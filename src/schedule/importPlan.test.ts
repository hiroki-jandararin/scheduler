import { describe, expect, it } from "vitest";
import { importPlan } from "./importPlan";
import { block, t } from "./testHelpers";
import type { ParsedBlock } from "../parser/parseSchedule";
import type { Day } from "./types";

const parsed = (title: string, start: string, end: string): ParsedBlock => ({
  title,
  start: t(start),
  end: t(end),
  kind: "work",
  fixed: false,
  durationGuessed: false,
});

const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

describe("予定の取り込み（日単位）", () => {
  it("その日の予定がなければ、新しい日を作る。ブロックは開始時刻の順に並べ、最初の予定として残す", () => {
    const { day, excluded } = importPlan(null, "2026-11-16", [parsed("B", "10:00", "11:00"), parsed("A", "9:00", "10:00")], 0, ids());

    expect(day.date).toBe("2026-11-16");
    expect(day.blocks.map((b) => b.title)).toEqual(["A", "B"]);
    expect(day.originalPlan).toEqual(day.blocks);
    expect(excluded).toEqual([]);
  });

  it("まだ何も始めていなければ、予定を丸ごと差し替え、最初の予定も差し替える", () => {
    const existing: Day = { date: "2026-11-16", blocks: [block("old", "9:00", "10:00")], originalPlan: [block("old", "9:00", "10:00")] };

    const { day } = importPlan(existing, "2026-11-16", [parsed("A", "9:00", "10:00")], t("8:00"), ids());

    expect(day.blocks.map((b) => b.title)).toEqual(["A"]);
    expect(day.originalPlan.map((b) => b.title)).toEqual(["A"]);
  });

  it("始めたあとなら貼り直しとして扱い、記録は残し、最初の予定も変えない", () => {
    const original = [block("a", "9:00", "10:00"), block("b", "10:00", "11:00")];
    const existing: Day = {
      date: "2026-11-16",
      blocks: [block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") }), block("b", "10:00", "11:00")],
      originalPlan: original,
    };
    const past = parsed("過去", "8:00", "9:00");

    const { day, excluded } = importPlan(existing, "2026-11-16", [past, parsed("C", "10:30", "11:30")], t("9:30"), ids());

    expect(day.blocks.map((b) => b.title)).toEqual(["a", "C"]);
    expect(day.originalPlan).toBe(original);
    expect(excluded).toEqual([past]);
  });
});
