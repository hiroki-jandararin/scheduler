// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import sample1 from "./parser/__fixtures__/sample1-table.txt?raw";
import sample3 from "./parser/__fixtures__/sample3-durations.txt?raw";

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  vi.setSystemTime(new Date(2026, 10, 16, h, m));
};

const paste = (text: string) => fireEvent.change(screen.getByLabelText("予定のテキスト"), { target: { value: text } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const preview = () => within(screen.getByRole("region", { name: "読み取った予定" }));
const rowOf = (title: string) => within(screen.getByText(title).closest("li")!);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("取り込みプレビュー", () => {
  it("貼るとすぐにプレビューが出る", () => {
    at("8:00");
    render(<App />);

    paste(sample1);

    expect(preview().getAllByRole("listitem")).toHaveLength(13);
    expect(screen.queryByText("読み取れなかった行")).toBeNull();
  });

  it("読み取れなかった行と、所要時間を仮置きしたことを見せる", () => {
    at("20:00");
    render(<App />);
    click("明日");

    paste(sample3);

    expect(screen.getByText("明日の予定。")).toBeTruthy();
    expect(screen.getAllByText(/所要時間が書かれていないため/)).toHaveLength(2);
  });

  it("所要時間モードでは、並べ始める時刻を変えられる", () => {
    at("20:00");
    render(<App />);
    click("明日");
    paste("開発 2時間\n読書 1時間");

    fireEvent.change(screen.getByLabelText("並べ始める時刻"), { target: { value: "08:00" } });

    const starts = preview().getAllByLabelText("開始").map((input) => (input as HTMLInputElement).value);
    expect(starts).toEqual(["08:00", "10:00"]);
  });

  it("プレビューで内容・固定・種別を直したり、予定を消したりできる", () => {
    at("8:00");
    render(<App />);
    paste("9:00-10:00 開発\n10:00-11:00 読書");

    const first = within(preview().getAllByRole("listitem")[0]);
    const fixedToggle = first.getByRole("button", { name: "📌 固定" });
    const breakToggle = first.getByRole("button", { name: "休憩" });
    expect(fixedToggle.getAttribute("aria-pressed")).toBe("false");
    expect(breakToggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.change(first.getByLabelText("内容"), { target: { value: "API開発" } });
    fireEvent.click(fixedToggle);
    fireEvent.click(breakToggle);
    fireEvent.click(within(preview().getAllByRole("listitem")[1]).getByRole("button", { name: "この予定を消す" }));

    expect(preview().getAllByRole("listitem")).toHaveLength(1);
    expect((first.getByLabelText("内容") as HTMLInputElement).value).toBe("API開発");
    expect(first.getByRole("button", { name: "📌 固定" }).getAttribute("aria-pressed")).toBe("true");
    expect(first.getByRole("button", { name: "休憩" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("取り込みの分かりやすさ", () => {
  it("何も貼っていないときは手順を見せ、貼ったら消す", () => {
    at("8:00");
    render(<App />);
    expect(screen.getByText(/AIで作った予定をコピー/)).toBeTruthy();

    paste(sample1);

    expect(screen.queryByText(/AIで作った予定をコピー/)).toBeNull();
  });

  it("読み取った予定の件数と時間帯をまとめて見せる", () => {
    at("8:00");
    render(<App />);

    paste(sample1);

    expect(screen.getByText("13件・9:00〜21:45")).toBeTruthy();
  });

  it("読み取れなかった行を、その場で予定に追加できる", () => {
    at("8:00");
    render(<App />);
    paste("9:00-10:00 開発\nストレッチ");

    fireEvent.click(rowOf("ストレッチ").getByRole("button", { name: "予定に追加" }));

    expect(preview().getAllByRole("listitem")).toHaveLength(2);
    expect((preview().getAllByLabelText("内容")[1] as HTMLInputElement).value).toBe("ストレッチ");
    expect(preview().getAllByLabelText("開始").map((input) => (input as HTMLInputElement).value)).toEqual(["09:00", "10:00"]);
    expect(screen.queryByText("読み取れなかった行")).toBeNull();
  });

  it("明日の予定は、日付つきの見出しで表示する", () => {
    at("20:00");
    render(<App />);
    click("明日");
    paste(sample1);
    click("この予定で始める");

    expect(screen.getByRole("heading", { name: "11月17日（火）の予定" })).toBeTruthy();
  });
});

describe("1日の流れ", () => {
  const startDay = () => {
    at("8:50");
    render(<App />);
    paste(sample1);
    click("この予定で始める");
  };

  it("確定すると、次の予定と終了見込みが出る。予定はブラウザに保存される", () => {
    startDay();

    expect(screen.getByRole("heading", { name: "今日の予定" })).toBeTruthy();
    expect(screen.getByText("9:00から")).toBeTruthy();
    expect(screen.getByText("終了見込み 21:45")).toBeTruthy();
    expect(window.localStorage.getItem("copipe-scheduler/v1/day/2026-11-16")).not.toBeNull();
  });

  it("開始・完了は押した時刻で記録し、遅れた分だけ終了見込みを後ろにずらす", () => {
    startDay();

    at("9:00");
    click("「開発①」を始める");
    expect(screen.getByText("あと1時間30分")).toBeTruthy();

    at("10:40");
    click("完了");

    expect(screen.getByText("あと15分")).toBeTruthy();
    expect(rowOf("開発①").getByText("9:00–10:40")).toBeTruthy();
    expect(screen.getByText("終了見込み 21:55")).toBeTruthy();
  });

  it("進行中はカードの中にアナログタイマーを出し、予定を超えたら超えた表示にする", () => {
    startDay();
    expect(screen.queryByRole("img", { name: /残り|オーバー/ })).toBeNull();

    at("9:00");
    click("「開発①」を始める");
    const timer = screen.getByRole("img", { name: "残り1時間30分" });
    expect(timer.closest(".now-panel")).not.toBeNull();
    expect(timer.classList.contains("is-over")).toBe(false);

    at("10:45");
    fireEvent.click(rowOf("ランニング").getByRole("button", { name: "スキップ" }));
    expect(screen.getByRole("img", { name: "15分オーバー" }).classList.contains("is-over")).toBe(true);
  });

  it("まだ始めていないブロックをスキップし、取り消せる", () => {
    startDay();

    fireEvent.click(rowOf("ランニング").getByRole("button", { name: "スキップ" }));
    expect(rowOf("ランニング").getByText("スキップ")).toBeTruthy();

    fireEvent.click(rowOf("ランニング").getByRole("button", { name: "戻す" }));
    expect(rowOf("ランニング").queryByText("スキップ", { selector: ".block-status" })).toBeNull();
  });

  it("貼り直すと記録は残し、過去の時間帯の予定は取り込まない", () => {
    startDay();
    at("9:00");
    click("「開発①」を始める");

    at("10:50");
    click("貼り直す");
    paste("10:00-10:30 過去の予定\n11:00-12:00 読書");

    expect(screen.getByText("過去の時間帯なので取り込まない予定")).toBeTruthy();
    click("残りを差し替える");

    expect(within(screen.getByRole("region", { name: "今の予定" })).getByText("開発①")).toBeTruthy();
    const upcoming = within(screen.getByRole("region", { name: "これからの予定" }));
    expect(upcoming.getAllByRole("listitem").map((li) => li.querySelector(".block-title")?.textContent)).toEqual(["読書"]);
  });
});

describe("実行中の分かりやすさ", () => {
  const startDay = () => {
    at("8:50");
    render(<App />);
    paste(sample1);
    click("この予定で始める");
    at("9:00");
    click("「開発①」を始める");
  };

  it("完了すると何が始まるかを、押す前に見せる", () => {
    startDay();

    expect(screen.getByText("完了すると「休憩」が始まります")).toBeTruthy();
  });

  it("押し間違えたら、元に戻せる", () => {
    startDay();
    at("9:10");
    click("完了");
    expect(screen.getByText("「開発①」を完了しました")).toBeTruthy();

    click("元に戻す");

    expect(screen.getByText("あと1時間20分")).toBeTruthy();
    expect(screen.queryByText("「開発①」を完了しました")).toBeNull();
  });

  it("完了したブロックは予定とのずれを、終了見込みは予定との差を見せる", () => {
    startDay();
    at("10:40");
    click("完了");

    expect(rowOf("開発①").getByText("予定より+10分")).toBeTruthy();
    expect(screen.getByText("（予定より10分遅れ）")).toBeTruthy();
    expect(rowOf("開発②").getByText("10分遅れ")).toBeTruthy();
  });

  it("タブのタイトルに残り時間を出す", () => {
    startDay();

    expect(document.title).toBe("あと1時間30分｜開発①");
  });
});

describe("一覧の整理", () => {
  const startDay = () => {
    at("8:50");
    render(<App />);
    paste(sample1);
    click("この予定で始める");
    at("9:00");
    click("「開発①」を始める");
  };

  it("終わった予定は、閉じた折りたたみにまとめる", () => {
    startDay();
    expect(screen.queryByText(/終わった予定/)).toBeNull();

    at("10:30");
    click("完了");

    const summary = screen.getByText("終わった予定（1件）");
    const details = summary.closest("details")!;
    expect(details.open).toBe(false);
    expect(within(details).getByText("開発①")).toBeTruthy();
  });

  it("今より前にスキップしたブロックも折りたたみに入れ、先の予定のスキップは「これから」に残す", () => {
    startDay();
    at("9:20");
    fireEvent.click(within(screen.getByRole("region", { name: "今の予定" })).getByRole("button", { name: "スキップ" }));
    fireEvent.click(rowOf("ランニング").getByRole("button", { name: "スキップ" }));

    expect(within(screen.getByText("終わった予定（1件）").closest("details")!).getByText("開発①")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "これからの予定" })).getByText("ランニング")).toBeTruthy();
  });

  it("今のブロックは一覧に出さず、パネルに予定の時間帯と一緒に出す", () => {
    startDay();

    const panel = within(screen.getByRole("region", { name: "今の予定" }));
    expect(panel.getByText("開発①")).toBeTruthy();
    expect(panel.getByText("9:00–10:30")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "これからの予定" })).queryByText("開発①")).toBeNull();
  });

  it("予定を超えたら、パネルを超えた表示にする", () => {
    startDay();
    const panel = screen.getByRole("region", { name: "今の予定" });
    expect(panel.classList.contains("is-over")).toBe(false);

    at("10:45");
    fireEvent.click(rowOf("ランニング").getByRole("button", { name: "スキップ" }));

    expect(screen.getByRole("region", { name: "今の予定" }).classList.contains("is-over")).toBe(true);
  });
});
