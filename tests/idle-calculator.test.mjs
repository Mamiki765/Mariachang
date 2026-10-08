// Run: node --experimental-vm-modules --test tests/idle-calculator.test.mjs
// Real formulas/config, Decimal and Discord builders; only the DB and clock are mocked.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import Decimal from "break_infinity.js";
import * as discord from "discord.js";
import { Op } from "sequelize";
import config from "../config.mjs";

const now = Date.parse("2026-10-09T00:00:00Z");
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [now]));
  }
  static now() {
    return now;
  }
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const fixture = (overrides = {}) => ({
  ...Object.fromEntries(
    Object.values(config.idle.factories).map((f) => [f.key, 0])
  ),
  userId: "fixture-user",
  population: "100",
  highestPopulation: "1000",
  lastUpdatedAt: new Date(now - 60000),
  pizzaOvenLevel: 3,
  cheeseFactoryLevel: 2,
  tomatoFarmLevel: 1,
  prestigeCount: 0,
  prestigePower: 0,
  skillPoints: 1,
  transcendencePoints: 0,
  skillLevel1: 0,
  skillLevel2: 0,
  skillLevel3: 0,
  skillLevel4: 0,
  skillLevel5: 0,
  skillLevel6: 0,
  skillLevel7: 0,
  skillLevel8: 0,
  ascensionCount: 0,
  infinityCount: 0,
  infinityTime: 10,
  eternityTime: 20,
  infinityPoints: "0",
  eternityCount: 0,
  eternityPoints: "0",
  generatorPower: "1",
  chipsSpentThisInfinity: "0",
  chipsSpentThisEternity: "0",
  pizzaBonusPercentage: 0,
  rankScore: 0,
  rankScoreComponents: {},
  ipUpgrades: { upgrades: [], generators: [] },
  epUpgrades: {},
  challenges: {},
  settings: {},
  buffMultiplier: 1,
  buffExpiresAt: null,
  ...overrides,
});

async function harness(input = fixture(), unlocked = []) {
  const context = createContext({ console, Date: FixedDate });
  const state = { reads: 0, writes: [] };
  function synthetic(values) {
    return new SyntheticModule(
      Object.keys(values),
      function () {
        for (const [key, value] of Object.entries(values))
          this.setExport(key, value);
      },
      { context }
    );
  }
  const deps = {
    "break_infinity.js": synthetic({ default: Decimal }),
    "discord.js": synthetic(discord),
    sequelize: synthetic({ Op }),
    "../config.mjs": synthetic({ default: config }),
    "../models/database.mjs": synthetic({
      IdleGame: {
        findOne: async () => {
          state.reads++;
          return structuredClone(input);
        },
        update: async (data, options) =>
          state.writes.push(plain({ data, options })),
      },
      Mee6Level: {
        findOne: async () => {
          state.reads++;
          return { level: 0 };
        },
      },
      UserAchievement: {
        findOne: async () => {
          state.reads++;
          return { achievements: { unlocked } };
        },
      },
    }),
  };
  async function load(path) {
    const module = new SourceTextModule(
      await readFile(new URL(path, import.meta.url), "utf8"),
      { context }
    );
    await module.link((specifier) => {
      assert.ok(deps[specifier], `Unexpected dependency: ${specifier}`);
      return deps[specifier];
    });
    await module.evaluate();
    return module;
  }
  const calc = await load("../idle-game/idle-game-calculator.mjs");
  deps["./idle-game-calculator.mjs"] = calc;
  const ui = await load("../idle-game/ui-builder.mjs");
  return { calc: calc.namespace, ui: ui.namespace, state };
}

test("offline income, buff expiry and game time retain the master results", async () => {
  const { calc } = await harness();
  const external = {
    mee6Level: 0,
    achievementCount: 0,
    unlockedSet: new Set(),
  };
  // Expected values captured from master 5283df6, before this refactor.
  for (const [overrides, population, bonus, infinityTime] of [
    [{}, "104.371894963069", 3.0185835685351208, 70],
    [
      { buffMultiplier: 4, buffExpiresAt: new Date(now + 3600000) },
      "117.48757985227401",
      3.0699919577845662,
      70,
    ],
    [
      { buffMultiplier: 4, buffExpiresAt: new Date(now) },
      "104.371894963069",
      3.0185835685351208,
      70,
    ],
    [{ lastUpdatedAt: new Date(now + 60000) }, "100", 3, 10],
    [
      { population: "1e400", infinityCount: 1 },
      "1.79769e+308",
      5309.254714802582,
      70,
    ],
  ]) {
    const result = calc.calculateOfflineProgress(fixture(overrides), external);
    assert.equal(result.population, population);
    assert.equal(result.pizzaBonusPercentage, bonus);
    assert.equal(result.infinityTime, infinityTime);
    assert.equal(result.lastUpdatedAt.getTime(), now);
  }
});

