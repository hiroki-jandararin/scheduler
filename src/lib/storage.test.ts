import { describe, expect, it } from "vitest";
import { loadDay, saveDay } from "./storage";
import type { Day } from "../schedule/types";

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
};

const day: Day = {
  date: "2026-11-16",
  blocks: [{ id: "a", title: "開発", kind: "work", fixed: false, plannedStart: 540, plannedEnd: 630, status: "pending" }],
  originalPlan: [],
};

describe("保存", () => {
  it("保存した日を読み出せる", () => {
    const storage = memoryStorage();

    saveDay(day, storage);

    expect(loadDay("2026-11-16", storage)).toEqual(day);
  });

  it("保存していない日は null", () => {
    expect(loadDay("2026-11-17", memoryStorage())).toBeNull();
  });

  it("壊れたデータは null として扱う", () => {
    const storage = memoryStorage();
    storage.setItem("copipe-scheduler/v1/day/2026-11-16", "{broken");

    expect(loadDay("2026-11-16", storage)).toBeNull();
  });

  it("ストレージが例外を投げても落ちない", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(loadDay("2026-11-16", throwing)).toBeNull();
    expect(() => saveDay(day, throwing)).not.toThrow();
  });
});
