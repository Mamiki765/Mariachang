//idle-game/idle-game-calculator.mjs
//commands/slashs/idle.mjsの各種計算や、処理部分を移植する
//UIとかユーザーが直接操作する部分は今のところidle.mjsに残す
import Decimal from "break_infinity.js";
import config from "../config.mjs";
import { IdleGame, Mee6Level, UserAchievement } from "../models/database.mjs";
//modがないので自作
Decimal.prototype.mod = function (b) {
  return this.sub(this.div(b).floor().mul(b));
};

/**
 * TPスキル#6によるコスト割引率を計算する
 * @param {number} skillLevel6 - スキル#6の現在のレベル
 * @returns {number} コストに乗算する割引率 (例: 0.8 => 20%引き)
 */
export function calculateDiscountMultiplier(skillLevel6 = 0) {
  if (skillLevel6 <= 0) {
    return 1.0; // 割引なし
  }
  const settings = config.idle.tp_skills.skill6;
  const baseDiscount = 1.0 - Math.pow(settings.effectBase, skillLevel6);

  if (baseDiscount <= settings.softCapThreshold) {
    return 1.0 - baseDiscount;
  } else {
    const overflow = baseDiscount - settings.softCapThreshold;
    const finalDiscount =
      settings.softCapThreshold + overflow / settings.softCapDivisor;
    return 1.0 - finalDiscount;
  }
}

//TPスキル#5によるベース強化を考慮した強化を入れる
//ゲームが進んできたらここもDicimal検討しよう
export function calculateFactoryEffects(idleGame, pp, unlockedSet = new Set()) {
  const effects = {};
  const s5_level = idleGame.skillLevel5 || 0;
  const s5_config = config.idle.tp_skills.skill5;
  const baseLevelBonusPerLevel = s5_level * s5_config.effect;
  const activeChallenge = idleGame.challenges?.activeChallenge;

  // config.idle.factories をループで処理
  for (const [name, factoryConfig] of Object.entries(config.idle.factories)) {
    // configに定義された 'key' を使って、idleGameオブジェクトからレベルを取得
    const level = idleGame[factoryConfig.key] || 0;
    // --- この施設の計算にPPを含めるかどうかを判定 ---
    let ppForThisFactory = pp; // デフォルトはPP効果あり
    if (
      factoryConfig.type === "multiplicative2" &&
      factoryConfig.unlockAchievementId &&
      !unlockedSet.has(factoryConfig.unlockAchievementId)
    ) {
      //追加乗算施設＋実績持ち＋未解禁の時、工場LVは0に
      ppForThisFactory = 0;
    }

    if (factoryConfig.type === "additive") {
      // ピザ窯の計算
      const ovenFinalEffect =
        (level + ppForThisFactory) * (1 + baseLevelBonusPerLevel * level);
      effects[name] = ovenFinalEffect;
    } else if (
      activeChallenge === "IC9" &&
      factoryConfig.type === "multiplicative2"
    ) {
      //IC9なら容赦なく"1"
      effects[name] = 1.0;
    } else if (
      factoryConfig.type === "multiplicative" ||
      factoryConfig.type === "multiplicative2"
    ) {
      // チーズ工場などの乗算施設の計算
      const base_effect = factoryConfig.effect;
      const boosted_effect = base_effect * (1 + baseLevelBonusPerLevel * level);
      const finalEffect = 1 + boosted_effect * (level + ppForThisFactory);
      effects[name] = finalEffect;
    }
  }

  return effects;
}

/**
 * 【修正版】施設のアップグレードコストを計算する (numberを返す)
 * @param {string} type
 * @param {number} level
 * @param {number} skillLevel6 - TPスキル#6のレベル
 * @param {Set<string>} purchasedIUs - 購入済みのIU IDのSet
 * @param {string|null} [activeChallenge=null] - 現在実行中のインフィニティ・チャレンジのID
 * @returns {number}
 */
export function calculateFacilityCost(
  type,
  level,
  skillLevel6 = 0,
  purchasedIUs = new Set(),
  activeChallenge = null
) {
  const facility = config.idle.factories[type];
  if (!facility) return Infinity;

  if (activeChallenge === "IC9" && facility.type === "multiplicative2") {
    return Infinity;
  }

  // --- 計算は内部的にDecimalで行うのが巨大数に対して最も安全 ---
  const baseCost_d = new Decimal(facility.baseCost);
  const multiplier_d = new Decimal(facility.multiplier);
  const discountMultiplier_d = new Decimal(
    calculateDiscountMultiplier(skillLevel6)
  );

  let finalDiscountMultiplier_d = discountMultiplier_d;

  if (purchasedIUs.has("IU14")) {
    const iu14Discount =
      config.idle.infinityUpgrades.tiers[0].upgrades.IU14.discount;
    finalDiscountMultiplier_d = finalDiscountMultiplier_d.times(
      1 - iu14Discount
    );
  }

  const finalCost_d = baseCost_d
    .times(multiplier_d.pow(level))
    .times(finalDiscountMultiplier_d);

  // --- 最終結果をnumberとして返す ---
  // コストが安全な範囲を超えたらInfinityを返すのが最も安全な挙動
  if (finalCost_d.gte(Number.MAX_VALUE)) {
    return Infinity;
  }
  return finalCost_d.floor().toNumber();
}

/**
 * 全ての施設のコストを計算し、オブジェクトとして返す (割引適用版)
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {object}
 */
export function calculateAllCosts(idleGame) {
  const costs = {};
  const skillLevel6 = idleGame.skillLevel6 || 0;
  const purchasedIUs = new Set(idleGame.ipUpgrades?.upgrades || []);
  const activeChallenge = idleGame.challenges?.activeChallenge;
  // config.idle.factories をループで処理
  for (const [name, factoryConfig] of Object.entries(config.idle.factories)) {
    // configからDBカラム名を取得
    const levelKey = factoryConfig.key;
    // DBカラム名を使って、現在のレベルを取得
    const currentLevel = idleGame[levelKey] || 0;

    // 計算したコストを costs オブジェクトに格納
    costs[name] = calculateFacilityCost(
      name,
      currentLevel,
      skillLevel6,
      purchasedIUs,
      activeChallenge
    );
  }

  return costs;
}

/**
 * スキルレベルから、そのスキルに費やされた合計SPを計算する
 * (2^0 + 2^1 + ... + 2^(レベル-1)) = 2^レベル - 1
 * @param {number} level - スキルの現在のレベル
 * @returns {number} 消費された合計SP
 */
export function calculateSpentSP(level) {
  if (level <= 0) return 0;
  return Math.pow(2, level) - 1;
}

/**
 * TP獲得量を計算する (スキル#8の効果も考慮)
 * ★ Decimal対応版 ★
 * @param {Decimal} population_d - 現在の人口 (Decimalオブジェクト)
 * @param {number} skillLevel8 - スキル#8の現在のレベル (これはNumberでOK)
 * @param {object} [challenges={}] - チャレンジの状態オブジェクト
 * @returns {number} 獲得できるTPの量 (TPはNumberで十分なのでNumberを返す)
 */
export function calculatePotentialTP(
  population_d,
  skillLevel8 = 0,
  challenges = {}
) {
  const threshold = new Decimal("1e16");
  if (population_d.lt(threshold)) {
    return 0;
  }

  let exponent = 2.5; // デフォルト値
  const activeChallenge = challenges?.activeChallenge;
  const completedChallenges = challenges?.completedChallenges || [];

  if (activeChallenge === "IC3") {
    exponent = 2.0; // IC3中は^2.0
  } else if (completedChallenges.includes("IC3")) {
    exponent = 2.7; // IC3クリア後は^2.7
  }

  const logPop_d = new Decimal(population_d.log10());
  const baseTP_d = logPop_d.minus(15).pow(exponent);

  const multiplier =
    1 + skillLevel8 * config.idle.tp_skills.skill8.effectMultiplier;
  return baseTP_d.times(multiplier).toNumber();
}

/**
 * ユーザーIDから、現在のピザボーナス倍率を取得する関数
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getPizzaBonusMultiplier(userId) {
  const idleGame = await IdleGame.findOne({ where: { userId } });
  if (!idleGame || idleGame.pizzaBonusPercentage <= 0) {
    return 1.0;
  }
  return 1 + idleGame.pizzaBonusPercentage / 100.0;
}

/**
 * 与えられたベース量にボーナスを適用し、「整数」で返す。
 * @param {string} userId
 * @param {number} baseAmount
 * @returns {Promise<number>}
 */
export async function applyPizzaBonus(userId, baseAmount) {
  const multiplier = await getPizzaBonusMultiplier(userId);
  return Math.floor(baseAmount * multiplier);
}

//人口とかの丸め　ログボとかで短い版
/**
 * 大きな数を見やすく整形
 * 0〜99,999 → そのまま
 * 10万~9,999,999 →　●●.●●万
 * 1000万〜9999億 → ●億●万
 * 1兆以上 → 指数表記
 */
export function formatNumberReadable(n) {
  if (n <= 99999) {
    return n.toString();
  } else if (n < 1000_0000) {
    const man = n / 10000;
    return `${man.toFixed(2)}万`;
  } else if (n < 1_0000_0000_0000) {
    const oku = Math.floor(n / 100000000);
    const man = Math.floor((n % 100000000) / 10000);
    return `${oku > 0 ? oku + "億" : ""}${man > 0 ? man + "万" : ""}`;
  } else {
    return n.toExponential(2);
  }
}

