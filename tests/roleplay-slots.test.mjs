// DB・Discord・ストレージを置換し、公開コマンドのスロット選択を検証する。
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const source = await readFile(
  new URL("../commands/slashs/roleplay.mjs", import.meta.url), "utf8"
);
const userId = "123456789012345678";
const slotIds = Array.from({ length: 25 }, (_, i) => `${userId}${i ? `-${i}` : ""}`);
// DBの取得順とスロットの表示順が異なるデータ。
const characters = [24, 2, 0].map((slot) => ({ userId: slotIds[slot], name: `キャラ${slot}` }));
const plain = (value) => JSON.parse(JSON.stringify(value));

class Builder {
  constructor() {
    this.data = {};
    return new Proxy(this, {
      get(target, method, receiver) {
        if (method in target) return target[method];
        return (...args) => {
          const values = args.flat().map((value) => value instanceof Builder ? value.data : value);
          if (method === "addLabelComponents") {
            (target.data.components ??= []).push(...values);
          } else if (method === "addOptions") {
            (target.data.options ??= []).push(...values);
          } else if (method.startsWith("set")) {
            const key = method[3].toLowerCase() + method.slice(4);
            target.data[key] = values[0];
          }
          return receiver;
        };
      },
    });
  }
}

async function harness(subcommand, options = {}) {
  const state = { characterQueries: [], pointQueries: [], responses: [], modals: [], replies: [], errors: [] };
  const inOperator = Symbol("in");
  const dependencies = {
    "discord.js": Object.fromEntries([
      "SlashCommandBuilder", "EmbedBuilder", "ButtonBuilder", "ActionRowBuilder",
      "ModalBuilder", "TextInputBuilder", "LabelBuilder", "StringSelectMenuBuilder",
      "StringSelectMenuOptionBuilder", "FileUploadBuilder",
    ].map((name) => [name, Builder])),
    sequelize: { Op: { in: inOperator } },
    "../../components/buttons.mjs": { createRpDeleteRequestButton() {} },
    "../../models/database.mjs": {
      Character: {
        findAll(query) {
          state.characterQueries.push([...query.where.userId[inOperator]]);
          if (options.failure) return Promise.reject(options.failure);
          return options.characterPromise ?? Promise.resolve(options.characters ?? characters);
        },
      },
      Icon: {},
      Point: {
        findOne(query) {
          state.pointQueries.push(plain(query));
          return options.pointPromise ?? Promise.resolve(options.point ?? null);
        },
      },
    },
    "../../utils/localStorage.mjs": { deleteFile() {} },
    "../../utils/webhook.mjs": { sendWebhookAsCharacter() {} },
    "../../utils/achievements.mjs": { unlockAchievements() {} },
    "../../config.mjs": { default: {} },
  };
  Object.assign(dependencies["discord.js"], {
    ButtonStyle: {}, TextInputStyle: { Short: 1, Paragraph: 2 },
  });
  const context = createContext({ console: { error: (...args) => state.errors.push(args) } });
  const command = new SourceTextModule(source, { context });
  await command.link((specifier) => {
    const exports = dependencies[specifier];
    assert.ok(exports, `Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await command.evaluate();
  const interaction = {
    user: { id: userId }, replied: false, deferred: false,
    options: {
      getSubcommand: () => subcommand,
      getFocused: () => options.focused ?? "",
    },
    respond: async (choices) => state.responses.push(plain(choices)),
    showModal: async (modal) => state.modals.push(plain(modal.data)),
    reply: async (reply) => state.replies.push(plain(reply)),
  };
  return { state, interaction, command: command.namespace };
}

function modalOptions(state, customId) {
  return state.modals[0].components
    .map((label) => label.stringSelectMenuComponent)
    .find((component) => component?.customId === customId).options;
}

function assertSingleCharacterRead(state) {
  assert.deepEqual(state.characterQueries.map((ids) => [...ids]), [slotIds]);
}

test("登録autocompleteは自分の25枠を一括取得し、既存枠と最初の空き枠を番号順に返す", async () => {
  const h = await harness("register");
  await h.command.autocomplete(h.interaction);
  assertSingleCharacterRead(h.state);
  assert.deepEqual(h.state.responses[0].map(({ value }) => value), [0, 1, 2, 24]);
  assert.equal(h.state.responses[0][0].name, "🍎スロット0: キャラ0 に上書き");
  assert.equal(h.state.responses[0][1].name, "🍌スロット1: (ここに新しく保存)");
  assert.equal(h.state.pointQueries.length, 0);
});

for (const subcommand of ["post_old", "delete"]) {
  test(`${subcommand} autocompleteは既存枠だけを番号順・従来の文字列フィルターで返す`, async () => {
    const h = await harness(subcommand, { focused: "キャラ2" });
    await h.command.autocomplete(h.interaction);
    assertSingleCharacterRead(h.state);
    assert.deepEqual(h.state.responses[0].map(({ value }) => value), [2, 24]);
    assert.equal(h.state.responses[0][0].name, "🍉スロット2: キャラ2");
  });
}

test("登録モーダルは25枠を番号順に表示し、最初の空き枠だけを初期選択する", async () => {
  const h = await harness("register");
  await h.command.execute(h.interaction);
  assertSingleCharacterRead(h.state);
  const options = modalOptions(h.state, "register-slot-select");
  assert.deepEqual(options.map(({ value }) => value), Array.from({ length: 25 }, (_, i) => String(i)));
  assert.equal(options[0].label, "スロット0: キャラ0 に上書き");
  assert.equal(options[1].label, "スロット1: (ここに新しく保存)");
  assert.deepEqual(options.filter((option) => option.default).map(({ value }) => value), ["1"]);
  assert.equal(h.state.pointQueries.length, 0);
});

test("投稿はキャラと設定を並列取得し、保存済みの枠・権利表記を初期選択する", async () => {
  let resolveCharacters, resolvePoint;
  const h = await harness("post", {
    characterPromise: new Promise((resolve) => { resolveCharacters = resolve; }),
    pointPromise: new Promise((resolve) => { resolvePoint = resolve; }),
  });
  const execution = h.command.execute(h.interaction);
  assertSingleCharacterRead(h.state);
  assert.deepEqual(h.state.pointQueries, [{
    where: { userId }, attributes: ["lastRoleplaySlot", "lastCreditChoice"],
  }]);
  resolvePoint({ lastRoleplaySlot: 2, lastCreditChoice: "hide" });
  resolveCharacters(characters);
  await execution;
  const options = modalOptions(h.state, "post-slot-select");
  assert.deepEqual(options.map(({ value }) => value), ["0", "2", "24"]);
  assert.deepEqual(options.filter((option) => option.default).map(({ value }) => value), ["2"]);
  assert.equal(modalOptions(h.state, "post-credit-select").find((option) => option.default).value, "hide");
});

test("保存済みの投稿枠がなければ最小番号を選び、未登録なら従来の案内を返す", async () => {
  const h = await harness("post", { point: { lastRoleplaySlot: 19 } });
  await h.command.execute(h.interaction);
  assertSingleCharacterRead(h.state);
  assert.deepEqual(modalOptions(h.state, "post-slot-select")
    .filter((option) => option.default).map(({ value }) => value), ["0"]);
  const empty = await harness("post", { characters: [] });
  await empty.command.execute(empty.interaction);
  assertSingleCharacterRead(empty.state);
  assert.deepEqual(empty.state.replies, [{
    content: "投稿できるキャラクターが登録されていません。\n`/roleplay register` から先にキャラクターを登録してください。",
    ephemeral: true,
  }]);
  assert.equal(empty.state.modals.length, 0);
});

test("DB取得失敗はautocompleteでは伝播し、登録・投稿では既存の応答を維持する", async () => {
  const failure = new Error("test-only failure");
  const autocomplete = await harness("register", { failure });
  await assert.rejects(autocomplete.command.autocomplete(autocomplete.interaction), (error) => error === failure);
  assert.equal(autocomplete.state.responses.length, 0);
  for (const [subcommand, content] of [
    ["register", "登録モーダルの表示に失敗しました。"],
    ["post", "発言モーダルの表示に失敗しました。"],
  ]) {
    const h = await harness(subcommand, { failure });
    await h.command.execute(h.interaction);
    assertSingleCharacterRead(h.state);
    assert.deepEqual(h.state.replies, [{ content, ephemeral: true }]);
    assert.equal(h.state.errors[0][1], failure);
  }
});
