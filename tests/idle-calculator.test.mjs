// Run: node --experimental-vm-modules --test tests/idle-calculator.test.mjs
// Real formulas/config, Decimal and Discord builders; DB, clock and achievement delivery are mocked.
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

async function harness(input = fixture(), unlocked = [], models = {}) {
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
      ...models,
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
  return {
    calc: calc.namespace,
    ui: ui.namespace,
    state,
    loadHandlers: async () => {
      deps["../utils/achievements.mjs"] = synthetic({
        unlockAchievements: async () => {},
        unlockHiddenAchievements: async () => {},
      });
      return (await load("../idle-game/handlers.mjs")).namespace;
    },
  };
}

async function purchaseHarness(input, budget, unlocked = []) {
  const state = {
    saves: 0,
    commits: 0,
    rollbacks: 0,
    replies: [],
    updates: [],
  };
  const model = {
    ...structuredClone(input),
    get: () => structuredClone(input),
    changed: () => {},
    save: async () => {
      state.saves++;
    },
    update: async (data) => {
      state.updates.push(plain(data));
      Object.assign(model, data);
    },
  };
  const point = {
    legacy_pizza: budget,
    decrement: async (field, { by }) => {
      point[field] -= by;
    },
  };
  const transaction = {
    LOCK: { UPDATE: "UPDATE" },
    commit: async () => {
      state.commits++;
    },
    rollback: async () => {
      state.rollbacks++;
    },
  };
  const h = await harness(input, unlocked, {
    IdleGame: { findOne: async () => model },
    Point: { findOne: async () => point },
    sequelize: {
      transaction: async (callback) =>
        callback ? callback(transaction) : transaction,
    },
  });
  const interaction = {
    user: { id: input.userId },
    client: {},
    followUp: async (reply) => state.replies.push(reply),
  };
  return { handlers: await h.loadHandlers(), model, point, state, interaction };
}

test("skill view preserves affordability, TP unlock, IC5 and SP reset gates", async () => {
  const { ui, state } = await harness();
  const render = (input) =>
    plain(
      ui.buildSkillView({
        idleGame: input,
        displayData: { radianceMultiplier: 1 },
      })
    );
  const buttons = (view) => view.components.flatMap((row) => row.components);
  const levelCosts = [
    [1, 1, 1, 1, 1, 10, 10, 40],
    [2, 2, 2, 2, 1.5, 20, 18, 120],
  ];
  for (const [level, costs] of levelCosts.entries()) {
    for (const [index, cost] of costs.entries()) {
      const skillNum = index + 1;
      const balanceKey = skillNum <= 4 ? "skillPoints" : "transcendencePoints";
      for (const delta of [-0.25, 0, 0.25]) {
        const input = fixture({
          prestigePower: 16,
          [`skillLevel${skillNum}`]: level,
          [balanceKey]: cost + delta,
        });
        const before = plain(input);
        const button = buttons(render(input)).find(
          (b) => b.custom_id === `idle_upgrade_skill_${skillNum}`
        );
        assert.equal(button.disabled, delta < 0);
        assert.deepEqual(plain(input), before);
      }
    }
  }
  for (const prestigePower of [15, 16]) {
    const view = render(fixture({ prestigePower }));
    assert.equal(
      buttons(view).some((b) => b.custom_id === "idle_upgrade_skill_5"),
      prestigePower === 16
    );
    assert.equal(view.embeds[0].fields.length, prestigePower === 16 ? 9 : 4);
  }
  const ic5 = buttons(
    render(
      fixture({ skillPoints: 100, challenges: { activeChallenge: "IC5" } })
    )
  );
  assert.equal(
    ic5.find((b) => b.custom_id === "idle_upgrade_skill_4").disabled,
    true
  );
  assert.equal(
    ic5.find((b) => b.custom_id === "idle_upgrade_skill_3").disabled,
    false
  );
  for (const [overrides, disabled] of [
    [{ skillPoints: 0 }, true],
    [{ skillPoints: 1 }, false],
    [{ skillPoints: 0, skillLevel3: 1 }, false],
  ]) {
    assert.equal(
      buttons(render(fixture(overrides))).find(
        (b) => b.custom_id === "idle_skill_reset"
      ).disabled,
      disabled
    );
  }
  assert.equal(state.reads, 0);
  assert.equal(state.writes.length, 0);
});

