// Run: node --experimental-vm-modules --test tests/hakoniwa-achievement.test.mjs
// 実際の付与/受信codeをDB・Discordのstubへ接続する。実付与・通知はしない。
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { timingSafeEqual } from "node:crypto";

async function harness(failMemberFetch = false) {
  const rows = new Map();
  const members = new Map([["111111111111111111", {}]]);
  const state = { sends: 0, fetches: 0, reads: 0 };
  const client = {
    guilds: {
      fetch: async () => ({
        members: {
          cache: members,
          fetch: async () => {
            state.fetches++;
            if (failMemberFetch) throw new Error("unavailable");
          },
        },
      }),
    },
    channels: {
      fetch: async () => ({
        send: async () => {
          state.sends++;
        },
      }),
    },
    users: {
      fetch: async () => ({
        send: async () => {
          state.sends++;
        },
      }),
    },
  };
  const context = createContext({
    Buffer,
    process: { env: { HAKONIWA_LINK_SECRET: "test-only-secret" } },
    console: { log() {}, warn() {}, error() {} },
    setInterval: () => 1,
    clearInterval() {},
  });
  class EmbedBuilder {
    constructor() {
      const chain = new Proxy({}, { get: () => () => chain });
      return chain;
    }
  }
  const dependencies = {
    "node:crypto": { timingSafeEqual },
    "discord.js": { EmbedBuilder },
    "../config.mjs": {
      default: {
        achievementNotification: {
          mode: "public",
          guildId: "rain",
          channelId: "notice",
        },
        idle: {
          achievements: [
            { id: 151, name: "fixture" },
            { id: 152, name: "other" },
          ],
          hidden_achievements: [{ id: 1, name: "hidden" }],
        },
      },
    },
    "../models/database.mjs": {
      UserAchievement: {
        findOrCreate: async ({ where }) => {
          state.reads++;
          if (!rows.has(where.userId))
            rows.set(where.userId, {
              unlocked: [],
              progress: {},
              hidden_unlocked: [],
            });
          return [{ achievements: structuredClone(rows.get(where.userId)) }];
        },
        update: async ({ achievements }, { where }) =>
          rows.set(where.userId, structuredClone(achievements)),
      },
    },
  };
  const modules = new Map();
  async function load(name) {
    if (modules.has(name)) return modules.get(name);
    const module = Object.hasOwn(dependencies, name)
      ? new SyntheticModule(
          Object.keys(dependencies[name]),
          function () {
            for (const [key, value] of Object.entries(dependencies[name]))
              this.setExport(key, value);
          },
          { context }
        )
      : new SourceTextModule(
          await readFile(new URL(`../utils/${name}`, import.meta.url), "utf8"),
          { context }
        );
    modules.set(name, module);
    await module.link((specifier) =>
      load(specifier === "./achievements.mjs" ? "achievements.mjs" : specifier)
    );
    return module;
  }
  const route = await load("hakoniwaAchievements.mjs");
  await route.evaluate();
  const achievements = modules.get("achievements.mjs").namespace;
  const handle = route.namespace.hakoniwaAchievementHandler(client);
  async function request(token = "test-only-secret") {
    const res = {
      status: null,
      sendStatus(code) {
        this.status = code;
      },
      json(body) {
        this.status = 200;
        this.body = body;
      },
    };
    await handle(
      {
        get: () => `Bearer ${token}`,
        body: {
          discord_user_id: "111111111111111111",
          achievement_key: "island_secretary",
        },
      },
      res
    );
    return res;
  }
  return { rows, members, state, client, achievements, request };
}

test("authenticated concurrent triggers use the existing grant once; departure suppresses later notices", async () => {
  const h = await harness();
  assert.equal((await h.request("wrong")).status, 401);
  assert.equal(h.state.reads, 0);
  await h.achievements.initializeAchievementMemberCache(h.client);
  const responses = await Promise.all([h.request(), h.request()]);
  assert.ok(responses.every((res) => res.status === 200));
  assert.equal(h.state.sends, 1);
  assert.equal(h.state.reads, 1);
  h.members.delete("111111111111111111"); // Discord.jsのguildMemberRemove更新を模擬。
  await h.achievements.unlockAchievements(h.client, "111111111111111111", 152);
  await h.achievements.unlockHiddenAchievements(
    h.client,
    "111111111111111111",
    1
  );
  await h.achievements.shutdownAchievementSystem();
  assert.deepEqual(h.rows.get("111111111111111111").unlocked, [151, 152]);
  assert.deepEqual(h.rows.get("111111111111111111").hidden_unlocked, [1]);
  assert.equal(h.state.sends, 1);
  assert.equal(h.state.fetches, 1);
});

test("an unavailable initial member cache keeps the existing save and suppresses notifications", async () => {
  const h = await harness(true);
  await h.achievements.initializeAchievementMemberCache(h.client);
  assert.equal((await h.request()).status, 200);
  await h.achievements.shutdownAchievementSystem();
  assert.deepEqual(h.rows.get("111111111111111111").unlocked, [151]);
  assert.equal(h.state.sends, 0);
});
