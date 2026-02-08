use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use oore_contract::{
    ApiError, Artifact, ArtifactDownloadLinkResponse, CreateArtifactRequest,
    CreateArtifactResponse, ListArtifactsResponse,
};
use sqlx::Row;
use tracing::{error, info};
use uuid::Uuid;

use crate::extractors::AuthUser;
use crate::rbac::check_permission;
use crate::runners::RunnerAuth;
use crate::store::write_audit_log;
use crate::util::{api_err, now_unix};
use crate::AppState;

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

/// Upload URL TTL: 30 minutes for uploads.
const UPLOAD_URL_TTL_SECS: u64 = 30 * 60;

/// Download URL TTL: 15 minutes for downloads.
const DOWNLOAD_URL_TTL_SECS: u64 = 15 * 60;

/// Valid artifact types.
const VALID_ARTIFACT_TYPES: &[&str] = &["apk", "ipa", "app", "generic"];

// ── Row conversion ──────────────────────────────────────────────

fn row_to_artifact(row: &sqlx::sqlite::SqliteRow) -> Artifact {
    let metadata_str: String = row.get("metadata");
    let metadata: serde_json::Value =
        serde_json::from_str(&metadata_str).unwrap_or_default();

    Artifact {
        id: row.get("id"),
        build_id: row.get("build_id"),
        name: row.get("name"),
        artifact_type: row.get("artifact_type"),
        file_path: row.get("file_path"),
        file_size: row.get("file_size"),
        checksum: row.get("checksum"),
        metadata,
        created_at: row.get("created_at"),
    }
}

// ── Handlers ────────────────────────────────────────────────────

/// `POST /v1/runners/{runner_id}/jobs/{job_id}/artifacts` — runner uploads an artifact.
pub async fn create_artifact(
    State(state): State<Arc<AppState>>,
    Path((runner_id, job_id)): Path<(String, String)>,
    runner_auth: RunnerAuth,
    Json(req): Json<CreateArtifactRequest>,
) -> ApiResult<CreateArtifactResponse> {
    // Prevent cross-runner access
    if runner_auth.runner_id != runner_id {
        return Err(api_err(
            StatusCode::FORBIDDEN,
            "runner_mismatch",
            "Runner token does not match the requested runner ID",
        ));
    }

    // Validate artifact_type
    if !VALID_ARTIFACT_TYPES.contains(&req.artifact_type.as_str()) {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_artifact_type",
            format!(
                "artifact_type must be one of: {}",
                VALID_ARTIFACT_TYPES.join(", ")
            ),
        ));
    }

    // Validate name length
    let name = req.name.trim();
    if name.is_empty() || name.len() > 255 {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_name",
            "Artifact name must be between 1 and 255 characters",
        ));
    }

    let store = state.store.lock().await;
    let pool = store.pool();

    // Verify build exists and is assigned to this runner
    let build_row = sqlx::query("SELECT id, runner_id FROM builds WHERE id = ?1")
        .bind(&job_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to fetch build");
            api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to fetch build")
        })?
        .ok_or_else(|| api_err(StatusCode::NOT_FOUND, "not_found", "Build not found"))?;

    let build_runner_id: Option<String> = build_row.get("runner_id");
    if build_runner_id.as_deref() != Some(&runner_id) {
        return Err(api_err(
            StatusCode::FORBIDDEN,
            "runner_mismatch",
            "This build is not assigned to your runner",
        ));
    }

    let build_id: String = build_row.get("id");
    let artifact_id = Uuid::new_v4().to_string();
    let now = now_unix();

    // S3 key format: artifacts/{build_id}/{artifact_id}/{name}
    let file_path = format!("artifacts/{build_id}/{artifact_id}/{name}");

    let metadata_str =
        serde_json::to_string(&req.metadata).unwrap_or_else(|_| "{}".to_string());

    // Generate upload URL first — if this fails we avoid leaving an orphan DB row
    let upload_url = match &state.storage {
        Some(storage) => {
            storage
                .generate_upload_url(&file_path, UPLOAD_URL_TTL_SECS)
                .await
                .map_err(|e| {
                    error!(error = %e, "failed to generate upload URL");
                    api_err(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "storage_error",
                        "Failed to generate upload URL",
                    )
                })?
        }
        None => String::new(),
    };

    // Insert artifact row only after URL generation succeeds
    sqlx::query(
        "INSERT INTO artifacts (id, build_id, name, artifact_type, file_path, file_size, checksum, metadata, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )
    .bind(&artifact_id)
    .bind(&build_id)
    .bind(name)
    .bind(&req.artifact_type)
    .bind(&file_path)
    .bind(req.file_size)
    .bind(&req.checksum)
    .bind(&metadata_str)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to insert artifact");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to create artifact")
    })?;

    info!(
        artifact_id = %artifact_id,
        build_id = %build_id,
        name = %name,
        artifact_type = %req.artifact_type,
        "artifact created"
    );

    let artifact = Artifact {
        id: artifact_id,
        build_id,
        name: name.to_string(),
        artifact_type: req.artifact_type,
        file_path,
        file_size: req.file_size,
        checksum: req.checksum,
        metadata: req.metadata,
        created_at: now,
    };

    Ok(Json(CreateArtifactResponse {
        artifact,
        upload_url,
    }))
}

