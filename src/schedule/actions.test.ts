import { describe, expect, it } from "vitest";
import { complete, createBlocks, editActual, replan, skip, start, unskip } from "./actions";
import type { ParsedBlock } from "../parser/parseSchedule";
import { block, t } from "./testHelpers";
import type { Block } from "./types";

const statusOf = (blocks: Block[]) => Object.fromEntries(blocks.map((b) => [b.id, b.status]));

describe("開始", () => {
  it("最初の未着手ブロックを、今の時刻で始める", () => {
    const blocks = [block("a", "9:00", "10:00"), block("b", "10:00", "11:00")];

    const result = start(blocks, t("9:05"));

    expect(result[0]).toMatchObject({ status: "active", actualStart: t("9:05") });
    expect(result[1].status).toBe("pending");
  });

  it("すでに進行中のブロックがあれば何もしない", () => {
    const blocks = [block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") }), block("b", "10:00", "11:00")];

    expect(start(blocks, t("9:30"))).toEqual(blocks);
  });
});

describe("完了", () => {
  it("進行中のブロックを今の時刻で完了し、次のブロックを同じ時刻で始める", () => {
    const blocks = [block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") }), block("b", "10:00", "11:00")];

    const result = complete(blocks, t("10:10"));

    expect(result[0]).toMatchObject({ status: "done", actualEnd: t("10:10") });
    expect(result[1]).toMatchObject({ status: "active", actualStart: t("10:10") });
  });

  it("スキップしたブロックは飛ばして、その次を始める", () => {
    const blocks = [
      block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") }),
      block("b", "10:00", "11:00", { status: "skipped" }),
      block("c", "11:00", "12:00"),
    ];

    expect(statusOf(complete(blocks, t("10:00")))).toEqual({ a: "done", b: "skipped", c: "active" });
  });

  it("次が固定ブロックで、まだ予定の時刻になっていなければ自動では始めない", () => {
    const blocks = [
      block("a", "13:00", "14:30", { status: "active", actualStart: t("13:00") }),
      block("mtg", "15:00", "16:00", { fixed: true }),
    ];

    expect(statusOf(complete(blocks, t("14:30")))).toEqual({ a: "done", mtg: "pending" });
  });

  it("次が固定ブロックでも、予定の時刻を過ぎていれば始める", () => {
    const blocks = [
      block("a", "13:00", "14:30", { status: "active", actualStart: t("13:00") }),
      block("mtg", "15:00", "16:00", { fixed: true }),
    ];

    expect(complete(blocks, t("15:05"))[1]).toMatchObject({ status: "active", actualStart: t("15:05") });
  });

  it("最後のブロックを完了したら、進行中のブロックはなくなる", () => {
    const blocks = [block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") })];

    expect(statusOf(complete(blocks, t("10:00")))).toEqual({ a: "done" });
  });

  it("進行中のブロックがなければ何もしない", () => {
    const blocks = [block("a", "9:00", "10:00")];

    expect(complete(blocks, t("10:00"))).toEqual(blocks);
  });
});

describe("スキップ", () => {
  it("進行中のブロックをスキップしたら、その時刻で次のブロックを始める", () => {
    const blocks = [block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") }), block("b", "10:00", "11:00")];

    const result = skip(blocks, "a", t("9:20"));

    expect(result[0]).toMatchObject({ status: "skipped", actualStart: t("9:00"), actualEnd: t("9:20") });
    expect(result[1]).toMatchObject({ status: "active", actualStart: t("9:20") });
  });

  it("まだ始めていないブロックもスキップできる。進行中のブロックはそのまま", () => {
    const blocks = [block("a", "9:00", "10:00", { status: "active", actualStart: t("9:00") }), block("b", "10:00", "11:00")];

    expect(statusOf(skip(blocks, "b", t("9:20")))).toEqual({ a: "active", b: "skipped" });
  });

  it("完了したブロックはスキップできない", () => {
    const blocks = [block("a", "9:00", "10:00", { status: "done", actualStart: t("9:00"), actualEnd: t("10:00") })];

    expect(skip(blocks, "a", t("10:30"))).toEqual(blocks);
  });

  it("スキップを取り消すと未着手に戻り、記録した時刻も消える", () => {
    const blocks = [block("a", "9:00", "10:00", { status: "skipped", actualStart: t("9:00"), actualEnd: t("9:20") })];

    const [result] = unskip(blocks, "a");

    expect(result.status).toBe("pending");
    expect(result.actualStart).toBeUndefined();
    expect(result.actualEnd).toBeUndefined();
  });
});

describe("記録の修正", () => {
  const recorded = () => [
    block("a", "9:00", "10:00", { status: "done", actualStart: t("9:00"), actualEnd: t("10:10") }),
    block("b", "10:00", "11:00", { status: "active", actualStart: t("10:10") }),
  ];

  it("終了時刻を直すと、同じ時刻に始めた次のブロックの開始も直す", () => {
    const result = editActual(recorded(), "a", "end", t("10:00"));

    expect(result[0].actualEnd).toBe(t("10:00"));
    expect(result[1].actualStart).toBe(t("10:00"));
  });

  it("開始時刻を直すと、同じ時刻に終えた前のブロックの終了も直す", () => {
    const result = editActual(recorded(), "b", "start", t("10:05"));

    expect(result[1].actualStart).toBe(t("10:05"));
    expect(result[0].actualEnd).toBe(t("10:05"));
  });

  it("隣のブロックと時刻が離れていれば、隣は動かさない", () => {
    const blocks = [
      block("a", "9:00", "10:00", { status: "done", actualStart: t("9:00"), actualEnd: t("10:00") }),
      block("b", "11:00", "12:00", { status: "active", actualStart: t("11:00") }),
    ];

    expect(editActual(blocks, "a", "end", t("10:20"))[1].actualStart).toBe(t("11:00"));
  });

  it("記録のないブロックは直さない", () => {
    const blocks = [block("a", "9:00", "10:00")];

    expect(editActual(blocks, "a", "start", t("9:10"))).toEqual(blocks);
  });
});

const parsed = (title: string, start: string, end: string, extra: Partial<ParsedBlock> = {}): ParsedBlock => ({
  title,
  start: t(start),
  end: t(end),
  kind: "work",
  fixed: false,
  durationGuessed: false,
  ...extra,
});

describe("取り込み", () => {
  it("読み取った予定を、未着手のブロックにする", () => {
    let n = 0;
    const result = createBlocks([parsed("開発", "9:00", "10:30", { fixed: true })], () => `id${++n}`);

    expect(result).toEqual([
      { id: "id1", title: "開発", kind: "work", fixed: true, plannedStart: t("9:00"), plannedEnd: t("10:30"), status: "pending" },
    ]);
  });
});

describe("日中の貼り直し", () => {
  let n = 0;
  const newId = () => `new${++n}`;
  const today = () => [
    block("a", "9:00", "10:00", { status: "done", actualStart: t("9:00"), actualEnd: t("10:30") }),
    block("b", "10:00", "11:00", { status: "skipped" }),
    block("c", "11:00", "12:00", { status: "active", actualStart: t("10:30") }),
    block("d", "12:00", "13:00"),
    block("e", "13:00", "14:00"),
  ];

  it("完了・スキップ・進行中のブロックは残し、未着手のブロックだけを新しい予定に差し替える", () => {
    const { blocks } = replan(today(), [parsed("読書", "12:00", "13:00"), parsed("散歩", "13:00", "13:30")], t("11:00"), newId);

    expect(blocks.map((b) => [b.title, b.status])).toEqual([
      ["a", "done"],
      ["b", "skipped"],
      ["c", "active"],
      ["読書", "pending"],
      ["散歩", "pending"],
    ]);
  });

  it("今より前に始まる予定は取り込まず、取り込まなかった予定として返す", () => {
    const old = parsed("開発", "10:00", "11:30");

    const result = replan(today(), [old, parsed("読書", "12:00", "13:00")], t("11:00"), newId);

    expect(result.blocks.map((b) => b.title)).toEqual(["a", "b", "c", "読書"]);
    expect(result.excluded).toEqual([old]);
  });
});
