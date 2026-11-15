import { useEffect, useState, type ReactNode } from "react";
import { complete, skip, start, unskip } from "../schedule/actions";
import { project, type TimeRange } from "../schedule/projection";
import type { Block, Day } from "../schedule/types";
import { formatDateLabel, formatDuration, formatTime, minutesOfDay } from "../lib/time";
import { AnalogTimer } from "./AnalogTimer";
import type { Target } from "./ImportView";

type Props = {
  day: Day;
  now: Date;
  isToday: boolean;
  onChange: (day: Day) => void;
  onImport: (target: Target) => void;
};

const STATUS_LABELS: Record<Block["status"], string> = {
  pending: "",
  active: "進行中",
  done: "完了",
  skipped: "スキップ",
};

const APP_TITLE = "コピペスケジューラー";
/** 「元に戻す」を出しておく時間 */
const UNDO_VISIBLE_MS = 10_000;

/** 直前の操作。押し間違えたときに、その前の状態へ戻すために持つ */
type LastAction = { message: string; previous: Block[] };

export function DayView({ day, now, isToday, onChange, onImport }: Props) {
  // 今日以外の日は、記録を付けずに予定どおりの時刻を見せる
  const nowMinutes = isToday ? minutesOfDay(now) : 0;
  const projection = project(day.blocks, nowMinutes);
  // 記録には、表示に使っている時刻（最大30秒前）ではなく押した瞬間の時刻を使う
  const clickedAt = () => minutesOfDay(new Date());
  const byId = (id: string) => day.blocks.find((block) => block.id === id)!;

  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  useEffect(() => {
    if (!lastAction) return;
    const id = setTimeout(() => setLastAction(null), UNDO_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [lastAction]);

  const act = (message: string, blocks: Block[]) => {
    setLastAction({ message, previous: day.blocks });
    onChange({ ...day, blocks });
  };
  const undo = () => {
    if (!lastAction) return;
    onChange({ ...day, blocks: lastAction.previous });
    setLastAction(null);
  };

  const current = projection.current ? byId(projection.current.id) : null;
  const remaining = projection.current?.remaining ?? null;
  const remainingText = remaining === null ? null : remaining >= 0 ? `あと${formatDuration(remaining)}` : overText(remaining);
  const next = day.blocks.find((block) => block.status === "pending");

  useEffect(() => {
    document.title = current && remainingText ? `${remainingText}｜${current.title}` : APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [current, remainingText]);

  // 終わった予定：完了したものと、今より前にスキップしたもの。先の予定のスキップは「これから」に残す
  const firstOpen = day.blocks.findIndex((block) => block.status === "active" || block.status === "pending");
  const isFinished = (block: Block, index: number) =>
    block.status === "done" || (block.status === "skipped" && (firstOpen === -1 || index < firstOpen));
  const finished = day.blocks.filter(isFinished);
  const upcoming = day.blocks.filter((block, i) => !isFinished(block, i) && block.id !== current?.id);

  const rowActions = (block: Block) =>
    isToday && (
      <>
        {block.status === "pending" && (
          <button
            className="chip"
            title="この予定をやらないことにする"
            onClick={() => act(`「${block.title}」をスキップしました`, skip(day.blocks, block.id, clickedAt()))}
          >
            スキップ
          </button>
        )}
        {block.status === "skipped" && (
          <button
            className="chip"
            title="スキップを取り消す"
            onClick={() => act(`「${block.title}」を戻しました`, unskip(day.blocks, block.id))}
          >
            戻す
          </button>
        )}
      </>
    );

  const renderRows = (blocks: Block[]) =>
    blocks.map((block) => (
      <BlockRow key={block.id} block={block} range={projection.times[block.id]} actions={rowActions(block)} />
    ));

  const over = remaining !== null && remaining < 0;
  const currentRange = current ? projection.times[current.id] : null;

  return (
    <main className="page">
      <header className="page-header">
        <h1>{isToday ? "今日の予定" : `${formatDateLabel(day.date)}の予定`}</h1>
        {isToday && <p className="page-date">{formatDateLabel(day.date)}</p>}
      </header>

      {/* 今のブロックと操作は、一覧をスクロールしても見えるように上に残す */}
      <div className="now-area">
        <section className={over ? "now-panel is-over" : "now-panel"} aria-label="今の予定">
          <div className="now-main" aria-live="polite">
            {current && currentRange ? (
              <>
                <p className="now-label">
                  今<span className="now-range">{formatTime(currentRange.start)}–{formatTime(currentRange.end)}</span>
                </p>
                <p className="now-title">{current.title}</p>
                <p className={over ? "now-remaining over" : "now-remaining"}>{remainingText}</p>
              </>
            ) : next ? (
              <>
                <p className="now-label">次</p>
                <p className="now-title">{next.title}</p>
                <p className="now-remaining">{formatTime(projection.times[next.id].start)}から</p>
              </>
            ) : (
              <p className="now-title">予定はすべて終わりました</p>
            )}
            {projection.finishAt !== null && (
              <p className="finish-at">
                <span>終了見込み {formatTime(projection.finishAt)}</span>
                {projection.plannedFinishAt !== null && (
                  <FinishDiff diff={projection.finishAt - projection.plannedFinishAt} />
                )}
              </p>
            )}
            {isToday && (
              <div className="now-actions">
                {current ? (
                  <>
                    <button
                      className="primary large"
                      onClick={() => act(`「${current.title}」を完了しました`, complete(day.blocks, clickedAt()))}
                    >
                      完了
                    </button>
                    <button
                      onClick={() => act(`「${current.title}」をスキップしました`, skip(day.blocks, current.id, clickedAt()))}
                    >
                      スキップ
                    </button>
                  </>
                ) : (
                  next && (
                    <button
                      className="primary large"
                      onClick={() => act(`「${next.title}」を始めました`, start(day.blocks, clickedAt()))}
                    >
                      「{next.title}」を始める
                    </button>
                  )
                )}
              </div>
            )}
            {isToday && current && <p className="next-hint">{nextHint(day.blocks, current, nowMinutes)}</p>}
          </div>
          {current && currentRange && remaining !== null && remainingText && (
            <AnalogTimer
              start={currentRange.start}
              end={nowMinutes + remaining}
              label={over ? remainingText : `残り${formatDuration(remaining)}`}
            />
          )}
        </section>

        {lastAction && (
          <div className="undo-bar" role="status">
            <span>{lastAction.message}</span>
            <button onClick={undo}>元に戻す</button>
          </div>
        )}

        {projection.conflicts.length > 0 && (
          <ul className="notice notice-warning">
            {projection.conflicts.map((conflict) => {
              const fixed = byId(conflict.fixedBlockId);
              return (
                <li key={conflict.fixedBlockId}>
                  {formatTime(fixed.plannedStart)}の「{fixed.title}」に{formatDuration(conflict.minutes)}食い込みそうです
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {finished.length > 0 && (
        <details className="finished">
          <summary>終わった予定（{finished.length}件）</summary>
          <ol className="block-list">{renderRows(finished)}</ol>
        </details>
      )}

      <section aria-label="これからの予定">
        <h2>これからの予定</h2>
        {upcoming.length > 0 ? (
          <ol className="block-list">{renderRows(upcoming)}</ol>
        ) : (
          <p className="hint">これからの予定はありません</p>
        )}
      </section>

      <footer className="actions">
        {isToday && (
          <button title="AIと組み直した残りの予定を貼る。記録済みのブロックは残ります" onClick={() => onImport("today")}>
            貼り直す
          </button>
        )}
        <button onClick={() => onImport("tomorrow")}>明日の予定を貼る</button>
      </footer>
    </main>
  );
}

function overText(remaining: number): string {
  return `${formatDuration(-remaining)}オーバー`;
}

/** 完了を押したら次に何が起きるか（D2 の自動開始を、押す前に伝える） */
function nextHint(blocks: Block[], current: Block, now: number): string {
  const index = blocks.indexOf(current);
  const next = blocks.find((block, i) => i > index && block.status === "pending");
  if (!next) return "これが最後の予定です";
  if (next.fixed && now < next.plannedStart) {
    return `完了したら、${formatTime(next.plannedStart)}の「${next.title}」まで空き時間です`;
  }
  return `完了すると「${next.title}」が始まります`;
}

function FinishDiff({ diff }: { diff: number }) {
  if (diff > 0) return <span className="finish-diff late">（予定より{formatDuration(diff)}遅れ）</span>;
  if (diff < 0) return <span className="finish-diff">（予定より{formatDuration(-diff)}早い）</span>;
  return <span className="finish-diff">（予定どおり）</span>;
}

function BlockRow({ block, range, actions }: { block: Block; range: TimeRange | undefined; actions: ReactNode }) {
  const shown = range ?? { start: block.plannedStart, end: block.plannedEnd };
  const delay = block.status === "pending" ? shown.start - block.plannedStart : 0;
  const plannedDuration = block.plannedEnd - block.plannedStart;
  const diff = block.status === "done" ? shown.end - shown.start - plannedDuration : 0;

  return (
    <li className={`block-row kind-${block.kind} status-${block.status}`}>
      <span className="block-time">{formatTime(shown.start)}–{formatTime(shown.end)}</span>
      <span className="block-title">
        {block.fixed && <span title="固定（遅れてもずらさない）">📌 </span>}
        {block.title}
        {block.kind === "break" && <span className="tag">休憩</span>}
      </span>
      {delay > 0 && <span className="delay">{formatDuration(delay)}遅れ</span>}
      {diff !== 0 && (
        <span className={diff > 0 ? "diff over" : "diff"}>
          予定より{diff > 0 ? "+" : "−"}{formatDuration(Math.abs(diff))}
        </span>
      )}
      <span className="block-status">{STATUS_LABELS[block.status]}</span>
      <span className="row-tools">{actions}</span>
    </li>
  );
}
