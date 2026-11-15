import { useMemo, useState } from "react";
import { parseSchedule, type ParsedBlock, type ParseError, type ParseResult } from "../parser/parseSchedule";
import { cleanTitle } from "../parser/text";
import { importPlan } from "../schedule/importPlan";
import type { Day } from "../schedule/types";
import { addDays, dateKey, formatDuration, formatTime, fromInputValue, minutesOfDay, toInputValue } from "../lib/time";

export type Target = "today" | "tomorrow";

type Props = {
  now: Date;
  initialTarget: Target;
  loadExisting: (date: string) => Day | null;
  onConfirm: (day: Day) => void;
  onCancel?: () => void;
};

const DAY = 24 * 60;
const MAX_CHARS = 20_000;
/** 読み取れなかった行を予定に追加するときの所要時間 */
const ADDED_DURATION = 30;

const ERROR_MESSAGES: Record<ParseError, string> = {
  "too-long": "長すぎるため読み取れません（2万文字まで）",
  "too-many-lines": "行が多すぎるため読み取れません（500行まで）",
  "too-many-blocks": "予定が多すぎるため読み取れません（100個まで）",
};

const PLACEHOLDER = `例：
9:00-10:30 開発
10:30-10:45 休憩
10:45-12:00 ブログ執筆`;

/** プレビューでの手直し。読み取り結果（source）が変わったら捨てる */
type Edits = { source: ParseResult; blocks: ParsedBlock[]; addedLines: number[] };

