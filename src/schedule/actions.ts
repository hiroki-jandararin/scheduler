import type { ParsedBlock } from "../parser/parseSchedule";
import type { Block } from "./types";

const defaultNewId = () => crypto.randomUUID();

/** 読み取った予定を未着手のブロックにする */
export function createBlocks(parsed: ParsedBlock[], newId: () => string = defaultNewId): Block[] {
  return parsed.map(({ title, kind, fixed, start, end }) => ({
    id: newId(),
    title,
    kind,
    fixed,
    plannedStart: start,
    plannedEnd: end,
    status: "pending",
  }));
}

/**
 * 日中の貼り直し（F8）。完了・スキップ・進行中のブロックは残し、未着手のブロックだけを差し替える。
 * 今より前に始まる予定は取り込まず excluded として返す
 */
export function replan(
  blocks: Block[],
  parsed: ParsedBlock[],
  now: number,
  newId: () => string = defaultNewId,
): { blocks: Block[]; excluded: ParsedBlock[] } {
  const kept = blocks.filter((block) => block.status !== "pending");
  const accepted = parsed.filter((p) => p.start >= now);
  const excluded = parsed.filter((p) => p.start < now);
  return { blocks: [...kept, ...createBlocks(accepted, newId)], excluded };
}

/**
 * 記録した時刻を直す（F4-2）。完了した時刻は次のブロックの開始としても記録しているので、
 * 同じ時刻だった隣のブロックの時刻も一緒に直す
 */
export function editActual(blocks: Block[], id: string, edge: "start" | "end", time: number): Block[] {
  const target = blocks.find((block) => block.id === id);
  const old = edge === "start" ? target?.actualStart : target?.actualEnd;
  if (!target || old === undefined) return blocks;

  return blocks.map((block) => {
    if (block.id === id) return edge === "start" ? { ...block, actualStart: time } : { ...block, actualEnd: time };
    if (edge === "start" && block.actualEnd === old) return { ...block, actualEnd: time };
    if (edge === "end" && block.actualStart === old) return { ...block, actualStart: time };
    return block;
  });
}

/** 最初の未着手ブロックを今の時刻で始める。進行中のブロックがあれば何もしない */
export function start(blocks: Block[], now: number): Block[] {
  if (blocks.some((block) => block.status === "active")) return blocks;
  const index = blocks.findIndex((block) => block.status === "pending");
  if (index === -1) return blocks;
  return replaceAt(blocks, index, { ...blocks[index], status: "active", actualStart: now });
}

/** 進行中のブロックを今の時刻で完了し、次のブロックを始める（D2） */
export function complete(blocks: Block[], now: number): Block[] {
  return finishActive(blocks, "done", now);
}

/**
 * ブロックをスキップする。進行中のブロックなら、その時刻で次のブロックを始める。
 * 完了したブロックはスキップできない
 */
export function skip(blocks: Block[], id: string, now: number): Block[] {
  const target = blocks.find((block) => block.id === id);
  if (!target) return blocks;
  if (target.status === "active") return finishActive(blocks, "skipped", now);
  if (target.status !== "pending") return blocks;
  return blocks.map((block) => (block.id === id ? { ...block, status: "skipped" } : block));
}

/** スキップを取り消して未着手に戻す */
export function unskip(blocks: Block[], id: string): Block[] {
  return blocks.map((block) => {
    if (block.id !== id || block.status !== "skipped") return block;
    return { ...block, status: "pending", actualStart: undefined, actualEnd: undefined };
  });
}

/**
 * 進行中のブロックを終わらせ、次の未着手ブロックを同じ時刻で始める。
 * 次が固定ブロックで、まだ予定の時刻になっていなければ始めない
 */
function finishActive(blocks: Block[], status: "done" | "skipped", now: number): Block[] {
  const index = blocks.findIndex((block) => block.status === "active");
  if (index === -1) return blocks;

  const finished = replaceAt(blocks, index, { ...blocks[index], status, actualEnd: now });
  const nextIndex = finished.findIndex((block, i) => i > index && block.status === "pending");
  if (nextIndex === -1) return finished;

  const next = finished[nextIndex];
  if (next.fixed && now < next.plannedStart) return finished;
  return replaceAt(finished, nextIndex, { ...next, status: "active", actualStart: now });
}

function replaceAt(blocks: Block[], index: number, block: Block): Block[] {
  return blocks.map((original, i) => (i === index ? block : original));
}
