use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use oore_contract::{ApiError, GitLabCompleteResponse, GitLabStartRequest, Integration};
use tracing::{error, info};
use uuid::Uuid;

use crate::crypto;
use crate::extractors::AuthUser;
use crate::rbac::check_permission;
use crate::store::write_audit_log;
use crate::util::{api_err, now_unix};
use crate::AppState;

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

/// `POST /v1/integrations/gitlab/start` — create GitLab integration (OAuth or token mode).
///
/// - **OAuth mode**: user provides client_id + client_secret from their GitLab application.
/// - **Token mode**: user provides a personal/group access token.
///
/// Both modes support gitlab.com and self-managed instances (host_url).
pub async fn gitlab_start(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<GitLabStartRequest>,
) -> ApiResult<GitLabCompleteResponse> {
    check_permission(&state.enforcer, &auth.0.role, "integrations", "write").await?;

    // Validate host URL
    let host_url = req.host_url.trim_end_matches('/').to_string();
    if host_url.is_empty() {
        return Err(api_err(StatusCode::BAD_REQUEST, "invalid_input", "host_url is required"));
    }
    if url::Url::parse(&host_url).is_err() {
        return Err(api_err(StatusCode::BAD_REQUEST, "invalid_input", "host_url is not a valid URL"));
    }

    let auth_mode = req.auth_mode.as_str();
    if !matches!(auth_mode, "oauth_app" | "personal_token") {
        return Err(api_err(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "auth_mode must be 'oauth_app' or 'personal_token'",
        ));
    }

    // Validate mode-specific fields
    match auth_mode {
        "oauth_app" => {
            if req.client_id.as_ref().map_or(true, |s| s.is_empty()) {
                return Err(api_err(StatusCode::BAD_REQUEST, "invalid_input", "client_id required for OAuth mode"));
            }
            if req.client_secret.as_ref().map_or(true, |s| s.is_empty()) {
                return Err(api_err(StatusCode::BAD_REQUEST, "invalid_input", "client_secret required for OAuth mode"));
            }
        }
        "personal_token" => {
            if req.access_token.as_ref().map_or(true, |s| s.is_empty()) {
                return Err(api_err(StatusCode::BAD_REQUEST, "invalid_input", "access_token required for token mode"));
            }
        }
        _ => unreachable!(),
    }

    // Validate token/credentials by calling GitLab API
    let client = reqwest::Client::new();
    let api_base = format!("{}/api/v4", host_url);

    let (display_name, username) = match auth_mode {
        "personal_token" => {
            let token = req.access_token.as_ref().unwrap();
            let resp = client
                .get(format!("{api_base}/user"))
                .header("PRIVATE-TOKEN", token.as_str())
                .header("User-Agent", "oore-ci")
                .send()
                .await
                .map_err(|e| {
                    error!(error = %e, "GitLab API request failed");
                    api_err(StatusCode::BAD_GATEWAY, "gitlab_api_error", "Failed to communicate with GitLab")
                })?;

            if !resp.status().is_success() {
                let status = resp.status();
                return Err(api_err(
                    StatusCode::BAD_REQUEST,
                    "gitlab_auth_failed",
                    format!("GitLab authentication failed ({status}). Check your access token."),
                ));
            }

            #[derive(serde::Deserialize)]
            struct GitLabUser {
                username: String,
                name: Option<String>,
            }

            let user: GitLabUser = resp.json().await.map_err(|e| {
                error!(error = %e, "failed to parse GitLab user response");
                api_err(StatusCode::BAD_GATEWAY, "gitlab_parse_error", "Failed to parse GitLab response")
            })?;

            let display = user.name.unwrap_or_else(|| user.username.clone());
            (display, user.username)
        }
        "oauth_app" => {
            // For OAuth mode, we don't have a token yet — we store the credentials
            // and the actual OAuth flow happens when the user authorizes.
            // For now, validate the host is reachable.
            let resp = client
                .get(format!("{api_base}/version"))
                .header("User-Agent", "oore-ci")
                .send()
                .await
                .map_err(|e| {
                    error!(error = %e, "GitLab API request failed");
                    api_err(StatusCode::BAD_GATEWAY, "gitlab_api_error", "Failed to communicate with GitLab")
                })?;

            if !resp.status().is_success() {
                return Err(api_err(
                    StatusCode::BAD_GATEWAY,
                    "gitlab_unreachable",
                    "GitLab instance is unreachable or returned an error",
                ));
            }

            #[derive(serde::Deserialize)]
            struct GitLabVersion {
                version: String,
            }

            let version: GitLabVersion = resp.json().await.map_err(|e| {
                error!(error = %e, "failed to parse GitLab version response");
                api_err(StatusCode::BAD_GATEWAY, "gitlab_parse_error", "Failed to parse GitLab response")
            })?;

            let display = format!("GitLab {}", version.version);
            (display, "oauth".to_string())
        }
        _ => unreachable!(),
    };

    let now = now_unix();
    let integration_id = Uuid::new_v4().to_string();
    let full_display_name = format!("{display_name} ({host_url})");

    let store = state.store.lock().await;
    let pool = store.pool();

    // Insert integration
    sqlx::query(
        "INSERT INTO integrations (id, provider, host_url, auth_mode, status, display_name, created_by, created_at, updated_at) \
         VALUES (?1, 'gitlab', ?2, ?3, 'active', ?4, ?5, ?6, ?6)",
    )
    .bind(&integration_id)
    .bind(&host_url)
    .bind(auth_mode)
    .bind(&full_display_name)
    .bind(&auth.0.user_id)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "failed to insert GitLab integration");
        api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to create integration")
    })?;

    // Store credentials
    match auth_mode {
        "personal_token" => {
            let token = req.access_token.as_ref().unwrap();
            let encrypted = crypto::encrypt(token, &state.encryption_key).map_err(|e| {
                error!(error = %e, "failed to encrypt access token");
                api_err(StatusCode::INTERNAL_SERVER_ERROR, "encryption_error", "Failed to encrypt credentials")
            })?;

            sqlx::query(
                "INSERT INTO integration_credentials (id, integration_id, credential_type, encrypted_value, created_at, updated_at) \
                 VALUES (?1, ?2, 'access_token', ?3, ?4, ?4)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&integration_id)
            .bind(&encrypted)
            .bind(now)
            .execute(pool)
            .await
            .map_err(|e| {
                error!(error = %e, "failed to store access token");
                api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to store credentials")
            })?;
        }
        "oauth_app" => {
            let client_id = req.client_id.as_ref().unwrap();
            let client_secret = req.client_secret.as_ref().unwrap();

            for (cred_type, value) in [("oauth_client_id", client_id), ("oauth_client_secret", client_secret)] {
                let encrypted = crypto::encrypt(value, &state.encryption_key).map_err(|e| {
                    error!(error = %e, credential_type = %cred_type, "failed to encrypt credential");
                    api_err(StatusCode::INTERNAL_SERVER_ERROR, "encryption_error", "Failed to encrypt credentials")
                })?;

                sqlx::query(
                    "INSERT INTO integration_credentials (id, integration_id, credential_type, encrypted_value, created_at, updated_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                )
                .bind(Uuid::new_v4().to_string())
                .bind(&integration_id)
                .bind(cred_type)
                .bind(&encrypted)
                .bind(now)
                .execute(pool)
                .await
                .map_err(|e| {
                    error!(error = %e, "failed to store credential");
                    api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to store credentials")
                })?;
            }
        }
        _ => unreachable!(),
    }

    // For personal token mode, create a default installation entry
    if auth_mode == "personal_token" {
        let inst_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO integration_installations (id, integration_id, external_id, account_name, account_type, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, 'user', ?5, ?5)",
        )
        .bind(&inst_id)
        .bind(&integration_id)
        .bind(&username)
        .bind(&username)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| {
            error!(error = %e, "failed to create default installation");
            api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to create installation")
        })?;

        // Fetch accessible projects via GitLab API
        let token = req.access_token.as_ref().unwrap();
        if let Err(e) = sync_gitlab_projects(&client, pool, &host_url, token, &inst_id, now).await {
            error!(error = ?e, "failed to sync GitLab projects (non-fatal)");
        }
    }

    let details = serde_json::json!({
        "provider": "gitlab",
        "host_url": host_url,
        "auth_mode": auth_mode,
        "display_name": full_display_name,
        "created_by": auth.0.email,
    })
    .to_string();
    let _ = write_audit_log(
        pool,
        Some(&auth.0.user_id),
        "integration_created",
        "integration",
        Some(&integration_id),
        Some(&details),
    )
    .await;

    info!(integration_id = %integration_id, host = %host_url, mode = %auth_mode, "GitLab integration created");

    let integration = Integration {
        id: integration_id,
        provider: "gitlab".to_string(),
        host_url,
        auth_mode: auth_mode.to_string(),
        status: "active".to_string(),
        display_name: Some(full_display_name),
        app_id: None,
        app_slug: None,
        created_by: auth.0.user_id,
        created_at: now,
        updated_at: now,
    };

    Ok(Json(GitLabCompleteResponse { integration }))
}

