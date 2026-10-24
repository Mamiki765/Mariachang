import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const handlerSource = await readFile(
  new URL("../handlers/messageCreate.mjs", import.meta.url),
  "utf8"
);

function fixture() {
  const calls = [];
  const config = { privatecategory: [], countingGame: {}, botid: "bot" };
  const body = {
    content: "quoted text",
    author: { id: "other" },
    attachments: [],
    embeds: [],
    createdAt: new Date("2026-10-24T00:00:00Z"),
  };
  const reference = { ...body, content: "reply target" };
  const bodies = new Map([
    ["500", body],
    ["600", reference],
  ]);
  const source = {
    id: "200",
    name: "source",
    parentId: null,
    parent: null,
    nsfw: false,
    type: 0,
    isThread() {
      return [10, 11, 12].includes(this.type);
    },
    messages: {
      fetch: async (id) => {
        calls.push(["body", id]);
        return bodies.get(id);
      },
    },
  };
  const destination = { id: "300", parent: null, nsfw: false };
  const parent = { id: "400", parentId: null, nsfw: false };
  const channels = new Map([
    [source.id, source],
    [destination.id, destination],
    [parent.id, parent],
  ]);
  const guild = {
    id: "100",
    channels: {
      fetch: async (id) => {
        calls.push(["channel", id]);
        return channels.get(id);
      },
    },
    members: {
      fetch: () =>
        assert.fail("Quote preview must not fetch member permissions"),
    },
    roles: {
      fetch: () => assert.fail("Quote preview must not fetch role permissions"),
    },
  };
  const message = {
    guild,
    guildId: guild.id,
    channel: destination,
    author: { id: "author", bot: false },
    content: "https://discord.com/channels/100/200/500",
    attachments: [],
    client: { user: { id: "bot" } },
    mentions: { has: () => false },
    reply: async (payload) => calls.push(["notice", payload]),
  };
  return {
    calls,
    config,
    source,
    parent,
    destination,
    channels,
    guild,
    message,
    body,
    bodies,
  };
}

function makeThread(f, type = 11, cachedParent = true) {
  f.source.type = type;
  f.source.parentId = f.parent.id;
  f.source.parent = cachedParent ? f.parent : null;
}

async function handler(f) {
  const dependencies = {
    "../config.mjs": { default: f.config },
    "../commands/utils/domino.mjs": { dominoeffect() {} },
    "../utils/messageutil.mjs": {
      createEmbed: (url, title, description) => ({ url, title, description }),
      getImagesFromMessage: async () => [],
      sendMessage: async (message, content, files, embeds, flags) =>
        f.calls.push(["send", { content, files, embeds, flags }]),
      safeDelete: async () => f.calls.push(["delete"]),
    },
    "../components/buttons.mjs": { deletebuttonunique() {} },
    "../utils/achievements.mjs": { updateAchievementProgress() {} },
    "../models/database.mjs": { sequelize: {}, CountingGame: {}, Point: {} },
    "../commands/utils/vc.mjs": { voiceSessions: new Map(), enqueueAudio() {} },
    "./messageCreate/reactionAndShortcutBlock.mjs": {
      handleReactionAndShortcutBlock: async () => false,
    },
  };
  const context = createContext({ console: { log() {}, error() {} } });
  const module = new SourceTextModule(handlerSource, { context });
  await module.link((specifier) => {
    const values = dependencies[specifier];
    assert.ok(values, `Unexpected import: ${specifier}`);
    return new SyntheticModule(
      Object.keys(values),
      function () {
        for (const [key, value] of Object.entries(values))
          this.setExport(key, value);
      },
      { context }
    );
  });
  await module.evaluate();
  await module.namespace.default(f.message);
}

function assertQuiet(f) {
  assert.deepEqual(
    f.calls.filter(([type]) => ["send", "delete", "notice"].includes(type)),
    []
  );
}

test("normal quotes keep the preview payload and replace the original link", async () => {
  const f = fixture();
  await handler(f);
  const sent = f.calls.find(([type]) => type === "send")[1];
  assert.equal(sent.content, "");
  assert.equal(sent.embeds[0].description, "quoted text");
  assert.equal(sent.embeds[0].url, f.message.content);
  assert.equal(sent.flags, 4096);
  assert.equal(f.calls.filter(([type]) => type === "delete").length, 1);
  assert.equal(f.calls.filter(([type]) => type === "notice").length, 0);
});

