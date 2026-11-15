import { SEP_CHARS } from "./time";

const DURATION = String.raw`\d+(?:\.\d+)?\s*(?:時間半?|h(?:ours?|rs?)?|m(?:in)?|分)(?:\s*\d+\s*(?:m(?:in)?|分))?`;
const DURATION_NOTE = new RegExp(String.raw`\s*[（(]\s*${DURATION}\s*[)）]\s*$`, "i");

const TABLE_DIVIDER = /^\|?\s*:?-{3,}/;
const HEADER_WORDS = new Set([
  "時間", "時刻", "時間帯", "所要時間", "内容", "予定", "タスク", "項目", "やること",
  "作業", "備考", "メモ", "詳細", "time", "task", "activity",
]);

/** タイトルを書き換えないよう、時刻の読み取りに必要な全角文字だけを半角にする */
export function normalize(line: string): string {
  return line
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":")
    .replace(/\u3000/g, " ")
    .replace(/\*\*/g, "");
}

/** 表の区切り行と見出し行 */
export function isTableDecoration(line: string): boolean {
  if (TABLE_DIVIDER.test(line)) return true;
  const cells = splitCells(line);
  return cells.length >= 2 && cells.every((cell) => HEADER_WORDS.has(cell.toLowerCase()));
}

function splitCells(line: string): string[] {
  return line
    .split(/\t|\|/)
    .map((cell) => cell.trim())
    .filter((cell) => cell !== "");
}

/** 表の行は列を " / " でつなげた1行にする */
export function flattenCells(line: string): string {
  return splitCells(line).join(" / ");
}

export function cleanBullet(text: string): string {
  return text.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, "").replace(/^\s*・/, "");
}

const EDGE = `[\\s/:・${SEP_CHARS}]+`;
const LEADING_EDGE = new RegExp(`^${EDGE}`);
/** 「アブローラー」の長音記号を削らないよう、末尾では "ー" を対象にしない */
const TRAILING_EDGE = new RegExp(`${EDGE.replace("ー", "")}$`);

export function cleanTitle(raw: string): string {
  return cleanBullet(raw.replace(DURATION_NOTE, ""))
    .replace(LEADING_EDGE, "")
    .replace(/^まで\s*/, "")
    .replace(/[。．]+$/, "")
    .replace(/(?:だけ)?は?(?:確定|固定)(?:です)?$/, "")
    .replace(TRAILING_EDGE, "")
    .replace(/\s+/g, " ");
}
