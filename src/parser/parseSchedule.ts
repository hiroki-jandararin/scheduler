import { cleanBullet, cleanTitle, flattenCells, isTableDecoration, normalize } from "./text";
import { moveForward, parseTime, RANGE, START_ONLY } from "./time";

export type BlockKind = "work" | "break";

export type ParsedBlock = {
  title: string;
  /** 0:00 からの分数 */
  start: number;
  end: number;
  kind: BlockKind;
  fixed: boolean;
  /** 所要時間が書かれておらず、仮の値で置いた */
  durationGuessed: boolean;
};

export type ParseError = "too-long" | "too-many-lines" | "too-many-blocks";

/** time：時刻範囲で読んだ。duration：所要時間を開始時刻から並べた */
export type ParseMode = "time" | "duration";

export type ParseResult = {
  mode: ParseMode;
  blocks: ParsedBlock[];
  unparsedLines: string[];
  /** 入力が上限を超えたときだけ入る。このとき blocks と unparsedLines は空 */
  error?: ParseError;
};

export type ParseOptions = {
  /** 所要時間が分からないブロックに仮置きする分数 */
  defaultDuration?: number;
  /** 所要時間だけの予定を並べ始める時刻（0:00 からの分数） */
  startAt?: number;
};

const MAX_CHARS = 20_000;
const MAX_LINES = 500;
const MAX_BLOCKS = 100;

const DEFAULT_DURATION = 30;
const DEFAULT_START_AT = 9 * 60;
/** 所要時間のない行を項目とみなす最大の文字数。これより長い行は文章とみなす */
const ITEM_MAX_LENGTH = 20;

const HOURS = /(\d+(?:\.\d+)?)\s*(?:時間|hours?|hrs?|h)(?![a-z])(?:\s*(半)|\s*(\d+)\s*(?:分|min|m)(?![a-z]))?/i;
const MINUTES = /(?<![\d.])(\d+)\s*(?:分|min|m)(?![a-z])/i;
const TOTAL_KEYWORDS = /合計|総計|^計[\s:]|total/i;

const BREAK_KEYWORDS = /休憩|昼休み|朝食|昼食|夕食|ランチ|食事|ごはん|ご飯|仮眠|昼寝|入浴|風呂|自由時間|break|lunch|dinner/i;
const FIXED_KEYWORDS = /仕事|勤務|通勤|帰宅|MTG|ミーティング|会議|打ち合わせ|打合せ|面談|面接|予約|通院|確定|固定/i;
const SLEEP_KEYWORDS = /就寝|寝る|おやすみ/;

/** 1行を読み取った結果。時刻つきの行は、終了時刻が行をまたいで決まることがある */
type Line =
  | { type: "timed"; title: string; start: number; end: number | null; fixed: boolean }
  | { type: "duration"; title: string; minutes: number; fixed: boolean; text: string }
  | { type: "other"; text: string };

type Entry = Omit<ParsedBlock, "kind">;

export function parseSchedule(text: string, options: ParseOptions = {}): ParseResult {
  if (text.length > MAX_CHARS) return failure("too-long");
  const rawLines = text.split(/\r?\n/);
  if (rawLines.length > MAX_LINES) return failure("too-many-lines");

  const defaultDuration = options.defaultDuration ?? DEFAULT_DURATION;
  const lines: Line[] = [];
  for (const rawLine of rawLines) {
    const line = normalize(rawLine).trim();
    if (line === "" || isTableDecoration(line)) continue;
    lines.push(readLine(line));
  }

  const hasRange = lines.some((line) => line.type === "timed" && line.end !== null);
  const hasDuration = lines.some((line) => line.type === "duration");
  const mode: ParseMode = !hasRange && hasDuration ? "duration" : "time";
  const { entries, unparsedLines } =
    mode === "duration"
      ? arrangeByDuration(lines, options.startAt ?? DEFAULT_START_AT, defaultDuration)
      : arrangeByTime(lines, defaultDuration);

  if (entries.length > MAX_BLOCKS) return failure("too-many-blocks");
  return { mode, blocks: entries.map(toBlock), unparsedLines };
}

function failure(error: ParseError): ParseResult {
  return { mode: "time", blocks: [], unparsedLines: [], error };
}

function readLine(line: string): Line {
  const flat = flattenCells(line);
  const fixed = FIXED_KEYWORDS.test(flat);

  const range = flat.match(RANGE);
  if (range && range.index !== undefined) {
    const [matched, startText, endText] = range;
    const before = flat.slice(0, range.index);
    const after = flat.slice(range.index + matched.length);
    const start = parseTime(startText);
    const end = moveForward(parseTime(endText, start.meridiem).minutes, start.minutes);
    return { type: "timed", title: cleanTitle(`${before} ${after}`), start: start.minutes, end, fixed };
  }

  const body = cleanBullet(flat);
  const startOnly = body.match(START_ONLY);
  if (startOnly) {
    const [matched, startText] = startOnly;
    return { type: "timed", title: cleanTitle(body.slice(matched.length)), start: parseTime(startText).minutes, end: null, fixed };
  }

  const duration = TOTAL_KEYWORDS.test(flat) ? null : readDuration(flat);
  if (duration) return { type: "duration", ...duration, fixed, text: line };

  return { type: "other", text: line };
}

