// AI "deep read" for ONE project's next task. Optional — the deterministic
// picker in mvp/nextMove.ts always works without a key; this reads the
// project's real file tree alongside its checklist so the pick reflects the
// actual state of the codebase, and adds a concrete first step.

import { invoke } from "@tauri-apps/api/core";
import type { ScannedFile } from "../types";
import type { NextMove, ProjectSnapshot } from "../mvp/nextMove";
import { completeJson, MissingApiKeyError } from "./provider";
import { nextMoveSystem } from "./prompts";
import { daysSince } from "../lib/time";

const MAX_TREE_FILES = 220;

// A compact view of the codebase: directories with their file counts, plus a
// capped list of real paths. Paths and categories only — never file contents,
// and the Rust scanner already excludes secrets, binaries and junk.
async function buildFileTree(projectPath: string): Promise<string> {
  if (!projectPath.trim()) return "";
  let files: ScannedFile[];
  try {
    files = await invoke("scan_project_folder", { path: projectPath, mvpRelPath: null });
  } catch {
    return "";
  }
  if (!files.length) return "";

  const byDir = new Map<string, string[]>();
  for (const f of files) {
    const slash = f.path.lastIndexOf("/");
    const dir = slash === -1 ? "." : f.path.slice(0, slash);
    const name = slash === -1 ? f.path : f.path.slice(slash + 1);
    const list = byDir.get(dir) ?? [];
    list.push(name);
    byDir.set(dir, list);
  }

  const dirs = [...byDir.entries()].sort((a, b) => b[1].length - a[1].length);
  const lines: string[] = [`FILE TREE (${files.length} tracked files):`];
  let shown = 0;
  for (const [dir, names] of dirs) {
    if (shown >= MAX_TREE_FILES) {
      lines.push(`  … ${dirs.length - lines.length + 1} more directories`);
      break;
    }
    const take = names.slice(0, 12);
    shown += take.length;
    const extra = names.length > take.length ? ` (+${names.length - take.length} more)` : "";
    lines.push(`  ${dir}/: ${take.join(", ")}${extra}`);
  }
  return lines.join("\n");
}

function buildContext(snapshot: ProjectSnapshot, fileTree: string): string {
  const { project, items } = snapshot;
  const active = items.filter((i) => i.status !== "cut");
  const open = active.filter((i) => i.status !== "done");
  const mustLeft = open.filter((i) => i.priority === "must_have").length;
  const doneCount = active.length - open.length;

  const openLines = open
    .slice(0, 40)
    .map((i) => {
      const base = `  - [${i.priority}] [${i.status}] ${i.title}`;
      const files = i.evidence
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .map((l) => l.slice(2).trim())
        .slice(0, 4);
      return files.length ? `${base}\n      recent files: ${files.join(", ")}` : base;
    })
    .join("\n");

  const doneLines = active
    .filter((i) => i.status === "done")
    .slice(0, 30)
    .map((i) => `  - ${i.title}`)
    .join("\n");

  return [
    `PROJECT: ${project.name}`,
    project.goal ? `Goal: ${project.goal}` : "",
    `Done: ${doneCount}/${active.length} | must-haves left: ${mustLeft} | last touched ${daysSince(project.updated_at)}d ago`,
    "",
    "OPEN TASKS (pick one of these):",
    openLines || "  (none)",
    "",
    doneLines ? `ALREADY DONE:\n${doneLines}` : "",
    "",
    fileTree,
  ]
    .filter(Boolean)
    .join("\n");
}

interface RawMove {
  title?: unknown;
  reason?: unknown;
  firstStep?: unknown;
}

// Returns null if there's no key, the model fails, or it names a task that
// doesn't exist — callers fall back to the deterministic pick rather than
// showing anything invented.
export async function aiNextMoveForProject(
  snapshot: ProjectSnapshot
): Promise<NextMove | null> {
  const open = snapshot.items.filter((i) => i.status !== "done" && i.status !== "cut");
  if (open.length === 0) return null;

  try {
    const fileTree = await buildFileTree(snapshot.project.path);
    const raw = await completeJson<RawMove>({
      system: nextMoveSystem(),
      messages: [{ role: "user", content: buildContext(snapshot, fileTree) }],
      maxTokens: 500,
    });

    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) return null;

    // Validate against real data — the model must have picked an actual task.
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const item = open.find((i) => norm(i.title) === norm(title));
    if (!item) return null;

    return {
      projectId: snapshot.project.id,
      projectName: snapshot.project.name,
      itemId: item.id,
      title: item.title,
      priority: item.priority,
      reason: typeof raw.reason === "string" ? raw.reason : "",
      firstStep: typeof raw.firstStep === "string" ? raw.firstStep : undefined,
      source: "ai",
    };
  } catch (e) {
    if (e instanceof MissingApiKeyError) return null;
    return null;
  }
}