/**
 * 生産速度をフォーマット
 */
export function formatProductionRate(n) {
  if (typeof n !== "number" || !isFinite(n)) {
    return "計算中...";
  }
  if (n < 100) {
    return n.toFixed(2);
  } else if (n < 1_000_000_000_000_000) {
    return Math.floor(n).toLocaleString();
  } else {
    return n.toExponential(2);
  }
}

// =========================================================================
// ★★★ ここからが新しいリファクタリングの核心部です ★★★
// =========================================================================
/**
 * 1. 生産量の計算エンジン
 * 毎分のニョワミヤ増加量を "Decimal" オブジェクトとして計算して返す。
 * GP効果など、べき乗の前に適用すべき乗算効果を外部から注入できる。
 * 
 * @param {object} idleGameData - IdleGameの生データ
 * @param {object} externalData - Mee6レベルなど外部から与えるデータ
 * @param {Decimal | null} [gpEffect_d=null] - (オプション) GPなど、べき乗計算の前に乗算する効果。指定しない場合は効果なし。
 * @returns {Decimal} - 毎分の生産量
 */
function calculateProductionRate(
  idleGameData,
  externalData,
  gpEffect_d = null
) {
  if (gpEffect_d) {
    console.log(`[DEBUG] calculateProductionRate received gpEffect_d: ${gpEffect_d.toString()}`);
  }
  const pp = idleGameData.prestigePower || 0;
  const achievementCount = externalData.achievementCount || 0;
  const ascensionCount = idleGameData.ascensionCount || 0;
  const activeChallenge = idleGameData.challenges?.activeChallenge;
  const completedChallenges =
    idleGameData.challenges?.completedChallenges || [];
  const purchasedIUs = new Set(idleGameData.ipUpgrades?.upgrades || []);
  // 1. externalDataからunlockedSetを取り出す
  const unlockedSet = externalData.unlockedSet || new Set();
  // 2. 肉効果を計算する
  const meatEffect = calculateFinalMeatEffect(idleGameData, externalData);

  // --- これ以降の計算は、修正済みのmeatEffectが使われるので変更不要 ---
  const achievementMultiplier = 1.0 + achievementCount * 0.01;

  // スキル効果 (これらは通常のNumberでOK)
  const skillLevels = {
    s1: idleGameData.skillLevel1,
    s2: idleGameData.skillLevel2,
    s3: idleGameData.skillLevel3,
    s4: idleGameData.skillLevel4,
  };
  const radianceMultiplier = calculateRadianceMultiplier(idleGameData);
  const skill1Effect =
    (1 + (skillLevels.s1 || 0)) * radianceMultiplier * achievementMultiplier;
  const skill2Effect = (1 + (skillLevels.s2 || 0)) * radianceMultiplier;
  const finalSkill2Effect = Math.pow(skill2Effect, 2); // 時間加速

  //IC2報酬
  let ic2Bonus = 1.0;
  if (idleGameData.infinityCount > 0 && activeChallenge !== "IC9") {
    //infinity済みでありIC9中でなければ
    //infinity前では無用
    if (completedChallenges.includes("IC2")) {
      // 報酬#2効果の^0.25を3つの工場（オリーブ、小麦、パイナップル）に乗算
      // (ベース効果^2)^0.25^3 = ベース効果^1.5
      ic2Bonus = Math.pow(skill2Effect, 1.5); //3つ分かけておく
      // 念のため、効果が1未満にならないようにする（#2がLv0の場合など）
      if (ic2Bonus < 1.0) ic2Bonus = 1.0;
    }
  }

  // 工場効果 (これもNumberでOK)
  const factoryEffects = calculateFactoryEffects(idleGameData, pp, unlockedSet);

  // バフ (これもNumberでOK)
  let buffMultiplier = 1.0;
  if (
    idleGameData.buffExpiresAt &&
    new Date(idleGameData.buffExpiresAt) > new Date()
  ) {
    buffMultiplier = idleGameData.buffMultiplier;
  }

  // --- ここからDecimal計算 ---
  let baseProduction = new Decimal(factoryEffects.oven)
    .times(factoryEffects.cheese)
    .times(factoryEffects.tomato)
    .times(factoryEffects.mushroom)
    .times(factoryEffects.anchovy)
    .times(new Decimal(skill1Effect).pow(5))
    .times(factoryEffects.olive || 1.0)
    .times(factoryEffects.wheat || 1.0)
    .times(factoryEffects.pineapple || 1.0)
    .times(ic2Bonus);
  if (ascensionCount > 0) {
    //0でも1-8だけど軽量化のため
    let ascensionBaseEffect = config.idle.ascension.effect; // 1.125
    if (idleGameData.infinityCount > 0) {
      //infinity後のアセ強化系
      if (completedChallenges.includes("IC7")) {
        ascensionBaseEffect += 0.025;
      }
      if (purchasedIUs.has("IU23")) {
        // configからボーナス値を取得して加算
        ascensionBaseEffect +=
          config.idle.infinityUpgrades.tiers[1].upgrades.IU23.bonus;
      }
      if (completedChallenges.includes("IC8")) {
        ascensionBaseEffect *= 1.2;
      }
      // IU65 の効果を適用
      if (purchasedIUs.has("IU65")) {
        const iu65Config = config.idle.infinityUpgrades.tiers[5].upgrades.IU65; // Tier 6はindex 5
        const infinityCount = idleGameData.infinityCount || 0;
        // 仕様: log10(∞ + 1) / 9 + 1.0
        const multiplier =
          Math.log10(infinityCount + 1) / iu65Config.bonusDivisor + 1.0;
        ascensionBaseEffect *= multiplier;
      }
    }
    // 1. アセンション1回あたりの効果を、現在のアセンション回数分だけ累乗する
    const ascensionFactor = Math.pow(ascensionBaseEffect, ascensionCount);
    // 8つの工場すべてに適用されるため、その効果を8乗したものを baseProduction に乗算する
    const ascensionPower = activeChallenge === "IC9" ? 5 : 8; //IC9は５乗
    baseProduction = baseProduction.times(
      new Decimal(ascensionFactor).pow(ascensionPower)
    );
  }
  // IU24「惑星間高速道路」の効果を適用
  if (purchasedIUs.has("IU24")) {
    // configからボーナス値を取得 (1/5 = 0.2)
    const iu24Bonus = config.idle.infinityUpgrades.tiers[1].upgrades.IU24.bonus;
    const infinityCount = idleGameData.infinityCount || 0;

    // 1工場あたりの倍率を計算: 1 + (∞回数 * 0.2)
    const singleFactoryMultiplier = 1 + infinityCount * iu24Bonus;

    // IC9挑戦中は上位3施設が無効になるため、効果は5乗。それ以外は8乗。
    const power = activeChallenge === "IC9" ? 5 : 8;

    // baseProductionに最終的な倍率を乗算
    baseProduction = baseProduction.times(
      new Decimal(singleFactoryMultiplier).pow(power)
    );
  }
  // もしGP効果が渡されていたら、べき乗の前にそれを乗算する
  if (gpEffect_d && gpEffect_d.gt(1)) {
    baseProduction = baseProduction.times(gpEffect_d);
  }

  //指数処理
  let finalProduction = baseProduction
    .pow(meatEffect) // ★実績ボーナスが含まれた新しい指数がここで使われる！
    .times(buffMultiplier)
    .times(finalSkill2Effect); // 時間加速効果は最終乗算

  return finalProduction;
}

/**
 * 【改訂版】オフライン進行の計算エンジン
 * ジェネレーター計算に始値と終値の平均を用いることで精度を向上させる。
 * @param {object} idleGameData - Sequelizeから取得したidleGameの生データ
 * @param {object} externalData - Mee6レベルなど外部から与えるデータ
 * @returns {object} - 計算後の更新されたidleGameの生データ (プレーンなJSオブジェクト)
 */
