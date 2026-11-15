import type { Block } from "./types";

/** "9:00" → 540 */
export const t = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** テスト用のブロック。予定の時刻は "9:00" の形で書く */
export const block = (id: string, start: string, end: string, extra: Partial<Block> = {}): Block => ({
  id,
  title: id,
  kind: "work",
  fixed: false,
  plannedStart: t(start),
  plannedEnd: t(end),
  status: "pending",
  ...extra,
});
