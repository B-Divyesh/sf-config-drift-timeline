use clap::{Parser, Subcommand, ValueEnum};
use config_drift_timeline::{
    Classification, build_report, capture, load_allowlist, load_ledger, render_terminal,
};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::{SystemTime, UNIX_EPOCH};

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
    /// Run the bundled incident in a new temporary directory
    Demo,
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
        Command::Demo => run_demo(),
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

fn run_demo() -> Result<u8, String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "could not create a timestamp for the demo workspace".to_string())?
        .as_nanos();
    let workspace =
        std::env::temp_dir().join(format!("driftline-demo-{}-{nonce}", std::process::id()));
    fs::create_dir(&workspace).map_err(|error| {
        format!(
            "could not create demo workspace {}: {error}",
            workspace.display()
        )
    })?;

    let staging = workspace.join("staging.yaml");
    let production = workspace.join("production.yaml");
    let shared_dotenv = workspace.join("demo.env");
    let shared_json = workspace.join("demo.json");
    let ledger = workspace.join("timeline.json");
    let report_path = workspace.join("drift-report.json");
    fs::write(&staging, include_str!("../examples/staging.yaml"))
        .map_err(|error| format!("could not write demo staging snapshot: {error}"))?;
    fs::write(&production, include_str!("../examples/production.yaml"))
        .map_err(|error| format!("could not write demo production snapshot: {error}"))?;
    fs::write(&shared_dotenv, include_str!("../examples/demo.env"))
        .map_err(|error| format!("could not write demo dotenv layer: {error}"))?;
    fs::write(&shared_json, include_str!("../examples/demo.json"))
        .map_err(|error| format!("could not write demo JSON layer: {error}"))?;

    capture(
        &ledger,
        "staging",
        "2026-08-28T09:00:00Z",
        "deploy-bot",
        &[staging, shared_dotenv.clone(), shared_json.clone()],
    )?;
    capture(
        &ledger,
        "production",
        "2026-08-28T10:42:00Z",
        "priya",
        &[production, shared_dotenv, shared_json],
    )?;
    let report = build_report(
        &load_ledger(&ledger)?,
        &["staging".to_string(), "production".to_string()],
        &load_allowlist(None)?,
    )?;
    fs::write(
        &report_path,
        serde_json::to_vec_pretty(&report)
            .map_err(|error| format!("could not encode demo report: {error}"))?,
    )
    .map_err(|error| format!("could not write demo report: {error}"))?;

    println!("DEMO  Config Drift Timeline");
    println!("Sample workspace: {}", workspace.display());
    print!("{}", render_terminal(&report));
    println!("Demo report: {}", report_path.display());
    println!("The sample stays in this temporary directory. Your files were not read or changed.");
    Ok(0)
}
