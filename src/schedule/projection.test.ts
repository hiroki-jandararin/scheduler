import { describe, expect, it } from "vitest";
import { project } from "./projection";
import { block, t } from "./testHelpers";

describe("終了見込み", () => {
  it("始める前で、予定の開始より前なら、予定どおりの時刻を見込む", () => {
    const blocks = [block("a", "9:00", "10:00"), block("b", "10:00", "11:00")];

    const result = project(blocks, t("8:00"));

    expect(result.times).toEqual({ a: { start: t("9:00"), end: t("10:00") }, b: { start: t("10:00"), end: t("11:00") } });
    expect(result.finishAt).toBe(t("11:00"));
  });

  it("予定の開始を過ぎても始めていなければ、今から始める見込みにして後ろをずらす", () => {
    const blocks = [block("a", "9:00", "10:00"), block("b", "10:00", "11:00")];

    const result = project(blocks, t("9:20"));

    expect(result.times.a).toEqual({ start: t("9:20"), end: t("10:20") });
    expect(result.times.b).toEqual({ start: t("10:20"), end: t("11:20") });
    expect(result.finishAt).toBe(t("11:20"));
  });

  it("進行中のブロックは、実際の開始＋予定の所要時間で終わる見込み", () => {
    const blocks = [
      block("a", "9:00", "10:00", { status: "active", actualStart: t("9:10") }),
      block("b", "10:00", "11:00"),
    ];

    const result = project(blocks, t("9:30"));

    expect(result.times.a).toEqual({ start: t("9:10"), end: t("10:10") });
    expect(result.times.b).toEqual({ start: t("10:10"), end: t("11:10") });
  });

  it("進行中のブロックが予定の所要時間を超えていたら、今終わる見込みにする", () => {
    const blocks = [
      block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") }),
      block("b", "10:00", "11:00"),
    ];

    const result = project(blocks, t("10:30"));

    expect(result.times.a).toEqual({ start: t("9:00"), end: t("10:30") });
    expect(result.times.b).toEqual({ start: t("10:30"), end: t("11:30") });
  });

  it("完了したブロックは実際の時刻をそのまま使う", () => {
    const blocks = [
      block("a", "9:00", "10:00", { status: "done", actualStart: t("9:00"), actualEnd: t("10:15") }),
      block("b", "10:00", "11:00", { status: "active", actualStart: t("10:15") }),
    ];

    expect(project(blocks, t("10:20")).times.a).toEqual({ start: t("9:00"), end: t("10:15") });
  });

  it("早く終わっても、まだ始めていないブロックは予定より前に詰めない", () => {
    const blocks = [
      block("a", "9:00", "10:00", { status: "done", actualStart: t("9:00"), actualEnd: t("9:40") }),
      block("b", "10:00", "11:00", { status: "active", actualStart: t("9:40") }),
      block("c", "11:00", "12:00"),
    ];

    const result = project(blocks, t("9:45"));

    expect(result.times.c).toEqual({ start: t("11:00"), end: t("12:00") });
  });

  it("予定に空き時間があれば、遅れはそこで吸収される", () => {
    const blocks = [
      block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") }),
      block("b", "11:00", "12:00"),
    ];

    expect(project(blocks, t("10:30")).times.b).toEqual({ start: t("11:00"), end: t("12:00") });
  });

  it("今のブロックと残り時間を返す。何も進行していなければ null", () => {
    const blocks = [block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") })];

    expect(project(blocks, t("9:40")).current).toEqual({ id: "a", remaining: 20 });
    expect(project([block("a", "9:00", "10:00")], t("8:00")).current).toBeNull();
  });

  it("予定の所要時間を超えたら、残り時間はマイナスになる", () => {
    const blocks = [block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") })];

    expect(project(blocks, t("10:15")).current).toEqual({ id: "a", remaining: -15 });
  });
});

describe("スキップ", () => {
  it("スキップしたブロックは見込みに含めず、後ろのブロックも押し出さない", () => {
    const blocks = [
      block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") }),
      block("b", "10:00", "11:00", { status: "skipped" }),
      block("c", "11:00", "12:00"),
    ];

    const result = project(blocks, t("9:30"));

    expect(result.times.b).toBeUndefined();
    expect(result.times.c).toEqual({ start: t("11:00"), end: t("12:00") });
    expect(result.finishAt).toBe(t("12:00"));
  });
});

describe("固定ブロック", () => {
  const meeting = { fixed: true };

  it("前のブロックが遅れても、固定ブロックは予定の時刻から動かさない", () => {
    const blocks = [
      block("a", "13:00", "14:30", { status: "active", actualStart: t("13:30") }),
      block("mtg", "15:00", "16:00", meeting),
    ];

    expect(project(blocks, t("13:40")).times.mtg).toEqual({ start: t("15:00"), end: t("16:00") });
  });

  it("固定ブロックの後ろのブロックは、固定ブロックの終わりから並べる", () => {
    const blocks = [
      block("a", "13:00", "14:30", { status: "active", actualStart: t("13:00") }),
      block("b", "14:30", "15:00"),
      block("mtg", "15:00", "16:00", meeting),
      block("c", "16:00", "17:00"),
    ];

    const result = project(blocks, t("14:50"));

    expect(result.times.b).toEqual({ start: t("14:50"), end: t("15:20") });
    expect(result.times.c).toEqual({ start: t("16:00"), end: t("17:00") });
  });

  it("前のブロックが固定ブロックに食い込みそうなら、食い込む分数を知らせる", () => {
    const blocks = [
      block("a", "13:00", "14:30", { status: "active", actualStart: t("13:00") }),
      block("b", "14:30", "15:00"),
      block("mtg", "15:00", "16:00", meeting),
    ];

    expect(project(blocks, t("14:50")).conflicts).toEqual([{ blockId: "b", fixedBlockId: "mtg", minutes: 20 }]);
  });

  it("食い込まなければ conflicts は空", () => {
    const blocks = [block("a", "13:00", "14:00"), block("mtg", "15:00", "16:00", meeting)];

    expect(project(blocks, t("12:00")).conflicts).toEqual([]);
  });

  it("進行中の固定ブロックは、予定の終了か今の遅い方で終わる見込み", () => {
    const blocks = [block("mtg", "15:00", "16:00", { ...meeting, status: "active", actualStart: t("15:10") })];

    expect(project(blocks, t("15:30")).times.mtg).toEqual({ start: t("15:10"), end: t("16:00") });
    expect(project(blocks, t("16:20")).times.mtg).toEqual({ start: t("15:10"), end: t("16:20") });
  });
});

describe("予定どおりの終了時刻", () => {
  it("スキップしていないブロックの、予定の終了時刻の最大を返す", () => {
    const blocks = [
      block("a", "9:00", "10:00", { status: "active", actualStart: t("9:20") }),
      block("b", "10:00", "11:00"),
      block("c", "11:00", "12:00", { status: "skipped" }),
    ];

    const result = project(blocks, t("9:30"));

    expect(result.plannedFinishAt).toBe(t("11:00"));
    expect(result.finishAt).toBe(t("11:20"));
  });
});