export function calculateOfflineProgress(idleGameData, externalData) {
  const radianceMultiplier = calculateRadianceMultiplier(idleGameData);
  // --- 1. Decimalオブジェクトへ変換 ---
  let population_d = new Decimal(idleGameData.population);
  let gp_d;
  let initial_gp_d;
  let generators;
  let ipUpgradesChanged = false;
  let purchasedIUs = new Set(idleGameData.ipUpgrades?.upgrades || []);

  if (idleGameData.infinityCount > 0) {
    gp_d = new Decimal(idleGameData.generatorPower || "1");
    initial_gp_d = gp_d;
    const oldGenerators = idleGameData.ipUpgrades?.generators || [];
    generators = Array.from(
      { length: 8 },
      (_, i) => oldGenerators[i] || { amount: "0", bought: 0 }
    );
  }

  // --- 2. 経過時間に基づいた計算 ---
  const now = new Date();
  const lastUpdate = new Date(idleGameData.lastUpdatedAt);
  const elapsedSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;
  let newInfinityTime = idleGameData.infinityTime || 0;
  let newEternityTime = idleGameData.eternityTime || 0;
  let newInfinityCount = idleGameData.infinityCount || 0;

  const timeAccelerationMultiplier = Math.pow(
    (1 + (idleGameData.skillLevel2 || 0)) * radianceMultiplier,
    2
  );

  if (elapsedSeconds > 0) {
    //--- 2.1. ジェネレーターの再計算（平均値を用いた高精度版） ---
    // GP 1e2000以上の時はSCを入れたいね
    if (idleGameData.infinityCount > 0) {
      ipUpgradesChanged = true;
      const completedChallenges =
        idleGameData.challenges?.completedChallenges || [];

      // ▼▼▼【実績103対応】▼▼▼
      // externalDataから実績情報を取得
      const unlockedSet = externalData.unlockedSet || new Set();
      let achievementBonus = 1.0;
      if (unlockedSet.has(103)) {
        const achievementCount = externalData.achievementCount || 0;
        achievementBonus = 1.0 + achievementCount / 100.0;
      }

      // IU81のボーナス倍率をここで計算
      let iu81Multiplier = 1.0;
      if (purchasedIUs.has("IU81")) {
        const iu81Config = config.idle.infinityUpgrades.tiers[7].upgrades.IU81;
        const bestTime = idleGameData.challenges?.bestInfinityRealTime;
        if (bestTime && bestTime > 0) {
          let skillBestTime =
            bestTime > 0.3 ? Math.max(0.3, bestTime - 0.5) : bestTime;
          skillBestTime = Math.max(0.001, skillBestTime / 3);

          const bestTimeInMs = skillBestTime * 1000;
          iu81Multiplier = 1 + iu81Config.max / bestTimeInMs;
        }
      }

      // IC9(全チャレンジ)クリア報酬: 全ジェネレーターの性能が2倍になる。
      const generatorMultiplier = completedChallenges.includes("IC9")
        ? 2.0
        : 1.0;
      const infinityCount = idleGameData.infinityCount || 0;
      const currentIp_d = new Decimal(idleGameData.infinityPoints || "0");
      let amountProducedByParent_d = new Decimal(0);

      for (let i = 7; i >= 0; i--) {
        // G8からG1へ
        const genData = generators[i];
        const bought = genData.bought || 0;
        const generatorId = i + 1;

        const initialAmount_d = new Decimal(genData.amount);
        const finalAmount_d = initialAmount_d.add(amountProducedByParent_d);
        genData.amount = finalAmount_d.toString();

        if (bought === 0) {
          amountProducedByParent_d = new Decimal(0);
          continue;
        }

        const averageAmount_d = initialAmount_d.add(
          amountProducedByParent_d.div(2)
        );
        const multiplier = Math.pow(2, bought - 1);
        let productionPerSecond_d = averageAmount_d.times(multiplier).div(60);

        //IU31,32
        // ジェネレーターIDは (i + 1) で取得できる
        if (generatorId === 1 && purchasedIUs.has("IU31")) {
          const bonusMultiplier =
            config.idle.infinityUpgrades.tiers[2].upgrades.IU31.bonus;
          productionPerSecond_d = productionPerSecond_d.times(bonusMultiplier);
        }
        if (generatorId === 2 && purchasedIUs.has("IU32")) {
          const bonusMultiplier =
            config.idle.infinityUpgrades.tiers[2].upgrades.IU32.bonus;
          productionPerSecond_d = productionPerSecond_d.times(bonusMultiplier);
        }
        //33,34
        if (generatorId === 1 && purchasedIUs.has("IU33")) {
          const bonus = calculateIPBonusMultiplier("IU33", currentIp_d); // ★新しい関数を呼び出す
          productionPerSecond_d = productionPerSecond_d.times(bonus);
        }
        if (generatorId === 2 && purchasedIUs.has("IU34")) {
          const bonus = calculateIPBonusMultiplier("IU34", currentIp_d); // ★新しい関数を呼び出す
          productionPerSecond_d = productionPerSecond_d.times(bonus);
        }
        if (generatorId === 2 && purchasedIUs.has("IU41")) {
          const bonus = calculateInfinityCountBonus(infinityCount); // ★新しい関数を呼び出す
          productionPerSecond_d = productionPerSecond_d.times(bonus);
        }
        //61
        if (generatorId === 1 && purchasedIUs.has("IU61")) {
          productionPerSecond_d = productionPerSecond_d.times(
            config.idle.infinityUpgrades.tiers[5].upgrades.IU61.bonus
          );
        }
        //52,53
        if (generatorId === 1 && purchasedIUs.has("IU52")) {
          const iu52Config =
            config.idle.infinityUpgrades.tiers[4].upgrades.IU52;
          productionPerSecond_d = productionPerSecond_d.times(
            calculateIC9TimeBasedBonus(idleGameData, iu52Config)
          );
        }
        if (generatorId === 2 && purchasedIUs.has("IU53")) {
          const iu53Config =
            config.idle.infinityUpgrades.tiers[4].upgrades.IU53;
          productionPerSecond_d = productionPerSecond_d.times(
            calculateIC9TimeBasedBonus(idleGameData, iu53Config)
          );
        }
        //71,72
        if (generatorId === 3 && purchasedIUs.has("IU71")) {
          const g2Bought = generators[1].bought || 0; // G2はindex 1
          productionPerSecond_d = productionPerSecond_d.times(g2Bought + 1);
        }
        if (generatorId === 4 && purchasedIUs.has("IU72")) {
          const g3Bought = generators[2].bought || 0; // G3はindex 2
          productionPerSecond_d = productionPerSecond_d.times(g3Bought + 1);
        }
        if (generatorId === 3 && purchasedIUs.has("IU63")) {
          const iu63Config =
            config.idle.infinityUpgrades.tiers[5].upgrades.IU63;
          const bonus = 1 + Math.log10(infinityCount + 1) * iu63Config.bonus;
          productionPerSecond_d = productionPerSecond_d.times(bonus);
        }

        const producedAmount_d = productionPerSecond_d
          .times(elapsedSeconds)
          .times(timeAccelerationMultiplier)
          .times(generatorMultiplier)
          .times(achievementBonus)
          .times(iu81Multiplier);

        amountProducedByParent_d = producedAmount_d;
      }

      const finalGpProduction_d = amountProducedByParent_d.times(
        idleGameData.infinityCount
      );
      gp_d = gp_d.add(finalGpProduction_d);
    }

    //--- 2.2. 人口増加の計算 ---
    let averageGpEffect_d = new Decimal(1); // GP効果のデフォルト値を1に設定
    if (idleGameData.infinityCount > 0) {
      const activeChallenge = idleGameData.challenges?.activeChallenge;
      const baseGpExponent = getFinalGpExponent(idleGameData);
      const initialSingleFactoryMult_d = initial_gp_d.pow(baseGpExponent);
      const finalSingleFactoryMult_d = gp_d.pow(baseGpExponent);
      let averageSingleFactoryMult_d = initialSingleFactoryMult_d
        .add(finalSingleFactoryMult_d)
        .div(2);
      averageSingleFactoryMult_d = applyGpMultSoftcaps(
        averageSingleFactoryMult_d
      );
      const factoryCount = activeChallenge === "IC9" ? 5 : 8;
      averageGpEffect_d = averageSingleFactoryMult_d.pow(factoryCount).max(1);
    }

    //  calculateProductionRate に averageGpEffect_d を渡す
    const finalProductionPerMinute_d = calculateProductionRate(
      idleGameData,
      externalData,
      averageGpEffect_d // 3番目の引数として渡す
    );

    const productionPerSecond_d = finalProductionPerMinute_d.div(60);
    const addedPopulation_d = productionPerSecond_d.times(elapsedSeconds);
    population_d = population_d.add(addedPopulation_d);

    //--- 2.3. 【IU73対応】受動的な∞生成 ---
    if (purchasedIUs.has("IU73")) {
      const bestTime = idleGameData.challenges?.bestInfinityRealTime;
      if (bestTime && bestTime > 0) {
        const iu73Config = config.idle.infinityUpgrades.tiers[6].upgrades.IU73;
        // 実時間より0.5秒短くし、下限を0.3秒とする（実時間が0.3未満を除く)
        let adjustedBestTime =
          bestTime > 0.3 ? Math.max(0.3, bestTime - 0.5) : bestTime;
        if (purchasedIUs.has("IU81")) {
          //IU81があれば1msにならない様に、1/3する
          adjustedBestTime = Math.max(0.001, adjustedBestTime / 3);
        }
        // 1秒あたりに獲得できる∞の基本量
        const baseInfinitiesPerSecond =
          1 / (adjustedBestTime * iu73Config.rateDivisor);

        // IU62の効果を適用
        const chipsSpent_d = new Decimal(
          idleGameData.chipsSpentThisEternity || "0"
        );
        const iu62Multiplier = chipsSpent_d.add(1).log10() + 1;
        const finalInfinitiesPerSecond =
          baseInfinitiesPerSecond * Math.floor(iu62Multiplier); // IU62は仕様書通り切り捨て

        // 経過時間分だけ∞を加算
        const generatedInfinities = finalInfinitiesPerSecond * elapsedSeconds;
        newInfinityCount += generatedInfinities;
      }
    }
    //--- 2.4. ゲーム内時間の加算 ---
    newInfinityTime += elapsedSeconds * timeAccelerationMultiplier;
    newEternityTime += elapsedSeconds * timeAccelerationMultiplier;
  }

  // --- 3. Infinity上限処理 ---
  const INFINITY_THRESHOLD = new Decimal(config.idle.infinity);
  if (population_d.gte(INFINITY_THRESHOLD)) {
    const gen2Bought = idleGameData.ipUpgrades?.generators?.[1]?.bought || 0;
    if (gen2Bought === 0) {
      // Break Infinity未達成
      population_d = INFINITY_THRESHOLD;
    }
  }

  // --- 4. ピザボーナス（チップ獲得量ボーナス）の再計算 ---
  let pizzaBonusPercentage = 0;
  const iu43Bouns = purchasedIUs.has("IU43") ? 1.2 : 1;
  let iu64Bonus = 1.0;
  if (purchasedIUs.has("IU64")) {
    const iu64Config = config.idle.infinityUpgrades.tiers[5].upgrades.IU64;
    iu64Bonus =
      1 + Math.log10((idleGameData.infinityCount || 0) + 1) * iu64Config.bonus;
  }
  if (population_d.gte(1)) {
    const logPop = population_d.log10();
    const afterInfinity = idleGameData.infinityCount > 0 ? 5000 : 0;
    const skill3Effect =
      (1 + (idleGameData.skillLevel3 || 0)) * radianceMultiplier;
    pizzaBonusPercentage =
      ((100 + logPop + 1 + (idleGameData.prestigePower || 0)) * skill3Effect +
        afterInfinity) *
      iu43Bouns *
      iu64Bonus;
    pizzaBonusPercentage -= 100; //加算分なので最後に100%を引く
  }

  // --- 4. 更新されたデータをオブジェクトとして返す ---
  return {
    ...idleGameData, // 変更がないデータはそのままコピー
    population: population_d.toString(), // ★ 文字列に戻して返す
    lastUpdatedAt: now,
    pizzaBonusPercentage: pizzaBonusPercentage,
    infinityTime: newInfinityTime,
    eternityTime: newEternityTime,
    generatorPower: gp_d ? gp_d.toString() : idleGameData.generatorPower,
    infinityCount: newInfinityCount,
    ipUpgrades: { ...idleGameData.ipUpgrades, generators: generators },
    wasChanged: {
      // ★変更フラグをオブジェクトにまとめる
      ipUpgrades: ipUpgradesChanged,
    },
  };
}

