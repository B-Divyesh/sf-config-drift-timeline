use chrono::{DateTime, SecondsFormat};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

pub const SCHEMA_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Ledger {
    pub schema_version: u8,
    pub snapshots: Vec<Snapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub environment: String,
    pub captured_at: String,
    pub actor: String,
    pub sources: Vec<String>,
    pub values: BTreeMap<String, RecordedValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecordedValue {
    pub kind: ValueKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<String>,
    pub overridden: bool,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum ValueKind {
    String,
    Number,
    Boolean,
    Null,
    Secret,
    Array,
}

#[derive(Debug, Deserialize, Default)]
pub struct Allowlist {
    #[serde(default)]
    pub allow: Vec<AllowRule>,
}

#[derive(Debug, Deserialize)]
pub struct AllowRule {
    pub key: String,
    pub environments: Vec<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Report {
    pub schema_version: u8,
    pub compared_environments: Vec<String>,
    pub snapshots_analyzed: usize,
    pub awaiting_environments: Vec<String>,
    pub summary: ReportSummary,
    pub events: Vec<DriftEvent>,
    pub active: Vec<ActiveDrift>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReportSummary {
    pub unsafe_active: usize,
    pub allowed_active: usize,
    pub resolved: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct DriftEvent {
    pub key: String,
    pub status: EventStatus,
    pub classification: Classification,
    pub observed_at: String,
    pub observed_after_actor: String,
    pub observed_after_environment: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_reason: Option<String>,
    pub sides: BTreeMap<String, SideValue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActiveDrift {
    pub key: String,
    pub first_observed_at: String,
    pub introduced_by: String,
    pub introduced_in: String,
    pub classification: Classification,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_reason: Option<String>,
    pub sides: BTreeMap<String, SideValue>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventStatus {
    Introduced,
    Changed,
    Resolved,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Classification {
    Unsafe,
    Allowed,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct SideValue {
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<String>,
    pub overridden: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Clone)]
struct ActiveEpisode {
    first_observed_at: String,
    introduced_by: String,
    introduced_in: String,
}

pub fn load_ledger(path: &Path) -> Result<Ledger, String> {
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("could not read ledger {}: {e}", path.display()))?;
    let ledger: Ledger = serde_json::from_str(&raw)
        .map_err(|e| format!("ledger {} is not valid JSON: {e}", path.display()))?;
    if ledger.schema_version != SCHEMA_VERSION {
        return Err(format!(
            "ledger schema {} is not supported (expected {})",
            ledger.schema_version, SCHEMA_VERSION
        ));
    }
    Ok(ledger)
}

pub fn capture(
    ledger_path: &Path,
    environment: &str,
    captured_at: &str,
    actor: &str,
    sources: &[PathBuf],
) -> Result<Snapshot, String> {
    validate_label("environment", environment)?;
    validate_label("actor", actor)?;
    let timestamp = DateTime::parse_from_rfc3339(captured_at)
        .map_err(|_| {
            "--at must be an RFC 3339 timestamp, for example 2026-08-28T09:00:00Z".to_string()
        })?
        .to_utc()
        .to_rfc3339_opts(SecondsFormat::Secs, true);
    if sources.is_empty() {
        return Err("at least one --source is required".into());
    }

    let mut merged = BTreeMap::<String, RecordedValue>::new();
    for source in sources {
        let parsed = parse_source(source)?;
        let source_name = source.display().to_string();
        for (key, (kind, canonical)) in parsed {
            let overridden = merged.contains_key(&key);
            let secret = is_secret_key(&key) && kind != ValueKind::Null;
            let recorded_kind = if secret {
                ValueKind::Secret
            } else {
                kind.clone()
            };
            let fingerprint = canonical.map(|value| fingerprint(&kind, &value));
            merged.insert(
                key,
                RecordedValue {
                    kind: recorded_kind,
                    fingerprint,
                    overridden,
                    source: source_name.clone(),
                },
            );
        }
    }

    let snapshot = Snapshot {
        environment: environment.to_string(),
        captured_at: timestamp,
        actor: actor.to_string(),
        sources: sources.iter().map(|p| p.display().to_string()).collect(),
        values: merged,
    };

    let mut ledger = if ledger_path.exists() {
        load_ledger(ledger_path)?
    } else {
        Ledger {
            schema_version: SCHEMA_VERSION,
            snapshots: Vec::new(),
        }
    };
    if ledger
        .snapshots
        .iter()
        .any(|s| s.environment == snapshot.environment && s.captured_at == snapshot.captured_at)
    {
        return Err(format!(
            "a {} snapshot already exists at {}",
            environment, snapshot.captured_at
        ));
    }
    ledger.snapshots.push(snapshot.clone());
    ledger.snapshots.sort_by(|a, b| {
        a.captured_at
            .cmp(&b.captured_at)
            .then(a.environment.cmp(&b.environment))
    });
    write_ledger(ledger_path, &ledger)?;
    Ok(snapshot)
}

fn validate_label(name: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.contains(['\n', '\r']) {
        Err(format!("--{name} must be a non-empty single line"))
    } else {
        Ok(())
    }
}

fn write_ledger(path: &Path, ledger: &Ledger) -> Result<(), String> {
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "could not create ledger directory {}: {e}",
                parent.display()
            )
        })?;
    }
    let bytes =
        serde_json::to_vec_pretty(ledger).map_err(|e| format!("could not encode ledger: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, bytes).map_err(|e| format!("could not write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("could not replace {}: {e}", path.display()))
}

type ParsedValues = BTreeMap<String, (ValueKind, Option<String>)>;

pub fn parse_source(path: &Path) -> Result<ParsedValues, String> {
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("could not read snapshot {}: {e}", path.display()))?;
    match path
        .extension()
        .and_then(|x| x.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("json") => {
            let value: Value = serde_json::from_str(&raw)
                .map_err(|e| format!("invalid JSON in {}: {e}", path.display()))?;
            flatten_root(value, path)
        }
        Some("yaml") | Some("yml") => {
            let yaml: serde_yaml::Value = serde_yaml::from_str(&raw)
                .map_err(|e| format!("invalid YAML in {}: {e}", path.display()))?;
            let value = serde_json::to_value(yaml).map_err(|e| {
                format!(
                    "YAML in {} must use string object keys: {e}",
                    path.display()
                )
            })?;
            flatten_root(value, path)
        }
        Some("env") | None => parse_dotenv(&raw, path),
        Some(other) => Err(format!(
            "unsupported snapshot extension .{other} in {}; use .env, .json, .yaml, or .yml",
            path.display()
        )),
    }
}

fn flatten_root(value: Value, path: &Path) -> Result<ParsedValues, String> {
    let Value::Object(map) = value else {
        return Err(format!(
            "snapshot {} must contain an object at its root",
            path.display()
        ));
    };
    let mut out = BTreeMap::new();
    flatten_object("", &map, &mut out)?;
    Ok(out)
}

fn flatten_object(
    prefix: &str,
    map: &Map<String, Value>,
    out: &mut ParsedValues,
) -> Result<(), String> {
    for (key, value) in map {
        if key.contains('.') {
            return Err(format!(
                "key {key:?} contains '.', which is reserved for nested paths"
            ));
        }
        let path = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{prefix}.{key}")
        };
        if let Value::Object(child) = value {
            flatten_object(&path, child, out)?;
        } else {
            out.insert(path, normalize_json(value)?);
        }
    }
    Ok(())
}

fn normalize_json(value: &Value) -> Result<(ValueKind, Option<String>), String> {
    Ok(match value {
        Value::Null => (ValueKind::Null, None),
        Value::Bool(v) => (ValueKind::Boolean, Some(v.to_string())),
        Value::Number(v) => (ValueKind::Number, Some(v.to_string())),
        Value::String(v) => (ValueKind::String, Some(v.clone())),
        Value::Array(v) => (
            ValueKind::Array,
            Some(serde_json::to_string(v).map_err(|e| e.to_string())?),
        ),
        Value::Object(_) => unreachable!("objects are flattened before normalization"),
    })
}

fn parse_dotenv(raw: &str, path: &Path) -> Result<ParsedValues, String> {
    let mut out = BTreeMap::new();
    for (index, original) in raw.lines().enumerate() {
        let line = original.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let line = line.strip_prefix("export ").unwrap_or(line);
        let Some((key, raw_value)) = line.split_once('=') else {
            return Err(format!(
                "invalid dotenv assignment in {} at line {}",
                path.display(),
                index + 1
            ));
        };
        let key = key.trim();
        if key.is_empty() || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            return Err(format!(
                "invalid dotenv key in {} at line {}",
                path.display(),
                index + 1
            ));
        }
        let value = unquote(raw_value.trim());
        out.insert(key.to_string(), (ValueKind::String, Some(value)));
    }
    Ok(out)
}

fn unquote(value: &str) -> String {
    if value.len() >= 2 {
        let first = value.as_bytes()[0];
        let last = value.as_bytes()[value.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return value[1..value.len() - 1].to_string();
        }
    }
    value.to_string()
}

fn fingerprint(kind: &ValueKind, canonical: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{:?}\0", kind));
    hasher.update(canonical.as_bytes());
    format!("sha256:{:x}", hasher.finalize())
}

fn is_secret_key(key: &str) -> bool {
    let upper = key.to_ascii_uppercase();
    [
        "SECRET",
        "TOKEN",
        "PASSWORD",
        "PASSWD",
        "API_KEY",
        "PRIVATE_KEY",
        "CREDENTIAL",
        "AUTH",
    ]
    .iter()
    .any(|needle| upper.contains(needle))
}

pub fn load_allowlist(path: Option<&Path>) -> Result<Allowlist, String> {
    let Some(path) = path else {
        return Ok(Allowlist::default());
    };
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("could not read allowlist {}: {e}", path.display()))?;
    let list: Allowlist = serde_yaml::from_str(&raw)
        .map_err(|e| format!("invalid allowlist {}: {e}", path.display()))?;
    for (index, rule) in list.allow.iter().enumerate() {
        if rule.key.trim().is_empty()
            || rule.reason.trim().is_empty()
            || rule.environments.len() != 2
        {
            return Err(format!(
                "allowlist rule {} needs a key, reason, and exactly two environments",
                index + 1
            ));
        }
    }
    Ok(list)
}

