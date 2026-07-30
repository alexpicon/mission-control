// Orchestrates the MVP-file and folder-tracking flows. This is the only place
// that decides when to propose a scope update or an item update — pages call
// these functions, they never talk to invoke()/the parser/the diff logic directly.

import { invoke } from "@tauri-apps/api/core";
import type {
  FolderSnapshotEntry,
  MvpItem,
  ParsedMvpItem,
  Project,
  ScanCategory,
  ScannedFile,
  ShipResult,
} from "../types";
import {
  cutMvpItemByTitle,
  findScopeUpdateByHash,
  getFolderSnapshot,
  getScopeUpdate,
  insertMvpItem,
  insertScopeUpdate,
  listMvpItems,
  replaceFolderSnapshot,
  setMvpFileSeen,
  setMvpItemStatus,
  setProgressMode,
  setScopeUpdateStatus,
  updateMvpItemFields,
  upsertProposedItemUpdate,
} from "../db";
import { parseMvpMarkdown } from "./parse";
import { computeMvpProgress, diffMvpItems, hasMeaningfulDiff, simulateApply } from "./diff";
import type { MvpProgress } from "./diff";
import { matchFilesToItems, formatEvidence } from "./evidence";
import { extractMvpItemsWithAI } from "../ai/mvpExtract";
import { hasApiKey } from "../ai/provider";
import { shipMvpItem } from "../xp/ship";

export interface CheckMvpResult {
  status: "no_path" | "not_found" | "no_items_found" | "unchanged" | "proposed";
  message?: string;
  // Items auto-shipped because their checkbox flipped [ ] -> [x] in the file.
  // Completion is applied automatically (it's the user's own gesture in their
  // own file); only SCOPE changes (add/remove/re-prioritize) need review.
  shipResults: ShipResult[];
  scopeProposed: boolean;
}

// Matches parsed checkbox state to current items by title, and applies
// completion changes: [ ]->[x] ships the item (auto, awards XP once);
// [x]->[ ] un-ships it (status back to not_started — XP already earned stays).
async function syncCompletions(
  project: Project,
  current: MvpItem[],
  parsed: ParsedMvpItem[]
): Promise<ShipResult[]> {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const parsedByTitle = new Map(parsed.map((p) => [norm(p.title), p]));
  const results: ShipResult[] = [];

  for (const item of current) {
    if (item.status === "cut") continue;
    const p = parsedByTitle.get(norm(item.title));
    if (!p) continue;
    if (p.done && item.status !== "done") {
      results.push(await shipMvpItem(item, project));
    } else if (!p.done && item.status === "done") {
      await setMvpItemStatus(item.id, "not_started");
    }
  }
  return results;
}

// Re-reads the connected MVP file. Applies checkbox completion changes
// automatically (with XP), and if the file's SCOPE changed (items added,
// removed, or re-prioritized) creates a proposed scope update for review.
// Scope is NEVER changed here without approval; completion always is.
export async function checkMvpFile(project: Project): Promise<CheckMvpResult> {
  const base: CheckMvpResult = { status: "unchanged", shipResults: [], scopeProposed: false };
  if (!project.mvp_file_path.trim()) return { ...base, status: "no_path" };

  let file: { content: string; hash: string; mtime: string };
  try {
    file = await invoke("read_mvp_file", { path: absoluteMvpPath(project) });
  } catch (e) {
    return { ...base, status: "not_found", message: e instanceof Error ? e.message : String(e) };
  }

  if (file.hash === project.mvp_file_hash) return base; // seen this exact content already

  let parsed = parseMvpMarkdown(file.content);
  let usedAi = false;
  if (parsed.length === 0 && (await hasApiKey())) {
    const ai = await extractMvpItemsWithAI(file.content);
    if (ai && ai.length) {
      parsed = ai;
      usedAi = true;
    }
  }

  if (parsed.length === 0) {
    return {
      ...base,
      status: "no_items_found",
      message:
        'No checklist items found. Add items like "- [ ] Thing to build" under a "## Must have" heading, or add an API key in Settings for automatic extraction from prose.',
    };
  }

  const current = await listMvpItems(project.id);

  // 1) Completion sync (auto, with XP) — always runs.
  const shipResults = await syncCompletions(project, current, parsed);

  // 2) Scope diff (add/remove/re-prioritize) — needs review.
  const existingScope = await findScopeUpdateByHash(project.id, file.hash);
  const diff = diffMvpItems(current, parsed, usedAi);
  const scopeChanged = hasMeaningfulDiff(diff);

  if (scopeChanged && !existingScope) {
    const refreshed = await listMvpItems(project.id); // post-completion state
    const oldProgress = computeMvpProgress(refreshed).pct;
    const newProgress = computeMvpProgress(simulateApply(refreshed, diff)).pct;
    await insertScopeUpdate({
      project_id: project.id,
      file_hash: file.hash,
      file_mtime: file.mtime,
      diff_json: JSON.stringify(diff),
      old_progress: oldProgress,
      new_progress: newProgress,
    });
  } else if (!scopeChanged) {
    // Only completion changed (or nothing) — safe to mark this content seen so
    // we don't re-scan it forever. Scope changes intentionally leave the hash
    // un-advanced until approved, so they stay visible.
    await setMvpFileSeen(project.id, file.hash, file.mtime);
  }

  return {
    status: scopeChanged ? "proposed" : "unchanged",
    shipResults,
    scopeProposed: scopeChanged,
  };
}

