use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri_plugin_sql::{Migration, MigrationKind};

// Mission Control — local SQLite schema.
// Deliberately small: two core tables (projects, updates) + a settings key/value store.
// "Stale" is NOT stored here; it is computed from projects.updated_at in the frontend.
const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  goal        TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'Moving',   -- Moving | Blocked | Done | Idea
  progress    INTEGER NOT NULL DEFAULT 0,          -- 0..100
  blocker     TEXT    NOT NULL DEFAULT '',
  next_step   TEXT    NOT NULL DEFAULT '',
  is_focus    INTEGER NOT NULL DEFAULT 0,          -- 0/1, at most one focus project
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS updates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL,
  kind        TEXT    NOT NULL DEFAULT 'progress', -- progress | decision | blocker | note
  body        TEXT    NOT NULL,
  source      TEXT    NOT NULL DEFAULT 'manual',   -- manual | claude-code
  status      TEXT    NOT NULL DEFAULT 'accepted', -- accepted | proposed | rejected
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"#;

// Claude Code auto-tracking: project folder path + raw event log + proposed updates.
const SCHEMA_V2: &str = r#"
ALTER TABLE projects ADD COLUMN path TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN claude_connected INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cc_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT    NOT NULL DEFAULT '',
  project_id  INTEGER,                              -- null if cwd matched no project
  cwd         TEXT    NOT NULL DEFAULT '',
  event_name  TEXT    NOT NULL DEFAULT '',          -- UserPromptSubmit | PostToolUse | Stop | ...
  tool_name   TEXT    NOT NULL DEFAULT '',
  payload     TEXT    NOT NULL,                      -- raw hook JSON
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cc_events_session ON cc_events(session_id);

CREATE TABLE IF NOT EXISTS proposed_updates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL,
  session_id    TEXT    NOT NULL DEFAULT '',
  summary       TEXT    NOT NULL,
  files_changed TEXT    NOT NULL DEFAULT '',         -- newline-separated
  status        TEXT    NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
"#;

// Evidence-based progress: MVP file link, parsed MVP items, proposed scope updates
// (from MVP file diffs), proposed item updates (from Claude Code / folder evidence),
// and a folder snapshot used to detect what changed between scans.
const SCHEMA_V3: &str = r#"
ALTER TABLE projects ADD COLUMN mvp_file_path TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN mvp_file_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN mvp_file_mtime TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN progress_mode TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS mvp_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  priority    TEXT    NOT NULL DEFAULT 'should_have', -- must_have | should_have | nice_to_have
  status      TEXT    NOT NULL DEFAULT 'not_started',  -- not_started | in_progress | blocked | done | cut
  evidence    TEXT    NOT NULL DEFAULT '',
  confidence  TEXT    NOT NULL DEFAULT 'low',          -- low | medium | high
  source      TEXT    NOT NULL DEFAULT 'mvp_file',     -- mvp_file | ai_extracted | manual
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS proposed_scope_updates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL,
  file_hash     TEXT    NOT NULL DEFAULT '',
  file_mtime    TEXT    NOT NULL DEFAULT '',
  diff_json     TEXT    NOT NULL,
  old_progress  INTEGER NOT NULL DEFAULT 0,
  new_progress  INTEGER NOT NULL DEFAULT 0,
  status        TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS proposed_item_updates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id       INTEGER NOT NULL,
  mvp_item_id      INTEGER NOT NULL,
  suggested_status TEXT    NOT NULL,
  evidence         TEXT    NOT NULL DEFAULT '',
  confidence       TEXT    NOT NULL DEFAULT 'low',
  source           TEXT    NOT NULL DEFAULT 'claude-code', -- claude-code | folder-scan
  session_id       TEXT    NOT NULL DEFAULT '',
  status           TEXT    NOT NULL DEFAULT 'pending',      -- pending | approved | rejected
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (mvp_item_id) REFERENCES mvp_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS folder_snapshot (
  project_id  INTEGER NOT NULL,
  file_path   TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT '',
  hash        TEXT    NOT NULL DEFAULT '',
  mtime       TEXT    NOT NULL DEFAULT '',
  size        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, file_path)
);
"#;

