use std::time::Duration;

use anyhow::Context;
use clap::{Args, Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(name = "oore")]
#[command(about = "oore operator CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    Setup(SetupArgs),
    Login,
    Status,
    Runner(RunnerArgs),
    Config(ConfigArgs),
    Doctor,
}

#[derive(Debug, Args)]
struct SetupArgs {
    #[command(subcommand)]
    command: Option<SetupSubcommand>,
}

#[derive(Debug, Subcommand)]
enum SetupSubcommand {
    Open(SetupOpenArgs),
}

#[derive(Debug, Args)]
struct SetupOpenArgs {
    #[arg(long, default_value = "15m")]
    ttl: String,
}

#[derive(Debug, Args)]
struct RunnerArgs {
    #[command(subcommand)]
    command: RunnerSubcommand,
}

#[derive(Debug, Subcommand)]
enum RunnerSubcommand {
    Register,
}

#[derive(Debug, Args)]
struct ConfigArgs {
    #[command(subcommand)]
    command: ConfigSubcommand,
}

#[derive(Debug, Subcommand)]
enum ConfigSubcommand {
    Set(ConfigSetArgs),
    Get(ConfigGetArgs),
}

#[derive(Debug, Args)]
struct ConfigSetArgs {
    key: String,
    value: String,
}

#[derive(Debug, Args)]
struct ConfigGetArgs {
    key: String,
}

fn parse_ttl(raw: &str) -> anyhow::Result<Duration> {
    humantime::parse_duration(raw).with_context(|| format!("invalid ttl value: {raw}"))
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Setup(setup) => match setup.command {
            Some(SetupSubcommand::Open(args)) => {
                let ttl = parse_ttl(&args.ttl)?;
                println!(
                    "setup window opened for {} seconds (token generation is not implemented yet)",
                    ttl.as_secs()
                );
            }
            None => {
                println!("starting interactive setup flow (not implemented yet)");
            }
        },
        Commands::Login => {
            println!("login flow placeholder");
        }
        Commands::Status => {
            println!("status command placeholder");
        }
        Commands::Runner(runner) => match runner.command {
            RunnerSubcommand::Register => {
                println!("runner registration placeholder");
            }
        },
        Commands::Config(config) => match config.command {
            ConfigSubcommand::Set(args) => {
                println!("config set placeholder: {}={}", args.key, args.value);
            }
            ConfigSubcommand::Get(args) => {
                println!("config get placeholder: {}", args.key);
            }
        },
        Commands::Doctor => {
            println!("doctor checks placeholder");
        }
    }

    Ok(())
}
