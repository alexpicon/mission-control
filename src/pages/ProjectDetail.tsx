import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Project, ShipResult, Update, UpdateKind } from "../types";
import { UPDATE_KINDS } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { ProgressBar } from "../components/ProgressBar";
import { StaleTag } from "../components/StaleTag";
import { DeadlineBadge } from "../components/DeadlineBadge";
import { ProposedUpdates } from "../components/ProposedUpdates";
import { MvpSection } from "../components/MvpSection";
import { relativeTime } from "../lib/time";
import {
  listUpdates,
  addUpdate,
  deleteProject,
  setFocusProject,
  setClaudeConnected,
} from "../db";

const KIND_STYLES: Record<UpdateKind, string> = {
  progress: "bg-emerald-50 text-emerald-700",
  decision: "bg-blue-50 text-blue-700",
  blocker: "bg-amber-50 text-amber-700",
  note: "bg-zinc-100 text-zinc-600",
};

export function ProjectDetail({
  project,
  onBack,
  onEdit,
  onDeleted,
  onChanged,
  onShipped,
}: {
  project: Project;
  onBack: () => void;
  onEdit: (p: Project) => void;
  onDeleted: () => void;
  onChanged: () => void;
  onShipped: (r: ShipResult) => void;
}) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [kind, setKind] = useState<UpdateKind>("progress");
  const [body, setBody] = useState("");
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  async function loadUpdates() {
    setUpdates(await listUpdates(project.id));
  }

  useEffect(() => {
    loadUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function submitUpdate(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    await addUpdate(project.id, kind, text);
    setBody("");
    await loadUpdates();
    onChanged(); // updated_at changed → refresh dashboard/staleness
  }

  async function toggleFocus() {
    await setFocusProject(project.is_focus === 1 ? null : project.id);
    onChanged();
  }

  async function remove() {
    const ok = window.confirm(`Delete "${project.name}"? This cannot be undone.`);
    if (!ok) return;
    await deleteProject(project.id);
    onDeleted();
  }

  async function connect() {
    if (!project.path) return;
    setConnectBusy(true);
    setConnectError(null);
    try {
      await invoke("connect_claude_code", { projectPath: project.path });
      await setClaudeConnected(project.id, true);
      onChanged();
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnectBusy(false);
    }
  }

  async function disconnect() {
    setConnectBusy(true);
    setConnectError(null);
    try {
      await invoke("disconnect_claude_code", { projectPath: project.path });
      await setClaudeConnected(project.id, false);
      onChanged();
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnectBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        onClick={onBack}
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Dashboard
      </button>

      {/* Header */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-900">
              {project.name}
            </h1>
            {project.is_focus === 1 && (
              <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Focus
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} />
          </div>
        </div>

        {project.goal && (
          <p className="mt-2 text-sm text-zinc-600">{project.goal}</p>
        )}

        <div className="mt-4">
          {project.progress_mode === "evidence" ? (
            <p className="text-xs text-zinc-400">
              Evidence-based progress — see the MVP section below. Manual % is not used
              while evidence mode is on.
            </p>
          ) : (
            <ProgressBar value={project.progress} />
          )}
        </div>

        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-zinc-400">Blocker</dt>
            <dd className="text-zinc-700">{project.blocker || "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-zinc-400">Next step</dt>
            <dd className="text-zinc-700">{project.next_step || "—"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-20 shrink-0 text-zinc-400">Updated</dt>
            <dd className="flex items-center gap-2 text-zinc-700">
              {relativeTime(project.updated_at)}
              <StaleTag project={project} />
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-20 shrink-0 text-zinc-400">Target</dt>
            <dd className="flex items-center gap-2 text-zinc-700">
              {project.deadline ? (
                <DeadlineBadge deadline={project.deadline} />
              ) : (
                <span className="text-zinc-400">no date set</span>
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-zinc-400">Folder</dt>
            <dd className="truncate font-mono text-xs text-zinc-600">
              {project.path || "—"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-zinc-400">MVP file</dt>
            <dd className="truncate font-mono text-xs text-zinc-600">
              {project.mvp_file_path || "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => onEdit(project)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Edit
          </button>
          <button
            onClick={toggleFocus}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {project.is_focus === 1 ? "Clear focus" : "Set as focus"}
          </button>
          <button
            onClick={remove}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Claude Code connection */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Claude Code</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {project.claude_connected === 1
                ? "Connected. Sessions in this folder create proposed updates below."
                : "Connect to auto-capture sessions run in this folder as proposed updates."}
            </p>
          </div>
          {project.claude_connected === 1 ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Connected
            </span>
          ) : null}
        </div>

        {!project.path ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Add a folder path first (Edit → Folder path), then connect.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {project.claude_connected === 1 ? (
              <button
                onClick={disconnect}
                disabled={connectBusy}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                {connectBusy ? "Working…" : "Disconnect"}
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={connectBusy}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
              >
                {connectBusy ? "Connecting…" : "Connect Claude Code"}
              </button>
            )}
          </div>
        )}

        {connectError && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {connectError}
          </p>
        )}
      </div>

      {/* Evidence-based progress: MVP file, checklist, XP shipping, scope/item updates */}
      <MvpSection project={project} onProjectChanged={onChanged} onShipped={onShipped} />

      {/* Claude Code session log (free-text summaries) — require explicit approval */}
      <ProposedUpdates
        projectId={project.id}
        onApplied={async () => {
          await loadUpdates();
          onChanged();
        }}
      />

      {/* Add update */}
      <form
        onSubmit={submitUpdate}
        className="rounded-xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">
          Add progress update
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as UpdateKind)}
            className="rounded-lg border border-zinc-300 px-2 py-2 text-sm capitalize outline-none focus:border-zinc-500"
          >
            {UPDATE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="One line — what happened?"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
          <button
            type="submit"
            disabled={!body.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </form>

      {/* Timeline */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Recent updates
        </h2>
        {updates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-400">
            No updates yet. Add one after your next work block.
          </p>
        ) : (
          <ul className="space-y-2">
            {updates.map((u) => (
              <li
                key={u.id}
                className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3"
              >
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${KIND_STYLES[u.kind]}`}
                >
                  {u.kind}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-zinc-800">{u.body}</p>
                  <p className="text-xs text-zinc-400">
                    {relativeTime(u.created_at)}
                    {u.source === "claude-code" && " · from Claude Code"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