// XP + achievements. XP is DERIVED from ship_events (append-only) — shipping a
// thing is permanent, so the level never decays even if a project stalls or an
// item is later un-checked. Progress % (from mvp_items) stays a separate,
// honest, can-go-down number. One ship_event per item enforces "no double XP".
const SCHEMA_V4: &str = r#"
CREATE TABLE IF NOT EXISTS ship_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL,
  mvp_item_id INTEGER,                              -- null only if the item was later deleted
  title       TEXT    NOT NULL DEFAULT '',
  priority    TEXT    NOT NULL DEFAULT 'should_have',
  xp          INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ship_events_item ON ship_events(mvp_item_id);

CREATE TABLE IF NOT EXISTS achievements_unlocked (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT    NOT NULL,
  project_id  INTEGER NOT NULL DEFAULT 0,           -- 0 = global; else per-project
  unlocked_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (key, project_id)
);
"#;

// The shell command every hook runs: dump the event JSON (from stdin) to a
// uniquely-named file in the shared inbox. No server, no port. `$$` is the hook
// process PID; combined with the epoch second it is unique per invocation.
const INBOX_WRITER: &str = r#"mkdir -p "$HOME/.mission-control/inbox" && cat > "$HOME/.mission-control/inbox/$(date +%s)-$$-$RANDOM.json""#;

// Marker used to recognize (and safely remove) hooks that WE installed.
const HOOK_MARKER: &str = ".mission-control/inbox";

fn inbox_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    Ok(PathBuf::from(home).join(".mission-control").join("inbox"))
}

fn hooks_json() -> serde_json::Value {
    let entry = serde_json::json!({
        "hooks": [ { "type": "command", "command": INBOX_WRITER } ]
    });
    // PostToolUse needs a matcher; scope to the tools that reveal real work.
    let post = serde_json::json!({
        "matcher": "Edit|Write|MultiEdit|NotebookEdit|Bash",
        "hooks": [ { "type": "command", "command": INBOX_WRITER } ]
    });
    serde_json::json!({
        "UserPromptSubmit": [ entry ],
        "PostToolUse": [ post ],
        "Stop": [ entry ]
    })
}

/// Install Mission Control's Claude Code hooks into <project_path>/.claude/settings.local.json,
/// merging with any existing settings and preserving unrelated user hooks.
#[tauri::command]
fn connect_claude_code(project_path: String) -> Result<(), String> {
    let root = PathBuf::from(&project_path);
    if !root.is_dir() {
        return Err(format!("Folder does not exist: {project_path}"));
    }
    let claude_dir = root.join(".claude");
    fs::create_dir_all(&claude_dir).map_err(|e| format!("Could not create .claude: {e}"))?;
    let settings_path = claude_dir.join("settings.local.json");

    let mut root_json: serde_json::Value = if settings_path.exists() {
        let s = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Could not read settings.local.json: {e}"))?;
        if s.trim().is_empty() {
            serde_json::json!({})
        } else {
            serde_json::from_str(&s)
                .map_err(|e| format!("Existing settings.local.json is not valid JSON: {e}"))?
        }
    } else {
        serde_json::json!({})
    };

    let obj = root_json
        .as_object_mut()
        .ok_or_else(|| "settings.local.json must be a JSON object".to_string())?;

    let hooks_entry = obj
        .entry("hooks")
        .or_insert_with(|| serde_json::json!({}));
    if !hooks_entry.is_object() {
        *hooks_entry = serde_json::json!({});
    }
    let hooks_obj = hooks_entry.as_object_mut().unwrap();
    for (event, cfg) in hooks_json().as_object().unwrap() {
        hooks_obj.insert(event.clone(), cfg.clone());
    }

    let pretty = serde_json::to_string_pretty(&root_json).map_err(|e| e.to_string())?;
    fs::write(&settings_path, pretty + "\n")
        .map_err(|e| format!("Could not write settings.local.json: {e}"))?;
    Ok(())
}

