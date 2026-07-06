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
  source      TEXT    NOT NULL DEFAULT 'manual',   -- manual | claude-code (future)
  status      TEXT    NOT NULL DEFAULT 'accepted', -- accepted | proposed | rejected (future approve/edit/reject)
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create core schema",
        sql: SCHEMA_V1,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:missioncontrol.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
