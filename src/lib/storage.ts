import type { Day } from "../schedule/types";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const KEY_PREFIX = "copipe-scheduler/v1/day/";

// window.localStorage は参照するだけで例外を投げる環境があるので、どちらの関数も try の中で参照する

/** 保存した日を読み出す。ない・壊れている・ストレージが使えない場合は null */
export function loadDay(date: string, storage?: KeyValueStorage): Day | null {
  try {
    const raw = (storage ?? window.localStorage).getItem(KEY_PREFIX + date);
    if (raw === null) return null;
    const day = JSON.parse(raw) as Day;
    return Array.isArray(day.blocks) ? day : null;
  } catch {
    return null;
  }
}

/** 日を保存する。ストレージが使えなくても例外は投げない（その場合は保存されない） */
export function saveDay(day: Day, storage?: KeyValueStorage): void {
  try {
    (storage ?? window.localStorage).setItem(KEY_PREFIX + day.date, JSON.stringify(day));
  } catch {
    // プライベートウィンドウなどで保存できないときは、画面上の状態だけで動かす
  }
}