/// Remove only the hooks that Mission Control installed (identified by marker).
#[tauri::command]
fn disconnect_claude_code(project_path: String) -> Result<(), String> {
    let settings_path = PathBuf::from(&project_path)
        .join(".claude")
        .join("settings.local.json");
    if !settings_path.exists() {
        return Ok(());
    }
    let s = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let mut root_json: serde_json::Value = serde_json::from_str(&s).map_err(|e| e.to_string())?;
    if let Some(hooks) = root_json.get_mut("hooks").and_then(|h| h.as_object_mut()) {
        for event in ["UserPromptSubmit", "PostToolUse", "Stop"] {
            if let Some(arr) = hooks.get_mut(event).and_then(|a| a.as_array_mut()) {
                arr.retain(|group| !serde_json::to_string(group).unwrap_or_default().contains(HOOK_MARKER));
                if arr.is_empty() {
                    hooks.remove(event);
                }
            }
        }
    }
    let pretty = serde_json::to_string_pretty(&root_json).map_err(|e| e.to_string())?;
    fs::write(&settings_path, pretty + "\n").map_err(|e| e.to_string())?;
    Ok(())
}

/// Read and remove all pending hook-event files, returning their raw contents.
/// Skips files written in the last ~1.5s to avoid reading a half-written file.
#[tauri::command]
fn drain_cc_inbox() -> Result<Vec<String>, String> {
    let dir = inbox_dir()?;
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let now = SystemTime::now();
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            if let Ok(modified) = meta.modified() {
                if now.duration_since(modified).unwrap_or(Duration::ZERO) < Duration::from_millis(1500)
                {
                    continue; // likely still being written; grab it next drain
                }
            }
        }
        if let Ok(content) = fs::read_to_string(&path) {
            out.push(content);
            let _ = fs::remove_file(&path);
        }
    }
    Ok(out)
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    hasher.finish().to_string()
}

fn epoch_secs(t: SystemTime) -> String {
    t.duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
}

#[derive(serde::Serialize, Debug)]
struct MvpFileResult {
    content: String,
    hash: String,
    mtime: String,
}

/// Read the connected MVP/spec file and return its content plus a content hash
/// and modified time, used to detect when the file has changed since last scan.
#[tauri::command]
fn read_mvp_file(path: String) -> Result<MvpFileResult, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Err(format!("MVP file not found: {path}"));
    }
    let content = fs::read_to_string(&p).map_err(|e| format!("Could not read file: {e}"))?;
    let hash = hash_bytes(content.as_bytes());
    let meta = fs::metadata(&p).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .map(epoch_secs)
        .map_err(|e| e.to_string())?;
    Ok(MvpFileResult { content, hash, mtime })
}

const IGNORE_DIRS: [&str; 15] = [
    "node_modules",
    "dist",
    "build",
    ".git",
    ".next",
    "target",
    ".venv",
    "venv",
    "__pycache__",
    "coverage",
    ".cache",
    ".turbo",
    "gen",
    ".vscode",
    ".idea",
];

const MAX_SCAN_FILES: usize = 4000;
const MAX_SCAN_DEPTH: usize = 14;
const MAX_HASH_BYTES: u64 = 300_000;

fn is_sensitive_name(lower: &str) -> bool {
    lower == ".env"
        || lower.starts_with(".env.")
        || lower.contains("secret")
        || lower.contains("credential")
        || lower.contains("apikey")
        || lower.contains("api_key")
        || lower.ends_with(".pem")
        || lower.ends_with(".key")
        || lower.ends_with(".p12")
}

fn ext_of(lower: &str) -> &str {
    match lower.rfind('.') {
        Some(i) => &lower[i + 1..],
        None => "",
    }
}

