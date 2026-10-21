import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { ChannelType, PermissionsBitField, PermissionFlagsBits as P } from "discord.js";
import { authorizedQuoteSource } from "../utils/quotePermissions.mjs";

const READ = P.ViewChannel | P.ReadMessageHistory;
const permissions = (bits) => new PermissionsBitField(bits);
const overwrite = (id, deny, allow = 0n) => [id, { deny: permissions(deny), allow: permissions(allow) }];

function fixture() {
  const calls = [];
  const member = { id: "author" };
  const everyone = { id: "100", permissions: permissions(READ) };
  const channel = (id) => ({
    id, guildId: "100", parentId: null, nsfw: false, type: ChannelType.GuildText,
    isThread() { return [10, 11, 12].includes(this.type); },
    isTextBased: () => true,
    permissionOverwrites: { cache: new Map() },
    permissionsFor: () => permissions(READ),
    messages: { fetch: async (id) => { calls.push(["body", id]); return body; } },
  });
  const source = channel("200");
  const destination = channel("300");
  const parent = channel("400");
  const channels = new Map([source, destination, parent].map((c) => [c.id, c]));
  const body = {
    content: "quoted text", author: { id: "other" }, attachments: [], embeds: [], createdAt: new Date(),
  };
  const guild = {
    id: "100",
    channels: { fetch: async (id, options) => { assert.equal(options.force, true); calls.push(["channel", id]); return channels.get(id); } },
    members: { fetch: async (options) => { assert.equal(options.force, true); assert.equal(options.user, member.id); return member; } },
    roles: { fetch: async () => new Map([[everyone.id, everyone]]) },
  };
  const message = {
    guild, guildId: guild.id, channel: destination, author: { id: "author", bot: false },
    content: "https://discord.com/channels/100/200/500", attachments: [],
    client: { user: { id: "bot" } }, mentions: { has: () => false },
    reply: async (payload) => calls.push(["notice", payload]),
  };
  return { calls, member, everyone, source, destination, parent, channels, guild, message, body };
}

test("public quotes require fresh author access, history, and same guild", async () => {
  const f = fixture();
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), f.source);
  for (const bits of [0n, P.ViewChannel, P.ReadMessageHistory]) {
    f.source.permissionsFor = () => permissions(bits);
    assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
  }
  f.source.permissionsFor = () => permissions(READ);
  f.source.guildId = "another-guild";
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
  assert.equal(f.calls.filter(([type]) => type === "body").length, 0);
});

test("role/member deny overwrites and restricted everyone access prevent public copies", async () => {
  for (const id of ["100", "role", "member"]) {
    for (const deny of [P.ViewChannel, P.ReadMessageHistory]) {
      const f = fixture();
      f.source.permissionOverwrites.cache = new Map([overwrite(id, deny)]);
      assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
    }
  }
  const f = fixture();
  f.everyone.permissions = permissions(P.ViewChannel);
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
});

test("same-channel restricted quotes work only when all viewers can read history", async () => {
  const f = fixture();
  f.message.channel = f.source;
  f.source.permissionOverwrites.cache = new Map([overwrite("100", P.ViewChannel)]);
  assert.equal(await authorizedQuoteSource(f.message, f.source.id, ["private"]), f.source);
  f.source.permissionOverwrites.cache.set(...overwrite("role", P.ReadMessageHistory));
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
});

test("public threads resolve their parent permissions and private category", async () => {
  for (const type of [ChannelType.PublicThread, ChannelType.AnnouncementThread]) {
    const f = fixture();
    f.source.type = type;
    f.source.parentId = f.parent.id;
    assert.equal(await authorizedQuoteSource(f.message, f.source.id), f.source);
    f.parent.parentId = "private";
    assert.equal(await authorizedQuoteSource(f.message, f.source.id, ["private"]), null);
    f.parent.parentId = null;
    f.parent.permissionOverwrites.cache = new Map([overwrite("role", P.ViewChannel)]);
    assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
  }
});