// Applies an approved (possibly edited-down) scope update: adds the selected
// new items, cuts the selected removed items, applies all priority changes,
// and advances the project's "seen" MVP file hash so we stop re-proposing it.
export async function applyScopeUpdate(
  scopeUpdateId: number,
  project: Project,
  selection: { addTitles: Set<string>; removeTitles: Set<string> }
): Promise<void> {
  const row = await getScopeUpdate(scopeUpdateId);
  if (!row) return;
  const diff = JSON.parse(row.diff_json) as ReturnType<typeof diffMvpItems>;

  for (const added of diff.added) {
    if (!selection.addTitles.has(added.title)) continue;
    await insertMvpItem({
      project_id: project.id,
      title: added.title,
      description: added.description,
      priority: added.priority,
      source: diff.usedAi ? "ai_extracted" : "mvp_file",
    });
  }

  // Items that were already checked [x] in the file import as DONE — and each
  // one credits XP once (via shipMvpItem's guard), so linking a project you've
  // already built reflects that work in your level. Done silently (no toast
  // spam); the level bar animates up on the next reload.
  const importedDone = new Set(
    diff.added
      .filter((a) => a.done && selection.addTitles.has(a.title))
      .map((a) => a.title.trim().toLowerCase())
  );
  if (importedDone.size > 0) {
    const justAdded = await listMvpItems(project.id);
    for (const item of justAdded) {
      if (item.status !== "done" && importedDone.has(item.title.trim().toLowerCase())) {
        await shipMvpItem(item, project);
      }
    }
  }

  for (const removed of diff.removed) {
    if (!selection.removeTitles.has(removed.title)) continue;
    await cutMvpItemByTitle(project.id, removed.title);
  }

  for (const changed of diff.changed) {
    const current = await listMvpItems(project.id);
    const match = current.find(
      (i) => i.title.trim().toLowerCase() === changed.title.trim().toLowerCase()
    );
    if (match) await updateMvpItemFields(match.id, { priority: changed.after.priority });
  }

  await setMvpFileSeen(project.id, row.file_hash, row.file_mtime);
  await setScopeUpdateStatus(scopeUpdateId, "approved");

  const items = await listMvpItems(project.id);
  if (items.some((i) => i.status !== "cut") && project.progress_mode === "manual") {
    await setProgressMode(project.id, "evidence");
  }
}

// --- Folder tracking ---------------------------------------------------------

const TRACKED_CATEGORIES: ScanCategory[] = ["code", "docs", "tests", "config", "dependencies"];

export interface FolderScanResult {
  changedCount: number;
  changedFiles: string[]; // tracked-category files that are new or modified
}

// Scans the project folder (bounded, ignore-listed — see the Rust side),
// diffs against the last snapshot, and — if the project is in evidence mode
// with MVP items — proposes item status updates for anything the changed
// files keyword-match. Manual/on-demand only; this does not run on a timer.
export async function scanFolder(project: Project): Promise<FolderScanResult> {
  if (!project.path.trim()) return { changedCount: 0, changedFiles: [] };

  const mvpRel = relativeMvpPath(project);
  const scanned: ScannedFile[] = await invoke("scan_project_folder", {
    path: project.path,
    mvpRelPath: mvpRel,
  });

  const previous = await getFolderSnapshot(project.id);
  const prevByPath = new Map(previous.map((f) => [f.file_path, f]));

  const changedFiles: string[] = [];
  for (const f of scanned) {
    const prev = prevByPath.get(f.path);
    const isNewOrChanged =
      !prev || (f.hash && prev.hash !== f.hash) || (!f.hash && (prev.mtime !== f.mtime || prev.size !== f.size));
    if (isNewOrChanged && TRACKED_CATEGORIES.includes(f.category)) {
      changedFiles.push(f.path);
    }
  }

  const snapshot: FolderSnapshotEntry[] = scanned.map((f) => ({
    project_id: project.id,
    file_path: f.path,
    category: f.category,
    hash: f.hash,
    mtime: f.mtime,
    size: f.size,
  }));
  await replaceFolderSnapshot(project.id, snapshot);

  if (changedFiles.length > 0 && project.progress_mode === "evidence") {
    const items = await listMvpItems(project.id);
    const matches = matchFilesToItems(changedFiles, items);
    for (const m of matches) {
      await upsertProposedItemUpdate({
        project_id: project.id,
        mvp_item_id: m.item.id,
        suggested_status: "in_progress",
        evidence: formatEvidence(m),
        confidence: m.confidence,
        source: "folder-scan",
        session_id: "",
      });
    }
  }

  return { changedCount: changedFiles.length, changedFiles };
}

// Resolve the MVP file to an absolute path for reading. A relative path (e.g.
// "docs/MVP.md") is joined to the project folder; an absolute path is used as-is.
function absoluteMvpPath(project: Project): string {
  const p = project.mvp_file_path.trim();
  if (p.startsWith("/")) return p;
  const base = project.path.replace(/\/+$/, "");
  return base ? `${base}/${p}` : p;
}

function relativeMvpPath(project: Project): string | null {
  if (!project.mvp_file_path || !project.path) return null;
  const base = project.path.replace(/\/+$/, "");
  if (project.mvp_file_path.startsWith(base + "/")) {
    return project.mvp_file_path.slice(base.length + 1);
  }
  if (!project.mvp_file_path.startsWith("/")) return project.mvp_file_path; // already relative
  return null;
}

export type { MvpProgress } from "./diff";

// Loads MVP progress for every evidence-mode project, keyed by project id —
// used by the dashboard/cards so they don't each fetch independently.
export async function loadMvpProgressMap(
  projects: Project[]
): Promise<Record<number, MvpProgress>> {
  const map: Record<number, MvpProgress> = {};
  for (const p of projects) {
    if (p.progress_mode !== "evidence") continue;
    const items = await listMvpItems(p.id);
    map[p.id] = computeMvpProgress(items);
  }
  return map;
}
