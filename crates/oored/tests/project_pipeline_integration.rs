// Integration tests for project and pipeline CRUD endpoints.
// Run with: cargo test -p oored --features test-support
#![cfg(feature = "test-support")]

mod common;

use axum::body::Body;
use axum::http::{self, Request, StatusCode};
use common::{
    body_json, connect_pool, create_test_app, seed_github_integration, seed_project_chain,
    seed_test_user,
};
use sqlx::Row;
use tower::ServiceExt;

// ── Helpers ──────────────────────────────────────────────────────

/// Create a session token for the test user.
async fn create_session_token(pool: &sqlx::SqlitePool, user_id: &str) -> String {
    let token = oored::token::generate_session_token();
    let hashed = oored::token::hash_token(&token);
    let now = common::now_unix();
    let expires_at = now + 86400;

    sqlx::query(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(&hashed)
    .bind(user_id)
    .bind(now)
    .bind(expires_at)
    .execute(pool)
    .await
    .expect("failed to create test session");

    token
}

/// Helper to send a JSON request and return (status, body_json).
async fn json_request(
    app: &axum::Router,
    method: &str,
    uri: &str,
    token: &str,
    body: Option<serde_json::Value>,
) -> (StatusCode, serde_json::Value) {
    let mut builder = Request::builder()
        .uri(uri)
        .method(method)
        .header(http::header::AUTHORIZATION, format!("Bearer {token}"));

    let req_body = if let Some(json) = body {
        builder = builder.header(http::header::CONTENT_TYPE, "application/json");
        Body::from(serde_json::to_string(&json).unwrap())
    } else {
        Body::empty()
    };

    let req = builder.body(req_body).unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let json = body_json(resp.into_body()).await;
    (status, json)
}

// ── Project CRUD Tests ──────────────────────────────────────────

#[tokio::test]
async fn test_create_and_list_projects() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    // Create a project
    let (status, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({
            "name": "Test Project",
            "description": "A test project",
            "default_branch": "main"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "create project: {json}");
    let project_id = json["project"]["id"].as_str().unwrap().to_string();
    assert_eq!(json["project"]["name"].as_str().unwrap(), "Test Project");
    assert_eq!(
        json["project"]["description"].as_str().unwrap(),
        "A test project"
    );
    assert_eq!(json["project"]["default_branch"].as_str().unwrap(), "main");

    // List projects
    let (status, json) = json_request(&app, "GET", "/v1/projects", &token, None).await;

    assert_eq!(status, StatusCode::OK, "list projects: {json}");
    let projects = json["projects"].as_array().unwrap();
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0]["id"].as_str().unwrap(), project_id);

    // List with search
    let (status, json) = json_request(&app, "GET", "/v1/projects?search=Test", &token, None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["projects"].as_array().unwrap().len(), 1);

    // Search miss
    let (status, json) =
        json_request(&app, "GET", "/v1/projects?search=Nonexistent", &token, None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(json["projects"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn test_get_project() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    // Create a project
    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Detail Project" })),
    )
    .await;

    let project_id = json["project"]["id"].as_str().unwrap();

    // Get by ID
    let (status, json) = json_request(
        &app,
        "GET",
        &format!("/v1/projects/{project_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK, "get project: {json}");
    assert_eq!(json["project"]["name"].as_str().unwrap(), "Detail Project");

    // Get nonexistent
    let (status, _) = json_request(&app, "GET", "/v1/projects/nonexistent-id", &token, None).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_update_project() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    // Create
    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Original Name" })),
    )
    .await;

    let project_id = json["project"]["id"].as_str().unwrap();

    // Update name
    let (status, json) = json_request(
        &app,
        "PATCH",
        &format!("/v1/projects/{project_id}"),
        &token,
        Some(serde_json::json!({
            "name": "Updated Name",
            "description": "Now with description"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "update project: {json}");
    assert_eq!(json["project"]["name"].as_str().unwrap(), "Updated Name");
    assert_eq!(
        json["project"]["description"].as_str().unwrap(),
        "Now with description"
    );
}

#[tokio::test]
async fn test_delete_project() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    // Create
    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Delete Me" })),
    )
    .await;

    let project_id = json["project"]["id"].as_str().unwrap().to_string();

    // Delete
    let (status, _) = json_request(
        &app,
        "DELETE",
        &format!("/v1/projects/{project_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);

    // Verify gone
    let (status, _) = json_request(
        &app,
        "GET",
        &format!("/v1/projects/{project_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_project_with_terminal_builds() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;
    let integration_id = seed_github_integration(&pool, &user_id, "secret").await;
    let (project_id, pipeline_id) =
        seed_project_chain(&pool, &integration_id, &user_id, "org/repo-del-proj").await;

    // Seed a terminal build
    let build_id = uuid::Uuid::new_v4().to_string();
    let now = common::now_unix();
    sqlx::query(
        "INSERT INTO builds (id, project_id, pipeline_id, build_number, status, \
         trigger_type, config_snapshot, queued_at, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 1, 'succeeded', 'manual', '{}', ?4, ?4, ?4)",
    )
    .bind(&build_id)
    .bind(&project_id)
    .bind(&pipeline_id)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    // Delete should succeed — terminal builds are cleaned up
    let (status, json) = json_request(
        &app,
        "DELETE",
        &format!("/v1/projects/{project_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(
        status,
        StatusCode::OK,
        "delete project with terminal builds should succeed: {json}"
    );

    // Build should also be gone
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM builds WHERE id = ?1")
        .bind(&build_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0, "terminal build should be deleted");
}

#[tokio::test]
async fn test_delete_project_blocked_by_active_builds() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;
    let integration_id = seed_github_integration(&pool, &user_id, "secret").await;
    let (project_id, pipeline_id) =
        seed_project_chain(&pool, &integration_id, &user_id, "org/repo-active").await;

    // Seed an active build (queued)
    let build_id = uuid::Uuid::new_v4().to_string();
    let now = common::now_unix();
    sqlx::query(
        "INSERT INTO builds (id, project_id, pipeline_id, build_number, status, \
         trigger_type, config_snapshot, queued_at, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 1, 'queued', 'manual', '{}', ?4, ?4, ?4)",
    )
    .bind(&build_id)
    .bind(&project_id)
    .bind(&pipeline_id)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    // Delete should be rejected
    let (status, json) = json_request(
        &app,
        "DELETE",
        &format!("/v1/projects/{project_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT, "should block delete: {json}");
    assert_eq!(json["code"].as_str().unwrap(), "active_builds");
}

#[tokio::test]
async fn test_create_project_empty_name() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    let (status, _) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "  " })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
}

// ── Pipeline CRUD Tests ─────────────────────────────────────────

#[tokio::test]
async fn test_create_and_list_pipelines() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    // Create a project first
    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Pipeline Test Project" })),
    )
    .await;

    let project_id = json["project"]["id"].as_str().unwrap();

    // Create a pipeline
    let (status, json) = json_request(
        &app,
        "POST",
        &format!("/v1/projects/{project_id}/pipelines"),
        &token,
        Some(serde_json::json!({
            "name": "Build & Test",
            "config_path": ".oore.yml",
            "trigger_config": {
                "events": ["push", "pull_request"],
                "branches": ["main", "develop"]
            },
            "concurrency": {
                "cancel_previous": true,
                "max_concurrent": 3
            }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "create pipeline: {json}");
    let pipeline_id = json["pipeline"]["id"].as_str().unwrap().to_string();
    assert_eq!(json["pipeline"]["name"].as_str().unwrap(), "Build & Test");
    assert_eq!(
        json["pipeline"]["config_path"].as_str().unwrap(),
        ".oore.yml"
    );
    assert_eq!(
        json["pipeline"]["config_path_explicit"].as_bool(),
        Some(false)
    );
    assert_eq!(
        json["pipeline"]["execution_config"]["platforms"][0].as_str(),
        Some("android")
    );
    assert!(json["pipeline"]["enabled"].as_bool().unwrap());

    // List pipelines for project
    let (status, json) = json_request(
        &app,
        "GET",
        &format!("/v1/projects/{project_id}/pipelines"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK, "list pipelines: {json}");
    let pipelines = json["pipelines"].as_array().unwrap();
    assert_eq!(pipelines.len(), 1);
    assert_eq!(pipelines[0]["id"].as_str().unwrap(), pipeline_id);
}

#[tokio::test]
async fn test_get_pipeline() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    // Create project + pipeline
    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Get Pipeline Project" })),
    )
    .await;
    let project_id = json["project"]["id"].as_str().unwrap();

    let (_, json) = json_request(
        &app,
        "POST",
        &format!("/v1/projects/{project_id}/pipelines"),
        &token,
        Some(serde_json::json!({ "name": "Detail Pipeline" })),
    )
    .await;
    let pipeline_id = json["pipeline"]["id"].as_str().unwrap();

    // Get by ID
    let (status, json) = json_request(
        &app,
        "GET",
        &format!("/v1/pipelines/{pipeline_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK, "get pipeline: {json}");
    assert_eq!(
        json["pipeline"]["name"].as_str().unwrap(),
        "Detail Pipeline"
    );

    // Nonexistent
    let (status, _) = json_request(&app, "GET", "/v1/pipelines/nonexistent-id", &token, None).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_update_pipeline() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    // Create project + pipeline
    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Update Pipeline Project" })),
    )
    .await;
    let project_id = json["project"]["id"].as_str().unwrap();

    let (_, json) = json_request(
        &app,
        "POST",
        &format!("/v1/projects/{project_id}/pipelines"),
        &token,
        Some(serde_json::json!({ "name": "Original Pipeline" })),
    )
    .await;
    let pipeline_id = json["pipeline"]["id"].as_str().unwrap();

    // Update
    let (status, json) = json_request(
        &app,
        "PATCH",
        &format!("/v1/pipelines/{pipeline_id}"),
        &token,
        Some(serde_json::json!({
            "name": "Renamed Pipeline",
            "enabled": false
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "update pipeline: {json}");
    assert_eq!(
        json["pipeline"]["name"].as_str().unwrap(),
        "Renamed Pipeline"
    );
    assert!(!json["pipeline"]["enabled"].as_bool().unwrap());
}

#[tokio::test]
async fn test_delete_pipeline() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    // Create project + pipeline
    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Delete Pipeline Project" })),
    )
    .await;
    let project_id = json["project"]["id"].as_str().unwrap();

    let (_, json) = json_request(
        &app,
        "POST",
        &format!("/v1/projects/{project_id}/pipelines"),
        &token,
        Some(serde_json::json!({ "name": "Doomed Pipeline" })),
    )
    .await;
    let pipeline_id = json["pipeline"]["id"].as_str().unwrap().to_string();

    // Delete
    let (status, _) = json_request(
        &app,
        "DELETE",
        &format!("/v1/pipelines/{pipeline_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);

    // Verify gone
    let (status, _) = json_request(
        &app,
        "GET",
        &format!("/v1/pipelines/{pipeline_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_pipeline_with_terminal_builds() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;
    let integration_id = seed_github_integration(&pool, &user_id, "secret").await;
    let (project_id, pipeline_id) =
        seed_project_chain(&pool, &integration_id, &user_id, "org/repo-del-pipe").await;

    // Seed a terminal build
    let build_id = uuid::Uuid::new_v4().to_string();
    let now = common::now_unix();
    sqlx::query(
        "INSERT INTO builds (id, project_id, pipeline_id, build_number, status, \
         trigger_type, config_snapshot, queued_at, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 1, 'failed', 'manual', '{}', ?4, ?4, ?4)",
    )
    .bind(&build_id)
    .bind(&project_id)
    .bind(&pipeline_id)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    // Delete should succeed
    let (status, json) = json_request(
        &app,
        "DELETE",
        &format!("/v1/pipelines/{pipeline_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(
        status,
        StatusCode::OK,
        "delete pipeline with terminal builds: {json}"
    );

    // Build should also be gone
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM builds WHERE id = ?1")
        .bind(&build_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0, "terminal build should be deleted");
}

#[tokio::test]
async fn test_delete_pipeline_blocked_by_active_builds() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;
    let integration_id = seed_github_integration(&pool, &user_id, "secret").await;
    let (project_id, pipeline_id) =
        seed_project_chain(&pool, &integration_id, &user_id, "org/repo-pipe-active").await;

    // Seed an active build
    let build_id = uuid::Uuid::new_v4().to_string();
    let now = common::now_unix();
    sqlx::query(
        "INSERT INTO builds (id, project_id, pipeline_id, build_number, status, \
         trigger_type, config_snapshot, queued_at, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 1, 'running', 'manual', '{}', ?4, ?4, ?4)",
    )
    .bind(&build_id)
    .bind(&project_id)
    .bind(&pipeline_id)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    // Delete should fail
    let (status, json) = json_request(
        &app,
        "DELETE",
        &format!("/v1/pipelines/{pipeline_id}"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT, "should block delete: {json}");
    assert_eq!(json["code"].as_str().unwrap(), "active_builds");
}

// ── Pipeline Validation Tests ───────────────────────────────────

#[tokio::test]
async fn test_validate_pipeline_valid() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    let (status, json) = json_request(
        &app,
        "POST",
        "/v1/pipelines/validate",
        &token,
        Some(serde_json::json!({
            "name": "Valid Pipeline",
            "config_path": ".oore.yml",
            "trigger_config": {
                "events": ["push"],
                "branches": ["main"]
            },
            "concurrency": {
                "cancel_previous": false,
                "max_concurrent": 5
            }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "validate: {json}");
    assert!(json["valid"].as_bool().unwrap());
}

#[tokio::test]
async fn test_validate_pipeline_invalid_event() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    let (status, json) = json_request(
        &app,
        "POST",
        "/v1/pipelines/validate",
        &token,
        Some(serde_json::json!({
            "name": "Bad Pipeline",
            "config_path": ".oore.yml",
            "trigger_config": {
                "events": ["push", "invalid_event"],
                "branches": []
            },
            "concurrency": {
                "cancel_previous": false
            }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "validate invalid: {json}");
    assert!(!json["valid"].as_bool().unwrap());
    let errors = json["errors"].as_array().unwrap();
    assert!(!errors.is_empty());
}

#[tokio::test]
async fn test_validate_pipeline_invalid_concurrency() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    let (status, json) = json_request(
        &app,
        "POST",
        "/v1/pipelines/validate",
        &token,
        Some(serde_json::json!({
            "name": "Bad Concurrency",
            "config_path": ".oore.yml",
            "trigger_config": { "events": [], "branches": [] },
            "concurrency": {
                "cancel_previous": false,
                "max_concurrent": 200
            }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "validate concurrency: {json}");
    assert!(!json["valid"].as_bool().unwrap());
}

// ── Pipeline Create Validation Tests ────────────────────────────

#[tokio::test]
async fn test_create_pipeline_for_nonexistent_project() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    let (status, _) = json_request(
        &app,
        "POST",
        "/v1/projects/nonexistent-id/pipelines",
        &token,
        Some(serde_json::json!({ "name": "Orphan Pipeline" })),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_create_pipeline_with_invalid_trigger() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    // Create project
    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Trigger Test Project" })),
    )
    .await;
    let project_id = json["project"]["id"].as_str().unwrap();

    // Create pipeline with invalid trigger event
    let (status, json) = json_request(
        &app,
        "POST",
        &format!("/v1/projects/{project_id}/pipelines"),
        &token,
        Some(serde_json::json!({
            "name": "Bad Trigger Pipeline",
            "trigger_config": {
                "events": ["invalid_event"],
                "branches": []
            }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST, "invalid trigger: {json}");
}

#[tokio::test]
async fn test_create_pipeline_with_execution_config_and_explicit_path() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Execution Config Project" })),
    )
    .await;
    let project_id = json["project"]["id"].as_str().unwrap();

    let (status, json) = json_request(
        &app,
        "POST",
        &format!("/v1/projects/{project_id}/pipelines"),
        &token,
        Some(serde_json::json!({
            "name": "Flutter Release",
            "config_path": "ci/mobile.yaml",
            "config_path_explicit": true,
            "execution_config": {
                "platforms": ["android", "ios"],
                "commands": {
                    "pre_build": ["echo pre"],
                    "build": ["echo custom-build"],
                    "post_build": ["echo post"]
                },
                "artifact_patterns": ["*.apk", "*.ipa"]
            }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "create pipeline: {json}");
    assert_eq!(
        json["pipeline"]["config_path"].as_str(),
        Some("ci/mobile.yaml")
    );
    assert_eq!(
        json["pipeline"]["config_path_explicit"].as_bool(),
        Some(true)
    );
    assert_eq!(
        json["pipeline"]["execution_config"]["platforms"]
            .as_array()
            .map(|v| v.len()),
        Some(2)
    );
}

#[tokio::test]
async fn test_validate_pipeline_rejects_invalid_execution_config() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    let (status, json) = json_request(
        &app,
        "POST",
        "/v1/pipelines/validate",
        &token,
        Some(serde_json::json!({
            "config_path_explicit": true,
            "execution_config": {
                "platforms": [],
                "flutter_version": "   ",
                "commands": {
                    "pre_build": [],
                    "build": [""],
                    "post_build": []
                },
                "platform_build_args": {
                    "android": ["--build-number=1"],
                    "ios": [],
                    "macos": []
                },
                "platform_commands": {},
                "env": [
                    { "key": "BAD-KEY", "value": "x" }
                ],
                "artifact_patterns": ["not-a-glob"]
            }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "validate: {json}");
    assert_eq!(json["valid"].as_bool(), Some(false));
    let errors = json["errors"].as_array().expect("errors");
    assert!(errors.len() >= 3);
    assert!(
        errors
            .iter()
            .filter_map(|v| v.as_str())
            .any(|msg| msg.contains("execution_config.flutter_version")),
        "expected flutter_version validation error"
    );
}

#[tokio::test]
async fn test_pipeline_android_signing_crud() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let token = create_session_token(&pool, &user_id).await;

    let (_, json) = json_request(
        &app,
        "POST",
        "/v1/projects",
        &token,
        Some(serde_json::json!({ "name": "Signing Project" })),
    )
    .await;
    let project_id = json["project"]["id"].as_str().unwrap();

    let (_, json) = json_request(
        &app,
        "POST",
        &format!("/v1/projects/{project_id}/pipelines"),
        &token,
        Some(serde_json::json!({ "name": "Signing Pipeline" })),
    )
    .await;
    let pipeline_id = json["pipeline"]["id"].as_str().unwrap().to_string();

    let (status, json) = json_request(
        &app,
        "PUT",
        &format!("/v1/pipelines/{pipeline_id}/android-signing"),
        &token,
        Some(serde_json::json!({
            "release": {
                "enabled": true,
                "keystore_filename": "release-upload.jks",
                "keystore_base64": "ZmFrZS1rZXlzdG9yZS1ieXRlcw==",
                "store_password": "store-pass",
                "key_alias": "releaseAlias",
                "key_password": "key-pass"
            }
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "put signing profile: {json}");
    assert_eq!(json["release"]["enabled"].as_bool(), Some(true));
    assert_eq!(json["release"]["has_keystore"].as_bool(), Some(true));
    assert_eq!(
        json["release"]["keystore_filename"].as_str(),
        Some("release-upload.jks")
    );
    assert_eq!(json["release"]["key_alias"].as_str(), Some("releaseAlias"));
    assert_eq!(json["debug"]["enabled"].as_bool(), Some(false));

    let (status, json) = json_request(
        &app,
        "GET",
        &format!("/v1/pipelines/{pipeline_id}/android-signing"),
        &token,
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK, "get signing profile: {json}");
    assert_eq!(json["release"]["enabled"].as_bool(), Some(true));

    let row = sqlx::query(
        "SELECT keystore_encrypted, store_password_encrypted, key_alias_encrypted, key_password_encrypted \
         FROM pipeline_android_signing_profiles WHERE pipeline_id = ?1 AND build_type = 'release'",
    )
    .bind(&pipeline_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    let encrypted_keystore: String = row.get("keystore_encrypted");
    let encrypted_store_password: String = row.get("store_password_encrypted");
    let encrypted_alias: String = row.get("key_alias_encrypted");
    let encrypted_key_password: String = row.get("key_password_encrypted");
    assert_ne!(encrypted_keystore, "ZmFrZS1rZXlzdG9yZS1ieXRlcw==");
    assert_ne!(encrypted_store_password, "store-pass");
    assert_ne!(encrypted_alias, "releaseAlias");
    assert_ne!(encrypted_key_password, "key-pass");
}

#[tokio::test]
async fn test_runner_fetches_pipeline_android_signing_for_assigned_job() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let app = create_test_app(&db_path).await;
    let pool = connect_pool(&db_path).await;
    let user_id = seed_test_user(&pool).await;
    let integration_id = seed_github_integration(&pool, &user_id, "secret").await;
    let (project_id, pipeline_id) =
        seed_project_chain(&pool, &integration_id, &user_id, "org/repo-signing").await;

    let now = common::now_unix();
    let runner_id = uuid::Uuid::new_v4().to_string();
    let runner_token = oored::token::generate_token();
    let runner_token_hash = oored::token::hash_token(&runner_token);
    sqlx::query(
        "INSERT INTO runners (id, name, token_hash, status, capabilities, registered_by, created_at, updated_at) \
         VALUES (?1, 'runner-signing', ?2, 'busy', '{}', ?3, ?4, ?4)",
    )
    .bind(&runner_id)
    .bind(&runner_token_hash)
    .bind(&user_id)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    let release_keystore = oored::crypto::encrypt("ZmFrZS1ieXRlcw==", &common::TEST_ENCRYPTION_KEY)
        .unwrap();
    let release_store_password =
        oored::crypto::encrypt("store-pass", &common::TEST_ENCRYPTION_KEY).unwrap();
    let release_alias =
        oored::crypto::encrypt("releaseAlias", &common::TEST_ENCRYPTION_KEY).unwrap();
    let release_key_password =
        oored::crypto::encrypt("key-pass", &common::TEST_ENCRYPTION_KEY).unwrap();
    sqlx::query(
        "INSERT INTO pipeline_android_signing_profiles (
            id, pipeline_id, build_type, enabled,
            keystore_filename, keystore_encrypted, keystore_checksum,
            store_password_encrypted, key_alias_encrypted, key_password_encrypted,
            created_by, updated_by, created_at, updated_at
         ) VALUES (?1, ?2, 'release', 1, 'release.jks', ?3, 'checksum', ?4, ?5, ?6, ?7, ?7, ?8, ?8)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&pipeline_id)
    .bind(&release_keystore)
    .bind(&release_store_password)
    .bind(&release_alias)
    .bind(&release_key_password)
    .bind(&user_id)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    let build_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO builds (id, project_id, pipeline_id, build_number, status, trigger_type, config_snapshot, runner_id, queued_at, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 1, 'assigned', 'manual', '{}', ?4, ?5, ?5, ?5)",
    )
    .bind(&build_id)
    .bind(&project_id)
    .bind(&pipeline_id)
    .bind(&runner_id)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    let req = Request::builder()
        .uri(format!(
            "/v1/runners/{runner_id}/jobs/{build_id}/android-signing"
        ))
        .method("GET")
        .header(http::header::AUTHORIZATION, format!("Bearer {runner_token}"))
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let json = body_json(resp.into_body()).await;

    assert_eq!(status, StatusCode::OK, "runner signing lookup: {json}");
    assert_eq!(
        json["release"]["keystore_filename"].as_str(),
        Some("release.jks")
    );
    assert_eq!(
        json["release"]["keystore_base64"].as_str(),
        Some("ZmFrZS1ieXRlcw==")
    );
    assert_eq!(json["release"]["store_password"].as_str(), Some("store-pass"));
    assert_eq!(json["release"]["key_alias"].as_str(), Some("releaseAlias"));
    assert_eq!(json["release"]["key_password"].as_str(), Some("key-pass"));
}
