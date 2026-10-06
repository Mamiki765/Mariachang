// Run: node --experimental-vm-modules --test tests/idle-command.test.mjs
// Control-flow tests of the real command. Discord, DB and arithmetic are mocked;
// these tests do not claim to validate production formulas or Discord rendering.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";

const source = await readFile(
  process.env.IDLE_COMMAND_SOURCE ||
    new URL("../commands/slashs/idle.mjs", import.meta.url),
  "utf8"
);
const routes = [
  ["factory", "idle_show_factory", "buildFactoryView"],
  ["skill", "idle_show_skills", "buildSkillView"],
  ["infinity", "idle_show_infinity", "buildInfinityView"],
  ["infinity_upgrades", "idle_show_iu_upgrades", "buildInfinityUpgradesView"],
  ["challenges", "idle_show_challenges", "buildChallengeView"],
  ["eternity", "idle_show_eternity", "buildEternityView"],
];
const handlerNames = [
  "handleFacilityUpgrade", "handlePrestige", "handleSkillReset",
  "handleNyoboshiHire", "handleAutoAllocate", "handleSkillUpgrade",
  "handleInfinity", "handleAscension", "handleGeneratorPurchase",
  "handleSettings", "handleInfinityUpgradePurchase", "handleGhostChipUpgrade",
  "handleStartChallenge", "handleAbortChallenge", "handleEternity",
  "handleGalaxyPurchase", "handleAscensionMax", "handleGeneratorBuyAll",
  "handleGravityUpgradePurchase", "handleGainMaxCp",
  "handleChronoUpgradePurchase", "handleChronoUpgradeReset", "handleStoryReplay",
];

function uiData(population = "10", overrides = {}) {
  return {
    idleGame: {
      population, highestPopulation: population, prestigeCount: 0,
      prestigePower: 0, ovenLevel: 0, skillLevel8: 0,
      buffMultiplier: 4, buffExpiresAt: new Date(Date.now() + 25 * 3600000),
      challenges: {}, ...overrides,
    },
    displayData: { meatEffect: 1 },
    userAchievement: { achievements: { unlocked: [], hidden_unlocked: [] } },
  };
}

