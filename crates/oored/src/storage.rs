use std::time::Duration;

use aws_config::BehaviorVersion;
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::presigning::PresigningConfig;
use tracing::info;

// ── Configuration ───────────────────────────────────────────────

/// S3-compatible storage configuration read from environment variables.
#[derive(Debug, Clone)]
pub struct StorageConfig {
    pub endpoint: Option<String>,
    pub bucket: String,
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
}

impl StorageConfig {
    /// Read storage configuration from environment variables.
    ///
    /// Required: `OORE_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
    /// Optional: `OORE_S3_ENDPOINT` (for MinIO/custom), `OORE_S3_REGION` (default: "us-east-1").
    pub fn from_env() -> Result<Self, anyhow::Error> {
        let bucket = std::env::var("OORE_S3_BUCKET")
            .map_err(|_| anyhow::anyhow!("OORE_S3_BUCKET not set"))?;
        let access_key_id = std::env::var("AWS_ACCESS_KEY_ID")
            .map_err(|_| anyhow::anyhow!("AWS_ACCESS_KEY_ID not set"))?;
        let secret_access_key = std::env::var("AWS_SECRET_ACCESS_KEY")
            .map_err(|_| anyhow::anyhow!("AWS_SECRET_ACCESS_KEY not set"))?;

        let endpoint = std::env::var("OORE_S3_ENDPOINT").ok();
        let region = std::env::var("OORE_S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());

        Ok(Self {
            endpoint,
            bucket,
            region,
            access_key_id,
            secret_access_key,
        })
    }
}

// ── Storage client ──────────────────────────────────────────────

/// S3-compatible storage client for artifact uploads and downloads.
pub struct StorageClient {
    client: aws_sdk_s3::Client,
    bucket: String,
}

impl StorageClient {
    /// Create a new storage client from the given configuration.
    pub fn new(config: StorageConfig) -> Self {
        let credentials =
            Credentials::new(&config.access_key_id, &config.secret_access_key, None, None, "oore");

        let mut s3_config_builder = aws_sdk_s3::config::Builder::new()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new(config.region))
            .credentials_provider(credentials)
            .force_path_style(true);

        if let Some(ref endpoint) = config.endpoint {
            s3_config_builder = s3_config_builder.endpoint_url(endpoint);
        }

        let s3_config = s3_config_builder.build();
        let client = aws_sdk_s3::Client::from_conf(s3_config);

        info!(bucket = %config.bucket, endpoint = ?config.endpoint, "S3 storage client initialized");

        Self {
            client,
            bucket: config.bucket,
        }
    }

    /// Generate a pre-signed PUT URL for uploading an artifact.
    pub async fn generate_upload_url(
        &self,
        key: &str,
        ttl_secs: u64,
    ) -> Result<String, anyhow::Error> {
        let presigning_config = PresigningConfig::builder()
            .expires_in(Duration::from_secs(ttl_secs))
            .build()?;

        let presigned = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .presigned(presigning_config)
            .await?;

        Ok(presigned.uri().to_string())
    }

    /// Generate a pre-signed GET URL for downloading an artifact.
    pub async fn generate_download_url(
        &self,
        key: &str,
        ttl_secs: u64,
    ) -> Result<String, anyhow::Error> {
        let presigning_config = PresigningConfig::builder()
            .expires_in(Duration::from_secs(ttl_secs))
            .build()?;

        let presigned = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .presigned(presigning_config)
            .await?;

        Ok(presigned.uri().to_string())
    }
}
