import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const sourceUrl = new URL("../utils/characterApi.mjs", import.meta.url);
const id = "r2p000001";
const plain = (value) => JSON.parse(JSON.stringify(value));
const fixture = (overrides = {}) => ({
  character_id: id,
  name: "Fixture PC",
  state: "Fixture",
  roots: [{ name: "Root" }],
  generation: { name: "Generation" },
  licenses: [],
  level: 10,
  exp: 123,
  exp_to_next: 500,
  testament: 50,
  sub_status: [],
  nexts: [],
  ...overrides,
});
const methods = {
  basic: (api, target) => api.getCharacterBasicInfo(id),
  next: (api, target) => api.getCharacterNextInfo(id, target),
  summary: (api, target) => api.getCharacterSummary(id, target),
  compact: (api, target) => api.getCharacterSummaryCompact(id, true, target),
};

async function harness(character = fixture(), options = {}) {
  const state = { requests: [], parameterReads: 0, events: [], errors: [] };
  const context = createContext({
    process: { env: {} },
    console: { error: (...args) => state.errors.push(args.map(String)) },
  });
  const values = {
    "./rev2Graphql.mjs": {
      postRev2Graphql: async (payload) => {
        state.events.push("detail");
        state.requests.push(plain(payload));
        if (options.requestFailure) throw new Error("fixture request failure");
        return { status: 200, data: { data: { character, status_range: [] } } };
      },
    },
    "./supabaseClient.mjs": {
      getSupabaseClient: () => ({
        from(table) {
          assert.equal(table, "app_config");
          return {
            select(columns) {
              assert.equal(columns, "key, value");
              return {
                async in(key, keys) {
                  assert.equal(key, "key");
                  assert.deepEqual(plain(keys), [
                    "rev2_max_level",
                    "rev2_base_exp",
                    "rev2_scenario_multipliers",
                  ]);
                  state.events.push("parameters");
                  state.parameterReads++;
                  return {
                    data: options.rows || [],
                    error: options.parameterFailure
                      ? "fixture parameter failure"
                      : null,
                  };
                },
              };
            },
          };
        },
      }),
    },
    fs: { default: { readFileSync: () => "fixture character query" } },
    path: { default: path },
    url: { fileURLToPath },
  };
  const module = new SourceTextModule(
    await readFile(options.source || sourceUrl, "utf8"),
    {
      context,
      identifier: sourceUrl.href,
      initializeImportMeta: (meta) => {
        meta.url = sourceUrl.href;
      },
    }
  );
  await module.link((specifier) => {
    assert.ok(values[specifier], `Unexpected dependency: ${specifier}`);
    return new SyntheticModule(
      Object.keys(values[specifier]),
      function () {
        for (const [key, value] of Object.entries(values[specifier]))
          this.setExport(key, value);
      },
      { context }
    );
  });
  await module.evaluate();
  return { api: module.namespace, state };
}

const levelLine = (text) =>
  text.split("\n").find((line) => line.startsWith("Lv."));

test("four PC summaries preserve Testament warning boundaries and caller newlines", async () => {
  for (const [testament, display] of [
    [49, "49"],
    [50, "⚠️50"],
    [79, "⚠️79"],
    [80, "⚠️80⚠️"],
    [99, "⚠️99⚠️"],
    [100, "100"],
  ]) {
    for (const [name, invoke] of Object.entries(methods)) {
      const character = fixture({ testament });
      const before = plain(character);
      const h = await harness(character);
      const text = await invoke(h.api, null);
      assert.equal(levelLine(text), `Lv.10 Exp.123/500 Testament.${display}`);
      assert.equal(
        text.endsWith("\n"),
        name === "summary" || name === "compact"
      );
      assert.equal(h.state.requests.length, 1);
      assert.deepEqual(h.state.events, ["detail", "parameters"]);
      assert.deepEqual(h.state.errors, []);
      assert.deepEqual(plain(character), before);
    }
  }
});

test("target hints, level caps and parameter failures retain each public entry point's behavior", async () => {
  const rows = [
    { key: "rev2_max_level", value: 30 },
    { key: "rev2_base_exp", value: 500 },
  ];
  for (const target of [null, 20, 999, 5]) {
    for (const [name, invoke] of Object.entries(methods)) {
      const h = await harness(fixture(), { rows });
      const line = levelLine(await invoke(h.api, target));
      const goal =
        name === "basic" || target === null || target === 5
          ? 30
          : target === 999
            ? 100
            : 20;
      assert.ok(line.includes(`(Lv.${goal}まで`));
      assert.ok(line.endsWith("Testament.⚠️50"));
      assert.deepEqual(h.state.errors, []);
      assert.equal(h.state.parameterReads, 1);
    }
  }
  for (const invoke of Object.values(methods)) {
    const capped = await harness(fixture({ level: 30, exp: 0 }), { rows });
    assert.equal(
      levelLine(await invoke(capped.api, null)),
      "Lv.30 Exp.0/500 Testament.⚠️50"
    );
    const pooled = await harness(fixture({ level: 30, exp: 100000 }), { rows });
    assert.match(levelLine(await invoke(pooled.api, null)), /\(実レベル:\d+\)/);
    const failed = await harness(fixture(), { parameterFailure: true });
    assert.equal(
      levelLine(await invoke(failed.api, 20)),
      "Lv.10 Exp.123/500 Testament.⚠️50"
    );
    assert.equal(failed.state.errors.length, 1);
  }
});

test("NPC, EXPC and failed detail responses bypass PC parameter lookups", async () => {
  for (const character of [
    fixture({
      character_id: "r2n000001",
      generation: undefined,
      npc_level: 12,
    }),
    fixture({
      owner: { name: "Fixture owner", character_id: "r2p000002" },
      generation: undefined,
    }),
  ]) {
    for (const invoke of Object.values(methods)) {
      const before = plain(character);
      const h = await harness(character);
      const text = await invoke(h.api, 20);
      assert.equal(text.includes("Testament."), false);
      assert.equal(h.state.parameterReads, 0);
      assert.deepEqual(h.state.errors, []);
      assert.deepEqual(plain(character), before);
    }
  }
  for (const options of [{}, { requestFailure: true }]) {
    for (const [name, invoke] of Object.entries(methods)) {
      const h = await harness(null, options);
      const text = await invoke(h.api, 20);
      assert.equal(levelLine(text), undefined);
      if (name === "basic")
        assert.equal(text, `https://rev2.reversion.jp/character/detail/${id}`);
      else assert.ok(text.includes("取得に失敗"));
      assert.equal(h.state.parameterReads, 0);
      assert.equal(h.state.requests.length, 1);
      assert.equal(h.state.errors.length, options.requestFailure ? 1 : 0);
    }
  }
});

test("budget output keeps its existing unadorned Testament display", async () => {
  const h = await harness(fixture({ level: 100, exp: 0, testament: 80 }), {
    rows: [{ key: "rev2_max_level", value: 100 }],
  });
  const text = await h.api.getCharacterBudgetInfo(id);
  assert.equal(levelLine(text), "Lv.100 Exp.0/500 Testament.80");
  assert.equal(text.includes("⚠️"), false);
  assert.equal(h.state.parameterReads, 1);
  assert.deepEqual(h.state.errors, []);
});
