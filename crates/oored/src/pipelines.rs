use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use oore_contract::{
    ApiError, ConcurrencyPolicy, CreatePipelineRequest, CreatePipelineResponse,
    ListPipelinesResponse, Pipeline, PipelineDetailResponse, TriggerConfig, UpdatePipelineRequest,
    ValidatePipelineRequest, ValidatePipelineResponse,
};
use serde::Deserialize;
use sqlx::Row;
use tracing::{error, info};
use uuid::Uuid;

use crate::extractors::AuthUser;
use crate::rbac::check_permission;
use crate::store::write_audit_log;
use crate::util::{api_err, now_unix};
use crate::AppState;

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

// ── Validation helpers ──────────────────────────────────────────

const VALID_EVENTS: &[&str] = &["push", "pull_request", "tag_push"];

fn validate_trigger_config(tc: &TriggerConfig) -> Vec<String> {
    let mut errors = Vec::new();

    for event in &tc.events {
        if !VALID_EVENTS.contains(&event.as_str()) {
            errors.push(format!(
                "Invalid event '{}'. Valid: push, pull_request, tag_push",
                event
            ));
        }
    }

    for (i, branch) in tc.branches.iter().enumerate() {
        if branch.is_empty() {
            errors.push(format!("Branch pattern at index {} is empty", i));
        }
    }

    errors
}

fn validate_concurrency(cp: &ConcurrencyPolicy) -> Vec<String> {
    let mut errors = Vec::new();

    if let Some(max) = cp.max_concurrent {
        if !(1..=100).contains(&max) {
            errors.push("max_concurrent must be between 1 and 100".to_string());
        }
    }

    errors
}

// ── Row conversion ──────────────────────────────────────────────

fn row_to_pipeline(row: &sqlx::sqlite::SqliteRow) -> Pipeline {
    let trigger_config_str: String = row.get("trigger_config");
    let trigger_config: TriggerConfig =
        serde_json::from_str(&trigger_config_str).unwrap_or_default();

    let concurrency_str: String = row.get("concurrency");
    let concurrency: ConcurrencyPolicy =
        serde_json::from_str(&concurrency_str).unwrap_or_default();

    let enabled_int: i32 = row.get("enabled");

    Pipeline {
        id: row.get("id"),
        project_id: row.get("project_id"),
        name: row.get("name"),
        config_path: row.get("config_path"),
        trigger_config,
        concurrency,
        enabled: enabled_int != 0,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

// ── Query parameters ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListPipelinesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ── Handlers ────────────────────────────────────────────────────

/// `POST /v1/projects/{project_id}/pipelines` — create a pipeline.
pub async fn create_pipeline(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(project_id): Path<String>,
    Json(req): Json<CreatePipelineRequest>,
) -> ApiResult<CreatePipelineResponse> {
    check_permission(&state.enforcer, &auth.0.role, "pipelines", "write").await?;

    let name = req.name.trim();
    if name.is_empty() {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "Pipeline name must not be empty",
        ));
    }

    let store = state.store.lock().await;
    let pool = store.pool();

    // Validate project exists
    let project_exists: bool =
        sqlx::query_scalar("SELECT COUNT(*) > 0 FROM projects WHERE id = ?1")
            .bind(&project_id)
            .fetch_one(pool)
            .await
            .unwrap_or(false);

    if !project_exists {
        return Err(api_err(StatusCode::NOT_FOUND, "not_found", "Project not found"));
    }

    // Validate trigger_config if provided
    let trigger_config = req.trigger_config.unwrap_or_default();
    let tc_errors = validate_trigger_config(&trigger_config);
    if !tc_errors.is_empty() {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_trigger_config",
            tc_errors.join("; "),
        ));
    }

    // Validate concurrency if provided
    let concurrency = req.concurrency.unwrap_or_default();
    let cp_errors = validate_concurrency(&concurrency);
    if !cp_errors.is_empty() {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_concurrency",
            cp_errors.join("; "),
        ));
    }

    let config_path = req.config_path.unwrap_or_else(|| ".oore.yml".to_string());
    let now = now_unix();
    let pipeline_id = Uuid::new_v4().to_string();

    let trigger_config_json = serde_json::to_string(&trigger_config).unwrap_or_default();
    let concurrency_json = serde_json::to_string(&concurrency).unwrap_or_default();

    sqlx::query(
        "INSERT INTO pipelines (id, project_id, name, config_path, trigger_config, concurrency, enabled, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)",
    )
    .bind(&pipeline_id)
    .bind(&project_id)
    .bind(name)
    .bind(&config_path)
    .bind(&trigger_config_json)
    .bind(&concurrency_json)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to create pipeline");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to create pipeline")
    })?;

    let details = serde_json::json!({
        "project_id": project_id,
        "pipeline_name": name,
        "created_by": auth.0.email,
    })
    .to_string();
    let _ = write_audit_log(
        pool,
        Some(&auth.0.user_id),
        "pipeline_created",
        "pipeline",
        Some(&pipeline_id),
        Some(&details),
    )
    .await;

    info!(pipeline_id = %pipeline_id, project_id = %project_id, name = %name, "pipeline created");

    let pipeline = Pipeline {
        id: pipeline_id,
        project_id,
        name: name.to_string(),
        config_path,
        trigger_config,
        concurrency,
        enabled: true,
        created_at: now,
        updated_at: now,
    };

    Ok(Json(CreatePipelineResponse { pipeline }))
}

