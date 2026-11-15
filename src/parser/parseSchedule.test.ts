import { describe, expect, it } from "vitest";
import { parseSchedule } from "./parseSchedule";

describe("parseSchedule", () => {
  it("時刻範囲と内容が書かれた1行を、1つのブロックとして読み取る", () => {
    const result = parseSchedule("9:00-10:30 開発");

    expect(result.blocks).toMatchObject([{ title: "開発", start: 540, end: 630 }]);
  });
});

describe("複数行", () => {
  it("時刻範囲のある行を、それぞれブロックとして読み取る", () => {
    const result = parseSchedule("9:00-10:30 開発\n10:30-10:45 休憩");

    expect(result.blocks).toMatchObject([
      { title: "開発", start: 540, end: 630 },
      { title: "休憩", start: 630, end: 645 },
    ]);
  });
});

describe("読み取れなかった行", () => {
  it("時刻範囲のない行は捨てずに unparsedLines に入れる。空行は無視する", () => {
    const result = parseSchedule("明日の予定です\n\n9:00-10:30 開発\n  \n頑張りましょう");

    expect(result.blocks).toHaveLength(1);
    expect(result.unparsedLines).toEqual(["明日の予定です", "頑張りましょう"]);
  });
});

describe("表記ゆれ", () => {
  it.each([
    ["9:00–10:30 開発", "enダッシュ"],
    ["9:00〜10:30 開発", "波ダッシュ"],
    ["9:00～10:30 開発", "全角チルダ"],
    ["9:00ー10:30 開発", "長音記号"],
    ["9:00 - 10:30 開発", "前後にスペース"],
    ["９：００〜１０：３０　開発", "全角数字・全角コロン・全角スペース"],
  ])("%s（%s）を読み取る", (line) => {
    expect(parseSchedule(line).blocks).toMatchObject([{ title: "開発", start: 540, end: 630 }]);
  });

  it("タイトルの丸数字や長音記号はそのまま残す", () => {
    expect(parseSchedule("9:00-10:30 開発①").blocks[0].title).toBe("開発①");
    expect(parseSchedule("21:45-22:00 アブローラー").blocks[0].title).toBe("アブローラー");
  });
});

describe("表と記号", () => {
  it("タブ区切りの表（表をコピーしたもの）を読み取り、見出し行は読み飛ばす", () => {
    const result = parseSchedule("時間\t内容\n9:00–10:30\t開発①");

    expect(result.blocks).toMatchObject([{ title: "開発①", start: 540, end: 630 }]);
    expect(result.unparsedLines).toEqual([]);
  });

  it("Markdownの表を読み取り、見出し行と区切り行は読み飛ばす", () => {
    const result = parseSchedule("| 時間 | 内容 |\n|---|:---|\n| 9:00-10:30 | 開発 |");

    expect(result.blocks).toMatchObject([{ title: "開発", start: 540, end: 630 }]);
    expect(result.unparsedLines).toEqual([]);
  });

  it("Markdownの表で列が3つ以上あれば、時刻以外の列をつなげてタイトルにする", () => {
    const result = parseSchedule("| 9:00-10:30 | 開発 | API実装 |");

    expect(result.blocks[0].title).toBe("開発 / API実装");
  });

  it.each([
    "- 9:00-10:30 開発",
    "* 9:00-10:30 開発",
    "・9:00-10:30 開発",
    "1. 9:00-10:30 開発",
    "**9:00-10:30** 開発",
    "9:00-10:30：開発",
  ])("箇条書きや強調の記号を取り除く：%s", (line) => {
    expect(parseSchedule(line).blocks).toMatchObject([{ title: "開発", start: 540, end: 630 }]);
  });
});

describe("所要時間の補足", () => {
  it.each([
    ["9:00-10:30 開発①（1.5h）", "開発①"],
    ["12:15-13:15 ランニング（60分）", "ランニング"],
    ["7:30-8:15 Webを支える技術 読書（45m）", "Webを支える技術 読書"],
    ["9:00-10:00 開発 (1時間)", "開発"],
    ["9:00-10:00 開発（API実装）", "開発（API実装）"],
  ])("%s → %s", (line, title) => {
    expect(parseSchedule(line).blocks[0].title).toBe(title);
  });
});