function readDuration(line: string): { title: string; minutes: number } | null {
  const hours = line.match(HOURS);
  const match = hours ?? line.match(MINUTES);
  if (!match || match.index === undefined) return null;

  const minutes = hours
    ? Number(hours[1]) * 60 + (hours[2] ? 30 : 0) + Number(hours[3] ?? 0)
    : Number(match[1]);
  const rest = `${line.slice(0, match.index)} ${line.slice(match.index + match[0].length)}`;
  return { title: cleanTitle(rest), minutes: Math.round(minutes) };
}

/** 時刻範囲・開始時刻の行を並べる。所要時間だけの行や文章は読み取れなかった行にする */
function arrangeByTime(lines: Line[], defaultDuration: number) {
  const timed = alignInOrder(lines.filter((line) => line.type === "timed"));
  const unparsedLines = lines.flatMap((line) => (line.type === "timed" ? [] : [line.text]));

  const last = timed[timed.length - 1];
  if (last && last.end === null && SLEEP_KEYWORDS.test(last.title)) timed.pop();

  return { entries: resolveEnds(timed, defaultDuration), unparsedLines };
}

type TimedLine = Extract<Line, { type: "timed" }>;

/** 前の行より時刻が戻っている行を、午後または翌日に寄せる */
function alignInOrder(timed: TimedLine[]): TimedLine[] {
  let prevStart = -Infinity;
  return timed.map((line) => {
    const shift = moveForward(line.start, prevStart) - line.start;
    prevStart = line.start + shift;
    return { ...line, start: line.start + shift, end: line.end === null ? null : line.end + shift };
  });
}

/** 終了時刻のない行は、次の行の開始を終了とする。次がなければ仮の所要時間で置く */
function resolveEnds(timed: TimedLine[], defaultDuration: number): Entry[] {
  return timed.map(({ title, start, end, fixed }, i) => {
    if (end !== null) return { title, start, end, fixed, durationGuessed: false };

    const nextStart = timed[i + 1]?.start;
    if (nextStart !== undefined && nextStart > start) {
      return { title, start, end: nextStart, fixed, durationGuessed: false };
    }
    return { title, start, end: start + defaultDuration, fixed, durationGuessed: true };
  });
}

/**
 * 所要時間の行を、開始時刻から書かれた順に並べる。
 * 時刻の指定がある行は固定ブロックとしてその時刻に置き、ほかの項目はそれを避ける
 */
function arrangeByDuration(lines: Line[], startAt: number, defaultDuration: number) {
  const anchors: Entry[] = lines.flatMap((line) =>
    line.type === "timed"
      ? [{ title: line.title, start: line.start, end: line.start + defaultDuration, fixed: true, durationGuessed: true }]
      : [],
  );

  const entries: Entry[] = [...anchors];
  const unparsedLines: string[] = [];
  let cursor = Math.min(startAt, ...anchors.map((anchor) => anchor.start));

  const place = (title: string, minutes: number, fixed: boolean, durationGuessed: boolean) => {
    const start = findFreeStart(cursor, minutes, anchors);
    entries.push({ title, start, end: start + minutes, fixed, durationGuessed });
    cursor = start + minutes;
  };

  for (const line of lines) {
    if (line.type === "duration") place(line.title, line.minutes, line.fixed, false);
    else if (line.type === "other" && looksLikeItem(line.text)) place(cleanTitle(line.text), defaultDuration, false, true);
    else if (line.type === "other") unparsedLines.push(line.text);
  }

  return { entries: entries.sort((a, b) => a.start - b.start), unparsedLines };
}

function findFreeStart(from: number, minutes: number, fixedBlocks: Entry[]): number {
  let start = from;
  for (;;) {
    const hit = fixedBlocks.find((block) => start < block.end && start + minutes > block.start);
    if (!hit) return start;
    start = hit.end;
  }
}

/** 所要時間の書かれていない項目らしいか。文章や見出しは除く */
function looksLikeItem(line: string): boolean {
  return !TOTAL_KEYWORDS.test(line) && !/[。.．!！?？:]$/.test(line) && line.length <= ITEM_MAX_LENGTH;
}

function toBlock(entry: Entry): ParsedBlock {
  return { ...entry, kind: BREAK_KEYWORDS.test(entry.title) ? "break" : "work" };
}
