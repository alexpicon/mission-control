// Builds a PROPOSED update from a Claude Code session's raw events.
// Deterministic and fact-based only — it reports what actually happened
// (prompts, files touched, commands run). It never fabricates "Done" claims.

import type { CcEvent, Project } from "../types";

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const TEST_LINT_RE = /\b(test|tests|vitest|jest|lint|eslint|tsc|typecheck|type-check|build|check|pytest|cargo (test|check|clippy))\b/i;

function parse(e: CcEvent): any {
  try {
    return JSON.parse(e.payload);
  } catch {
    return {};
  }
}

function truncate(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1) + "…" : one;
}

function relativize(file: string, projectPath: string): string {
  const base = projectPath.replace(/\/+$/, "");
  if (base && (file === base || file.startsWith(base + "/"))) {
    return file.slice(base.length + 1) || file;
  }
  return file;
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

// Claude Code injects machine-generated turns (background-task notifications,
// system reminders, slash-command echoes) into the transcript as user messages,
// so the UserPromptSubmit hook sees them exactly like something you typed.
// They aren't intent — they're plumbing — and they drown out the real prompt.
const MACHINE_PROMPT = [
  /^\s*<task-notification>/i,
  /^\s*\[SYSTEM NOTIFICATION/i,
  /^\s*<system-reminder>/i,
  /^\s*<local-command-caveat>/i,
  /^\s*<command-name>/i,
  /^\s*<command-message>/i,
  /^\s*Caveat: The messages below were generated/i,
];

function isMachinePrompt(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return MACHINE_PROMPT.some((re) => re.test(t));
}

export interface BuiltSummary {
  summary: string;
  filesChanged: string; // newline-separated
  hasEvidence: boolean;
}

export function buildSummary(project: Project, events: CcEvent[]): BuiltSummary {
  const prompts: string[] = [];
  const files: string[] = [];
  const commands: string[] = [];
  const tools = new Set<string>();

  for (const e of events) {
    const p = parse(e);
    if (
      e.event_name === "UserPromptSubmit" &&
      typeof p.prompt === "string" &&
      !isMachinePrompt(p.prompt)
    ) {
      prompts.push(p.prompt);
    }
    if (e.event_name === "PostToolUse") {
      if (e.tool_name) tools.add(e.tool_name);
      const input = p.tool_input ?? {};
      if (EDIT_TOOLS.has(e.tool_name)) {
        const f = input.file_path ?? input.notebook_path;
        if (typeof f === "string") files.push(relativize(f, project.path));
      }
      if (e.tool_name === "Bash" && typeof input.command === "string") {
        commands.push(input.command);
      }
    }
  }

  const uPrompts = uniq(prompts).map((s) => truncate(s, 160)).slice(0, 3);
  const uFiles = uniq(files).slice(0, 25);
  const uCommands = uniq(commands);
  const testCmds = uCommands.filter((c) => TEST_LINT_RE.test(c)).slice(0, 8);
  const otherCmds = uCommands.filter((c) => !TEST_LINT_RE.test(c)).slice(0, 10);

  const hasEvidence =
    uPrompts.length > 0 || uFiles.length > 0 || uCommands.length > 0;

  if (!hasEvidence) {
    return {
      summary: "Not enough data to summarize this session.",
      filesChanged: "",
      hasEvidence: false,
    };
  }

  const lines: string[] = [`Claude Code session`, `Project: ${project.name}`, ""];

  if (uPrompts.length) {
    lines.push("Intent:");
    uPrompts.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }

  lines.push(`Changed files (${uFiles.length}):`);
  if (uFiles.length) uFiles.forEach((f) => lines.push(`- ${f}`));
  else lines.push("- none detected");
  lines.push("");

  if (otherCmds.length) {
    lines.push("Commands:");
    otherCmds.forEach((c) => lines.push(`- ${truncate(c, 120)}`));
    lines.push("");
  }

  lines.push("Tests / lint:");
  if (testCmds.length) testCmds.forEach((c) => lines.push(`- ${truncate(c, 120)}`));
  else lines.push("- none detected");
  lines.push("");

  lines.push("Next:");
  lines.push("- Review, then approve / edit / reject.");

  return {
    summary: lines.join("\n").trim(),
    filesChanged: uFiles.join("\n"),
    hasEvidence: true,
  };
}
