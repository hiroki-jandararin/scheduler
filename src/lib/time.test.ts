import { describe, expect, it } from "vitest";
import { addDays, dateKey, formatDateLabel, formatDuration, formatTime, fromInputValue, minutesOfDay, toInputValue } from "./time";

describe("時刻の表示", () => {
  it.each([
    [540, "9:00"],
    [575, "9:35"],
    [0, "0:00"],
    [1500, "翌1:00"],
  ])("%i → %s", (minutes, text) => {
    expect(formatTime(minutes)).toBe(text);
  });

  it.each([
    [45, "45分"],
    [60, "1時間"],
    [90, "1時間30分"],
    [0, "0分"],
  ])("所要時間 %i → %s", (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
});

describe("時刻の入力欄", () => {
  it("入力欄の値（HH:MM）に変換する。翌日の時刻は 24時間を引く", () => {
    expect(toInputValue(540)).toBe("09:00");
    expect(toInputValue(1500)).toBe("01:00");
  });

  it("入力欄の値を分数に戻す", () => {
    expect(fromInputValue("09:30")).toBe(570);
    expect(fromInputValue("")).toBeNull();
  });
});

describe("日付", () => {
  const date = new Date(2026, 10, 15, 9, 35);

  it("その日の 0:00 からの分数", () => {
    expect(minutesOfDay(date)).toBe(575);
  });

  it("日付のキー（YYYY-MM-DD）", () => {
    expect(dateKey(date)).toBe("2026-11-15");
  });
});

describe("日付の計算", () => {
  it("月をまたいでも翌日を返す", () => {
    expect(dateKey(addDays(new Date(2026, 10, 30, 23, 0), 1))).toBe("2026-12-01");
  });
});

describe("日付の表示", () => {
  it("YYYY-MM-DD を「11月16日（月）」にする", () => {
    expect(formatDateLabel("2026-11-16")).toBe("11月16日（月）");
    expect(formatDateLabel("2026-11-22")).toBe("11月22日（日）");
  });
});