test("IC9 saves averaged-GP income and displays production at current GP", async () => {
  const h = await harness(
    fixture({
      infinityCount: 3,
      generatorPower: "16",
      ascensionCount: 2,
      eternityCount: 2,
      skillLevel2: 1,
      skillLevel4: 1,
      oliveFarmLevel: 5,
      challenges: {
        activeChallenge: "IC9",
        completedChallenges: ["IC2", "IC5"],
      },
      ipUpgrades: {
        upgrades: ["IU24"],
        gravity: "1",
        generators: [
          { amount: "4", bought: 1 },
          { amount: "2", bought: 1 },
        ],
      },
    }),
    [65, 66, 78]
  );
  const data = await h.calc.getSingleUserUIData("fixture-user", true);
  assert.equal(data.idleGame.population, "422319434762838");
  assert.equal(data.idleGame.generatorPower, "1430.81375329085");
  assert.equal(
    data.displayData.productionRate_d.toString(),
    "12415402898578892"
  );
  assert.equal(data.idleGame.pizzaBonusPercentage, 15288.502153987567);
  assert.equal(data.displayData.factoryEffects.olive, 1);
  assert.equal(data.displayData.radianceMultiplier, 1.12);
  const [{ data: saved, options }] = h.state.writes;
  assert.equal(h.state.writes.length, 1);
  assert.deepEqual(options, { where: { userId: "fixture-user" } });
  for (const key of [
    "population",
    "generatorPower",
    "pizzaBonusPercentage",
    "infinityTime",
    "eternityTime",
    "ipUpgrades",
    "rankScoreComponents",
  ]) {
    assert.deepEqual(saved[key], plain(data.idleGame[key]));
  }
  data.point = { legacy_pizza: 1000000 };
  const rendered = plain(h.ui.buildFactoryView(data));
  const final = plain(h.ui.buildFactoryView(data, true));
  assert.equal(rendered.embeds[0].title, "ピザ工場ステータス");
  assert.deepEqual(rendered.embeds[0].fields, final.embeds[0].fields);
  assert.ok(
    final.components
      .flatMap((row) => row.components)
      .every((button) => button.disabled)
  );
  assert.equal(
    h.state.reads,
    3,
    "rendering must not read DB or advance progress"
  );
  assert.equal(h.state.writes.length, 1);
});

test("a fresh display reflects a facility upgrade without mutating or saving state", async () => {
  const h = await harness();
  const input = fixture();
  const external = {
    mee6Level: 0,
    achievementCount: 0,
    unlockedSet: new Set(),
  };
  const before = plain(input);
  const oldDisplay = h.calc.calculateDisplayData(input, external);
  assert.equal(oldDisplay.productionRate_d.toString(), "4.371894963068575");
  assert.deepEqual(plain(input), before);
  const upgraded = { ...input, pizzaOvenLevel: 4 };
  const newDisplay = h.calc.calculateDisplayData(upgraded, external);
  assert.ok(newDisplay.productionRate_d.gt(oldDisplay.productionRate_d));
  for (const [idleGame, displayData, expectedCost, disabled] of [
    [input, oldDisplay, 125, false],
    [upgraded, newDisplay, 136, true],
  ]) {
    const data = {
      idleGame,
      displayData,
      point: { legacy_pizza: 125 },
      userAchievement: { achievements: { unlocked: [] } },
      mee6Level: 0,
      achievementCount: 0,
    };
    const rendered = plain(h.ui.buildFactoryView(data));
    assert.ok(
      rendered.embeds[0].fields[0].value.includes(
        `Lv. ${idleGame.pizzaOvenLevel}`
      )
    );
    assert.ok(
      rendered.embeds[0].fields[0].value.includes(`Next.${expectedCost}©`)
    );
    assert.equal(
      rendered.components
        .flatMap((row) => row.components)
        .find((button) => button.custom_id === "idle_upgrade_oven").disabled,
      disabled
    );
  }
  assert.deepEqual(plain(input), before);
  assert.equal(h.state.reads, 0);
  assert.equal(h.state.writes.length, 0);
});