// =========================================================================
// ★★★ UI表示用のフォーマット関数 (Decimal対応版) ★★★
// =========================================================================

/**
 * 【新規】Decimal対応版 - 動的なルールでフォーマット
 * @param {Decimal} dec - フォーマットするDecimalオブジェクト
 * @param {number} [decimalPlaces=2] - 100未満の場合に使用する小数点以下の桁数
 * @returns {string} フォーマットされた文字列
 */
export function formatNumberDynamic_Decimal(dec, decimalPlaces = 2) {
  if (!(dec instanceof Decimal)) {
    return "N/A";
  }
  if (dec.lt(100)) {
    return dec.toFixed(decimalPlaces);
  }
  if (dec.lt(1_000_000_000)) {
    // 10億未満
    return dec.floor().toNumber().toLocaleString();
  }
  return dec.toExponential(2);
}

// (↓既存のフォーマット関数は、内部で使われるので残しておきます)
/**
 * 【Decimal対応 - 巨大数値を日本の単位に整形
 * - 1京未満: 日本の単位（兆, 億, 万）で詳細に表示
 * - 1京以上: 指数表記 (e+) で表示
 * @param {Decimal} dec - フォーマットしたいDecimalオブジェクト
 * @returns {string} フォーマットされた文字列
 */
export function formatNumberJapanese_Decimal(dec) {
  if (!(dec instanceof Decimal)) {
    return "N/A";
  }
  if (dec.equals(0)) {
    return "0";
  }

  const KEI = new Decimal("1e16");

  // --- 1京以上は指数表記 ---
  if (dec.gte(KEI)) {
    return dec.toExponential(4);
  }

  // --- 1京未満は日本の単位で表示 ---
  const CHOU = new Decimal("1e12");
  const OKU = new Decimal("1e8");
  const MAN = new Decimal("1e4");

  let temp_d = dec.floor();
  let result = "";

  // 兆の単位
  if (temp_d.gte(CHOU)) {
    const chouPart = temp_d.div(CHOU).floor();
    result += `${chouPart.toString()}兆`;
    temp_d = temp_d.mod(CHOU);
  }

  // 億の単位
  if (temp_d.gte(OKU)) {
    const okuPart = temp_d.div(OKU).floor();
    result += `${okuPart.toString()}億`;
    temp_d = temp_d.mod(OKU);
  }

  // 万の単位
  if (temp_d.gte(MAN)) {
    const manPart = temp_d.div(MAN).floor();
    result += `${manPart.toString()}万`;
    temp_d = temp_d.mod(MAN);
  }

  // 残りの部分
  if (temp_d.gt(0) || result === "") {
    result += temp_d.toString();
  }

  return result;
}

/**
 * 数値を動的なルールでフォーマットします。
 * - 100未満: 指定された小数点以下の桁数で表示 (toFixed)
 * - 100以上, 10億未満: 整数に丸めて桁区切りで表示 (toLocaleString)
 * - 10億以上: 指数表記 (toExponential)
 * @param {number} n - フォーマットする数値
 * @param {number} [decimalPlaces=2] - 100未満の場合に使用する小数点以下の桁数
 * @returns {string} フォーマットされた文字列
 */
export function formatNumberDynamic(n, decimalPlaces = 2) {
  // 既存の関数から持ってきた、堅牢な入力値チェック
  if (typeof n !== "number" || !isFinite(n)) {
    return "N/A"; // または '計算中...' など、エラー時の表示を統一
  }

  // 条件1: 100未満
  if (n < 100) {
    return n.toFixed(decimalPlaces);
  }
  // 条件2: 100以上 ~ 10億未満 (1e9)
  else if (n < 1_000_000_000) {
    return Math.floor(n).toLocaleString();
  }
  // 条件3: 10億以上
  else {
    return n.toExponential(2);
  }
}

/**
 * UI表示に必要な全てのデータを取得・計算して返す関数
 * @param {string} userId
 * @param {boolean} [isInitialLoad=false] - 初回読み込み時にtrueを指定するとランキングチェックを行う
 * @returns {Promise<object|null>}
 */
export async function getSingleUserUIData(userId, isInitialLoad = false) {
  // 1. 関連データを "並行して" 取得 (Promise.allで高速化)
  const [idleGameData, mee6Level, userAchievement] = await Promise.all([
    IdleGame.findOne({ where: { userId }, raw: true }),
    Mee6Level.findOne({ where: { userId }, raw: true }),
    UserAchievement.findOne({ where: { userId }, raw: true }),
  ]);
  if (!idleGameData) return null; // ユーザーデータがなければ終了

  let uiContext = {
    //UIコンテキスト系(/idleで表示される)
    messages: [], // 表示用メッセージ
    challengeFailed: false,
  };

  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);

  // 2. externalData(道具箱)を準備
  const externalData = {
    mee6Level: mee6Level?.level || 0,
    achievementCount: unlockedSet.size,
    unlockedSet: unlockedSet, // ★ Setオブジェクトそのものを梱包！
  };

  // 3. 計算エンジンを呼び出して、最新の状態にする
  const updatedIdleGame = calculateOfflineProgress(idleGameData, externalData);

  // 3.5.インフィニティチャレンジ関連のUIメッセージを生成
  const activeChallenge = updatedIdleGame.challenges?.activeChallenge;
  if (activeChallenge) {
    const challengeConfig = config.idle.infinityChallenges.find(
      (c) => c.id === activeChallenge
    );
    if (challengeConfig) {
      uiContext.messages.push(
        `**⚔️ チャレンジ挑戦中: ${challengeConfig.name}**`
      );
    }
    // IC6
    if (activeChallenge === "IC6") {
      uiContext = processIC6Rival(updatedIdleGame, uiContext);
    }
  }

  // 4. DBに保存する (注意: この関数はUI表示のたびに呼ばれるので、頻繁なDB書き込みになる。将来的には分離も検討)
  // updateに渡すオブジェクトを動的に構築
  const updateData = {
    population: updatedIdleGame.population,
    lastUpdatedAt: updatedIdleGame.lastUpdatedAt,
    pizzaBonusPercentage: updatedIdleGame.pizzaBonusPercentage,
    infinityCount: updatedIdleGame.infinityCount,
    infinityTime: updatedIdleGame.infinityTime,
    eternityTime: updatedIdleGame.eternityTime,
  };
  // ジェネレーターが更新された場合のみ、updateDataに追加
  if (updatedIdleGame.wasChanged.ipUpgrades) {
    updateData.generatorPower = updatedIdleGame.generatorPower;
    updateData.ipUpgrades = updatedIdleGame.ipUpgrades;
    //IdleGame.changed("ipUpgrades", true);
  }

  // isInitialLoadがtrueの場合のみ、ランキングスコアを更新するかチェックする
  if (isInitialLoad) {
    const rankUpdateResult = updateRankScoreIfNeeded(
      updatedIdleGame,
      externalData
    );
    if (rankUpdateResult.needsUpdate) {
      updateData.rankScore = rankUpdateResult.newScore;
      updateData.rankScoreComponents = rankUpdateResult.newComponents;

      updatedIdleGame.rankScore = rankUpdateResult.newScore;
      updatedIdleGame.rankScoreComponents = rankUpdateResult.newComponents;
    }
  }

  await IdleGame.update(updateData, { where: { userId } });

  // --- 5. UI表示に必要なデータを "全て" 計算してまとめる ---
  const pp = updatedIdleGame.prestigePower || 0;
  const meatEffect = calculateFinalMeatEffect(updatedIdleGame, externalData); //ここで最初に計算
  //const achievementExponentBonus = externalData.achievementCount;
  const gp_d = new Decimal(updatedIdleGame.generatorPower || "1");

  // a. 最終的な指数を取得
  const finalGpExponent = getFinalGpExponent(updatedIdleGame);
  // b. 「1工場あたり」の倍率を計算
  let singleFactoryMult_d = gp_d.pow(finalGpExponent);
  // c. ソフトキャップを適用
  singleFactoryMult_d = applyGpMultSoftcaps(singleFactoryMult_d);
  // d. キャップ後の値を、工場数分だけ累乗して、最終的なGP効果を算出
  const factoryCount = activeChallenge === "IC9" ? 5 : 8;
  const gpEffect_d = singleFactoryMult_d
    .pow(factoryCount)
    .max(1);

  const factoryEffects = calculateFactoryEffects(
    updatedIdleGame,
    pp,
    unlockedSet
  );
  const skillLevels = {
    s1: updatedIdleGame.skillLevel1,
    s2: updatedIdleGame.skillLevel2,
    s3: updatedIdleGame.skillLevel3,
    s4: updatedIdleGame.skillLevel4,
  };
  const radianceMultiplier = calculateRadianceMultiplier(updatedIdleGame);

  // ★表示に必要なデータを displayData オブジェクトに格納する
  const displayData = {
    productionRate_d: calculateProductionRate(
      updatedIdleGame,
      externalData,
      gpEffect_d
    ),
    factoryEffects: factoryEffects,
    skill1Effect:
      (1 + (skillLevels.s1 || 0)) *
      radianceMultiplier *
      (1.0 + externalData.achievementCount * 0.01),
    meatEffect: meatEffect,
    baseGpExponent: finalGpExponent,
    singleFactoryMult_d: singleFactoryMult_d,
  };

  // --- 6. 最終的なデータを返す ---
  return {
    idleGame: updatedIdleGame,
    mee6Level: externalData.mee6Level,
    achievementCount: externalData.achievementCount,
    userAchievement: userAchievement,
    displayData: displayData, // ★計算済みの表示用データも一緒に返す！
    uiContext: uiContext,
  };
}

