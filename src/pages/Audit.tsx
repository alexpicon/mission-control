import { useState } from "react";
import type { Project } from "../types";
import { complete, MissingApiKeyError } from "../ai/provider";
import { auditSystem } from "../ai/prompts";
import { projectContext } from "../ai/context";
import { listUpdates } from "../db";

export function Audit({
  projects,
  onGoToSettings,
}: {
  projects: Project[];
  onGoToSettings: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needKey, setNeedKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (selectedId === "" || busy) return;
    const project = projects.find((p) => p.id === selectedId);
    if (!project) return;

    setBusy(true);
    setResult(null);
    setError(null);
    setNeedKey(false);

    try {
      const updates = await listUpdates(project.id);
      const out = await complete({
        system: auditSystem(projectContext(project, updates)),
        messages: [{ role: "user", content: "Audit this project." }],
        maxTokens: 500,
      });
      setResult(out);
    } catch (err) {
      if (err instanceof MissingApiKeyError) setNeedKey(true);
      else setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900">Product audit</h1>
        <p className="text-sm text-zinc-500">
          Pick a project. Get what's missing and the best next move.
        </p>
      </header>

      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-400">
          Add a project first.
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            value={selectedId}
            onChange={(e) =>
              setSelectedId(e.target.value ? Number(e.target.value) : "")
            }
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={run}
            disabled={selectedId === "" || busy}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            {busy ? "Auditing…" : "Run audit"}
          </button>
        </div>
      )}

      {needKey && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">No API key set.</p>
          <p className="mt-1">The audit needs your Anthropic API key.</p>
          <button
            onClick={onGoToSettings}
            className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Add API key in Settings
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <pre className="whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 font-sans text-sm text-zinc-800">
          {result}
        </pre>
      )}
    </div>
  );
}
