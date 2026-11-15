import type { ParsedBlock } from "../parser/parseSchedule";
import { createBlocks, replan } from "./actions";
import type { Day } from "./types";

/**
 * 読み取った予定をその日に取り込む。
 * まだ何も始めていなければ丸ごと差し替え、始めたあとなら貼り直し（F8）として扱う
 */
export function importPlan(
  existing: Day | null,
  date: string,
  parsed: ParsedBlock[],
  now: number,
  newId?: () => string,
): { day: Day; excluded: ParsedBlock[] } {
  const sorted = [...parsed].sort((a, b) => a.start - b.start);
  const started = existing?.blocks.some((block) => block.status !== "pending") ?? false;

  if (!existing || !started) {
    const blocks = createBlocks(sorted, newId);
    return { day: { date, blocks, originalPlan: blocks }, excluded: [] };
  }

  const { blocks, excluded } = replan(existing.blocks, sorted, now, newId);
  return { day: { ...existing, blocks }, excluded };
}