describe("種別と固定の判定", () => {
  it.each(["休憩", "昼休み", "シャワー・昼食", "夕食・休憩", "起床・朝食・身支度", "入浴・自由時間", "ランチ", "仮眠", "Lunch"])(
    "%s は休憩",
    (title) => {
      expect(parseSchedule(`9:00-10:00 ${title}`).blocks[0].kind).toBe("break");
    },
  );

  it.each(["開発", "ランニング", "ピアノ"])("%s は作業", (title) => {
    expect(parseSchedule(`9:00-10:00 ${title}`).blocks[0].kind).toBe("work");
  });

  it.each(["仕事", "通勤", "帰宅", "定例MTG", "会議", "打ち合わせ", "1on1面談", "歯医者の予約", "通院"])(
    "%s は固定",
    (title) => {
      expect(parseSchedule(`9:00-10:00 ${title}`).blocks[0].fixed).toBe(true);
    },
  );

  it("キーワードのない予定は固定しない", () => {
    expect(parseSchedule("9:00-10:00 開発").blocks[0].fixed).toBe(false);
  });
});

describe("開始時刻だけの行", () => {
  it("終了は次のブロックの開始とする", () => {
    const result = parseSchedule("9:00 朝会\n9:15-10:00 開発");

    expect(result.blocks[0]).toMatchObject({ title: "朝会", start: 540, end: 555, durationGuessed: false });
  });

  it("「9:00〜 朝会」のように区切りだけ書かれていても読み取る", () => {
    expect(parseSchedule("9:00〜 朝会\n9:15-10:00 開発").blocks[0]).toMatchObject({ title: "朝会", start: 540, end: 555 });
  });

  it("最後の行なら所要時間を30分と仮置きし、仮置きしたことを示す", () => {
    const result = parseSchedule("9:00-10:00 開発\n10:00 読書");

    expect(result.blocks[1]).toMatchObject({ title: "読書", start: 600, end: 630, durationGuessed: true });
  });

  it("最後の行が就寝なら1日の終わりの印として扱い、ブロックにも読み取れなかった行にもしない", () => {
    const result = parseSchedule("22:00-23:30 入浴・自由時間\n23:30     就寝");

    expect(result.blocks).toHaveLength(1);
    expect(result.unparsedLines).toEqual([]);
  });

  it("時刻範囲のあるブロックは仮置きではない", () => {
    expect(parseSchedule("9:00-10:00 開発").blocks[0].durationGuessed).toBe(false);
  });
});

describe("日本語の時刻表記", () => {
  it.each([
    ["9時〜10時半 開発", "開発", 540, 630],
    ["13時15分-14時 開発", "開発", 795, 840],
    ["9時から10時まで 開発", "開発", 540, 600],
    ["午後1時から2時 会議", "会議", 780, 840],
    ["午前11時〜午後1時 開発", "開発", 660, 780],
    ["1:00pm-2:30pm 会議", "会議", 780, 870],
    ["9:00 to 10:00 開発", "開発", 540, 600],
  ])("%s", (line, title, start, end) => {
    expect(parseSchedule(line).blocks).toMatchObject([{ title, start, end }]);
  });

  it("所要時間（2時間、1.5時間）を時刻と読み違えない", () => {
    const result = parseSchedule("9:00-11:00 開発 2時間\n1.5時間 読書");

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].title).toBe("開発 2時間");
  });
});

