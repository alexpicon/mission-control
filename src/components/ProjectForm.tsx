import { useState } from "react";
import type { Project, ProjectInput, Status } from "../types";
import { STATUSES } from "../types";

const EMPTY: ProjectInput = {
  name: "",
  goal: "",
  status: "Moving",
  progress: 0,
  blocker: "",
  next_step: "",
  path: "",
  mvp_file_path: "",
  deadline: "",
};

function fromProject(p: Project): ProjectInput {
  return {
    name: p.name,
    goal: p.goal,
    status: p.status,
    progress: p.progress,
    blocker: p.blocker,
    next_step: p.next_step,
    path: p.path,
    mvp_file_path: p.mvp_file_path,
    deadline: p.deadline,
  };
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";
const labelCls = "mb-1 block text-xs font-medium text-zinc-500";

export function ProjectForm({
  project,
  onSave,
  onCancel,
}: {
  project?: Project;
  onSave: (input: ProjectInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ProjectInput>(
    project ? fromProject(project) : EMPTY
  );

  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canSave = form.name.trim().length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave({ ...form, name: form.name.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          {project ? "Edit project" : "New project"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="pf-name">
              Name
            </label>
            <input
              id="pf-name"
              className={inputCls}
              value={form.name}
              autoFocus
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. AI Assistant App"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="pf-goal">
              Goal
            </label>
            <textarea
              id="pf-goal"
              className={inputCls}
              rows={2}
              value={form.goal}
              onChange={(e) => set("goal", e.target.value)}
              placeholder="What does 'done' look like?"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="pf-status">
              Status
            </label>
            <select
              id="pf-status"
              className={inputCls}
              value={form.status}
              onChange={(e) => set("status", e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="pf-blocker">
              Blocker
            </label>
            <input
              id="pf-blocker"
              className={inputCls}
              value={form.blocker}
              onChange={(e) => set("blocker", e.target.value)}
              placeholder="What's in the way? (leave empty if none)"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="pf-next">
              Next step
            </label>
            <input
              id="pf-next"
              className={inputCls}
              value={form.next_step}
              onChange={(e) => set("next_step", e.target.value)}
              placeholder="The single next action"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="pf-path">
              Folder path{" "}
              <span className="font-normal text-zinc-400">
                (optional — enables Claude Code tracking)
              </span>
            </label>
            <input
              id="pf-path"
              className={inputCls}
              value={form.path}
              onChange={(e) => set("path", e.target.value)}
              placeholder="/Users/you/code/my-project"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="pf-mvp">
              MVP file path{" "}
              <span className="font-normal text-zinc-400">
                (optional — enables evidence-based progress)
              </span>
            </label>
            <input
              id="pf-mvp"
              className={inputCls}
              value={form.mvp_file_path}
              onChange={(e) => set("mvp_file_path", e.target.value)}
              placeholder="docs/MVP.md"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="pf-deadline">
              Target date{" "}
              <span className="font-normal text-zinc-400">
                (optional — shows a live countdown)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="pf-deadline"
                type="date"
                className={inputCls}
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
              />
              {form.deadline && (
                <button
                  type="button"
                  onClick={() => set("deadline", "")}
                  className="shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <details className="rounded-lg border border-zinc-200 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-zinc-500">
              Manual progress % (fallback only — used until an MVP file takes over)
            </summary>
            <div className="mt-3">
              <label className={labelCls} htmlFor="pf-progress">
                Progress: {form.progress}%
              </label>
              <input
                id="pf-progress"
                type="range"
                min={0}
                max={100}
                step={5}
                className="mt-2 w-full accent-zinc-800"
                value={form.progress}
                onChange={(e) => set("progress", Number(e.target.value))}
              />
            </div>
          </details>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            {project ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );
}
