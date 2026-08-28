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