// Categorize a file for evidence purposes. Returns None for anything we should
// not track at all (binaries, media, junk, sensitive files) — these are never
// returned to the frontend, never hashed, never sent anywhere.
fn classify(rel_path: &str, is_mvp_file: bool) -> Option<&'static str> {
    if is_mvp_file {
        return Some("mvp_scope");
    }
    let lower = rel_path.to_lowercase();
    let name = lower.rsplit('/').next().unwrap_or(&lower);
    if is_sensitive_name(name) {
        return None;
    }
    let ext = ext_of(name);
    // Lock files are dependency evidence, not junk — check before the binary exclusion.
    if name == "package-lock.json"
        || name == "cargo.lock"
        || name == "yarn.lock"
        || name == "pnpm-lock.yaml"
    {
        return Some("dependencies");
    }
    match ext {
        "png" | "jpg" | "jpeg" | "gif" | "svg" | "ico" | "webp" | "bmp" | "mp4" | "mov" | "webm"
        | "avi" | "pdf" | "zip" | "tar" | "gz" | "woff" | "woff2" | "ttf" | "otf" | "eot"
        | "icns" | "wasm" | "db" | "sqlite" | "sqlite3" | "lock" => {
            return None;
        }
        _ => {}
    }
    if name.contains("test") || name.contains("spec") || lower.contains("__tests__/") {
        return Some("tests");
    }
    if ext == "md" || ext == "mdx" || ext == "txt" {
        return Some("docs");
    }
    if matches!(ext, "json" | "toml" | "yaml" | "yml")
        || name == "dockerfile"
        || name.starts_with(".env.example")
    {
        return Some("config");
    }
    if matches!(
        ext,
        "ts" | "tsx" | "js" | "jsx" | "rs" | "py" | "go" | "java" | "kt" | "rb" | "css" | "scss"
            | "html" | "swift" | "c" | "cpp" | "h" | "hpp"
    ) {
        return Some("code");
    }
    None // unknown extension: skip rather than guess
}

#[derive(serde::Serialize)]
struct ScannedFile {
    path: String,
    category: String,
    hash: String,
    mtime: String,
    size: u64,
}