test("NSFW thread content cannot expand into a non-NSFW destination", async () => {
  const f = fixture();
  f.source.type = ChannelType.PublicThread;
  f.source.parentId = f.parent.id;
  f.parent.nsfw = true;
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
  f.destination.nsfw = true;
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), f.source);
});

test("private threads require same channel and verified membership or ManageThreads", async () => {
  const f = fixture();
  f.source.type = ChannelType.PrivateThread;
  f.source.parentId = f.parent.id;
  f.source.members = { fetch: async () => ({ id: f.member.id }) };
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
  f.message.channel = f.source;
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), f.source);
  f.source.members.fetch = async () => new Map();
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
  f.source.members.fetch = async () => new Map([[f.member.id, {}]]);
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), f.source);
  f.parent.permissionsFor = () => permissions(READ | P.ManageThreads);
  f.source.members.fetch = () => { throw Error("not needed"); };
  assert.equal(await authorizedQuoteSource(f.message, f.source.id), f.source);
});

test("missing channels, parent, roles, overwrite data and REST errors fail closed", async () => {
  const changes = [
    (f) => f.channels.delete(f.source.id),
    (f) => f.channels.delete(f.destination.id),
    (f) => { f.source.type = ChannelType.PublicThread; f.source.parentId = "missing"; },
    (f) => { f.source.permissionOverwrites = null; },
    (f) => { f.guild.roles.fetch = async () => new Map(); },
    (f) => { f.guild.members.fetch = async () => { throw Error("REST failure"); }; },
  ];
  for (const change of changes) {
    const f = fixture(); change(f);
    assert.equal(await authorizedQuoteSource(f.message, f.source.id), null);
  }
});

async function handler(f) {
  const dependencies = {
    "../config.mjs": { default: { privatecategory: [], countingGame: {}, botid: "bot" } },
    "../utils/quotePermissions.mjs": { authorizedQuoteSource },
    "../commands/utils/domino.mjs": { dominoeffect() {} },
    "../utils/messageutil.mjs": {
      createEmbed: (...args) => args,
      getImagesFromMessage: async () => [],
      sendMessage: async (...args) => f.calls.push(["send", args]),
      safeDelete: async () => f.calls.push(["delete"]),
    },
    "../components/buttons.mjs": { deletebuttonunique() {} },
    "../utils/achievements.mjs": { updateAchievementProgress() {} },
    "../models/database.mjs": { sequelize: {}, CountingGame: {}, Point: {} },
    "../commands/utils/vc.mjs": { voiceSessions: new Map(), enqueueAudio() {} },
    "./messageCreate/reactionAndShortcutBlock.mjs": { handleReactionAndShortcutBlock: async () => false },
  };
  const context = createContext({ console: { log() {}, error() {} } });
  const module = new SourceTextModule(await readFile(new URL("../handlers/messageCreate.mjs", import.meta.url), "utf8"), { context });
  await module.link((specifier) => {
    const values = dependencies[specifier];
    assert.ok(values, `Unexpected import: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  await module.namespace.default(f.message);
}

test("real handler refuses private content before body fetch and leaves the original intact", async () => {
  const f = fixture();
  f.source.permissionOverwrites.cache = new Map([overwrite("role", P.ViewChannel)]);
  await handler(f);
  assert.equal(f.calls.filter(([type]) => ["body", "send", "delete"].includes(type)).length, 0);
  const notice = f.calls.find(([type]) => type === "notice")[1];
  assert.equal(notice.allowedMentions.repliedUser, false);
});

test("real handler retains public preview and same-channel replies but never fetches cross-channel references", async () => {
  for (const referenceChannel of ["200", "secret-channel"]) {
    const f = fixture();
    f.body.reference = { messageId: "600", channelId: referenceChannel, guildId: "100" };
    await handler(f);
    assert.equal(f.calls.filter(([type]) => type === "body").length, referenceChannel === "200" ? 2 : 1);
    assert.equal(f.calls.filter(([type]) => type === "send").length, 1);
    assert.equal(f.calls.filter(([type]) => type === "delete").length, 1);
  }
});
