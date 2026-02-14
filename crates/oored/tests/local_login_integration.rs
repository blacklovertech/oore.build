// Local login integration tests — exercises local auth behavior end-to-end.
// Run with: cargo test -p oored --features test-support --test local_login_integration
#![cfg(feature = "test-support")]

mod common;

use axum::body::Body;
use hyper::Request;
use serde_json::json;
use tower::ServiceExt;

#[tokio::test]
async fn test_local_login_auto_bootstraps_local_instance() {
    let tmp = tempfile::TempDir::new().expect("tempdir");
    let db_path = tmp.path().join("test.db");
    let app = common::create_test_app(&db_path).await;
    let pool = common::connect_pool(&db_path).await;

    let status_before = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/v1/public/setup-status")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("status before");
    assert_eq!(status_before.status(), 200);
    let status_before_body = common::body_json(status_before.into_body()).await;
    assert_eq!(status_before_body["setup_mode"], true);
    assert_eq!(status_before_body["runtime_mode"], "local");

    let login_resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/auth/local/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({})).expect("serialize request"),
                ))
                .unwrap(),
        )
        .await
        .expect("local login");
    assert_eq!(login_resp.status(), 200);
    let login_body = common::body_json(login_resp.into_body()).await;
    assert!(login_body["session_token"].as_str().is_some());
    assert_eq!(login_body["user"]["email"], "owner@local");
    assert_eq!(login_body["user"]["role"], "owner");

    let status_after = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/v1/public/setup-status")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("status after");
    assert_eq!(status_after.status(), 200);
    let status_after_body = common::body_json(status_after.into_body()).await;
    assert_eq!(status_after_body["setup_mode"], false);
    assert_eq!(status_after_body["is_configured"], true);
    assert_eq!(status_after_body["state"], "ready");

    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE role = 'owner'")
        .fetch_one(&pool)
        .await
        .expect("owner count");
    assert_eq!(user_count, 1);
}

#[tokio::test]
async fn test_local_login_rejected_when_runtime_mode_remote() {
    let tmp = tempfile::TempDir::new().expect("tempdir");
    let db_path = tmp.path().join("test.db");
    let app = common::create_test_app(&db_path).await;
    let pool = common::connect_pool(&db_path).await;
    common::set_runtime_mode(&pool, "remote").await;

    let login_resp = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/v1/auth/local/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({})).expect("serialize request"),
                ))
                .unwrap(),
        )
        .await
        .expect("local login");
    assert_eq!(login_resp.status(), 403);
    let body = common::body_json(login_resp.into_body()).await;
    assert_eq!(body["code"], "mode_restricted");
}