/**
 * 秒数を「X年X日X時間X分X秒」の形式にフォーマットする
 * @param {number} totalSeconds - 合計秒数
 * @returns {string} フォーマットされた時間文字列
 */
export function formatInfinityTime(totalSeconds) {
  if (typeof totalSeconds !== "number" || totalSeconds < 0) {
    return "測定不能";
  }

  const SAFE_SECONDS_THRESHOLD = Number.MAX_SAFE_INTEGER;
  if (totalSeconds >= SAFE_SECONDS_THRESHOLD) {
    // 安全な整数表現の限界を超えた場合、年単位の指数表記に切り替える
    const years = totalSeconds / (365.25 * 24 * 60 * 60); // うるう年を考慮
    return `${formatNumberDynamic(years, 2)}年`;
  } else if (totalSeconds < 1) {
    // 1秒未満の場合、ミリ秒(ms)で表示
    const milliseconds = totalSeconds * 1000;
    return `${milliseconds.toFixed(0)}ms`;
  } else if (totalSeconds < 60) {
    // 1秒以上、60秒未満の場合、小数点以下2桁の秒で表示
    return `${totalSeconds.toFixed(2)}秒`;
  }

  const SECONDS_IN_MINUTE = 60;
  const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
  const SECONDS_IN_DAY = 24 * SECONDS_IN_HOUR;
  const SECONDS_IN_YEAR = 365 * SECONDS_IN_DAY;

  let remainingSeconds = totalSeconds;

  const years = Math.floor(remainingSeconds / SECONDS_IN_YEAR);
  remainingSeconds %= SECONDS_IN_YEAR;

  const days = Math.floor(remainingSeconds / SECONDS_IN_DAY);
  remainingSeconds %= SECONDS_IN_DAY;

  const hours = Math.floor(remainingSeconds / SECONDS_IN_HOUR);
  remainingSeconds %= SECONDS_IN_HOUR;

  const minutes = Math.floor(remainingSeconds / SECONDS_IN_MINUTE);
  const seconds = Math.floor(remainingSeconds % SECONDS_IN_MINUTE);

  const parts = [];
  if (years > 0) parts.push(`${years}年`);
  if (days > 0) parts.push(`${days}日`);
  if (hours > 0) parts.push(`${hours}時間`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (seconds > 0) parts.push(`${seconds}秒`);

  return parts.join(" ") || "0秒";
}

/**
 * 実績#66による指数ボーナスを計算する
 * @param {object} idleGameData - IdleGameの生データ
 * @param {Set<number>} unlockedSet - 解除済み実績IDのSet
 * @returns {number} - 計算された指数ボーナス
 */
function calculateAchievement66Bonus(idleGameData, unlockedSet) {
  if (!unlockedSet.has(66)) {
    return 0;
  }

  const rewardDef = config.idle.achievements[66].reward;
  if (!rewardDef || rewardDef.type !== "exponentBonusPerFactoryLevel") {
    return 0;
  }

  let totalLevels = 0;
  // rewardで定義された対象施設の "キー名" ("oven", "cheese"など) でループ
  for (const factoryKey of rewardDef.targetFactories) {
    // ★ "対象施設" -> "targetFactories" に変更
    // configから、そのキーに対応する施設の定義を取得
    const factoryConfig = config.idle.factories[factoryKey];
    if (factoryConfig) {
      // configから、正しいDBカラム名 ('pizzaOvenLevel'など) を取得
      const dbColumnName = factoryConfig.key;
      // 正しいカラム名を使って、idleGameDataからレベルを取得して加算
      totalLevels += idleGameData[dbColumnName] || 0;
    }
  }

  return totalLevels * rewardDef.value;
}

/**
 * アセンションの要件（必要人口、必要チップ）を計算する
 * @param {number} currentAscensionCount - 現在のアセンション回数 (0から始まる)
 * @param {number} skillLevel6 - TPスキル#6のレベル
 * @param {Set<string>} purchasedIUs - 購入済みのIU IDのSet
 * @param {string|null} activeChallenge - 実行中のチャレンジID
 * @returns {{requiredPopulation_d: Decimal, requiredChips: number}}
 */
export function calculateAscensionRequirements(
  currentAscensionCount,
  skillLevel6 = 0,
  purchasedIUs = new Set(),
  activeChallenge = null
) {
  const ascensionConfig = config.idle.ascension;

  // --- 1. チャレンジに応じて基礎値と倍率を決定 ---
  let basePopulation_d = new Decimal(ascensionConfig.basePopulation);
  let populationMultiplier_d = new Decimal(
    ascensionConfig.populationMultiplier
  );

  // activeChallengeの値に応じて、設定を上書き
  switch (activeChallenge) {
    case "IC7":
      basePopulation_d = new Decimal(1);
      populationMultiplier_d = new Decimal("1e10");
      break;
    case "IC8":
      // 事実上のアセンション禁止
      basePopulation_d = new Decimal("1e308");
      populationMultiplier_d = new Decimal("1e1");
      break;
  }

  // --- 2. 要求人口を計算 ---
  const requiredPopulation_d = basePopulation_d.times(
    populationMultiplier_d.pow(currentAscensionCount)
  );

  // 3. 要求チップ数を計算
  let totalChipCost = 0;
  const targetLevel = currentAscensionCount; // 0回目はLv0->1, 1回目はLv1->2 ...

  for (const facilityName in config.idle.factories) {
    // TPスキル#6の割引も考慮したコストを合計する
    totalChipCost += calculateFacilityCost(
      facilityName,
      targetLevel,
      skillLevel6,
      purchasedIUs, //そのままIU14用に流す！
      null
    );
  }

  const requiredChips = totalChipCost;

  return { requiredPopulation_d, requiredChips };
}

/**
 * ジェネレーターの購入コストを計算する
 * @param {number} generatorId - ジェネレーターのID (1-8)
 * @param {number} currentBought - そのジェネレーターの現在の購入回数
 * @returns {Decimal} 購入に必要なIPコスト
 */
export function calculateGeneratorCost(generatorId, currentBought) {
  // configから該当ジェネレーターの設定を探す
  const genConfig = config.idle.infinityGenerators.find(
    (g) => g.id === generatorId
  );
  if (!genConfig) {
    return new Decimal(Infinity); // 見つからなければ購入不可
  }

  const baseCost_d = new Decimal(genConfig.baseCost);
  const multiplier_d = new Decimal(genConfig.costMultiplier);

  // コスト = 基本コスト * (コスト成長率 ^ 現在の購入回数)
  const cost_d = baseCost_d.times(multiplier_d.pow(currentBought));

  return cost_d;
}

/**
 * インフィニティ時に獲得できるIP量を計算する
 * @param {object} idleGame - インフィニティ直前のIdleGameデータ
 * @param {number} [completedChallengeCount=0] - （クリア直後のものを含む）達成済みICの数
 * @returns {Decimal} 獲得IP量
 */
export function calculateGainedIP(idleGame, completedChallengeCount = 0) {
  const population_d = new Decimal(idleGame.population);
  const purchasedIUs = new Set(idleGame.ipUpgrades?.upgrades || []);
  let ic9TimeBonus = 1.0;
  if (purchasedIUs.has("IU51")) {
    // IU51の設定オブジェクトを取得
    const iu51Config = config.idle.infinityUpgrades.tiers[4].upgrades.IU51;
    // IU51効果を計算
    ic9TimeBonus = calculateIC9TimeBasedBonus(idleGame, iu51Config);
  }

  // 最低条件：インフィニティに到達しているか (念のため)
  if (population_d.lt(config.idle.infinity)) {
    return new Decimal(0);
  }

  // --- 1. 基本値の計算 ---
  let baseIP = new Decimal(1);
  const newInfinityCount = (idleGame.infinityCount || 0) + 1;
  //5回無限実績
  if (newInfinityCount >= 5) {
    baseIP = baseIP.times(2);
  }
  // ICクリア数に応じた補正
  if (completedChallengeCount > 0) {
    baseIP = baseIP.times(completedChallengeCount + 1);
  }
  if (completedChallengeCount >= 4) {
    baseIP = baseIP.times(2);
  }
  if (completedChallengeCount >= 9) {
    //IC9クリア時点で9個達成している必要があり、クリアしていれば2倍されているので。
    baseIP = baseIP.times(2);
  }
  //IU51
  baseIP = baseIP.times(ic9TimeBonus);
  // IU55の効果を適用
  if (purchasedIUs.has("IU55")) {
    const iu55Config = config.idle.infinityUpgrades.tiers[4].upgrades.IU55; // Tier 5はindex 4
    // 仕様: log10(∞ + 1) * 1.05 + 1
    const multiplier =
      Math.log10(newInfinityCount + 1) * iu55Config.bonusBase + 1;
    baseIP = baseIP.times(multiplier);
  }
  // (ここに将来的にボーナスなどを追加していく)

  // --- 2. ジェネレーターII購入によるIP増加ロジック (ブレイク後) ---
  const gen2Bought = idleGame.ipUpgrades?.generators?.[1]?.bought || 0;
  if (gen2Bought > 0) {
    // 仕様書通りの計算式: 基本値 × 10 ^ (log10(人口) / 308 - 0.75)
    const logPop = population_d.log10();
    const exponent = logPop / 308 - 0.75;

    // 10のべき乗を計算
    const formulaIP = Decimal.pow(10, exponent);

    // 計算結果と基本値を乗算する
    // これにより、実績#84などの基本値ボーナスがブレイク後のIPにも乗るようになります
    const finalIP = baseIP.times(formulaIP);

    // 最終的に、計算されたIPの小数点以下を切り捨てて返す
    return finalIP.floor();
  }

  // ブレイクしていない場合は、今までの基本値だけを返す
  return baseIP.floor();
}

/**
 * 【新規】指定されたTPスキルの次のレベルのコストを計算する
 * @param {number} skillNum - スキルの番号 (5-8)
 * @param {number} currentLevel - そのスキルの現在のレベル
 * @returns {number} 次のレベルのコスト
 */
export function calculateTPSkillCost(skillNum, currentLevel) {
  const skillConfig = config.idle.tp_skills[`skill${skillNum}`];
  if (!skillConfig) return Infinity;
  return (
    skillConfig.baseCost * Math.pow(skillConfig.costMultiplier, currentLevel)
  );
}

/**
 * 【改訂版】ゴーストチップのレベルに応じた予算を計算する
 */
export function calculateGhostChipBudget(level) {
  const effectiveLevel = level || 0; // undefinedなら0として扱う
  const budgetPerLevel = config.idle.ghostChip.budgetPerLevel;
  return effectiveLevel * budgetPerLevel; // レベル0なら予算0、レベル1なら予算5000
}

/**
 * 【最終改訂版】ゴーストチップの次のレベルへのアップグレードコストを計算する
 */
export function calculateGhostChipUpgradeCost(level) {
  const currentLevel = level || 0;
  const configGc = config.idle.ghostChip;
  // ★設定ファイルの上限レベルに達したら購入不可
  if (currentLevel >= configGc.levelCap2nd) {
    return Infinity;
  }

  // レベル0から1への強化は、既存ユーザーへの救済として無料にする
  if (currentLevel === 0) {
    return 0;
  }

  // ★Lv201以降の新しい計算ロジック
  if (currentLevel >= configGc.extendedCost.startLevel - 1) {
    // 現在Lvが200以上なら
    const extendedConfig = configGc.extendedCost;
    const increment =
      configGc.budgetPerLevel * extendedConfig.levelIncrementMultiplier; // 5万チップ
    const levelsPastThreshold = currentLevel - (extendedConfig.startLevel - 2); // Lv200のとき1, Lv201のとき2...
    return extendedConfig.baseCost + levelsPastThreshold * increment;
  }
  // ★既存のLv1～199までの計算ロジック
  const budgetPerLevel = configGc.budgetPerLevel;
  const costConfig = configGc.cost;
  const linearCost =
    budgetPerLevel *
    (costConfig.baseMultiplier +
      costConfig.levelMultiplier * (currentLevel - 1));
  const cap = budgetPerLevel * costConfig.capMultiplier;

  return Math.min(linearCost, cap);
}

/**
 * 【新規】最終的な肉効果（指数）をソフトキャップとボーナス込みで計算する
 * @param {object} idleGameData - IdleGameの生データ
 * @param {object} externalData - Mee6レベルなど外部から与えるデータ
 * @returns {number} 計算後の最終的な肉効果
 */
function calculateFinalMeatEffect(idleGameData, externalData) {
  // --- 1. 基礎となる値を準備 ---
  const pp = idleGameData.prestigePower || 0;
  let mee6Level = externalData.mee6Level || 0;
  const achievementCount = externalData.achievementCount || 0;
  const unlockedSet = externalData.unlockedSet || new Set();

  // --- 1.5 IC4中ならMee6Lv=0
  const activeChallenge = idleGameData.challenges?.activeChallenge;
  if (activeChallenge === "IC4") {
    mee6Level = 0; // Mee6レベルを強制的に0にする
  }

  // --- 2. キャップ対象の指数を計算 ---
  const achievement66Bonus = calculateAchievement66Bonus(
    idleGameData,
    unlockedSet
  );
  const meatFactoryLevel = mee6Level + pp + achievementCount;

  let capTargetExponent =
    1 + config.idle.meat.effect * meatFactoryLevel + achievement66Bonus;

  // --- 3. ソフトキャップを順番に適用 ---
  for (const cap of config.idle.meat.softCapsBeforeInfinity) {
    if (capTargetExponent > cap.base) {
      const excess = capTargetExponent - cap.base;
      capTargetExponent = cap.base + Math.pow(excess, cap.power);
    }
  }

  // --- 4. キャップ対象外のボーナスを加算 ---
  let finalExponent = capTargetExponent;
  //IU13 +0.05
  if (idleGameData.ipUpgrades?.upgrades?.includes("IU13")) {
    finalExponent += config.idle.meat.iu13bonus;
  }
  // IC4 +0.10
  const ic4Config = config.idle.infinityChallenges.find((c) => c.id === "IC4");
  if (ic4Config && ic4Config.rewardValue) {
    finalExponent += ic4Config.rewardValue;
  }

  return finalExponent;
}

/**
 * 【IC6専用】ライバルとの人口を比較し、UIコンテキストを更新する (修正版)
 * @param {object} idleGameData - 最新のIdleGameデータ
 * @param {object} uiContext - 更新対象のUIコンテキストオブジェクト
 * @returns {object} 更新されたUIコンテキストオブジェクト
 */
function processIC6Rival(idleGameData, uiContext) {
  if (!idleGameData.challenges.IC6?.startTime) {
    return uiContext;
  }

  const rivalStartTime = new Date(idleGameData.challenges.IC6.startTime);
  const now = new Date();
  const realSecondsElapsed = (now.getTime() - rivalStartTime.getTime()) / 1000;
  const rivalUpdates = Math.floor(realSecondsElapsed / 60);

  if (rivalUpdates > 0) {
    const rivalPop_d = Decimal.pow(10, rivalUpdates);
    const playerPop_d = new Decimal(idleGameData.population);

    // ▼▼▼【ここからが修正箇所です】▼▼▼
    if (playerPop_d.lt(rivalPop_d)) {
      // --- 敗北時の処理 ---
      uiContext.challengeFailed = true;
      const failureReason = `ライバルに抜かれました…\n- **あなたの人口:** ${formatNumberJapanese_Decimal(playerPop_d)}\n- **ライバル人口:<:nyo_wa:1430006900489060423>** ${formatNumberJapanese_Decimal(rivalPop_d)}`;

      // 既存のメッセージをクリアし、詳細な敗北メッセージだけを追加する
      uiContext.messages = [`**🚨 ${failureReason}**`];
    } else {
      // --- 継続中の処理 ---
      // 既存のメッセージはそのままに、ライバルの人口だけを追加
      uiContext.messages.push(
        `- ライバル人口<:nyo_wa:1430006900489060423>: ${formatNumberJapanese_Decimal(rivalPop_d)}`
      );
    }
    // ▲▲▲【修正箇所ここまで】▲▲▲
  }

  return uiContext;
}

/**
 * 【新規】所持IPとアップグレードIDに基づき、ジェネレーター等へのボーナス倍率を計算する
 * @param {string} upgradeId - アップグレードのID ("IU33" or "IU34")
 * @param {Decimal} ip_d - 現在の所持IP (Decimalオブジェクト)
 * @returns {number} 計算されたボーナス倍率
 */
export function calculateIPBonusMultiplier(upgradeId, ip_d) {
  // IPが0またはマイナスの場合、log10でエラーになるのを防ぐ
  if (ip_d.lte(0)) {
    return 1.0; // ボーナスなし
  }

  const logIp = ip_d.log10();
  let multiplier = 1.0;

  switch (upgradeId) {
    case "IU33": {
      // 仕様: max(log10(IP)*4/3, 1.5)
      const baseMultiplier = (logIp * 4) / 3;
      multiplier = Math.max(baseMultiplier, 1.5);
      break;
    }
    case "IU34": {
      // 仕様: max(log10(IP)*4/5, 1.2)
      const baseMultiplier = (logIp * 4) / 5;
      multiplier = Math.max(baseMultiplier, 1.2);
      break;
    }
    default:
      // 対象外のIDならボーナスなし
      return 1.0;
  }

  return multiplier;
}

/**
 * 【新規】インフィニティ回数に基づき、IU41によるG2へのボーナス倍率を計算する
 * @param {number} infinityCount - 現在のインフィニティ回数
 * @returns {number} 計算されたボーナス倍率
 */
export function calculateInfinityCountBonus(infinityCount) {
  if (infinityCount < 10) {
    return 1.0; // 10回未満ならボーナスなし
  }
  // 仕様書通り: √(インフィニティ回数 / 10)
  return Math.sqrt(infinityCount / 10);
}

/**
 * 【表示用】各ジェネレーターの現在の毎分生産量を計算する
 * @param {object} idleGameData - IdleGameの生データ
 * @param {Set<number>} unlockedSet - 解除済み実績IDのSet
 * @returns {Decimal[]} G8からG1までの毎分生産量（GP含む）の配列
 */
export function calculateGeneratorProductionRates(
  idleGameData,
  unlockedSet = new Set()
) {
  const rates = Array(8).fill(new Decimal(0));
  if (idleGameData.infinityCount === 0) return rates;

  //【実績103対応】
  const achievementCount = unlockedSet.size;
  let achievementBonus = 1.0;
  if (unlockedSet.has(103)) {
    achievementBonus = 1.0 + achievementCount / 100.0;
  }

  // 必要なデータを準備
  const userGenerators = idleGameData.ipUpgrades?.generators || [];
  const purchasedIUs = new Set(idleGameData.ipUpgrades?.upgrades || []);
  const completedChallenges = new Set(
    idleGameData.challenges?.completedChallenges || []
  );
  const currentIp_d = new Decimal(idleGameData.infinityPoints);
  const infinityCount = idleGameData.infinityCount || 0;

  // 全体に掛かる倍率
  const globalMultiplier = completedChallenges.has("IC9") ? 2.0 : 1.0;

  // IU81のボーナス倍率
  let iu81Multiplier = 1.0;
  if (purchasedIUs.has("IU81")) {
    const iu81Config = config.idle.infinityUpgrades.tiers[7].upgrades.IU81; // Tier 8はindex 7
    const bestTime = idleGameData.challenges?.bestInfinityRealTime;
    if (bestTime && bestTime > 0) {
      let skillBestTime =
        bestTime > 0.3 ? Math.max(0.3, bestTime - 0.5) : bestTime;
      skillBestTime = Math.max(0.001, skillBestTime / 3);

      const bestTimeInMs = skillBestTime * 1000;
      iu81Multiplier = 1 + iu81Config.max / bestTimeInMs;
    }
  }

  // G1からG8まで、順番に計算する
  for (let i = 0; i < 8; i++) {
    const genData = userGenerators[i] || { amount: "0", bought: 0 };
    const bought = genData.bought || 0;

    // 購入数が0なら生産しない
    if (bought === 0) {
      rates[i] = new Decimal(0);
      continue;
    }

    // 生産速度は、純粋に「自身の所持数」にのみ依存する
    const currentAmount_d = new Decimal(genData.amount);

    // 基本生産量 = 所持数 * (2 ^ (購入数 - 1))
    let productionPerMinute_d = currentAmount_d.times(Math.pow(2, bought - 1));

    // --- 各種ボーナスを適用 ---
    productionPerMinute_d = productionPerMinute_d.times(globalMultiplier);
    productionPerMinute_d = productionPerMinute_d.times(achievementBonus); //実績103
    productionPerMinute_d = productionPerMinute_d.times(iu81Multiplier); //iu81
    const generatorId = i + 1;

    if (generatorId === 1 && purchasedIUs.has("IU31")) {
      productionPerMinute_d = productionPerMinute_d.times(
        config.idle.infinityUpgrades.tiers[2].upgrades.IU31.bonus
      );
    }
    if (generatorId === 2 && purchasedIUs.has("IU32")) {
      productionPerMinute_d = productionPerMinute_d.times(
        config.idle.infinityUpgrades.tiers[2].upgrades.IU32.bonus
      );
    }
    if (generatorId === 1 && purchasedIUs.has("IU33")) {
      productionPerMinute_d = productionPerMinute_d.times(
        calculateIPBonusMultiplier("IU33", currentIp_d)
      );
    }
    if (generatorId === 2 && purchasedIUs.has("IU34")) {
      productionPerMinute_d = productionPerMinute_d.times(
        calculateIPBonusMultiplier("IU34", currentIp_d)
      );
    }
    if (generatorId === 2 && purchasedIUs.has("IU41")) {
      productionPerMinute_d = productionPerMinute_d.times(
        calculateInfinityCountBonus(infinityCount)
      );
    }
    if (generatorId === 1 && purchasedIUs.has("IU61")) {
      productionPerMinute_d = productionPerMinute_d.times(
        config.idle.infinityUpgrades.tiers[5].upgrades.IU61.bonus
      );
    }
    if (generatorId === 1 && purchasedIUs.has("IU52")) {
      const iu52Config = config.idle.infinityUpgrades.tiers[4].upgrades.IU52;
      productionPerMinute_d = productionPerMinute_d.times(
        calculateIC9TimeBasedBonus(idleGameData, iu52Config)
      );
    }
    if (generatorId === 2 && purchasedIUs.has("IU53")) {
      const iu53Config = config.idle.infinityUpgrades.tiers[4].upgrades.IU53;
      productionPerMinute_d = productionPerMinute_d.times(
        calculateIC9TimeBasedBonus(idleGameData, iu53Config)
      );
    }
    if (generatorId === 3 && purchasedIUs.has("IU71")) {
      const g2Bought = userGenerators[1]?.bought || 0; // G2はindex 1
      productionPerMinute_d = productionPerMinute_d.times(g2Bought + 1);
    }
    if (generatorId === 4 && purchasedIUs.has("IU72")) {
      const g3Bought = userGenerators[2]?.bought || 0; // G3はindex 2
      productionPerMinute_d = productionPerMinute_d.times(g3Bought + 1);
    }
    if (generatorId === 3 && purchasedIUs.has("IU63")) {
      // infinityCountは関数の冒頭で定義済み
      const iu63Config = config.idle.infinityUpgrades.tiers[5].upgrades.IU63;
      const bonus = 1 + Math.log10(infinityCount + 1) * iu63Config.bonus;
      productionPerMinute_d = productionPerMinute_d.times(bonus);
    }

    // G1の場合、生産するのはGPなので、さらにインフィニティ回数を乗算
    if (generatorId === 1) {
      productionPerMinute_d = productionPerMinute_d.times(infinityCount);
    }

    rates[i] = productionPerMinute_d;
  }

  // .reverse() を削除！ 配列はすでに正しい順序 [G1, G2, ...] になっている
  return rates;
}

/**
 * 【汎用版】IC9のクリアタイムに基づき、指定されたIUのボーナス倍率を計算する
 * @param {object} idleGame - IdleGameのデータオブジェクト
 * @param {object} iuConfig - IUの設定オブジェクト (max, min, baseTimeプロパティを含む)
 * @returns {number} 計算されたボーナス倍率
 */
export function calculateIC9TimeBasedBonus(idleGame, iuConfig) {
  const bestTime = idleGame.challenges?.IC9?.bestTime;

  // IC9を一度もクリアしていない場合、ボーナスは1倍
  if (!bestTime || bestTime === Infinity) {
    return 1.0;
  }
  // --- タイムがbaseTime（60秒）より「遅い」場合（既存の減衰ロジック） ---
  if (bestTime > iuConfig.baseTime) {
    // 時間が何回「倍」になったかを計算 (例: 120秒なら1回, 240秒なら2回)
    const doublings = Math.log2(bestTime / iuConfig.baseTime);
    // 仕様通り、倍化回数分だけ最大倍率から引く
    const multiplier = iuConfig.max - doublings;
    // 最低倍率を下回らないようにする
    return Math.max(iuConfig.min, multiplier);
  } else {
    // --- タイムがbaseTime（60秒）と「同じか、より速い」場合 ---
    // 60秒からどれだけ速く「半分」になったかを計算
    // 例: 30秒なら1回, 15秒なら2回
    // bestTime / iuConfig.baseTime は (0, 1] の範囲の値になる
    // そのlog2を取ると、値は (-∞, 0] になる
    // 正の値にしたいので、逆数 (baseTime / bestTime) を使う
    const calBestTime = bestTime <= 0.01 ? 0.01 : bestTime;
    const halvings = Math.log2(iuConfig.baseTime / calBestTime);

    // 仕様「タイムが半分になるごとに+1倍」を実装
    const multiplier = iuConfig.max + halvings;

    // この場合、上限は設定せず、計算結果をそのまま返す
    return multiplier;
  }
}

/**
 * スキル#4「光輝」の効果倍率を計算する
 * IC5クリア報酬（効果+20%）も考慮する
 * @param {object} idleGame - IdleGameのデータオブジェクト
 * @returns {number} 計算された光輝の倍率 (例: 1.1, 1.22)
 */
export function calculateRadianceMultiplier(idleGame) {
  const skillLevel4 = idleGame.skillLevel4 || 0;

  // 1. 基本となる1レベルあたりの効果を決定する
  let effectPerLevel = 0.1; // 通常は10%

  // 2. IC5をクリア済みかチェックする
  const completedChallenges = idleGame.challenges?.completedChallenges || [];
  if (completedChallenges.includes("IC5")) {
    // 仕様書案「#4効果+20%」は、元の10%が1.2倍されて12%になると解釈
    effectPerLevel *= 1.2;
  }

  // 3. 最終的な倍率を計算して返す
  return 1.0 + skillLevel4 * effectPerLevel;
}

/**
 * ランキングスコアの構成要素オブジェクトから最終スコアを計算する
 * @param {object} components - スコア計算に必要な最大値が格納されたオブジェクト
 * @returns {number} 計算された最終スコア
 */
function calculateScoreFromComponents(components) {
  // componentsが空、または最大人口が0なら流石に0点
  if (!components || !components.highestPopulation) {
    return 0;
  }

  // --- 計算に必要な各要素を準備 ---
  // 各要素を取得する際に、存在しない場合のデフォルト値を設定する
  const meatEffect = components.meatEffect || 1.0; // 指数計算なので、1をデフォルトに
  const infinityCount = components.infinityCount || 0;
  const completedICCount = components.completedICCount || 0;
  // --- Decimalに変換して計算 ---
  const highestPopulation_d = new Decimal(components.highestPopulation || "0");
  const infinityPoints_d = new Decimal(components.infinityPoints || "0");

  // --- スコア計算 ---
  // (1 + log10(1 + MaxPopulation))
  const popFactor = new Decimal(1).add(highestPopulation_d.add(1).log10());
  // (MaxExponent) ^ 0.5
  const meatFactor = new Decimal.pow(meatEffect, 0.5);
  // (1 + log10(1 + MaxInfinityCount))
  const infCountFactor = new Decimal(1).add(
    new Decimal(infinityCount).add(1).log10()
  );
  // (1 + log10(1 + MaxIP))
  const ipFactor = new Decimal(1).add(infinityPoints_d.add(1).log10());
  // (1 + MaxInfChallenges / 10) ^ 0.5
  const challengeFactor = new Decimal(1).add(completedICCount / 10).pow(0.5);

  //全てを乗算
  const finalScore = popFactor
    .times(meatFactor)
    .times(infCountFactor)
    .times(ipFactor)
    .times(challengeFactor);

  return finalScore.toNumber();
}

/**
 * ランキングスコアの構成要素をチェックし、必要であれば更新する
 * @param {object} idleGame - 最新のIdleGameデータ (オフライン進行計算後)
 * @param {object} externalData - Mee6レベルなどの外部データ
 * @returns {{needsUpdate: boolean, newScore?: number, newComponents?: object}} - 更新結果
 */
export function updateRankScoreIfNeeded(idleGame, externalData) {
  // DBに保存されている過去の最高記録を取得。なければ空オブジェクトで初期化。
  const currentComponents = idleGame.rankScoreComponents || {};
  // 更新があった場合に備え、新しいコンポーネントオブジェクトのコピーを作成。
  const newComponents = { ...currentComponents };
  let needsUpdate = false;

  // 1. MaxPopulation: 最高人口の比較
  //    過去の最高記録、現在の最高人口、現在の人口のうち、最も大きいものを新しい最高記録とする。
  const currentMaxPop = new Decimal(currentComponents.highestPopulation || "0");
  const highestPop = new Decimal(idleGame.highestPopulation || "0");
  const currentPop = new Decimal(idleGame.population || "0");
  const newMaxPop = Decimal.max(currentMaxPop, highestPop, currentPop);

  if (newMaxPop.gt(currentMaxPop)) {
    newComponents.highestPopulation = newMaxPop.toString();
    needsUpdate = true;
  }

  // 2. MaxExponent: 肉工場の最大指数の比較
  const currentExponent = calculateFinalMeatEffect(idleGame, externalData);
  if (currentExponent > (currentComponents.meatEffect || 0)) {
    newComponents.meatEffect = currentExponent;
    needsUpdate = true;
  }

  // 3. MaxInfinityCount: インフィニティ回数の比較
  const currentInfCount = idleGame.infinityCount || 0;
  if (currentInfCount > (currentComponents.infinityCount || 0)) {
    newComponents.infinityCount = currentInfCount;
    needsUpdate = true;
  }

  // 4. MaxIP: 最大IPの比較
  const currentIP = new Decimal(idleGame.infinityPoints || "0");
  const existingIP = new Decimal(currentComponents.infinityPoints || "0");
  if (currentIP.gt(existingIP)) {
    newComponents.infinityPoints = currentIP.toString();
    needsUpdate = true;
  }

  // 5. MaxInfChallenges: ICクリア数の比較
  const currentICCount = idleGame.challenges?.completedChallenges?.length || 0;
  if (currentICCount > (currentComponents.completedICCount || 0)) {
    newComponents.completedICCount = currentICCount;
    needsUpdate = true;
  }

  // いずれかの要素が更新されていた場合
  if (needsUpdate) {
    const newScore = calculateScoreFromComponents(newComponents);
    return {
      needsUpdate: true,
      newScore: newScore,
      newComponents: newComponents,
    };
  }

  // 更新が不要な場合
  return { needsUpdate: false };
}

/**
 * ゴーストアセンションのシミュレーションを行う
 * @param {number} budget - ゴーストチップ予算
 * @param {object} idleGameForSim - アセンション回数やスキルレベルなどを含むシミュレーション用のIdleGameオブジェクト
 * @returns {{ascensions: number, totalCost: number}} 実行されたアセンション回数と総コスト
 */
export function simulateGhostAscension(budget, idleGameForSim) {
  let availableChips = budget;
  let ascensionsDone = 0;
  let totalCost = 0;
  const MAX_ITERATIONS = 500; // 安全装置

  // シミュレーション用のデータを準備
  const purchasedIUs = new Set(idleGameForSim.ipUpgrades?.upgrades || []);
  const skillLevel6 = idleGameForSim.skillLevel6 || 0;
  const activeChallenge = idleGameForSim.challenges?.activeChallenge;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const currentAscensionCount =
      idleGameForSim.ascensionCount + ascensionsDone;
    const { requiredChips } = calculateAscensionRequirements(
      currentAscensionCount,
      skillLevel6,
      purchasedIUs,
      activeChallenge
    );

    if (availableChips < requiredChips) {
      break; // 予算不足
    }

    availableChips -= requiredChips;
    totalCost += requiredChips;
    ascensionsDone++;
  }
  return { ascensions: ascensionsDone, totalCost };
}