/// `GET /v1/builds/{build_id}/artifacts` — list artifacts for a build.
pub async fn list_artifacts(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(build_id): Path<String>,
) -> ApiResult<ListArtifactsResponse> {
    check_permission(&state.enforcer, &auth.0.role, "builds", "read").await?;

    let store = state.store.lock().await;
    let pool = store.pool();

    let rows = sqlx::query(
        "SELECT * FROM artifacts WHERE build_id = ?1 ORDER BY created_at ASC",
    )
    .bind(&build_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to list artifacts");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to list artifacts")
    })?;

    let artifacts = rows.iter().map(row_to_artifact).collect();

    Ok(Json(ListArtifactsResponse { artifacts }))
}

/// `POST /v1/artifacts/{artifact_id}/download-link` — generate a download link.
pub async fn generate_download_link(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(artifact_id): Path<String>,
) -> ApiResult<ArtifactDownloadLinkResponse> {
    check_permission(&state.enforcer, &auth.0.role, "builds", "read").await?;

    let store = state.store.lock().await;
    let pool = store.pool();

    // Look up artifact
    let row = sqlx::query("SELECT * FROM artifacts WHERE id = ?1")
        .bind(&artifact_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to fetch artifact");
            api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to fetch artifact")
        })?
        .ok_or_else(|| api_err(StatusCode::NOT_FOUND, "not_found", "Artifact not found"))?;

    let file_path: String = row.get("file_path");

    let storage = state.storage.as_ref().ok_or_else(|| {
        api_err(
            StatusCode::SERVICE_UNAVAILABLE,
            "storage_not_configured",
            "S3 storage is not configured. Artifact downloads require S3-compatible storage.",
        )
    })?;

    let download_url = storage
        .generate_download_url(&file_path, DOWNLOAD_URL_TTL_SECS)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to generate download URL");
            api_err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Failed to generate download URL",
            )
        })?;

    let now = now_unix();
    let expires_at = now + DOWNLOAD_URL_TTL_SECS as i64;

    // Audit log the download link generation
    let details = serde_json::json!({
        "artifact_id": artifact_id,
        "file_path": file_path,
        "expires_at": expires_at,
    })
    .to_string();
    let _ = write_audit_log(
        pool,
        Some(&auth.0.user_id),
        "artifact_download_link_generated",
        "artifact",
        Some(&artifact_id),
        Some(&details),
    )
    .await;

    info!(
        artifact_id = %artifact_id,
        user = %auth.0.email,
        "download link generated"
    );

    Ok(Json(ArtifactDownloadLinkResponse {
        download_url,
        expires_at,
    }))
}