async function harness({ view = null, ranking = null, unlocked = true } = {}) {
  const state = {
    idleReads: 0, pointReads: 0, loads: [], handlers: [], edits: [], replies: [],
    errors: [], initial: uiData("10", unlocked ? {
      prestigePower: 8, infinityCount: 1, eternityCount: 1,
      ipUpgrades: { upgrades: ["IU22"] },
    } : {}),
    next: uiData("123"), point: { legacy_pizza: "456" },
    actionResult: true, exists: true, pendingUi: null,
  };
  const events = new Map();
  const collector = {
    on: (event, callback) => events.set(event, callback),
    resetTimer() {},
  };
  const interaction = {
    user: { id: "test-user" }, client: {},
    options: { getString: (name) => name === "view" ? view : ranking },
    reply: async () => ({ createMessageComponentCollector: () => collector }),
    editReply: async (payload) => state.edits.push(payload),
    followUp: async (payload) => state.replies.push(payload),
    deleteReply: async () => {},
  };
  const builders = Object.fromEntries(routes.map(([name, , exported]) => [
    exported, (data, final = false) => ({
      view: name, population: data.idleGame.population,
      balance: data.point?.legacy_pizza, final,
    }),
  ]));
  const handlers = Object.fromEntries(handlerNames.map((name) => [
    name, async (...args) => {
      state.handlers.push({ name, args });
      return state.actionResult;
    },
  ]));
  class DecimalStub {
    constructor(value) { this.value = Number(value); }
    gte(value) { return this.value >= Number(value); }
  }
  class SlashCommandBuilder {
    constructor() {
      const chain = new Proxy({}, { get: () => () => chain });
      return chain;
    }
  }
  const dependencies = {
    "break_infinity.js": { default: DecimalStub },
    "discord.js": { SlashCommandBuilder },
    "../../config.mjs": {
      default: { idle: { factories: { oven: { key: "ovenLevel" } } } },
    },
    "../../models/database.mjs": {
      IdleGame: {
        findOrCreate: async () => [state.initial.idleGame, false],
        findOne: async () => {
          state.idleReads++;
          return state.exists ? state.initial.idleGame : null;
        },
        update: async () => {},
      },
      Point: {
        findOrCreate: async () => [{ legacy_pizza: "20" }, false],
        findOne: async () => { state.pointReads++; return state.point; },
      },
      sequelize: {},
    },
    "../../utils/achievements.mjs": {
      unlockAchievements: async () => {}, unlockHiddenAchievements: async () => {},
    },
    "../../idle-game/handlers.mjs": handlers,
    "../../idle-game/idle-game-calculator.mjs": {
      getSingleUserUIData: async (...args) => {
        state.loads.push(args);
        if (state.loads.length === 1) return state.initial;
        return state.pendingUi || state.next;
      },
    },
    "../../idle-game/ui-builder.mjs": {
      ...builders, generateProfileEmbed: (data) => ({ profile: data.idleGame.population }),
      executeRankingCommand: async (...args) => state.handlers.push({ name: "ranking", args }),
    },
  };
  const context = createContext({
    console: { error: (...args) => state.errors.push(args), warn: () => {} },
  });
  const command = new SourceTextModule(source, { context });
  await command.link((specifier) => {
    const values = dependencies[specifier];
    assert.ok(values, `Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await command.evaluate();
  await command.namespace.execute(interaction);
  return {
    state, events,
    click: async (customId) => {
      const button = {
        user: interaction.user, customId, deferred: false,
        deferUpdate: async () => { button.deferred = true; },
        followUp: interaction.followUp,
      };
      await events.get("collect")(button);
      return button;
    },
    end: () => events.get("end")([]),
  };
}

// Check real routing behavior, not source spelling or a fixed number of screens.
test("initial rendering and navigation use the expected existing builders", async () => {
  for (const [view, button] of routes) {
    const h = await harness({ view });
    assert.equal(h.state.edits.at(-1).view, view);
    await h.click(button);
    assert.equal(h.state.edits.at(-1).view, view);
    assert.equal(h.state.edits.at(-1).population, "123");
    assert.equal(h.state.idleReads, 0, "navigation must not prefetch IdleGame");
    assert.equal(h.state.loads.length, 2, "initial load + one fresh navigation load");
    assert.equal(h.state.pointReads, 1);
  }
});

test("help, settings and story retain their paths without extra game reads", async () => {
  const h = await harness();
  await h.click("idle_info");
  assert.equal(h.state.replies.length, 1);
  for (const id of ["idle_show_settings", "idle_story_mode"]) {
    assert.equal((await h.click(id)).deferred, false);
  }
  assert.deepEqual(h.state.handlers.map((call) => call.name), [
    "handleSettings", "handleStoryReplay",
  ]);
  assert.equal(h.state.idleReads, 0);
  assert.equal(h.state.pointReads, 0);
  assert.equal(h.state.loads.length, 1);
});

test("successful action refreshes once and final rendering keeps the latest snapshot", async () => {
  const h = await harness();
  await h.click("idle_upgrade_oven");
  assert.equal(h.state.handlers[0].name, "handleFacilityUpgrade");
  assert.equal(h.state.handlers[0].args[1], "oven");
  assert.equal(h.state.idleReads, 1, "mutation existence guard is preserved");
  assert.equal(h.state.loads.length, 2);
  assert.equal(h.state.pointReads, 1);
  await h.end();
  assert.deepEqual(h.state.edits.at(-1), {
    view: "factory", population: "123", balance: "456", final: true,
  });
  assert.equal(h.state.loads.length, 2, "ending must not recalculate progress");
  assert.equal(h.state.pointReads, 1);
});

test("cancelled reset or absent game does not run the refresh path", async () => {
  const cancelled = await harness();
  cancelled.state.actionResult = false;
  await cancelled.click("idle_skill_reset");
  assert.equal(cancelled.state.handlers[0].name, "handleSkillReset");
  assert.equal(cancelled.state.loads.length, 1);
  assert.equal(cancelled.state.pointReads, 0);
  const absent = await harness();
  absent.state.exists = false;
  await absent.click("idle_upgrade_oven");
  assert.equal(absent.state.handlers.length, 0);
  assert.equal(absent.state.loads.length, 1);
});

test("incomplete refresh reports failure and keeps the last successfully displayed data", async () => {
  for (const missing of ["next", "point"]) {
    const h = await harness();
    await h.click("idle_show_factory");
    const successful = h.state.edits.at(-1);
    h.state[missing] = null;
    await h.click("idle_show_skills");
    assert.equal(h.state.errors.length, 1);
    assert.equal(h.state.replies.length, 1);
    assert.equal(h.state.edits.at(-1), successful);
    await h.end();
    assert.equal(h.state.edits.at(-1).population, successful.population);
    assert.equal(h.state.edits.at(-1).balance, successful.balance);
  }
});

test("Point loading starts before the independent UI calculation finishes", async () => {
  const h = await harness();
  let resolveUi;
  h.state.pendingUi = new Promise((resolve) => { resolveUi = resolve; });
  const click = h.click("idle_show_skills");
  await setImmediate();
  // Always release the blocked request, including when testing the old command.
  const readsBeforeResolution = h.state.pointReads;
  resolveUi(h.state.next);
  await click;
  assert.equal(readsBeforeResolution, 1);
  assert.equal(h.state.edits.at(-1).balance, "456");
});

test("initial unlock guard and unknown-view factory fallback are preserved", async () => {
  const locked = await harness({ view: "skill", unlocked: false });
  assert.equal(locked.state.edits.at(-1).view, "factory");
  assert.equal(locked.state.replies.length, 1);
  const unknown = await harness({ view: "not-a-view" });
  assert.equal(unknown.state.edits.at(-1).view, "factory");
});

test("public ranking and profile paths do not create a game collector", async () => {
  const ranking = await harness({ ranking: "public" });
  assert.equal(ranking.state.handlers[0].name, "ranking");
  assert.equal(ranking.state.handlers[0].args[1], false);
  assert.equal(ranking.state.loads.length, 0);
  assert.equal(ranking.events.size, 0);
  const profile = await harness({ ranking: "view" });
  assert.equal(profile.state.replies[0].embeds[0].profile, "10");
  assert.equal(profile.events.size, 0);
});
