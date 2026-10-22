// 実ソースの公開関数を通し、HTTP・Discord・DB・実環境変数を使わずに確認する。
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const root = new URL("../", import.meta.url);
const characterId = "r2n000123";
const characterUrl = `https://rev2.reversion.jp/character/detail/${characterId}`;
const paths = {
  character: "utils/characterApi.mjs",
  scenario: "tasks/scenario-checker.mjs",
  atelier: "tasks/atelier-checker.mjs",
};
const plain = (value) => JSON.parse(JSON.stringify(value));

function responseData(operation) {
  if (operation === "GetCharacterDetail") {
    return { data: { character: { character_id: characterId, name: "テストNPC", licenses: [] } } };
  }
  if (operation === "OpeningList") {
    return { data: { rev2OpeningList: [], rev2ScenarioResources: [], rev2ScenarioResourceMultipliers: [] } };
  }
  return { data: { rev2IllustExtraCardsOnSale: { data: [{ status_name: "予約期間中" }] } } };
}

async function harness(options = {}) {
  const state = { requests: [], reads: [], writes: [], sends: [], errors: [], logs: [], channelReads: 0 };
  const axios = {
    async post(url, payload, config) {
      state.requests.push({ url, payload: plain(payload), config });
      if (options.failure) throw options.failure;
      const status = options.status ?? 200;
      if (status >= 300 && !config.validateStatus?.(status)) {
        throw new Error(`Request failed with status code ${status}`);
      }
      return { status, data: options.data ?? responseData(payload.operationName) };
    },
  };
  class EmbedBuilder {
    constructor() { this.data = {}; }
  }
  for (const method of ["setURL", "setTimestamp", "setFooter", "setColor", "setTitle", "setDescription"]) {
    EmbedBuilder.prototype[method] = function (value) { this.data[method] = value; return this; };
  }
  const channel = {
    async send({ embeds }) {
      state.sends.push(plain(embeds.map((embed) => embed.data)));
      if (options.sendFailure) throw options.sendFailure;
    },
  };
  const client = { channels: { fetch: async () => { state.channelReads++; return channel; } } };
  const supabase = {
    from(table) {
      return {
        async select() { state.reads.push(table); return { data: [], error: null }; },
        async upsert(data) { state.writes.push({ table, data: plain(data) }); return { error: null }; },
      };
    },
  };
  const exportsBySpecifier = {
    axios: { default: axios },
    "discord.js": { EmbedBuilder },
    fs: { default: { readFileSync: (file) => `fixture:${path.basename(file)}` } },
    path: { default: path },
    url: { fileURLToPath },
  };
  const context = createContext({
    process: { env: options.forbidEnvAccess ? new Proxy({}, {
      get() { throw new Error("Environment access is forbidden in this test"); },
    }) : {} },
    console: {
      error: (...args) => state.errors.push(args),
      log: (...args) => state.logs.push(args),
    },
  });
  const modules = new Map();
  async function load(name) {
    if (modules.has(name)) return modules.get(name);
    let exports = exportsBySpecifier[name];
    if (name === "config.mjs") exports = { default: { rev2ch: "test-channel" } };
    if (name === "utils/supabaseClient.mjs") exports = { getSupabaseClient: () => supabase };
    let module;
    if (exports) {
      module = new SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      }, { context });
    } else {
      assert.ok([...Object.values(paths), "utils/rev2Graphql.mjs"].includes(name), `Unexpected module: ${name}`);
      module = new SourceTextModule(await readFile(new URL(name, root), "utf8"), {
        context, identifier: name,
        initializeImportMeta: (meta) => { meta.url = new URL(name, root).href; },
      });
    }
    modules.set(name, module);
    await module.link((specifier) => load(
      specifier.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier)) : specifier
    ));
    return module;
  }
  async function invoke(kind) {
    const module = await load(paths[kind]);
    if (module.status !== "evaluated") await module.evaluate();
    if (kind === "character") return module.namespace.getCharacterBasicInfo(characterId);
    if (kind === "scenario") return module.namespace.checkNewScenarios(client);
    return module.namespace.checkAtelierCards(client, true);
  }
  return { state, invoke, load };
}

