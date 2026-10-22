import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { EmbedBuilder, Colors } from "discord.js";

const fixedNow = "2026-10-22T05:00:00.000Z";
const separator = "\n-# \u200b\n";
const raidRoleId = "1137548892779597874";
const normalFooter = (count) => ({
  text: `${count}件の新しいシナリオが追加されました。帯書きは /ロスアカシナリオ一覧 で確認できます。`,
});
const raidFooter = (count) => ({ text: `${count}件のレイドシナリオが公示されました。` });

function scenario(id, overrides = {}) {
  return {
    id, title: `タイトル${id}`, source_name: "出典", creator: { penname: "作者", type: "GM" },
    action_type: "RESERVABLE", state: "予約中", type: "通常", difficulty: "HARD",
    current_member_count: 3, max_member_count: 5, rally_member_count: 0,
    time: "2026-10-22 21:00:00", time_type: "予約抽選",
    catchphrase: "表示しない帯書き\n二行目", join_conditions: ["条件A", "条件B"],
    rally_playing_start: null, rally_playing_end: null, ...overrides,
  };
}

async function run(scenarios, { rows = [], sendFailure = false } = {}) {
  const state = { events: [], writes: [], deletes: [], sends: [], errors: [] };
  const supabase = {
    from(table) {
      return {
        async select() { state.events.push(`select:${table}`); return { data: rows, error: null }; },
        async upsert(data) {
          state.events.push(`upsert:${table}`);
          state.writes.push({ table, data: JSON.parse(JSON.stringify(data)) });
          return { error: null };
        },
        delete() {
          return { async in(column, ids) {
            state.events.push(`delete:${table}`);
            state.deletes.push({ table, column, ids: [...ids] });
            return { error: null };
          } };
        },
      };
    },
  };
  const dependencies = {
    "../utils/rev2Graphql.mjs": { postRev2Graphql: async () => ({ data: { data: {
      rev2OpeningList: scenarios, rev2ScenarioResources: [], rev2ScenarioResourceMultipliers: [],
    } } }) },
    "discord.js": { EmbedBuilder },
    "../config.mjs": { default: {
      rev2ch: "fixture-channel",
      scenarioChecker: { difficultyEmojis: { HARD: "🔥", DEFAULT: "▫️" }, defaultReserveTime: "21:00" },
    } },
    "../utils/supabaseClient.mjs": { getSupabaseClient: () => supabase },
    fs: { default: { readFileSync: () => "fixture query" } },
    path: { default: path }, url: { fileURLToPath },
  };
  class FixedDate extends Date {
    constructor(value) { super(value === undefined ? fixedNow : value); }
  }
  const context = createContext({
    Date: FixedDate,
    process: { env: new Proxy({}, { get() { throw Error("Environment access is forbidden"); } }) },
    console: { log() {}, error: (...args) => state.errors.push(args) },
  });
  const sourceUrl = new URL("../tasks/scenario-checker.mjs", import.meta.url);
  const module = new SourceTextModule(await readFile(sourceUrl, "utf8"), {
    context, initializeImportMeta: (meta) => { meta.url = sourceUrl.href; },
  });
  await module.link((specifier) => {
    const values = dependencies[specifier];
    assert.ok(values, `Unexpected import: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  await module.namespace.checkNewScenarios({ channels: { async fetch(channelId) {
    assert.equal(channelId, "fixture-channel");
    state.events.push("channel");
    return { async send(payload) {
      state.events.push("send");
      const serialized = JSON.parse(JSON.stringify(payload));
      for (const embed of serialized.embeds) {
        if (embed.timestamp) {
          assert.ok(Number.isFinite(Date.parse(embed.timestamp)));
          embed.timestamp = "timestamp-present";
        }
      }
      state.sends.push(serialized);
      if (sendFailure) throw Error("fixture send failure");
    } };
  } } });
  return state;
}

test("通常・ラリー・レイドEXを含む新規通知の全文、色、メンション、順序を維持する", async () => {
  const fixtures = [
    scenario("n1"),
    scenario("r1", { type: "レイド", max_member_count: null }),
    scenario("y1", { type: "ラリー", rally_member_count: 7,
      rally_playing_start: "2026-10-23 08:45:00", rally_playing_end: "2026-10-25 20:30:00" }),
    scenario("r2", { type: "レイドEX", time: null, time_type: "締切", join_conditions: [] }),
    scenario("n2", { source_name: "  ", difficulty: "OTHER", action_type: "OTHER", max_member_count: null,
      time: "2026-10-22 22:15:00", time_type: "予約開始", join_conditions: [] }),
    scenario("p1", { action_type: "OUT_OF_ACTION", state: "事前公開中" }),
    scenario("hidden", { action_type: "DISCUSSION" }),
  ];
  const state = await run(fixtures);
  assert.deepEqual(state.errors, []);
  assert.deepEqual(state.sends, [
    { content: `<@&${raidRoleId}>`, allowedMentions: { roles: [raidRoleId] }, embeds: [{
      description: [
        "🔥<出典> [タイトルr1](https://rev2.reversion.jp/scenario/opening/r1)\n-# > **参加条件:** 条件A / 条件B\n-# 📖作者GM|レイド|HARD|3/∞人|**予約期間中**|**予約抽選: 21:00**",
        "🔥<出典> [タイトルr2](https://rev2.reversion.jp/scenario/opening/r2)\n-# 📖作者GM|レイドEX|HARD|3/5人|**予約期間中**|**締切: **",
      ].join(separator), color: Colors.Red, title: "🚨レイドシナリオのお知らせ(1/1)",
      timestamp: "timestamp-present", footer: raidFooter(2),
    }] },
    { embeds: [{
      description: [
        "🔥<出典> [タイトルn1](https://rev2.reversion.jp/scenario/opening/n1)\n-# > **参加条件:** 条件A / 条件B\n-# 📖作者GM|通常|HARD|3/5人|**予約期間中**",
        "🔥<出典> [タイトルy1](https://rev2.reversion.jp/scenario/opening/y1)\n-# > **参加条件:** 条件A / 条件B\n-# > **プレイング期間:** 2026/10/23 08:45 ～ 2026/10/25 20:30\n-# 📖作者GM|ラリー|HARD|3/7人|**予約期間中**",
        "▫️[タイトルn2](https://rev2.reversion.jp/scenario/opening/n2)\n-# 📖作者GM|通常|OTHER|3/∞人|**不明**|**予約抽選: 22:15**",
        "🔥<出典> [タイトルp1](https://rev2.reversion.jp/scenario/opening/p1)\n-# > **参加条件:** 条件A / 条件B\n-# 📖作者GM|通常|HARD|3/5人|**事前公開中**",
      ].join(separator), color: Colors.Green, title: "✨新規シナリオのお知らせ(1/1)",
      timestamp: "timestamp-present", footer: normalFooter(4),
    }] },
  ]);
  assert.deepEqual(state.events, ["select:scenarios", "channel", "upsert:scenarios", "send", "send", "upsert:task_logs"]);
  assert.deepEqual(state.writes[0].data.map(({ id }) => id), fixtures.map(({ id }) => id));
  assert.equal(state.writes[0].data[0].catchphrase, fixtures[0].catchphrase);
  assert.deepEqual(state.writes.at(-1), { table: "task_logs", data: {
    task_name: "scenario-checker", last_successful_run: fixedNow,
  } });
});

for (const [action, label] of [["JOINABLE", "参加受付中"], ["SUPPORTABLE", "サポート可"]]) {
  test(`${action}の表示と予約以外の時刻非表示を維持する`, async () => {
    const state = await run([scenario("s", { action_type: action, time_type: "締切" })]);
    const description = state.sends[0].embeds[0].description;
    assert.ok(description.endsWith(`|**${label}**`));
    assert.ok(!description.includes("21:00"));
  });
}

test("ラリー期間の未設定表示と事前公開以外の除外条件を維持する", async () => {
  const state = await run([
    scenario("rally", { type: "ラリー" }),
    scenario("discussion", { action_type: "DISCUSSION" }),
    scenario("out", { action_type: "OUT_OF_ACTION" }),
  ]);
  assert.equal(state.sends.length, 1);
  assert.ok(state.sends[0].embeds[0].description.includes("**プレイング期間:** 未設定 ～ 未設定"));
  assert.deepEqual(state.sends[0].embeds[0].footer, normalFooter(1));
  assert.equal(state.writes[0].data.length, 3);
});

for (const type of ["通常", "レイド"]) {
  for (const [lineLength, count] of [[1998, 1], [1999, 1], [2000, 2]]) {
    test(`${type}の既存4000文字判定の境界を維持する（line=${lineLength}）`, async () => {
      const emptyTitleLine = `🔥[](https://rev2.reversion.jp/scenario/opening/a)\n-# 📖作者GM|${type}|HARD|3/5人|**予約期間中**${type === "レイド" ? "|**: **" : ""}`;
      const titleLength = lineLength - emptyTitleLine.length;
      const fixture = (id) => scenario(id, { type, title: "a".repeat(titleLength), source_name: null,
        join_conditions: [], time: null, time_type: "" });
      const state = await run([fixture("a"), fixture("b")]);
      assert.equal(state.sends.length, count);
      const descriptions = state.sends.map(({ embeds }) => embeds[0].description);
      assert.equal(descriptions[0].length, count === 1 ? lineLength * 2 + separator.length : lineLength);
      assert.ok(descriptions[0].includes("/opening/a)"));
      assert.ok(descriptions.at(-1).includes("/opening/b)"));
      for (const [index, payload] of state.sends.entries()) {
        const embed = payload.embeds[0];
        assert.equal(embed.color, type === "レイド" ? Colors.Red : Colors.Green);
        assert.equal(embed.title, `${type === "レイド" ? "🚨レイド" : "✨新規"}シナリオのお知らせ(${index + 1}/${count})`);
        assert.equal(embed.timestamp, index === count - 1 ? "timestamp-present" : undefined);
        assert.deepEqual(embed.footer, index === count - 1 ? (type === "レイド" ? raidFooter(2) : normalFooter(2)) : undefined);
        assert.deepEqual(payload.allowedMentions, type === "レイド" ? { roles: [raidRoleId] } : undefined);
      }
    });
  }
}

test("新規・章更新・リプレイ返却・終了の送信順とDB処理順を維持する", async () => {
  const state = await run([
    scenario("new"), scenario("raid", { type: "レイド" }),
    scenario("rally", { type: "ラリー", rally_member_count: 2,
      rally_playing_start: "2026-10-23 08:45:00", rally_playing_end: "2026-10-25 20:30:00" }),
  ], { rows: [
    { id: "rally", rally_member_count: 1, rally_playing_start: null, rally_playing_end: null },
    { id: "closed", source_name: null, title: "終了済", difficulty: "HARD", creator_penname: "旧作者GM" },
  ] });
  assert.deepEqual(state.errors, []);
  assert.deepEqual(state.sends.map(({ embeds }) => embeds[0].title), [
    "🚨レイドシナリオのお知らせ(1/1)", "✨新規シナリオのお知らせ(1/1)",
    "🔄ラリーシナリオのプレイング期間更新 (1/1)", "📢ラリーシナリオのリプレイ返却 (1/1)",
    "🔚終了したシナリオ(1/1)",
  ]);
  assert.deepEqual(state.deletes, [{ table: "scenarios", column: "id", ids: ["closed"] }]);
  assert.deepEqual(state.events, ["select:scenarios", "channel", "upsert:scenarios", "delete:scenarios",
    "send", "send", "send", "send", "send", "upsert:task_logs"]);
});

test("送信失敗後は後続の通常通知と成功ログを追加しない", async () => {
  const state = await run([scenario("normal"), scenario("raid", { type: "レイド" })], { sendFailure: true });
  assert.equal(state.sends.length, 1);
  assert.equal(state.sends[0].embeds[0].color, Colors.Red);
  assert.equal(state.errors.length, 1);
  assert.deepEqual(state.writes.map(({ table }) => table), ["scenarios"]);
});

test("新規通知がないときは空のEmbedを送らない", async () => {
  const state = await run([]);
  assert.deepEqual(state.sends, []);
  assert.deepEqual(state.errors, []);
  assert.deepEqual(state.writes.map(({ table }) => table), ["task_logs"]);
});