export function ImportView({ now, initialTarget, loadExisting, onConfirm, onCancel }: Props) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<Target>(initialTarget);
  const [startAt, setStartAt] = useState(() => defaultStartAt(initialTarget, now));
  const [pasteError, setPasteError] = useState<string | null>(null);

  const result = useMemo(() => parseSchedule(text, { startAt }), [text, startAt]);

  const [edits, setEdits] = useState<Edits | null>(null);
  const current = edits?.source === result ? edits : { source: result, blocks: result.blocks, addedLines: [] };
  const draft = current.blocks;
  const updateDraft = (blocks: ParsedBlock[], addedLines = current.addedLines) =>
    setEdits({ source: result, blocks, addedLines });
  const updateRow = (index: number, patch: Partial<ParsedBlock>) =>
    updateDraft(draft.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const unparsed = result.unparsedLines
    .map((line, index) => ({ line, index }))
    .filter(({ index }) => !current.addedLines.includes(index));

  /** 読み取れなかった行を、最後の予定の後ろに仮の所要時間で足す（D5） */
  const addLine = (line: string, index: number) => {
    const start = draft.length > 0 ? Math.max(...draft.map((row) => row.end)) : startAt;
    const added: ParsedBlock = {
      title: cleanTitle(line) || line,
      start,
      end: start + ADDED_DURATION,
      kind: "work",
      fixed: false,
      durationGuessed: true,
    };
    updateDraft([...draft, added], [...current.addedLines, index]);
  };

  const targetDate = target === "today" ? dateKey(now) : dateKey(addDays(now, 1));
  const nowForTarget = target === "today" ? minutesOfDay(now) : 0;
  const existing = loadExisting(targetDate);
  const replanning = existing?.blocks.some((block) => block.status !== "pending") ?? false;
  const excluded = replanning ? importPlan(existing, targetDate, draft, nowForTarget, () => "").excluded : [];

  const changeTarget = (next: Target) => {
    setTarget(next);
    setStartAt(defaultStartAt(next, now));
  };

  const pasteFromClipboard = async () => {
    try {
      setText(await navigator.clipboard.readText());
      setPasteError(null);
    } catch {
      setPasteError("ブラウザが読み取りを許可しませんでした。下の欄をクリックして ⌘V（Ctrl+V）で貼ってください");
    }
  };

  const confirm = () => {
    const blocks = draft.map((row) => ({ ...row, title: row.title.trim() || "（無題）" }));
    const confirmedAt = target === "today" ? minutesOfDay(new Date()) : 0;
    onConfirm(importPlan(existing, targetDate, blocks, confirmedAt).day);
  };

  const canReadClipboard = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";

  return (
    <main className="page">
      <header className="page-header">
        <h1>予定を貼る</h1>
        <div className="field">
          <span className="field-label" id="target-label">どの日の予定？</span>
          <div className="segmented" role="group" aria-labelledby="target-label">
            <button aria-pressed={target === "today"} onClick={() => changeTarget("today")}>今日</button>
            <button aria-pressed={target === "tomorrow"} onClick={() => changeTarget("tomorrow")}>明日</button>
          </div>
        </div>
      </header>

      {text.trim() === "" && (
        <ol className="steps">
          <li>ChatGPT や Claude など、AIで作った予定をコピー</li>
          <li>下の欄に貼る（形式はそのままで大丈夫です）</li>
          <li>読み取り結果を確かめて「この予定で始める」</li>
        </ol>
      )}

      {canReadClipboard && text.trim() === "" && (
        <button className="clipboard-button" onClick={pasteFromClipboard}>
          クリップボードから貼る
        </button>
      )}
      {pasteError && <p className="notice notice-error">{pasteError}</p>}

      <textarea
        className="paste-area"
        aria-label="予定のテキスト"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        maxLength={MAX_CHARS}
        autoFocus
      />

      {result.error && <p className="notice notice-error">{ERROR_MESSAGES[result.error]}</p>}

      {result.mode === "duration" && draft.length > 0 && (
        <label className="start-at">
          並べ始める時刻
          <input
            type="time"
            value={toInputValue(startAt)}
            onChange={(e) => {
              const value = fromInputValue(e.target.value);
              if (value !== null) setStartAt(value);
            }}
          />
        </label>
      )}

      {replanning && draft.length > 0 && (
        <p className="notice">記録済みのブロックは残し、まだ始めていないブロックだけを差し替えます。</p>
      )}

      {draft.length > 0 && (
        <section aria-label="読み取った予定">
          <div className="section-header">
            <h2>読み取った予定</h2>
            <p className="summary">
              {draft.length}件・{formatTime(Math.min(...draft.map((row) => row.start)))}〜
              {formatTime(Math.max(...draft.map((row) => row.end)))}
            </p>
          </div>
          <p className="hint">時刻や内容はクリックして直せます。「休憩」「📌 固定」は押すと切り替わります。</p>
          <ol className="preview-list">
            {draft.map((row, i) => (
              <PreviewRow
                key={i}
                row={row}
                onChange={(patch) => updateRow(i, patch)}
                onRemove={() => updateDraft(draft.filter((_, j) => j !== i))}
              />
            ))}
          </ol>
        </section>
      )}

      {excluded.length > 0 && (
        <section className="muted-section">
          <h2>過去の時間帯なので取り込まない予定</h2>
          <ul>
            {excluded.map((row, i) => (
              <li key={i}>{formatTime(row.start)}〜 {row.title}</li>
            ))}
          </ul>
        </section>
      )}

      {unparsed.length > 0 && (
        <section className="muted-section">
          <h2>読み取れなかった行</h2>
          <p className="hint">予定に入れたい行は「予定に追加」を押してください。最後の予定の後ろに30分で入ります。</p>
          <ul className="unparsed-list">
            {unparsed.map(({ line, index }) => (
              <li key={index}>
                <span>{line}</span>
                <button className="chip" onClick={() => addLine(line, index)}>予定に追加</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="actions sticky">
        {onCancel && <button onClick={onCancel}>戻る</button>}
        <button className="primary" disabled={draft.length === 0} onClick={confirm}>
          {replanning ? "残りを差し替える" : "この予定で始める"}
        </button>
      </footer>
    </main>
  );
}

function PreviewRow({
  row,
  onChange,
  onRemove,
}: {
  row: ParsedBlock;
  onChange: (patch: Partial<ParsedBlock>) => void;
  onRemove: () => void;
}) {
  const changeStart = (value: string) => {
    const minutes = fromInputValue(value);
    if (minutes === null) return;
    const start = minutes + (row.start >= DAY ? DAY : 0);
    onChange({ start, end: start + (row.end - row.start), durationGuessed: false });
  };

  const changeEnd = (value: string) => {
    let end = fromInputValue(value);
    if (end === null) return;
    while (end <= row.start) end += DAY;
    onChange({ end, durationGuessed: false });
  };

  return (
    <li className={`preview-row kind-${row.kind}`}>
      <span className="time-inputs">
        <input type="time" aria-label="開始" value={toInputValue(row.start)} onChange={(e) => changeStart(e.target.value)} />
        <span aria-hidden>–</span>
        <input type="time" aria-label="終了" value={toInputValue(row.end)} onChange={(e) => changeEnd(e.target.value)} />
      </span>
      <input className="title-input" aria-label="内容" value={row.title} onChange={(e) => onChange({ title: e.target.value })} />
      <span className="row-tools">
        <button
          className="chip toggle"
          aria-pressed={row.kind === "break"}
          title="休憩は見積もり倍率の計算に含めません"
          onClick={() => onChange({ kind: row.kind === "work" ? "break" : "work" })}
        >
          休憩
        </button>
        <button
          className="chip toggle"
          aria-pressed={row.fixed}
          title="固定すると、前の予定が遅れてもこの予定の時刻はずらしません"
          onClick={() => onChange({ fixed: !row.fixed })}
        >
          📌 固定
        </button>
        <button className="icon-button" aria-label="この予定を消す" title="この予定を消す" onClick={onRemove}>
          ×
        </button>
      </span>
      {row.durationGuessed && (
        <span className="row-note">所要時間が書かれていないため、仮に{formatDuration(row.end - row.start)}にしています</span>
      )}
    </li>
  );
}

/** 今日なら今の時刻を5分単位に切り上げた時刻、明日なら 9:00 */
function defaultStartAt(target: Target, now: Date): number {
  return target === "today" ? Math.ceil(minutesOfDay(now) / 5) * 5 : 9 * 60;
}
