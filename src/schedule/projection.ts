import type { Block } from "./types";

export type TimeRange = { start: number; end: number };

/** 前のブロックが固定ブロックに食い込みそうなこと */
export type Conflict = { blockId: string; fixedBlockId: string; minutes: number };

export type Projection = {
  /** ブロックごとの見込みの時刻。スキップしたブロックは含まない */
  times: Record<string, TimeRange>;
  /** 最後のブロックが終わる見込みの時刻 */
  finishAt: number | null;
  /** 予定どおりに進んだ場合の終了時刻（スキップしたブロックは除く）。finishAt と比べて遅れを出す */
  plannedFinishAt: number | null;
  /** 進行中のブロックと、予定の終わりまでの残り（分）。超えるとマイナス */
  current: { id: string; remaining: number } | null;
  conflicts: Conflict[];
};

/**
 * 今の時刻から、各ブロックの見込みの時刻を計算する。
 * 遅れは後ろへ押し出すが、早く終わっても始めていないブロックは予定より前に詰めない。
 * 固定ブロックは予定の時刻から動かさない
 */
export function project(blocks: Block[], now: number): Projection {
  const times: Record<string, TimeRange> = {};
  const conflicts: Conflict[] = [];
  let current: Projection["current"] = null;
  let cursor = now;
  let previousId: string | null = null;

  for (const block of blocks) {
    if (block.status === "skipped") continue;

    const range = projectOne(block, cursor, now);
    times[block.id] = range;

    if (block.status === "active") {
      const target = block.fixed ? block.plannedEnd : range.start + duration(block);
      current = { id: block.id, remaining: target - now };
    }
    if (block.status === "pending" && block.fixed && previousId !== null && cursor > block.plannedStart) {
      conflicts.push({ blockId: previousId, fixedBlockId: block.id, minutes: cursor - block.plannedStart });
    }

    if (block.status !== "done") cursor = Math.max(cursor, range.end);
    previousId = block.id;
  }

  const plannedEnds = blocks.filter((block) => block.status !== "skipped").map((block) => block.plannedEnd);
  return {
    times,
    finishAt: maxOrNull(Object.values(times).map((range) => range.end)),
    plannedFinishAt: maxOrNull(plannedEnds),
    current,
    conflicts,
  };
}

function projectOne(block: Block, cursor: number, now: number): TimeRange {
  switch (block.status) {
    case "done":
      return { start: block.actualStart!, end: block.actualEnd! };
    case "active": {
      const start = block.actualStart!;
      const plannedEnd = block.fixed ? block.plannedEnd : start + duration(block);
      return { start, end: Math.max(plannedEnd, now) };
    }
    default: {
      if (block.fixed) return { start: block.plannedStart, end: block.plannedEnd };
      const start = Math.max(cursor, block.plannedStart);
      return { start, end: start + duration(block) };
    }
  }
}

function maxOrNull(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function duration(block: Block): number {
  return block.plannedEnd - block.plannedStart;
}
