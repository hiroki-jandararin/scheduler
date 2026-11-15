import { describe, expect, it } from "vitest";
import { preciseMinutesOfDay, sectorPath, timerState } from "./timer";

describe("タイマーの状態", () => {
  it("残りの割合を返す", () => {
    expect(timerState(540, 600, 555)).toEqual({ fraction: 0.75, over: false });
  });

  it("予定を超えたら over にし、超えた分の割合を返す", () => {
    expect(timerState(540, 600, 615)).toEqual({ fraction: 0.25, over: true });
  });

  it("超えた分の割合は 1 を上限にする", () => {
    expect(timerState(540, 600, 700)).toEqual({ fraction: 1, over: true });
  });

  it("秒の単位（分の小数）も扱う", () => {
    expect(timerState(540, 600, 569.5).fraction).toBeCloseTo(0.508, 3);
  });

  it("1周はそのブロックの所要時間。長さが違っても、半分経てば半周になる", () => {
    expect(timerState(540, 555, 547.5).fraction).toBe(0.5); // 15分のブロック
    expect(timerState(540, 630, 585).fraction).toBe(0.5); // 1時間30分のブロック
    expect(timerState(540, 840, 690).fraction).toBe(0.5); // 5時間のブロック
  });

  it("所要時間が 0 以下なら、割合は 0", () => {
    expect(timerState(540, 540, 540)).toEqual({ fraction: 0, over: false });
  });
});

describe("扇形のパス（中心 50,50・半径 46）", () => {
  it("1/4 なら 12時から3時まで", () => {
    expect(sectorPath(0.25)).toBe("M 50 50 L 50 4 A 46 46 0 0 1 96 50 Z");
  });

  it("半分を超えたら大きい弧にする", () => {
    expect(sectorPath(0.75)).toBe("M 50 50 L 50 4 A 46 46 0 1 1 4 50 Z");
  });

  it("0 なら何も描かない", () => {
    expect(sectorPath(0)).toBe("");
  });
});

describe("秒まで含めた時刻", () => {
  it("その日の 0:00 からの分数を、秒を小数にして返す", () => {
    expect(preciseMinutesOfDay(new Date(2026, 10, 16, 9, 30, 30))).toBe(570.5);
  });
});
