import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import * as discord from "discord.js";
import { Op } from "sequelize";
import { readImageAttachment } from "../utils/imageAttachment.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=", "base64");
const image = { name: "test.png", size: 1, url: "https://cdn.discordapp.com/attachments/1/2/test.png" };

async function moduleAt(path, dependencies) {
  const context = createContext({ console: { error() {}, log() {} } });
  const module = new SourceTextModule(await readFile(new URL(path, import.meta.url), "utf8"), { context });
  await module.link((specifier) => {
    const values = dependencies[specifier];
    assert.ok(values, `Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

function fixture() {
  const calls = [];
  const storage = {
    uploadFile: async (buffer) => { calls.push(["upload", buffer.length]); return { url: "https://example.com/image.png", path: "image.png" }; },
    deleteFile: async () => calls.push(["delete"]),
  };
  const interaction = {
    user: { id: "123456789" }, client: {}, member: { roles: { cache: new Map() } },
    deferReply: async () => {}, editReply: async (reply) => calls.push(["reply", reply]),
  };
  return { calls, storage, interaction };
}

test("sticker registration persists actual received bytes and does not publish private stickers", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(png));
  const f = fixture();
  const command = await moduleAt("../commands/slashs/sticker.mjs", {
    "discord.js": discord, "sequelize": { Op },
    "../../utils/imageAttachment.mjs": { readImageAttachment },
    "../../utils/localStorage.mjs": f.storage,
    "../../utils/gitHubDeployer.mjs": { deployStickerListPage: () => { throw Error("must not deploy"); } },
    "../../config.mjs": { default: { sticker: { vipRoles: [], limitPerUser: 50, directorySizeLimit: 1e8 } } },
    "../../models/database.mjs": { Sticker: {
      count: async () => 0, findOne: async () => null, sum: async () => 0,
      create: async (row) => f.calls.push(["create", row]),
    } },
  });
  f.interaction.options = {
    getSubcommand: () => "register", getAttachment: () => image,
    getString: () => "sample", getBoolean: () => false,
  };
  await command.execute(f.interaction);
  assert.equal(f.calls.find(([type]) => type === "create")[1].fileSize, png.length);
  assert.equal(f.calls.find(([type]) => type === "upload")[1], png.length);
  t.mock.method(globalThis, "fetch", async () => new Response("not an image"));
  f.calls.length = 0;
  await command.execute(f.interaction);
  assert.deepEqual(f.calls.map(([type]) => type), ["reply"]);
});

async function roleplay(f, customId, uploaded = true) {
  const handler = await moduleAt("../handlers/interactionCreate/modalHandlers.mjs", {
    "discord.js": discord, "../../config.mjs": { default: {} },
    "../../components/buttons.mjs": { replytoDM() {}, replyfromDM() {}, createRpDeleteRequestButton: () => ({}) },
    "../../utils/webhook.mjs": { sendWebhookAsCharacter: async () => { f.calls.push(["webhook"]); return { id: "posted" }; } },
    "../../commands/slashs/roleplay.mjs": { updatePoints: async () => null },
    "../../utils/localStorage.mjs": f.storage,
    "../../utils/imageAttachment.mjs": { readImageAttachment },
    "../../models/database.mjs": {
      Character: { findOne: async () => ({ name: "character" }), upsert: async (row) => f.calls.push(["character", row]) },
      Icon: { findOne: async () => ({ deleteHash: "old.png" }), upsert: async (row) => f.calls.push(["icon", row]) },
      Point: {}, sequelize: { transaction: async (callback) => { f.calls.push(["transaction"]); await callback({}); } },
    },
  });
  f.interaction.customId = customId;
  f.interaction.fields = {
    getTextInputValue: (name) => name.includes("message") ? "hello" : "character",
    getStringSelectValues: (name) => [name.includes("slot") ? "0" : name.includes("pbw") ? "other" : "display"],
    getUploadedFiles: () => ({ size: uploaded ? 1 : 0, first: () => image }),
  };
  await handler.default(f.interaction);
}

test("both RP upload routes reject oversize data before deleting icons, opening transactions or posting", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(new Uint8Array(1024 * 1024 + 1)));
  for (const customId of ["roleplay-register-modal", "roleplay-post-modal"]) {
    const f = fixture();
    await roleplay(f, customId);
    assert.deepEqual(f.calls.map(([type]) => type), ["reply"]);
  }
});

test("both RP upload routes save valid images and posting without a new image still works", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(png));
  for (const customId of ["roleplay-register-modal", "roleplay-post-modal"]) {
    const f = fixture();
    await roleplay(f, customId);
    assert.equal(f.calls.find(([type]) => type === "icon")[1].fileSize, png.length);
    assert.equal(f.calls.filter(([type]) => type === "upload").length, 1);
  }
  const f = fixture();
  const fetch = t.mock.method(globalThis, "fetch", () => { throw Error("no image request expected"); });
  await roleplay(f, "roleplay-post-modal", false);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(f.calls.filter(([type]) => type === "webhook").length, 1);
});