describe("所要時間モード", () => {
  it("時刻範囲が1行もなければ、所要時間の行を開始時刻（既定は9:00）から順に並べる", () => {
    const result = parseSchedule("開発 2時間\nピアノ45分\n掃除30分");

    expect(result.blocks).toMatchObject([
      { title: "開発", start: 540, end: 660, durationGuessed: false },
      { title: "ピアノ", start: 660, end: 705 },
      { title: "掃除", start: 705, end: 735 },
    ]);
  });

  it("並べ始める時刻を指定できる", () => {
    expect(parseSchedule("開発 2時間", { startAt: 600 }).blocks[0]).toMatchObject({ start: 600, end: 720 });
  });

  it.each([
    ["開発　2時間", "開発", 120],
    ["Podcast台本作成1.5時間", "Podcast台本作成", 90],
    ["読書 1時間半", "読書", 90],
    ["筋トレ 1h30m", "筋トレ", 90],
    ["散歩 90min", "散歩", 90],
    ["- 掃除：30分", "掃除", 30],
  ])("所要時間の書き方：%s", (line, title, minutes) => {
    const [block] = parseSchedule(line).blocks;
    expect(block.title).toBe(title);
    expect(block.end - block.start).toBe(minutes);
  });

  it("文章の行と合計の行は読み取らない。所要時間のない短い項目は30分で仮置きする", () => {
    const result = parseSchedule("明日の予定。\n開発 2時間\nアブローラー\n合計 2.5時間");

    expect(result.blocks).toMatchObject([
      { title: "開発", start: 540, end: 660, durationGuessed: false },
      { title: "アブローラー", start: 660, end: 690, durationGuessed: true },
    ]);
    expect(result.unparsedLines).toEqual(["明日の予定。", "合計 2.5時間"]);
  });

  it("時刻の指定がある項目は固定ブロックとして置き、ほかの項目はそれを避けて並べる", () => {
    const result = parseSchedule("9時から買い物だけは確定。\n開発 2時間");

    expect(result.blocks).toMatchObject([
      { title: "買い物", start: 540, end: 570, fixed: true, durationGuessed: true },
      { title: "開発", start: 570, end: 690, fixed: false },
    ]);
  });

  it("固定ブロックにかかる項目は、固定ブロックの後ろに回す", () => {
    const result = parseSchedule("15時から歯医者\n開発 2時間\n掃除 5時間");

    expect(result.blocks).toMatchObject([
      { title: "開発", start: 540, end: 660 },
      { title: "歯医者", start: 900, end: 930, fixed: true },
      { title: "掃除", start: 930, end: 1230 },
    ]);
  });

  it("時刻範囲のある予定では、所要時間だけの行は読み取れなかった行にする", () => {
    const result = parseSchedule("9:00-10:00 開発\n読書 1時間");

    expect(result.blocks).toHaveLength(1);
    expect(result.unparsedLines).toEqual(["読書 1時間"]);
  });
});

describe("日付またぎと12時間表記", () => {
  it("終了が開始より前なら翌日とみなす", () => {
    expect(parseSchedule("23:00-1:00 夜更かし開発").blocks[0]).toMatchObject({ start: 1380, end: 1500 });
  });

  it("12時間表記で終了が開始より前なら午後とみなす", () => {
    expect(parseSchedule("11:00-1:00 開発").blocks[0]).toMatchObject({ start: 660, end: 780 });
  });

  it("前の行より時刻が戻っていれば、午後とみなす", () => {
    const result = parseSchedule("11:00-12:00 開発\n1:00-2:00 読書");

    expect(result.blocks[1]).toMatchObject({ start: 780, end: 840 });
  });

  it("前の行より時刻が戻っていて、午後でも足りなければ翌日とみなす", () => {
    const result = parseSchedule("22:00-23:30 入浴\n0:30-1:00 読書");

    expect(result.blocks[1]).toMatchObject({ start: 1470, end: 1500 });
  });
});

describe("入力の上限", () => {
  it("2万文字を超えたら読み取らずにエラーを返す", () => {
    const result = parseSchedule("あ".repeat(20001));

    expect(result).toEqual({ mode: "time", blocks: [], unparsedLines: [], error: "too-long" });
  });

  it("500行を超えたら読み取らずにエラーを返す", () => {
    const result = parseSchedule("a\n".repeat(501));

    expect(result).toEqual({ mode: "time", blocks: [], unparsedLines: [], error: "too-many-lines" });
  });

  it("ブロックが100個を超えたら読み取らずにエラーを返す", () => {
    const text = Array.from({ length: 101 }, (_, i) => `${String(i % 24)}:00-${String(i % 24)}:10 作業${i}`).join("\n");

    expect(parseSchedule(text)).toEqual({ mode: "time", blocks: [], unparsedLines: [], error: "too-many-blocks" });
  });

  it("上限内ならエラーを返さない", () => {
    expect(parseSchedule("9:00-10:00 開発").error).toBeUndefined();
  });
});

describe("読み取りモード", () => {
  it("時刻範囲があれば time、所要時間だけなら duration を返す", () => {
    expect(parseSchedule("9:00-10:00 開発").mode).toBe("time");
    expect(parseSchedule("開発 2時間").mode).toBe("duration");
  });
});