/// `GET /v1/projects/{project_id}/pipelines` — list pipelines for a project.
pub async fn list_pipelines(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(project_id): Path<String>,
    Query(params): Query<ListPipelinesQuery>,
) -> ApiResult<ListPipelinesResponse> {
    check_permission(&state.enforcer, &auth.0.role, "pipelines", "read").await?;

    let store = state.store.lock().await;
    let pool = store.pool();

    // Validate project exists
    let project_exists: bool =
        sqlx::query_scalar("SELECT COUNT(*) > 0 FROM projects WHERE id = ?1")
            .bind(&project_id)
            .fetch_one(pool)
            .await
            .unwrap_or(false);

    if !project_exists {
        return Err(api_err(StatusCode::NOT_FOUND, "not_found", "Project not found"));
    }

    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM pipelines WHERE project_id = ?1")
            .bind(&project_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    let rows = sqlx::query(
        "SELECT * FROM pipelines WHERE project_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3",
    )
    .bind(&project_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to list pipelines");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to list pipelines")
    })?;

    let pipelines = rows.iter().map(row_to_pipeline).collect();

    Ok(Json(ListPipelinesResponse { pipelines, total }))
}

/// `GET /v1/pipelines/{pipeline_id}` — pipeline detail with build count.
pub async fn get_pipeline(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(pipeline_id): Path<String>,
) -> ApiResult<PipelineDetailResponse> {
    check_permission(&state.enforcer, &auth.0.role, "pipelines", "read").await?;

    let store = state.store.lock().await;
    let pool = store.pool();

    let pipeline_row = sqlx::query("SELECT * FROM pipelines WHERE id = ?1")
        .bind(&pipeline_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to fetch pipeline");
            api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to fetch pipeline")
        })?
        .ok_or_else(|| api_err(StatusCode::NOT_FOUND, "not_found", "Pipeline not found"))?;

    let pipeline = row_to_pipeline(&pipeline_row);

    let build_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM builds WHERE pipeline_id = ?1")
            .bind(&pipeline_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    Ok(Json(PipelineDetailResponse {
        pipeline,
        build_count,
    }))
}

/// `PATCH /v1/pipelines/{pipeline_id}` — partial update.
pub async fn update_pipeline(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(pipeline_id): Path<String>,
    Json(req): Json<UpdatePipelineRequest>,
) -> ApiResult<CreatePipelineResponse> {
    check_permission(&state.enforcer, &auth.0.role, "pipelines", "write").await?;

    let store = state.store.lock().await;
    let pool = store.pool();

    // Verify pipeline exists
    let exists: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM pipelines WHERE id = ?1")
        .bind(&pipeline_id)
        .fetch_one(pool)
        .await
        .unwrap_or(false);

    if !exists {
        return Err(api_err(StatusCode::NOT_FOUND, "not_found", "Pipeline not found"));
    }

    // Validate name if provided
    if let Some(ref name) = req.name {
        if name.trim().is_empty() {
            return Err(api_err(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "Pipeline name must not be empty",
            ));
        }
    }

    // Validate trigger_config if provided
    if let Some(ref tc) = req.trigger_config {
        let errors = validate_trigger_config(tc);
        if !errors.is_empty() {
            return Err(api_err(
                StatusCode::BAD_REQUEST,
                "invalid_trigger_config",
                errors.join("; "),
            ));
        }
    }

    // Validate concurrency if provided
    if let Some(ref cp) = req.concurrency {
        let errors = validate_concurrency(cp);
        if !errors.is_empty() {
            return Err(api_err(
                StatusCode::BAD_REQUEST,
                "invalid_concurrency",
                errors.join("; "),
            ));
        }
    }

    let now = now_unix();

    // Build dynamic SET clause
    let mut set_parts = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(ref name) = req.name {
        bind_values.push(name.trim().to_string());
        set_parts.push(format!("name = ?{}", bind_values.len()));
    }
    if let Some(ref config_path) = req.config_path {
        bind_values.push(config_path.clone());
        set_parts.push(format!("config_path = ?{}", bind_values.len()));
    }
    if let Some(ref tc) = req.trigger_config {
        bind_values.push(serde_json::to_string(tc).unwrap_or_default());
        set_parts.push(format!("trigger_config = ?{}", bind_values.len()));
    }
    if let Some(ref cp) = req.concurrency {
        bind_values.push(serde_json::to_string(cp).unwrap_or_default());
        set_parts.push(format!("concurrency = ?{}", bind_values.len()));
    }
    if let Some(enabled) = req.enabled {
        bind_values.push(if enabled { "1".to_string() } else { "0".to_string() });
        set_parts.push(format!("enabled = ?{}", bind_values.len()));
    }

    if set_parts.is_empty() {
        let row = sqlx::query("SELECT * FROM pipelines WHERE id = ?1")
            .bind(&pipeline_id)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                error!(error = %e, "failed to fetch pipeline");
                api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to fetch pipeline")
            })?;
        return Ok(Json(CreatePipelineResponse {
            pipeline: row_to_pipeline(&row),
        }));
    }

    bind_values.push(now.to_string());
    set_parts.push(format!("updated_at = ?{}", bind_values.len()));

    let query = format!(
        "UPDATE pipelines SET {} WHERE id = ?{}",
        set_parts.join(", "),
        bind_values.len() + 1
    );

    let mut q = sqlx::query(&query);
    for val in &bind_values {
        q = q.bind(val);
    }
    q = q.bind(&pipeline_id);

    q.execute(pool).await.map_err(|e| {
        error!(error = %e, "failed to update pipeline");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to update pipeline")
    })?;

    let details = serde_json::json!({
        "updated_by": auth.0.email,
    })
    .to_string();
    let _ = write_audit_log(
        pool,
        Some(&auth.0.user_id),
        "pipeline_updated",
        "pipeline",
        Some(&pipeline_id),
        Some(&details),
    )
    .await;

    info!(pipeline_id = %pipeline_id, "pipeline updated");

    let row = sqlx::query("SELECT * FROM pipelines WHERE id = ?1")
        .bind(&pipeline_id)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to reload pipeline");
            api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to reload pipeline")
        })?;

    Ok(Json(CreatePipelineResponse {
        pipeline: row_to_pipeline(&row),
    }))
}