test("3操作のURL・変数・query・15秒timeout・個別ヘッダーと成功時動作を維持する", async () => {
  const h = await harness();
  assert.equal(await h.invoke("character"), `${characterUrl}\nキャラクター「テストNPC」は **NPC** です。`);
  await h.invoke("scenario");
  await h.invoke("atelier");
  const [character, scenario, atelier] = h.state.requests;
  assert.equal(h.state.requests.length, 3);
  for (const request of h.state.requests) {
    assert.equal(request.url, `https://rev2.reversion.jp/graphql?opname=${request.payload.operationName}`);
    assert.equal(request.config.timeout, 15_000);
    assert.equal(request.config.headers.cookie, undefined);
  }
  assert.deepEqual(character.payload, {
    operationName: "GetCharacterDetail", variables: { character_id: characterId },
    query: "fixture:getCharacterDetail.graphql",
  });
  assert.equal(character.config.validateStatus(503), true);
  assert.equal(character.config.headers.referer, characterUrl);
  assert.equal(character.config.headers["accept-language"], "ja");
  assert.match(character.config.headers["user-agent"], /Chrome\/144/);
  assert.deepEqual(scenario.payload, {
    operationName: "OpeningList",
    variables: { input: {
      states: ["PUBLISHED", "RESERVING", "DISCUSSION", "DEPARTED"],
      type: null, character_id: null, creator_id: null, penname: null,
      heading: null, title: null, include_gm: null, include_nm: null,
      include_old_rally: null, supportable: null, allow_ex_playing: null,
    } },
    query: "fixture:getOpeningScenarios.graphql",
  });
  assert.equal(scenario.config.validateStatus, undefined);
  assert.deepEqual(atelier.payload, {
    operationName: "GetOnSellingIllustExtraCardList", variables: { page: 1 },
    query: "fixture:getAtelierCards.graphql",
  });
  assert.equal(atelier.config.validateStatus, undefined);
  assert.equal(atelier.config.headers.Referer, "https://rev2.reversion.jp/shop/illust/excard/search");
  assert.match(atelier.config.headers["User-Agent"], /Chrome\/138/);
  assert.deepEqual(h.state.reads, ["scenarios"]);
  assert.deepEqual(h.state.writes.map(({ data }) => data.task_name), ["scenario-checker", "atelier-checker"]);
  assert.equal(h.state.sends.length, 1);
  assert.equal(h.state.sends[0][0].setDescription, "**1枚**のエクストラカードが登録されたようですにゃ！");
  assert.deepEqual(h.state.errors, []);
});

for (const kind of Object.keys(paths)) {
  for (const failureKind of ["timeout", "HTTP 503"]) {
    test(`${kind}の${failureKind}は再試行せず既存の失敗処理へ戻る`, async () => {
      const failure = Object.assign(new Error("test timeout"), { code: "ECONNABORTED" });
      const h = await harness(failureKind === "timeout" ? { failure } : { status: 503 });
      const result = await h.invoke(kind);
      assert.equal(result, kind === "character" ? characterUrl : undefined);
      assert.equal(h.state.requests.length, 1);
      assert.equal(h.state.requests[0].config.timeout, 15_000);
      assert.equal(h.state.errors.length, 1);
      assert.deepEqual(h.state.reads, []);
      assert.deepEqual(h.state.writes, []);
      assert.deepEqual(h.state.sends, []);
    });
  }
}

test("キャラクターのGraphQL errorsは従来どおりURLだけを返す", async () => {
  const h = await harness({ data: { errors: [{ message: "test-only error" }] } });
  assert.equal(await h.invoke("character"), characterUrl);
  assert.equal(h.state.errors[0][0], "[エラー] GraphQLエラー:");
});

test("シナリオ一覧が欠ける応答はDB更新や通知を行わず終了する", async () => {
  const h = await harness({ data: { data: {} } });
  await h.invoke("scenario");
  assert.equal(h.state.requests.length, 1);
  assert.deepEqual(h.state.writes, []);
  assert.deepEqual(h.state.sends, []);
  assert.equal(h.state.logs.at(-1)[0], "APIからシナリオデータを取得できませんでした。");
});

test("アトリエの不正な応答は既存のAPI失敗処理で終了する", async () => {
  const h = await harness({ data: { data: {} } });
  await h.invoke("atelier");
  assert.equal(h.state.errors.length, 1);
  assert.deepEqual(h.state.writes, []);
  assert.deepEqual(h.state.sends, []);
});

test("アトリエ通知の送信失敗後も従来の成功時刻記録を維持する", async () => {
  const h = await harness({ sendFailure: new Error("test-only send failure") });
  await h.invoke("atelier");
  assert.equal(h.state.errors.length, 1);
  assert.equal(h.state.sends.length, 1);
  assert.equal(h.state.writes[0].data.task_name, "atelier-checker");
});

test("共通送信は環境変数を読まず、個別ヘッダー・HTTP判定を後続操作へ持ち越さない", async () => {
  const h = await harness({ forbidEnvAccess: true });
  const module = await h.load("utils/rev2Graphql.mjs");
  await module.evaluate();
  const firstOptions = { headers: { "X-Test-Only": "fixture" }, validateStatus: () => true };
  const secondOptions = { headers: { "Content-Type": "application/json" } };
  await module.namespace.postRev2Graphql({ operationName: "GetCharacterDetail" }, firstOptions);
  await module.namespace.postRev2Graphql({ operationName: "OpeningList" }, secondOptions);
  assert.equal(h.state.requests[0].config.headers, firstOptions.headers);
  assert.equal(h.state.requests[0].config.validateStatus, firstOptions.validateStatus);
  assert.equal(h.state.requests[1].config.headers["X-Test-Only"], undefined);
  assert.equal(h.state.requests[1].config.validateStatus, undefined);
  assert.equal(Object.hasOwn(firstOptions, "timeout"), false);
  assert.equal(Object.hasOwn(secondOptions, "timeout"), false);
});