pub fn build_report(
    ledger: &Ledger,
    environments: &[String],
    allowlist: &Allowlist,
) -> Result<Report, String> {
    if environments.len() != 2 || environments[0] == environments[1] {
        return Err(
            "--compare needs two distinct environments, for example staging,production".into(),
        );
    }
    let env_set: BTreeSet<&str> = environments.iter().map(String::as_str).collect();
    let mut snapshots: Vec<&Snapshot> = ledger
        .snapshots
        .iter()
        .filter(|s| env_set.contains(s.environment.as_str()))
        .collect();
    snapshots.sort_by(|a, b| {
        a.captured_at
            .cmp(&b.captured_at)
            .then(a.environment.cmp(&b.environment))
    });

    let present: BTreeSet<&str> = snapshots.iter().map(|s| s.environment.as_str()).collect();
    let awaiting_environments = environments
        .iter()
        .filter(|e| !present.contains(e.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let mut current = BTreeMap::<String, &Snapshot>::new();
    let mut previous = BTreeMap::<String, String>::new();
    let mut episodes = BTreeMap::<String, ActiveEpisode>::new();
    let mut events = Vec::new();
    let mut resolved = 0;

    for snapshot in &snapshots {
        current.insert(snapshot.environment.clone(), snapshot);
        if current.len() < 2 {
            continue;
        }
        let left = current
            .get(&environments[0])
            .expect("both environments are present");
        let right = current
            .get(&environments[1])
            .expect("both environments are present");
        let keys: BTreeSet<String> = left
            .values
            .keys()
            .chain(right.values.keys())
            .chain(previous.keys())
            .cloned()
            .collect();
        let mut next = BTreeMap::new();

        for key in keys {
            let sides = sides_for(&key, environments, left, right);
            if equal_sides(&sides, environments) {
                if previous.contains_key(&key) {
                    let (classification, reason) =
                        classification_for(&key, environments, allowlist);
                    events.push(DriftEvent {
                        key: key.clone(),
                        status: EventStatus::Resolved,
                        classification,
                        observed_at: snapshot.captured_at.clone(),
                        observed_after_actor: snapshot.actor.clone(),
                        observed_after_environment: snapshot.environment.clone(),
                        allow_reason: reason,
                        sides,
                    });
                    episodes.remove(&key);
                    resolved += 1;
                }
                continue;
            }
            let signature = serde_json::to_string(&sides).expect("serializable sides");
            let changed = previous.get(&key).is_some_and(|old| old != &signature);
            if !previous.contains_key(&key) || changed {
                let status = if changed {
                    EventStatus::Changed
                } else {
                    EventStatus::Introduced
                };
                let (classification, reason) = classification_for(&key, environments, allowlist);
                events.push(DriftEvent {
                    key: key.clone(),
                    status,
                    classification,
                    observed_at: snapshot.captured_at.clone(),
                    observed_after_actor: snapshot.actor.clone(),
                    observed_after_environment: snapshot.environment.clone(),
                    allow_reason: reason,
                    sides: sides.clone(),
                });
                episodes
                    .entry(key.clone())
                    .or_insert_with(|| ActiveEpisode {
                        first_observed_at: snapshot.captured_at.clone(),
                        introduced_by: snapshot.actor.clone(),
                        introduced_in: snapshot.environment.clone(),
                    });
            }
            next.insert(key, signature);
        }
        previous = next;
    }

    let mut active = Vec::new();
    if current.len() == 2 {
        let left = current.get(&environments[0]).unwrap();
        let right = current.get(&environments[1]).unwrap();
        for (key, episode) in episodes {
            let sides = sides_for(&key, environments, left, right);
            if !equal_sides(&sides, environments) {
                let (classification, reason) = classification_for(&key, environments, allowlist);
                active.push(ActiveDrift {
                    key,
                    first_observed_at: episode.first_observed_at,
                    introduced_by: episode.introduced_by,
                    introduced_in: episode.introduced_in,
                    classification,
                    allow_reason: reason,
                    sides,
                });
            }
        }
    }
    active.sort_by(|a, b| {
        a.first_observed_at
            .cmp(&b.first_observed_at)
            .then(a.key.cmp(&b.key))
    });
    let unsafe_active = active
        .iter()
        .filter(|d| d.classification == Classification::Unsafe)
        .count();
    let allowed_active = active.len() - unsafe_active;
    Ok(Report {
        schema_version: SCHEMA_VERSION,
        compared_environments: environments.to_vec(),
        snapshots_analyzed: snapshots.len(),
        awaiting_environments,
        summary: ReportSummary {
            unsafe_active,
            allowed_active,
            resolved,
        },
        events,
        active,
    })
}

fn sides_for(
    key: &str,
    environments: &[String],
    left: &Snapshot,
    right: &Snapshot,
) -> BTreeMap<String, SideValue> {
    let mut sides = BTreeMap::new();
    sides.insert(environments[0].clone(), side_value(left.values.get(key)));
    sides.insert(environments[1].clone(), side_value(right.values.get(key)));
    sides
}

fn side_value(value: Option<&RecordedValue>) -> SideValue {
    match value {
        None => SideValue {
            state: "absent".into(),
            fingerprint: None,
            overridden: false,
            source: None,
        },
        Some(value) => SideValue {
            state: match value.kind {
                ValueKind::String => "string",
                ValueKind::Number => "number",
                ValueKind::Boolean => "boolean",
                ValueKind::Null => "null",
                ValueKind::Secret => "secret",
                ValueKind::Array => "array",
            }
            .into(),
            fingerprint: value.fingerprint.clone(),
            overridden: value.overridden,
            source: Some(value.source.clone()),
        },
    }
}

fn equal_sides(sides: &BTreeMap<String, SideValue>, environments: &[String]) -> bool {
    let a = &sides[&environments[0]];
    let b = &sides[&environments[1]];
    a.state == b.state && a.fingerprint == b.fingerprint
}

fn classification_for(
    key: &str,
    environments: &[String],
    allowlist: &Allowlist,
) -> (Classification, Option<String>) {
    for rule in &allowlist.allow {
        let same_pair = rule.environments.iter().all(|e| environments.contains(e))
            && environments.iter().all(|e| rule.environments.contains(e));
        if same_pair && glob_matches(&rule.key, key) {
            return (Classification::Allowed, Some(rule.reason.clone()));
        }
    }
    (Classification::Unsafe, None)
}

fn glob_matches(pattern: &str, text: &str) -> bool {
    let (p, t) = (pattern.as_bytes(), text.as_bytes());
    let (mut pi, mut ti, mut star, mut mark) = (0, 0, None, 0);
    while ti < t.len() {
        if pi < p.len() && (p[pi] == b'?' || p[pi] == t[ti]) {
            pi += 1;
            ti += 1;
        } else if pi < p.len() && p[pi] == b'*' {
            star = Some(pi);
            pi += 1;
            mark = ti;
        } else if let Some(s) = star {
            pi = s + 1;
            mark += 1;
            ti = mark;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == b'*' {
        pi += 1;
    }
    pi == p.len()
}

pub fn render_terminal(report: &Report) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "DRIFT TIMELINE  {} <-> {}\n",
        report.compared_environments[0], report.compared_environments[1]
    ));
    out.push_str(&format!(
        "Snapshots: {}  Active unsafe: {}  Allowed: {}  Resolved: {}\n",
        report.snapshots_analyzed,
        report.summary.unsafe_active,
        report.summary.allowed_active,
        report.summary.resolved
    ));
    out.push_str("Values are redacted; hashes are shown as short fingerprints.\n");
    if !report.awaiting_environments.is_empty() {
        out.push_str(&format!(
            "\nWAITING  Capture a snapshot for: {}\n",
            report.awaiting_environments.join(", ")
        ));
        return out;
    }
    if report.events.is_empty() {
        out.push_str("\nCLEAN  No drift was observed between these environments.\n");
        return out;
    }
    for event in &report.events {
        let status = match event.status {
            EventStatus::Introduced => "INTRODUCED",
            EventStatus::Changed => "CHANGED",
            EventStatus::Resolved => "RESOLVED",
        };
        let class = match event.classification {
            Classification::Unsafe => "unsafe",
            Classification::Allowed => "allowed",
        };
        out.push_str(&format!(
            "\n{}  {}  {} [{}]\n",
            event.observed_at, status, event.key, class
        ));
        out.push_str(&format!(
            "  after {} captured {}\n",
            event.observed_after_actor, event.observed_after_environment
        ));
        for env in &report.compared_environments {
            let value = &event.sides[env];
            let hash = value
                .fingerprint
                .as_deref()
                .map(|x| &x[..x.len().min(15)])
                .unwrap_or("-");
            let override_note = if value.overridden {
                " (overridden)"
            } else {
                ""
            };
            let source = value.source.as_deref().unwrap_or("-");
            out.push_str(&format!(
                "  {:<14} {:<8} {:<15} {}{}\n",
                env, value.state, hash, source, override_note
            ));
        }
        if let Some(reason) = &event.allow_reason {
            out.push_str(&format!("  allowlist: {reason}\n"));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn parses_nested_and_distinguishes_null() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.yaml");
        fs::write(&path, "http:\n  port: 8080\n  token: abc\nmissing: null\n").unwrap();
        let parsed = parse_source(&path).unwrap();
        assert_eq!(parsed["http.port"].0, ValueKind::Number);
        assert_eq!(parsed["missing"], (ValueKind::Null, None));
    }

    #[test]
    fn capture_redacts_and_records_overrides() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join("base.env");
        let prod = dir.path().join("prod.env");
        fs::write(&base, "PORT=3000\nAPI_TOKEN=not-stored\n").unwrap();
        fs::write(&prod, "PORT=8080\n").unwrap();
        let snapshot = capture(
            &dir.path().join("ledger.json"),
            "production",
            "2026-08-28T09:00:00Z",
            "ana",
            &[base, prod],
        )
        .unwrap();
        assert!(snapshot.values["PORT"].overridden);
        assert_eq!(snapshot.values["API_TOKEN"].kind, ValueKind::Secret);
        let serialized = serde_json::to_string(&snapshot).unwrap();
        assert!(!serialized.contains("not-stored"));
        assert!(!serialized.contains("8080"));
    }

    #[test]
    fn report_finds_introduction_actor_and_allowlist() {
        let value = |hash: &str| RecordedValue {
            kind: ValueKind::String,
            fingerprint: Some(hash.into()),
            overridden: false,
            source: "config.env".into(),
        };
        let snap = |environment: &str, at: &str, actor: &str, hash: &str| Snapshot {
            environment: environment.into(),
            captured_at: at.into(),
            actor: actor.into(),
            sources: vec!["config.env".into()],
            values: BTreeMap::from([("LOG_LEVEL".into(), value(hash))]),
        };
        let ledger = Ledger {
            schema_version: 1,
            snapshots: vec![
                snap("staging", "2026-01-01T00:00:00Z", "bot", "sha256:a"),
                snap("production", "2026-01-01T00:01:00Z", "bot", "sha256:a"),
                snap("production", "2026-01-02T00:00:00Z", "maya", "sha256:b"),
            ],
        };
        let allowlist = Allowlist {
            allow: vec![AllowRule {
                key: "LOG_*".into(),
                environments: vec!["production".into(), "staging".into()],
                reason: "intentional".into(),
            }],
        };
        let report = build_report(
            &ledger,
            &["staging".into(), "production".into()],
            &allowlist,
        )
        .unwrap();
        assert_eq!(report.summary.allowed_active, 1);
        assert_eq!(report.active[0].introduced_by, "maya");
        assert_eq!(report.events[0].status, EventStatus::Introduced);
    }

    #[test]
    fn readme_flow_runs_without_raw_values_in_ledger() {
        let dir = tempfile::tempdir().unwrap();
        let mut base = fs::File::create(dir.path().join("base.yaml")).unwrap();
        writeln!(base, "replicas: 2\npassword: hunter2").unwrap();
        let ledger_path = dir.path().join("timeline.json");
        capture(
            &ledger_path,
            "staging",
            "2026-08-28T09:00:00Z",
            "deploy-bot",
            &[dir.path().join("base.yaml")],
        )
        .unwrap();
        fs::write(
            dir.path().join("prod.json"),
            r#"{"replicas":3,"password":"different"}"#,
        )
        .unwrap();
        capture(
            &ledger_path,
            "production",
            "2026-08-28T09:04:00Z",
            "ana@example.com",
            &[dir.path().join("prod.json")],
        )
        .unwrap();
        let ledger_raw = fs::read_to_string(&ledger_path).unwrap();
        assert!(!ledger_raw.contains("hunter2"));
        assert!(!ledger_raw.contains("different"));
        let report = build_report(
            &load_ledger(&ledger_path).unwrap(),
            &["staging".into(), "production".into()],
            &Allowlist::default(),
        )
        .unwrap();
        assert_eq!(report.summary.unsafe_active, 2);
    }

    #[test]
    fn reports_resolution_when_a_key_becomes_absent_on_both_sides() {
        let present = |environment: &str, at: &str, actor: &str| Snapshot {
            environment: environment.into(),
            captured_at: at.into(),
            actor: actor.into(),
            sources: vec!["config.env".into()],
            values: BTreeMap::from([(
                "OLD_FLAG".into(),
                RecordedValue {
                    kind: ValueKind::Boolean,
                    fingerprint: Some("sha256:on".into()),
                    overridden: false,
                    source: "config.env".into(),
                },
            )]),
        };
        let absent = |environment: &str, at: &str| Snapshot {
            environment: environment.into(),
            captured_at: at.into(),
            actor: "cleanup-bot".into(),
            sources: vec!["config.env".into()],
            values: BTreeMap::new(),
        };
        let ledger = Ledger {
            schema_version: 1,
            snapshots: vec![
                present("staging", "2026-01-01T00:00:00Z", "bot"),
                absent("production", "2026-01-01T00:01:00Z"),
                absent("staging", "2026-01-02T00:00:00Z"),
            ],
        };
        let report = build_report(
            &ledger,
            &["staging".into(), "production".into()],
            &Allowlist::default(),
        )
        .unwrap();
        assert_eq!(report.summary.resolved, 1);
        assert!(report.active.is_empty());
        assert_eq!(report.events[1].status, EventStatus::Resolved);
    }
}