/// Sync accessible GitLab projects into integration_repositories.
async fn sync_gitlab_projects(
    client: &reqwest::Client,
    pool: &sqlx::SqlitePool,
    host_url: &str,
    token: &str,
    installation_id: &str,
    now: i64,
) -> Result<(), (StatusCode, Json<ApiError>)> {
    let api_base = format!("{}/api/v4", host_url);

    let resp = client
        .get(format!("{api_base}/projects?membership=true&per_page=100&simple=true"))
        .header("PRIVATE-TOKEN", token)
        .header("User-Agent", "oore-ci")
        .send()
        .await
        .map_err(|e| {
            error!(error = %e, "GitLab projects API failed");
            api_err(StatusCode::BAD_GATEWAY, "gitlab_api_error", "Failed to list GitLab projects")
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        return Err(api_err(
            StatusCode::BAD_GATEWAY,
            "gitlab_api_error",
            format!("GitLab returned {status}"),
        ));
    }

    #[derive(serde::Deserialize)]
    struct GitLabProject {
        id: i64,
        path_with_namespace: String,
        default_branch: Option<String>,
        visibility: Option<String>,
        web_url: Option<String>,
    }

    let projects: Vec<GitLabProject> = resp.json().await.map_err(|e| {
        error!(error = %e, "failed to parse GitLab projects");
        api_err(StatusCode::BAD_GATEWAY, "gitlab_parse_error", "Failed to parse GitLab response")
    })?;

    for project in &projects {
        let is_private = project.visibility.as_deref() != Some("public");

        sqlx::query(
            "INSERT INTO integration_repositories (id, installation_id, external_id, full_name, default_branch, is_private, html_url, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8) \
             ON CONFLICT(installation_id, external_id) DO UPDATE SET \
             full_name = excluded.full_name, default_branch = excluded.default_branch, \
             is_private = excluded.is_private, html_url = excluded.html_url, updated_at = excluded.updated_at",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(installation_id)
        .bind(project.id.to_string())
        .bind(&project.path_with_namespace)
        .bind(&project.default_branch)
        .bind(is_private as i32)
        .bind(&project.web_url)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| {
            error!(error = %e, project = %project.path_with_namespace, "failed to upsert GitLab project");
            api_err(StatusCode::INTERNAL_SERVER_ERROR, "store_error", "Failed to store project")
        })?;
    }

    info!(project_count = projects.len(), "GitLab projects synced");
    Ok(())
}
