use clap::{Parser, Subcommand, ValueEnum};
use config_drift_timeline::{
    Classification, build_report, capture, load_allowlist, load_ledger, render_terminal,
};
use serde_json::json;
use std::path::PathBuf;
use std::process::ExitCode;

#[derive(Parser)]
#[command(
    name = "driftline",
    version,
    about = "Explain when environments drifted and who introduced it",
    long_about = "Capture redacted application-configuration snapshots, then reconstruct a semantic drift timeline across two environments. Raw values never enter the ledger."
)]
struct Cli {
    /// Emit JSON for scripting (equivalent to --format json for reports)
    #[arg(long, global = true)]
    json: bool,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Capture one environment snapshot into a redacted local ledger
    Capture {
        /// Environment name, such as staging or production
        #[arg(long, value_name = "NAME")]
        env: String,
        /// RFC 3339 capture/deploy time
        #[arg(long, value_name = "TIMESTAMP")]
        at: String,
        /// Person or automation responsible for this snapshot
        #[arg(long)]
        actor: String,
        /// Input layer (.env, .json, .yaml); repeat in override order
        #[arg(long, required = true)]
        source: Vec<PathBuf>,
        /// Redacted timeline ledger to create or append
        #[arg(long, default_value = ".drift/timeline.json")]
        ledger: PathBuf,
    },
    /// Report semantic changes across two environments
    Report {
        /// Redacted timeline ledger created by capture
        #[arg(long, default_value = ".drift/timeline.json")]
        ledger: PathBuf,
        /// Two comma-separated environment names
        #[arg(long, value_name = "ENV_A,ENV_B")]
        compare: String,
        /// YAML allowlist of intentional key differences
        #[arg(long)]
        allowlist: Option<PathBuf>,
        /// Output representation
        #[arg(long, value_enum, default_value = "terminal")]
        format: OutputFormat,
        /// Exit 1 when unsafe active drift remains (for CI/release gates)
        #[arg(long)]
        fail_on_drift: bool,
    },
}

#[derive(Clone, ValueEnum)]
enum OutputFormat {
    Terminal,
    Json,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(cli) {
        Ok(code) => ExitCode::from(code),
        Err(message) => {
            eprintln!("error: {message}");
            eprintln!("hint: run 'driftline --help' or 'driftline <command> --help'");
            ExitCode::from(2)
        }
    }
}

fn run(cli: Cli) -> Result<u8, String> {
    match cli.command {
        Command::Capture {
            env,
            at,
            actor,
            source,
            ledger,
        } => {
            let snapshot = capture(&ledger, &env, &at, &actor, &source)?;
            if cli.json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&json!({
                        "captured": true,
                        "environment": snapshot.environment,
                        "captured_at": snapshot.captured_at,
                        "actor": snapshot.actor,
                        "keys": snapshot.values.len(),
                        "ledger": ledger,
                    }))
                    .unwrap()
                );
            } else {
                println!(
                    "CAPTURED  {} at {} by {}",
                    snapshot.environment, snapshot.captured_at, snapshot.actor
                );
                println!(
                    "Redacted {} keys from {} layer(s) -> {}",
                    snapshot.values.len(),
                    snapshot.sources.len(),
                    ledger.display()
                );
            }
            Ok(0)
        }
        Command::Report {
            ledger,
            compare,
            allowlist,
            format,
            fail_on_drift,
        } => {
            let ledger = load_ledger(&ledger)?;
            let allowlist = load_allowlist(allowlist.as_deref())?;
            let compare = compare
                .split(',')
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(str::to_owned)
                .collect::<Vec<_>>();
            let report = build_report(&ledger, &compare, &allowlist)?;
            if cli.json || matches!(format, OutputFormat::Json) {
                println!("{}", serde_json::to_string_pretty(&report).unwrap());
            } else {
                print!("{}", render_terminal(&report));
            }
            let unsafe_active = report
                .active
                .iter()
                .any(|d| d.classification == Classification::Unsafe);
            Ok(if fail_on_drift && unsafe_active { 1 } else { 0 })
        }
    }
}
