use std::fs;
use std::process::Command;

#[test]
fn documented_capture_and_comma_separated_report_flow() {
    let dir = tempfile::tempdir().unwrap();
    let staging = dir.path().join("staging.env");
    let production = dir.path().join("production.env");
    let ledger = dir.path().join("timeline.json");
    fs::write(&staging, "PORT=8080\nAPI_TOKEN=raw-secret-one\n").unwrap();
    fs::write(&production, "PORT=9090\nAPI_TOKEN=raw-secret-two\n").unwrap();

    for (env, at, actor, source) in [
        ("staging", "2026-08-28T09:00:00Z", "deploy-bot", &staging),
        ("production", "2026-08-28T10:42:00Z", "priya", &production),
    ] {
        let status = Command::new(env!("CARGO_BIN_EXE_driftline"))
            .args([
                "capture", "--env", env, "--at", at, "--actor", actor, "--source",
            ])
            .arg(source)
            .arg("--ledger")
            .arg(&ledger)
            .status()
            .unwrap();
        assert!(status.success());
    }

    let output = Command::new(env!("CARGO_BIN_EXE_driftline"))
        .args(["report", "--ledger"])
        .arg(&ledger)
        .args([
            "--compare",
            "staging,production",
            "--json",
            "--fail-on-drift",
        ])
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    let report = String::from_utf8(output.stdout).unwrap();
    assert!(report.contains("\"introduced_by\": \"priya\""));
    assert!(report.contains("\"unsafe_active\": 2"));
    let stored = fs::read_to_string(ledger).unwrap();
    assert!(!stored.contains("raw-secret-one"));
    assert!(!stored.contains("raw-secret-two"));
}

#[test]
fn bundled_demo_uses_a_new_temporary_workspace_and_redacts_the_report() {
    let output = Command::new(env!("CARGO_BIN_EXE_driftline"))
        .arg("demo")
        .output()
        .unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("DEMO  Config Drift Timeline"));
    assert!(stdout.contains("after priya captured production"));
    assert!(!stdout.contains("example-staging-token"));

    let workspace = stdout
        .lines()
        .find_map(|line| line.strip_prefix("Sample workspace: "))
        .expect("demo prints its isolated workspace");
    let report = stdout
        .lines()
        .find_map(|line| line.strip_prefix("Demo report: "))
        .expect("demo prints its report location");
    let workspace = std::path::PathBuf::from(workspace);
    let report = std::path::PathBuf::from(report);
    assert!(workspace.starts_with(std::env::temp_dir()));
    assert!(workspace.join("staging.yaml").is_file());
    assert!(workspace.join("production.yaml").is_file());
    assert!(workspace.join("demo.env").is_file());
    assert!(workspace.join("demo.json").is_file());
    let report_contents = fs::read_to_string(report).unwrap();
    assert!(report_contents.contains("database.replica_count"));
    assert!(!report_contents.contains("example-staging-token"));
    fs::remove_dir_all(workspace).unwrap();
}