test("quotes no longer require member, role, or everyone permission proofs", async () => {
  const f = fixture();
  Object.defineProperty(f.source, "permissionOverwrites", {
    get() {
      assert.fail("Quote preview must not inspect permission overwrites");
    },
  });
  f.source.permissionsFor = () =>
    assert.fail("Quote preview must not resolve permissions");
  await handler(f);
  assert.deepEqual(
    f.calls.filter(([type]) => type === "channel"),
    [["channel", "200"]]
  );
  assert.equal(f.calls.filter(([type]) => type === "send").length, 1);
  assert.equal(f.calls.filter(([type]) => type === "notice").length, 0);
});

test("configured private categories still skip cross-channel quotes silently", async () => {
  const f = fixture();
  f.source.parentId = "private";
  f.config.privatecategory = ["private"];
  await handler(f);
  assertQuiet(f);

  f.calls.length = 0;
  f.message.channel = f.source;
  await handler(f);
  assert.equal(f.calls.filter(([type]) => type === "send").length, 1);
  assert.equal(f.calls.filter(([type]) => type === "notice").length, 0);
});

test("private threads still skip cross-channel quotes but allow same-thread quotes", async () => {
  const f = fixture();
  makeThread(f, 12);
  await handler(f);
  assertQuiet(f);

  f.calls.length = 0;
  f.message.channel = f.source;
  await handler(f);
  assert.equal(f.calls.filter(([type]) => type === "send").length, 1);
});

test("private categories also exclude public and announcement threads, with or without cached parents", async () => {
  for (const type of [10, 11]) {
    for (const cachedParent of [false, true]) {
      const f = fixture();
      makeThread(f, type, cachedParent);
      f.parent.parentId = "private";
      f.config.privatecategory = ["private"];
      await handler(f);
      assertQuiet(f);

      f.calls.length = 0;
      f.message.channel = f.source;
      await handler(f);
      assert.equal(f.calls.filter(([kind]) => kind === "send").length, 1);
      assert.equal(f.calls.filter(([kind]) => kind === "notice").length, 0);
    }
  }
});

test("an unavailable thread parent leaves the link intact without a notice", async () => {
  for (const throws of [false, true]) {
    const f = fixture();
    makeThread(f, 11, false);
    f.channels.delete(f.parent.id);
    if (throws) {
      const fetch = f.guild.channels.fetch;
      f.guild.channels.fetch = async (id) => {
        if (id === f.parent.id) throw Error("Parent unavailable");
        return fetch(id);
      };
    }
    await handler(f);
    assertQuiet(f);
  }
});

test("NSFW channels and threads still skip safe destinations silently", async () => {
  for (const sourceIsThread of [false, true]) {
    for (const destinationIsThread of [false, true]) {
      const f = fixture();
      if (sourceIsThread) {
        makeThread(f, 11, false);
        f.parent.nsfw = true;
      } else {
        f.source.nsfw = true;
      }
      await handler(f);
      assertQuiet(f);

      f.calls.length = 0;
      if (destinationIsThread) f.destination.parent = { nsfw: true };
      else f.destination.nsfw = true;
      await handler(f);
      assert.equal(f.calls.filter(([type]) => type === "send").length, 1);
      assert.equal(f.calls.filter(([type]) => type === "notice").length, 0);
    }
  }
});

test("public and announcement threads retain normal quote expansion", async () => {
  for (const type of [10, 11]) {
    const f = fixture();
    makeThread(f, type);
    await handler(f);
    assert.equal(f.calls.filter(([kind]) => kind === "send").length, 1);
  }
});

test("DMs, other guild links, bot messages, and missing bodies stay untouched", async () => {
  const changes = [
    (f) => {
      f.message.guild = null;
    },
    (f) => {
      f.message.content = "https://discord.com/channels/999/200/500";
    },
    (f) => {
      f.message.author.bot = true;
    },
    (f) => {
      f.bodies.delete("500");
    },
  ];
  for (const change of changes) {
    const f = fixture();
    change(f);
    await handler(f);
    assertQuiet(f);
  }
});

test("reply previews keep their existing same-channel and same-guild boundary", async () => {
  for (const [channelId, guildId, expectedBodies] of [
    ["200", "100", 2],
    ["200", undefined, 2],
    ["secret-channel", "100", 1],
    ["200", "another-guild", 1],
  ]) {
    const f = fixture();
    f.body.reference = { messageId: "600", channelId, guildId };
    await handler(f);
    assert.equal(
      f.calls.filter(([type]) => type === "body").length,
      expectedBodies
    );
    const sent = f.calls.find(([type]) => type === "send")[1];
    assert.equal(sent.embeds.length, expectedBodies);
    if (expectedBodies === 2)
      assert.equal(sent.embeds[1].description, "reply target");
    assert.equal(f.calls.filter(([type]) => type === "delete").length, 1);
  }
});
