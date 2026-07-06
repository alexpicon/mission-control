use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};
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
            drain_cc_inbox
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
