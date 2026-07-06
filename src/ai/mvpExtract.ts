// AI fallback for extracting MVP items from a messy doc that doesn't use
// "- [ ]" checkboxes. Only called when the local parser (src/mvp/parse.ts)
// finds zero items AND an API key is configured — never the primary path.

import type { MvpPriority, ParsedMvpItem } from "../types";
import { completeJson, MissingApiKeyError } from "./provider";
import { mvpExtractionSystem } from "./prompts";

const VALID_PRIORITIES: MvpPriority[] = ["must_have", "should_have", "nice_to_have"];

interface RawExtraction {
  items?: { title?: unknown; description?: unknown; priority?: unknown }[];
}

// Returns null (not an empty array) when extraction couldn't run or produced
// nothing usable — callers must treat that as "Not enough data", not "0 items
// confirmed by AI".
export async function extractMvpItemsWithAI(content: string): Promise<ParsedMvpItem[] | null> {
  try {
    const raw = await completeJson<RawExtraction>({
      system: mvpExtractionSystem(),
      messages: [{ role: "user", content: content.slice(0, 12000) }],
      maxTokens: 1500,
    });
    if (!Array.isArray(raw.items)) return null;

    const items: ParsedMvpItem[] = [];
    for (const r of raw.items) {
      if (typeof r.title !== "string" || !r.title.trim()) continue;
      const priority = VALID_PRIORITIES.includes(r.priority as MvpPriority)
        ? (r.priority as MvpPriority)
        : "should_have";
      items.push({
        title: r.title.trim(),
        description: typeof r.description === "string" ? r.description : "",
        priority,
        done: false, // AI extraction only proposes items; done-ness needs real evidence
      });
    }
    return items.length ? items : null;
  } catch (e) {
    if (e instanceof MissingApiKeyError) return null;
    return null; // model error / bad JSON — treat as "couldn't extract", never fabricate
  }
}