/// Walk a project folder (bounded depth/count, skipping junk/sensitive/binary
/// files) and return metadata for files worth tracking as evidence. File
/// contents are only read (and hashed) for small, already-classified text
/// files; sensitive and ignored files are never read or returned at all.
#[tauri::command]
fn scan_project_folder(path: String, mvp_rel_path: Option<String>) -> Result<Vec<ScannedFile>, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("Folder does not exist: {path}"));
    }
    let mvp_rel = mvp_rel_path.map(|s| s.trim_start_matches('/').to_string());

    let mut out = Vec::new();
    let mut stack: Vec<(PathBuf, usize)> = vec![(root.clone(), 0)];

    while let Some((dir, depth)) = stack.pop() {
        if out.len() >= MAX_SCAN_FILES || depth > MAX_SCAN_DEPTH {
            continue;
        }
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            if out.len() >= MAX_SCAN_FILES {
                break;
            }
            let file_type = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            if file_type.is_symlink() {
                continue; // never follow symlinks (avoids loops and escaping the project root)
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if file_type.is_dir() {
                if IGNORE_DIRS.contains(&name.as_str()) {
                    continue;
                }
                stack.push((entry.path(), depth + 1));
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            let full = entry.path();
            let rel = full
                .strip_prefix(&root)
                .unwrap_or(&full)
                .to_string_lossy()
                .replace('\\', "/");
            let is_mvp = mvp_rel.as_deref() == Some(rel.as_str());
            let category = match classify(&rel, is_mvp) {
                Some(c) => c,
                None => continue,
            };
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let size = meta.len();
            let mtime = meta.modified().map(epoch_secs).unwrap_or_default();
            let hash = if size <= MAX_HASH_BYTES {
                fs::read(&full).map(|b| hash_bytes(&b)).unwrap_or_default()
            } else {
                String::new() // large file: rely on size+mtime for change detection
            };
            out.push(ScannedFile {
                path: rel,
                category: category.to_string(),
                hash,
                mtime,
                size,
            });
        }
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repo_root() -> PathBuf {
        // src-tauri/ -> repo root
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf()
    }

    #[test]
    fn classify_recognizes_real_repo_files() {
        assert_eq!(classify("src/App.tsx", false), Some("code"));
        assert_eq!(classify("src-tauri/src/lib.rs", false), Some("code"));
        assert_eq!(classify("docs/MVP.md", false), Some("docs"));
        assert_eq!(classify("package-lock.json", false), Some("dependencies"));
        assert_eq!(classify("src-tauri/Cargo.lock", false), Some("dependencies"));
        assert_eq!(classify("src-tauri/tauri.conf.json", false), Some("config"));
        assert_eq!(classify("docs/MVP.md", true), Some("mvp_scope"));
    }

    #[test]
    fn classify_excludes_sensitive_and_junk() {
        assert_eq!(classify(".env", false), None);
        assert_eq!(classify(".env.local", false), None);
        assert_eq!(classify("secrets/prod.key", false), None);
        assert_eq!(classify("src-tauri/icons/icon.png", false), None);
        assert_eq!(classify("public/vite.svg", false), None);
    }

    #[test]
    fn read_mvp_file_reads_real_docs_mvp_md() {
        let path = repo_root().join("docs/MVP.md");
        let result = read_mvp_file(path.to_string_lossy().to_string()).expect("should read real file");
        assert!(result.content.contains("Must have"));
        assert!(!result.hash.is_empty());
        assert!(!result.mtime.is_empty());

        // Same content -> same hash (change detection depends on this).
        let again = read_mvp_file(path.to_string_lossy().to_string()).unwrap();
        assert_eq!(result.hash, again.hash);
    }

    #[test]
    fn read_mvp_file_errors_clearly_on_missing_file() {
        let err = read_mvp_file("/definitely/not/a/real/path/MVP.md".to_string());
        assert!(err.is_err());
        assert!(err.unwrap_err().contains("not found"));
    }

    #[test]
    fn scan_project_folder_finds_real_files_and_skips_junk() {
        let root = repo_root();
        let files = scan_project_folder(root.to_string_lossy().to_string(), Some("docs/MVP.md".to_string()))
            .expect("scan should succeed on the real repo");

        let paths: Vec<&str> = files.iter().map(|f| f.path.as_str()).collect();
        assert!(paths.contains(&"src/App.tsx"), "should find src/App.tsx");
        assert!(paths.contains(&"docs/MVP.md"), "should find docs/MVP.md");
        assert!(
            !paths.iter().any(|p| p.contains("node_modules")),
            "must never descend into node_modules"
        );
        assert!(
            !paths.iter().any(|p| p.contains("src-tauri/target")),
            "must never descend into target"
        );
        assert!(
            !paths.iter().any(|p| p.ends_with(".env") || p.ends_with(".env.local")),
            "must never return sensitive files"
        );

        let mvp_entry = files.iter().find(|f| f.path == "docs/MVP.md").unwrap();
        assert_eq!(mvp_entry.category, "mvp_scope");
        assert!(!mvp_entry.hash.is_empty(), "small text file should be hashed");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create core schema",
            sql: SCHEMA_V1,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "claude code tracking: project path, events, proposed updates",
            sql: SCHEMA_V2,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "evidence-based progress: mvp items, scope updates, folder snapshot",
            sql: SCHEMA_V3,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "xp + achievements: ship_events, achievements_unlocked",
            sql: SCHEMA_V4,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:missioncontrol.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            connect_claude_code,
            disconnect_claude_code,
            drain_cc_inbox,
            read_mvp_file,
            scan_project_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