test("skill purchases recalculate from the latest level and preserve balances", async () => {
  const { ui } = await harness();
  const levelCosts = [
    [1, 2],
    [1, 2],
    [1, 2],
    [1, 2],
    [1, 1.5],
    [10, 20],
    [10, 18],
    [40, 120],
  ];
  for (const [index, [oldCost, latestCost]] of levelCosts.entries()) {
    const skillNum = index + 1;
    const levelKey = `skillLevel${skillNum}`;
    const balanceKey = skillNum <= 4 ? "skillPoints" : "transcendencePoints";
    const input = fixture({ prestigePower: 16, [balanceKey]: oldCost });
    const view = plain(
      ui.buildSkillView({
        idleGame: input,
        displayData: { radianceMultiplier: 1 },
      })
    );
    assert.equal(
      view.components
        .flatMap((row) => row.components)
        .find((b) => b.custom_id === `idle_upgrade_skill_${skillNum}`).disabled,
      false
    );
    const h = await purchaseHarness(input, 0);
    h.model[levelKey] = 1;
    const before = plain(h.model);
    assert.equal(
      await h.handlers.handleSkillUpgrade(h.interaction, skillNum),
      false
    );
    assert.deepEqual(plain(h.model), before);
    assert.equal(h.state.saves, 0);
    assert.equal(
      h.state.replies.at(-1).content,
      skillNum <= 4 ? "SPが足りません！" : "TPが足りません！"
    );
    for (const surplus of [0, 0.25]) {
      h.model[levelKey] = 1;
      h.model[balanceKey] = latestCost + surplus;
      assert.equal(
        await h.handlers.handleSkillUpgrade(h.interaction, skillNum),
        true
      );
      assert.equal(h.model[levelKey], 2);
      assert.equal(h.model[balanceKey], surplus);
    }
    assert.equal(h.state.saves, 2);
  }
});

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
  const generators = plain(h.ui.buildInfinityView(data));
  assert.deepEqual(
    generators.components
      .flatMap((row) => row.components)
      .filter(
        (button) =>
          button.custom_id.startsWith("idle_generator_buy_") &&
          button.custom_id !== "idle_generator_buy_all"
      )
      .map((button) => button.custom_id),
    ["idle_generator_buy_1", "idle_generator_buy_2", "idle_generator_buy_3"]
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

test("ascension bonuses retain production and factory display across Infinity and IC9", async () => {
  const h = await harness();
  const external = {
    mee6Level: 7,
    achievementCount: 3,
    unlockedSet: new Set([65, 66, 78]),
  };
  // master 74c55f8の結果。Infinity前はIC/IU報酬を適用せず、Eternity倍率は適用する。
  for (const [infinityCount, activeChallenge, production, ovenEffect] of [
    [0, null, "3.5882634634027966e+62", "4,632,809"],
    [0, "IC9", "1.0333663091314638e+41", "4,632,809"],
    [1, null, "1.7313330794508084e+68", "12,080,670"],
    [1, "IC9", "5.399390623696908e+43", "12,080,670"],
    [100, null, "3.2716291558705235e+83", "350,127,119"],
    [100, "IC9", "1.9058310571833972e+53", "350,127,119"],
  ]) {
    const input = fixture({
      ascensionCount: 3,
      infinityCount,
      eternityCount: 5,
      population: "1e100",
      highestPopulation: "1e200",
      prestigePower: 10,
      skillLevel2: 3,
      skillLevel4: 2,
      generatorPower: "1e8",
      buffMultiplier: 4,
      buffExpiresAt: new Date(now + 60000),
      challenges: {
        activeChallenge,
        completedChallenges: ["IC2", "IC7", "IC8"],
      },
      ipUpgrades: {
        upgrades: ["IU24", "IU23", "IU65"],
        generators: [
          { amount: "4", bought: 1 },
          { amount: "2", bought: 1 },
        ],
      },
    });
    const before = plain(input);
    const displayData = h.calc.calculateDisplayData(input, external);
    assert.equal(displayData.productionRate_d.toString(), production);
    const rendered = plain(
      h.ui.buildFactoryView({
        idleGame: input,
        displayData,
        point: { legacy_pizza: 1000000 },
        userAchievement: { achievements: { unlocked: [65, 66, 78] } },
        mee6Level: 7,
        achievementCount: 3,
      })
    );
    assert.equal(
      rendered.embeds[0].fields[0].value,
      `Lv. 3 (${ovenEffect}) Next.125©`
    );
    assert.deepEqual(plain(input), before);
  }

  // 再描画では最新の回数を使い、Numberの上限を超える倍率も保持する。
  const input = fixture();
  const initial = h.calc.calculateDisplayData(input, external);
  input.ascensionCount = 10000;
  const refreshed = h.calc.calculateDisplayData(input, external);
  assert.equal(initial.ascensionEffect_d.toString(), "1");
  assert.ok(refreshed.ascensionEffect_d.gt(Number.MAX_VALUE));
  assert.ok(Number.isFinite(refreshed.ascensionEffect_d.log10()));
  assert.ok(refreshed.productionRate_d.gt(initial.productionRate_d));
  assert.equal(h.state.reads, 0);
  assert.equal(h.state.writes.length, 0);
});

test("bulk facility allocation preserves discounted costs, locks and chip accounting", async () => {
  const input = fixture({
    ...Object.fromEntries(
      Object.values(config.idle.factories).map((f) => [f.key, 0])
    ),
    prestigePower: 8,
    skillLevel6: 10,
    ipUpgrades: { upgrades: ["IU14"] },
    epUpgrades: { chronoUpgrades: { realityDiscount: 3 } },
  });
  const before = plain(input);
  const h = await purchaseHarness(input, 1000000, [65, 66, 78]);
  assert.equal(await h.handlers.handleAutoAllocate(h.interaction), true);
  assert.deepEqual(
    Object.values(config.idle.factories).map((f) => h.model[f.key]),
    [73, 47, 39, 34, 31, 0, 0, 24]
  );
  assert.equal(h.point.legacy_pizza, 3976);
  assert.equal(h.model.chipsSpentThisInfinity, "996024");
  assert.equal(h.model.chipsSpentThisEternity, "996024");
  assert.equal(h.state.saves, 1);
  assert.equal(h.state.rollbacks, 0);
  assert.deepEqual(plain(input), before);
});

test("bulk generators preserve unbought priority, Decimal balances and the 1000-purchase limit", async () => {
  for (const [budget, counts, remainder] of [
    ["1e12", [12, 5, 3, 2, 1, 0, 0, 0], "668767868789"],
    ["1e6000", [373, 186, 123, 92, 73, 60, 50, 43], "1e+6000"],
  ]) {
    const input = fixture({
      infinityPoints: budget,
      ipUpgrades: {
        upgrades: [],
        generators: Array.from({ length: 8 }, (_, i) => ({
          amount: String(i + 1),
          bought: 0,
        })),
      },
    });
    const h = await purchaseHarness(input, 0);
    assert.equal(await h.handlers.handleGeneratorBuyAll(h.interaction), true);
    assert.deepEqual(
      h.model.ipUpgrades.generators.map((g) => g.bought),
      counts
    );
    assert.deepEqual(
      h.model.ipUpgrades.generators.map((g) => g.amount),
      counts.map((count, i) => String(count + i + 1))
    );
    assert.equal(h.model.infinityPoints, remainder);
    assert.equal(h.state.saves, 1);
    assert.equal(h.state.commits, 1);
    assert.equal(h.state.rollbacks, 0);
  }
});

test("challenge descriptions and controls keep IC9 gating, status and abort behavior", async () => {
  const h = await harness();
  const firstEight = Array.from({ length: 8 }, (_, i) => `IC${i + 1}`);
  for (const [completedChallenges, activeChallenge, showIC9] of [
    [[], null, false],
    [firstEight.slice(0, 7), null, false],
    [[...firstEight.slice(0, 7), "IC1"], null, false],
    [firstEight, null, true],
    [[...firstEight, "IC9"], null, true],
    [firstEight, "IC9", true],
    [["IC1"], "IC2", false],
  ]) {
    const input = fixture({
      challenges: {
        completedChallenges,
        activeChallenge,
        IC9: { bestTime: 3661 },
      },
    });
    const before = plain(input);
    const rendered = plain(h.ui.buildChallengeView({ idleGame: input }));
    const fields = rendered.embeds[0].fields;
    const buttons = rendered.components.flatMap((row) => row.components);
    const starts = buttons.filter((button) =>
      button.custom_id.startsWith("idle_start_challenge_")
    );
    const expected = showIC9 ? [...firstEight, "IC9"] : firstEight;
    assert.deepEqual(
      fields.map((field) => field.name.split(":")[0]),
      expected
    );
    assert.deepEqual(
      starts.map((button) => button.custom_id),
      expected.map((id) => `idle_start_challenge_${id}`)
    );
    for (const [i, id] of expected.entries()) {
      const status =
        id === activeChallenge
          ? "挑戦中"
          : completedChallenges.includes(id)
            ? "✅ 達成済み"
            : "未挑戦";
      assert.ok(fields[i].name.endsWith(`[${status}]`));
      assert.equal(
        starts[i].disabled,
        Boolean(activeChallenge) ||
          (id !== "IC9" && completedChallenges.includes(id))
      );
    }
    assert.equal(
      buttons.some((button) => button.custom_id === "idle_abort_challenge"),
      Boolean(activeChallenge)
    );
    if (showIC9)
      assert.ok(fields.at(-1).value.includes("自己ベスト（現実時間)"));
    assert.deepEqual(plain(input), before);
  }
  assert.equal(h.state.reads, 0);
  assert.deepEqual(h.state.writes, []);
});

test("eternity CP prices agree with buttons at Decimal cost boundaries and refresh from new state", async () => {
  const h = await harness();
  const resourceKeys = {
    nyowamiya: "population",
    ip: "infinityPoints",
    ep: "eternityPoints",
  };
  for (const times of [0, 1, 3, 10]) {
    for (const [type, key] of Object.entries(resourceKeys)) {
      const cost = h.calc.calculateCpGainCost(type, times);
      for (const factor of [0.5, 1, 2]) {
        const input = fixture({
          [key]: cost.mul(factor).toString(),
          eternityCount: 2,
          epUpgrades: { cpGainedFrom: { [type]: times }, chronoPoints: "0" },
        });
        const before = plain(input);
        const rendered = plain(h.ui.buildEternityView({ idleGame: input }));
        const buttons = rendered.components.flatMap((row) => row.components);
        assert.equal(
          buttons.find(
            (button) => button.custom_id === `idle_gain_max_cp_${type}`
          ).disabled,
          factor < 1
        );
        assert.ok(
          rendered.embeds[0].fields[0].value.includes(
            h.calc.formatNumberDynamic_Decimal(cost)
          )
        );
        assert.deepEqual(
          plain(h.ui.generateEternityButtons({ idleGame: input })),
          rendered.components
        );
        assert.deepEqual(plain(input), before);
      }
    }
  }
  const input = fixture({ infinityPoints: "1", epUpgrades: {} });
  const ipButton = () =>
    plain(h.ui.buildEternityView({ idleGame: input }))
      .components.flatMap((row) => row.components)
      .find((button) => button.custom_id === "idle_gain_max_cp_ip");
  assert.equal(ipButton().disabled, false);
  input.epUpgrades.cpGainedFrom = { ip: 1 };
  assert.equal(ipButton().disabled, true);
  assert.equal(h.state.reads, 0);
  assert.deepEqual(h.state.writes, []);
});

test("chrono display, max levels and reset controls keep their state without carrying prices between renders", async () => {
  const h = await harness();
  for (const [id, upgrade] of Object.entries(
    config.idle.eternity.chronoUpgrades
  )) {
    for (const level of [
      0,
      upgrade.maxLevel - 1,
      upgrade.maxLevel,
      upgrade.maxLevel + 1,
    ]) {
      for (const chronoPoints of ["0", "1", "2"]) {
        const input = fixture({
          epUpgrades: { chronoPoints, chronoUpgrades: { [id]: level } },
        });
        const before = plain(input);
        const rendered = plain(h.ui.buildEternityView({ idleGame: input }));
        const buttons = rendered.components.flatMap((row) => row.components);
        const cost = upgrade.cost(level);
        const isMax = level >= upgrade.maxLevel;
        assert.equal(
          buttons.find(
            (button) => button.custom_id === `idle_chrono_upgrade_${id}`
          ).disabled,
          Number(chronoPoints) < cost || isMax
        );
        const text = rendered.embeds[0].fields.find((field) =>
          field.name.includes("クロノアップグレード")
        ).value;
        assert.ok(
          text.includes(
            `**${upgrade.name}** [Lv.${level}] (${isMax ? "✅" : `${cost} CP`})`
          )
        );
        assert.equal(
          buttons.some((button) => button.custom_id === "idle_chrono_reset"),
          level > 0
        );
        assert.deepEqual(plain(input), before);
      }
    }
  }
  // A legacy key still makes the existing reset action available.
  const legacy = fixture({ epUpgrades: { chronoUpgrades: { legacy: 1 } } });
  assert.ok(
    plain(h.ui.generateEternityButtons({ idleGame: legacy }))
      .flatMap((row) => row.components)
      .some((button) => button.custom_id === "idle_chrono_reset")
  );
  assert.equal(h.state.reads, 0);
  assert.deepEqual(h.state.writes, []);
});

test("chrono purchases validate the current locked model after an affordable screen was rendered", async () => {
  const input = fixture({
    epUpgrades: { chronoPoints: "1", chronoUpgrades: {} },
  });
  const h = await harness();
  const rendered = plain(h.ui.buildEternityView({ idleGame: input }));
  assert.equal(
    rendered.components
      .flatMap((row) => row.components)
      .find(
        (button) => button.custom_id === "idle_chrono_upgrade_realityDiscount"
      ).disabled,
    false
  );
  for (const [chronoPoints, level, success] of [
    ["0", 0, false],
    ["1", 1000, false],
    ["1", 999, true],
  ]) {
    const purchase = await purchaseHarness(input, 0);
    purchase.model.epUpgrades = {
      chronoPoints,
      chronoUpgrades: { realityDiscount: level },
    };
    assert.equal(
      await purchase.handlers.handleChronoUpgradePurchase(
        purchase.interaction,
        "realityDiscount"
      ),
      success
    );
    assert.equal(purchase.state.saves, Number(success));
    assert.equal(purchase.state.commits, Number(success));
    assert.equal(purchase.state.rollbacks, Number(!success));
    assert.equal(
      purchase.model.epUpgrades.chronoPoints,
      success ? "0" : chronoPoints
    );
    assert.equal(
      purchase.model.epUpgrades.chronoUpgrades.realityDiscount,
      success ? 1000 : level
    );
  }
});

test("IU embed and buttons agree at the first unfinished tier and after all purchases", async () => {
  const h = await harness();
  for (const [upgrades, expectedButtons, expectedTier] of [
    [["IU11", "IU12", "IU13", "IU14"], ["IU21", "IU22", "IU23", "IU24"], 2],
    [
      config.idle.infinityUpgrades.tiers.flatMap((tier) =>
        Object.keys(tier.upgrades)
      ),
      ["IU91"],
      9,
    ],
  ]) {
    const rendered = plain(
      h.ui.buildInfinityUpgradesView({
        idleGame: fixture({ infinityCount: 1, ipUpgrades: { upgrades } }),
        point: { legacy_pizza: 0 },
      })
    );
    const buttons = rendered.components
      .flatMap((row) => row.components)
      .filter((button) => button.custom_id.startsWith("idle_iu_purchase_"));
    assert.deepEqual(
      buttons.map((button) => button.custom_id),
      expectedButtons.map((id) => `idle_iu_purchase_${id}`)
    );
    assert.ok(buttons.every((button) => button.disabled));
    assert.ok(
      rendered.embeds[0].fields.some((field) =>
        field.name.includes(`Tier ${expectedTier}`)
      )
    );
  }
});

test("prestige automatic skill allocation preserves SP priority and the iteration limit", async () => {
  for (const [priority, budget] of [
    ["1234", 3.25],
    ["4321", 3.25],
    ["3412", 1e300],
  ]) {
    const input = fixture({
      population: "1e20",
      highestPopulation: "1e19",
      prestigeCount: 1,
      prestigePower: 20,
      skillPoints: budget,
      ipUpgrades: { upgrades: ["IU12"], generators: [] },
      settings: {
        skipPrestigeConfirmation: true,
        autoAssignSpPriority: priority,
        autoAssignTpEnabled: false,
      },
    });
    const before = plain(input);
    const h = await purchaseHarness(input, 0);
    const order = [];
    let allocating = true;
    for (let skillNum = 1; skillNum <= 4; skillNum++) {
      let level = h.model[`skillLevel${skillNum}`];
      Object.defineProperty(h.model, `skillLevel${skillNum}`, {
        enumerable: true,
        get: () => level,
        set: (next) => {
          if (allocating) order.push(String(skillNum));
          level = next;
        },
      });
    }
    const update = h.model.update;
    h.model.update = async (...args) => {
      allocating = false;
      return update(...args);
    };
    assert.equal(await h.handlers.handlePrestige(h.interaction), true);
    assert.equal(h.state.updates.length, 1);
    const saved = h.state.updates[0];
    for (let skillNum = 1; skillNum <= 4; skillNum++) {
      assert.equal(
        saved[`skillLevel${skillNum}`],
        h.model[`skillLevel${skillNum}`]
      );
    }
    if (budget < 4) {
      assert.deepEqual(order, priority.slice(0, 3).split(""));
      assert.equal(saved.skillPoints, budget - order.length);
    } else {
      assert.equal(order.length, 500);
      const levels = [1, 2, 3, 4].map((n) => saved[`skillLevel${n}`]);
      assert.ok(Math.max(...levels) - Math.min(...levels) <= 1);
    }
    assert.deepEqual(plain(input), before);
    assert.equal(h.state.rollbacks, 0);
  }
});
