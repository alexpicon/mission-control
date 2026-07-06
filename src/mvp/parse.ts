// Local, deterministic parser for MVP/spec markdown. No AI required.
//
// Recognizes:
//   ## Must have
//   - [x] Done thing
//   - [ ] Not done thing
//
// Headings are matched loosely (any heading level, "must-have(s)", "must have",
// etc.). Checkbox items are only counted while under a recognized heading —
// anything outside must_have/should_have/nice_to_have sections is ignored
// rather than guessed at.

import type { MvpPriority, ParsedMvpItem } from "../types";

const HEADING_RE = /^\s{0,3}#{1,6}\s+(.+?)\s*$/;
const CHECKBOX_RE = /^\s*[-*]\s*\[([ xX])\]\s*(.+?)\s*$/;

function matchSection(heading: string): MvpPriority | null {
  const h = heading.toLowerCase();
  if (/must[\s-]?have/.test(h)) return "must_have";
  if (/should[\s-]?have/.test(h)) return "should_have";
  if (/nice[\s-]?to[\s-]?have|could[\s-]?have/.test(h)) return "nice_to_have";
  return null;
}

export function parseMvpMarkdown(content: string): ParsedMvpItem[] {
  const lines = content.split(/\r?\n/);
  let section: MvpPriority | null = null;
  const items: ParsedMvpItem[] = [];

  for (const line of lines) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      section = matchSection(heading[1]);
      continue;
    }
    if (!section) continue;
    const box = line.match(CHECKBOX_RE);
    if (!box) continue;
    const done = box[1].toLowerCase() === "x";
    const title = box[2].trim();
    if (!title) continue;
    items.push({ title, description: "", priority: section, done });
  }

  return items;
}