/**
 * 【新規】GPによる効果指数を、全てのアップグレードを考慮して計算する
 * @param {object} idleGameData - IdleGameの生データ
 * @returns {number} 最終的なGPの指数
 */
export function getFinalGpExponent(idleGameData) {
  const purchasedIUs = new Set(idleGameData.ipUpgrades?.upgrades || []);
  let baseExponent = 0.5;

  // IU42: 0.5 -> 0.75
  if (purchasedIUs.has("IU42")) {
    baseExponent += config.idle.infinityUpgrades.tiers[3].upgrades.IU42.bonus;
  }
  // IU74: 0.75 -> 0.9
  if (purchasedIUs.has("IU74")) {
    baseExponent += config.idle.infinityUpgrades.tiers[6].upgrades.IU74.bonus;
  }

  // IU82: 動的指数ボーナス
  if (purchasedIUs.has("IU82")) {
    const gp_d = new Decimal(idleGameData.generatorPower || "1");

    if (gp_d.gt(1)) {
      // GPが1より大きい場合のみ計算
      let bonus = gp_d.log10() / 500;
      if (bonus > 0.2) {
        bonus = Math.pow(bonus / 0.2, 0.2) * 0.2;
      }
      baseExponent += bonus;
    }
  }

  return baseExponent;
}

/**
 * 【最適化版】GPによる1工場あたりの倍率(Mult)に、多段階ソフトキャップを適用する
 * @param {Decimal} mult_d - ソフトキャップ適用前の1工場あたりの倍率
 * @returns {Decimal} ソフトキャップ適用後の1工場あたりの倍率
 */
function applyGpMultSoftcaps(mult_d) {
  const softcaps = config.idle.gpMult_softcaps;
  // 最初のキャップの閾値より小さければ、即座に終了
  if (mult_d.lt("1e1000")) {
    return mult_d;
  }
  let exponent = mult_d.log10();

  for (const cap of softcaps) {
    if (exponent > cap.threshold) {
      // キャップを適用
      exponent = (exponent - cap.threshold) * cap.power + cap.threshold;
    } else {
      // ここでループを抜ける
      break;
    }
  }

  return Decimal.pow(10, exponent);
}
