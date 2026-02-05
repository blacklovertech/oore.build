use std::{env, net::SocketAddr};

use anyhow::Context;
use axum::{Json, Router, routing::get};
use clap::{Parser, Subcommand};
use oore_contract::{SetupState, SetupStatus};
use serde_json::json;
use tracing::info;

#[derive(Debug, Parser)]
#[command(name = "oored")]
#[command(about = "oore daemon")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    Run(RunArgs),
    InstallService,
    UninstallService,
    Version,
}

#[derive(Debug, clap::Args)]
struct RunArgs {
    #[arg(long, env = "OORED_LISTEN_ADDR", default_value = "127.0.0.1:8787")]
    listen: String,
}

fn setup_state_from_env() -> SetupState {
    match env::var("OORE_SETUP_STATE")
        .unwrap_or_else(|_| "bootstrap_pending".to_string())
        .as_str()
    {
        "uninitialized" => SetupState::Uninitialized,
        "bootstrap_pending" => SetupState::BootstrapPending,
        "idp_configured" => SetupState::IdpConfigured,
        "owner_created" => SetupState::OwnerCreated,
        "ready" => SetupState::Ready,
        _ => SetupState::BootstrapPending,
    }
}

async fn healthz() -> Json<serde_json::Value> {
    Json(json!({"ok": true}))
}

async fn setup_status() -> Json<SetupStatus> {
    let instance_id = env::var("OORE_INSTANCE_ID").unwrap_or_else(|_| "local-dev".to_string());
    let state = setup_state_from_env();
    Json(SetupStatus::from_state(instance_id, state))
}

async fn run_server(args: RunArgs) -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let addr: SocketAddr = args
        .listen
        .parse()
        .with_context(|| format!("invalid listen address: {}", args.listen))?;

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/public/setup-status", get(setup_status));

    info!(listen = %addr, "starting oored daemon");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .await
        .context("oored server failed")?;

    Ok(())
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Run(args) => {
            let runtime = tokio::runtime::Runtime::new()?;
            runtime.block_on(run_server(args))?;
        }
        Commands::InstallService => {
            println!("install-service placeholder (launchd integration pending)");
        }
        Commands::UninstallService => {
            println!("uninstall-service placeholder (launchd integration pending)");
        }
        Commands::Version => {
            println!("{}", env!("CARGO_PKG_VERSION"));
        }
    }

    Ok(())
}