/// `DELETE /v1/pipelines/{pipeline_id}` — delete a pipeline.
pub async fn delete_pipeline(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(pipeline_id): Path<String>,
) -> ApiResult<serde_json::Value> {
    check_permission(&state.enforcer, &auth.0.role, "pipelines", "delete").await?;

    let store = state.store.lock().await;
    let pool = store.pool();

    // Use a transaction so the active-build check, terminal-build cleanup,
    // and pipeline delete are atomic (prevents race with concurrent build creation).
    let mut tx = pool.begin().await.map_err(|e| {
        error!(error = %e, "failed to begin transaction");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to delete pipeline")
    })?;

    // Verify pipeline exists
    let exists: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM pipelines WHERE id = ?1")
        .bind(&pipeline_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(false);

    if !exists {
        return Err(api_err(StatusCode::NOT_FOUND, "not_found", "Pipeline not found"));
    }

    // Check for non-terminal builds
    let active_builds: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM builds WHERE pipeline_id = ?1 \
         AND status NOT IN ('succeeded', 'failed', 'canceled', 'timed_out', 'expired')",
    )
    .bind(&pipeline_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0);

    if active_builds > 0 {
        return Err(api_err(
            StatusCode::CONFLICT,
            "active_builds",
            "Cannot delete pipeline with active builds",
        ));
    }

    // Delete terminal builds first (non-cascading FK on builds.pipeline_id)
    sqlx::query(
        "DELETE FROM builds WHERE pipeline_id = ?1 \
         AND status IN ('succeeded', 'failed', 'canceled', 'timed_out', 'expired')",
    )
    .bind(&pipeline_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to clean up builds for pipeline");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to delete pipeline")
    })?;

    sqlx::query("DELETE FROM pipelines WHERE id = ?1")
        .bind(&pipeline_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to delete pipeline");
            api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to delete pipeline")
        })?;

    tx.commit().await.map_err(|e| {
        error!(error = %e, "failed to commit delete transaction");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to delete pipeline")
    })?;

    let details = serde_json::json!({
        "deleted_by": auth.0.email,
    })
    .to_string();
    let _ = write_audit_log(
        pool,
        Some(&auth.0.user_id),
        "pipeline_deleted",
        "pipeline",
        Some(&pipeline_id),
        Some(&details),
    )
    .await;

    info!(pipeline_id = %pipeline_id, "pipeline deleted");

    Ok(Json(serde_json::json!({"ok": true})))
}

/// `POST /v1/pipelines/validate` — dry-run validation of pipeline config.
pub async fn validate_pipeline(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<ValidatePipelineRequest>,
) -> ApiResult<ValidatePipelineResponse> {
    check_permission(&state.enforcer, &auth.0.role, "pipelines", "read").await?;

    let mut errors = Vec::new();

    if let Some(ref tc) = req.trigger_config {
        errors.extend(validate_trigger_config(tc));
    }

    if let Some(ref cp) = req.concurrency {
        errors.extend(validate_concurrency(cp));
    }

    let valid = errors.is_empty();

    Ok(Json(ValidatePipelineResponse { valid, errors }))
}
