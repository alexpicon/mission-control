import { useEffect, useState } from "react";
import type { Project } from "../types";
import { countCcEvents, countResolvedProposals } from "../db";

interface Step {
  label: string;
  done: boolean;
}

// First-run guidance: makes the evidence-based workflow obvious. Auto-hides
// once every step is done so it doesn't nag a project that's already set up.
export function SetupChecklist({ projects }: { projects: Project[] }) {
  const [ccEvents, setCcEvents] = useState(0);
  const [resolved, setResolved] = useState(0);

  useEffect(() => {
    (async () => {
      setCcEvents(await countCcEvents());
      setResolved(await countResolvedProposals());
    })();
  }, [projects.length]);

  const hasProject = projects.length > 0;
  const hasFolder = projects.some((p) => p.path.trim().length > 0);
  const hasMvpFile = projects.some((p) => p.mvp_file_path.trim().length > 0);
  const hasClaudeConnected = projects.some((p) => p.claude_connected === 1);

  const steps: Step[] = [
    { label: "Add a project", done: hasProject },
    { label: "Choose the project folder", done: hasFolder },
    { label: "Choose or create an MVP file", done: hasMvpFile },
    { label: "Connect Claude Code", done: hasClaudeConnected },
    { label: "Run Claude Code in the project", done: ccEvents > 0 },
    { label: "Review proposed updates", done: resolved > 0 },
  ];

  if (steps.every((s) => s.done)) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Get evidence-based progress</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        Choose a project folder and MVP file to enable automatic progress tracking.
      </p>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                s.done ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-400"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span className={s.done ? "text-zinc-400 line-through" : "text-zinc-700"}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
