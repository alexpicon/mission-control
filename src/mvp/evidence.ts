// Matches a batch of changed files (a Claude Code session's files, or a
// folder-scan diff) to MVP items by keyword overlap between the item title
// and the file paths. Deterministic — no AI, no guessing "by vibes".
//
// Design note: a file only needs to keyword-match an item once to trigger a
// proposal, but the evidence shown includes the WHOLE batch (the files that
// changed together), because that's what actually explains the work — e.g.
// editing Widget.tsx AND tauri.conf.json in the same session is evidence for
// "Floating widget" even though "tauri.conf.json" alone shares no keywords
// with that title.

import type { Confidence, MvpItem } from "../types";

const STOPWORDS = new Set([
  "have",
  "with",
  "from",
  "this",
  "that",
  "into",
  "your",
  "should",
  "must",
  "nice",
  "page",
  "over",
  "when",
  "then",
  "such",
  "each",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

export interface EvidenceMatch {
  item: MvpItem;
  matchedFiles: string[]; // the subset of the batch that keyword-matched this item
  evidenceFiles: string[]; // the full batch, shown as context
  confidence: Confidence;
}

// Only items that could plausibly move (not already done, not cut) are
// candidates — evidence should never propose downgrading finished work, and
// cut items are out of scope entirely.
export function matchFilesToItems(batch: string[], items: MvpItem[]): EvidenceMatch[] {
  if (batch.length === 0) return [];
  const candidates = items.filter((i) => i.status !== "done" && i.status !== "cut");
  const fileTokens = batch.map((f) => ({ file: f, tokens: new Set(tokenize(f)) }));

  const matches: EvidenceMatch[] = [];
  for (const item of candidates) {
    const itemTokens = tokenize(item.title);
    if (itemTokens.length === 0) continue;
    const matchedFiles = fileTokens
      .filter(({ tokens }) => itemTokens.some((t) => tokens.has(t)))
      .map(({ file }) => file);
    if (matchedFiles.length === 0) continue;

    const confidence: Confidence =
      matchedFiles.length >= 3 ? "high" : matchedFiles.length === 2 ? "medium" : "low";

    matches.push({
      item,
      matchedFiles,
      evidenceFiles: batch.slice(0, 25),
      confidence,
    });
  }
  return matches;
}

export function formatEvidence(match: EvidenceMatch): string {
  const lines = [`Files changed:`, ...match.evidenceFiles.map((f) => `- ${f}`)];
  return lines.join("\n");
}
