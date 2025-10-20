//utils/idle-game-calculator.mjs
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
 * @returns {number}
 */
export function calculateFacilityCost(
  type,
  level,
  skillLevel6 = 0,
  purchasedIUs = new Set()
) {
  const facility = config.idle.factories[type];
  if (!facility) return Infinity;

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
      purchasedIUs
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
 * @returns {number} 獲得できるTPの量 (TPはNumberで十分なのでNumberを返す)
 */
export function calculatePotentialTP(population_d, skillLevel8 = 0) {
  // --- 1. 比較もDecimalのメソッドで行う ---
  const threshold = new Decimal("1e16");
  if (population_d.lt(threshold)) {
    // .lt() は "less than" (<)
    return 0;
  }

  // --- 2. 基礎TPの計算をDecimalで行う ---
  // population_d.log10() は Number を返すので、それをDecimalに変換し直す
  const logPop_d = new Decimal(population_d.log10());

  // (log10(人口) - 15) ^ 2.5
  const baseTP_d = logPop_d.minus(15).pow(2.5);
  // .minus() は引き算, .pow() はべき乗

  // --- 3. スキル倍率を計算し、最終結果を求める ---
  const multiplier =
    1 + skillLevel8 * config.idle.tp_skills.skill8.effectMultiplier;

  // 最後に .toNumber() で通常の数値に戻して返す
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
 * 【新規】1. 生産量の計算エンジン
 * 毎分のニョワミヤ増加量を "Decimal" オブジェクトとして計算して返す。
 * @param {object} idleGameData - IdleGameの生データ
 * @param {object} externalData - Mee6レベルなど外部から与えるデータ
 * @returns {Decimal} - 毎分の生産量
 */
function calculateProductionRate(idleGameData, externalData) {
  const pp = idleGameData.prestigePower || 0;
  const achievementCount = externalData.achievementCount || 0;
  const ascensionCount = idleGameData.ascensionCount || 0;
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
  const radianceMultiplier = 1.0 + (skillLevels.s4 || 0) * 0.1;
  const skill1Effect =
    (1 + (skillLevels.s1 || 0)) * radianceMultiplier * achievementMultiplier;
  const skill2Effect = (1 + (skillLevels.s2 || 0)) * radianceMultiplier;
  const finalSkill2Effect = Math.pow(skill2Effect, 2); // 時間加速

  //IC2報酬
  let ic2Bonus = 1.0;
  if (idleGameData.infinityCount > 0) {
    //infinity前では無用
    const completedChallenges =
      idleGameData.challenges?.completedChallenges || [];
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
      const completedChallenges =
        idleGameData.challenges?.completedChallenges || [];
      if (completedChallenges.includes("IC7")) {
        ascensionBaseEffect += 0.025;
      }
      if (completedChallenges.includes("IC8")) {
        ascensionBaseEffect *= 1.1;
      }
    }
    // 1. アセンション1回あたりの効果を、現在のアセンション回数分だけ累乗する
    const ascensionFactor = Math.pow(ascensionBaseEffect, ascensionCount);
    // 8つの工場すべてに適用されるため、その効果を8乗したものを baseProduction に乗算する
    baseProduction = baseProduction.times(new Decimal(ascensionFactor).pow(8));
  }

  let finalProduction = baseProduction
    .pow(meatEffect) // ★実績ボーナスが含まれた新しい指数がここで使われる！
    .times(buffMultiplier)
    .times(finalSkill2Effect); // 時間加速効果は最終乗算

  return finalProduction;
}

/**
 * 【新規】2. オフライン進行の計算エンジン (新しい心臓部)
 * @param {object} idleGameData - Sequelizeから取得したidleGameの生データ
 * @param {object} externalData - Mee6レベルなど外部から与えるデータ
 * @returns {object} - 計算後の更新されたidleGameの生データ (プレーンなJSオブジェクト)
 */
export function calculateOfflineProgress(idleGameData, externalData) {
  // --- 1. Decimalオブジェクトへ変換 ---
  let population_d = new Decimal(idleGameData.population);
  // --- i1.定義をする ---
  let gp_d;
  let generators;
  let ipUpgradesChanged = false;
  // --- i2.∞>0で整える
  if (idleGameData.infinityCount > 0) {
    gp_d = new Decimal(idleGameData.generatorPower || "1");
    // ジェネレーター配列を安全に正規化
    const oldGenerators = idleGameData.ipUpgrades?.generators || [];
    generators = Array.from(
      { length: 8 },
      (_, i) => oldGenerators[i] || { amount: "0", bought: 0 }
    );
  }

  // --- 2. 経過時間に基づいた人口計算 ---
  const now = new Date();
  const lastUpdate = new Date(idleGameData.lastUpdatedAt);
  const elapsedSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;
  let newInfinityTime = idleGameData.infinityTime || 0;
  let newEternityTime = idleGameData.eternityTime || 0;
  //251012 時間加速スキル効果を計算
  //251024 ジェネ効果のためinTimeやetTime加算より上で先に計算
  // (#2 * #4)^2倍速
  const timeAccelerationMultiplier = Math.pow(
    (1 + (idleGameData.skillLevel2 || 0)) *
      (1.0 + (idleGameData.skillLevel4 || 0) * 0.1),
    2
  );

  if (elapsedSeconds > 0) {
    //--- i3.ジェネの再計算をする
    if (idleGameData.infinityCount > 0) {
      ipUpgradesChanged = true;
      //8号機から子供を増やす処理　Geneは非常に数が吹っ飛びやすいんでamountをdで見るのは大事…
      for (let i = 7; i >= 0; i--) {
        // G8 -> G1
        const genData = generators[i];
        const bought = genData.bought || 0;
        if (bought === 0) continue;

        const multiplier = Math.pow(2, bought - 1); //1個買う度に2倍
        const amount_d = new Decimal(genData.amount);
        const productionPerSecond = amount_d.times(multiplier).div(60);
        const producedAmount = productionPerSecond
          .times(elapsedSeconds)
          .times(timeAccelerationMultiplier); //#2の「ゲームスピード加速」がここで生きてくる

        if (i > 0) {
          generators[i - 1].amount = new Decimal(generators[i - 1].amount)
            .add(producedAmount)
            .toString();
        } else {
          const firstProducedAmount = producedAmount.times(
            idleGameData.infinityCount
          ); // G1のみ∞数で乗算される
          gp_d = gp_d.add(firstProducedAmount); // ここで gp_d が更新される。
        }
      }
      //GPがe2000＝マルチe1000以上の時、SC関数を後々入れる（インフィニティがインフィニティしそうな頃の話）
    }

    // infinity前の処理
    const productionPerMinute_d = calculateProductionRate(
      idleGameData,
      externalData
    );
    let finalProductionPerMinute_d = productionPerMinute_d;
    if (idleGameData.infinityCount > 0) {
      const gpEffect_d = gp_d.pow(4).max(1); //^0.5^8
      finalProductionPerMinute_d = productionPerMinute_d.times(gpEffect_d);
    }
    const productionPerSecond_d = finalProductionPerMinute_d.div(60);
    const addedPopulation_d = productionPerSecond_d.times(elapsedSeconds);
    population_d = population_d.add(addedPopulation_d);

    newInfinityTime += elapsedSeconds * timeAccelerationMultiplier;
    newEternityTime += elapsedSeconds * timeAccelerationMultiplier;
  }

  // --- 2.5 Infinityを超えたら直前で止める
  const INFINITY_THRESHOLD = new Decimal(config.idle.infinity); //この数値をInfinityボタン出現条件とする
  if (population_d.gte(INFINITY_THRESHOLD)) {
    //infinityを超えたら
    // ジェネレーターIIの購入数をチェック
    const gen2Bought = idleGameData.ipUpgrades?.generators?.[1]?.bought || 0;
    if (gen2Bought === 0) {
      //0ならInfinity is not broken.
      population_d = INFINITY_THRESHOLD;
    }
    //1以上ならBreak Infinity
  }

  // --- 3. ピザボーナスの再計算 ---
  let pizzaBonusPercentage = 0;
  // populationが1以上の場合のみ計算
  if (population_d.gte(1)) {
    // population_d.log10() は通常の Number を返すので、以降はNumber計算でOK
    const logPop = population_d.log10();
    // infinity実績　chip + 5000%
    const afterInfinity = idleGameData.infinityCount > 0 ? 5000 : 0;
    const skill3Effect =
      (1 + (idleGameData.skillLevel3 || 0)) *
      (1.0 + (idleGameData.skillLevel4 || 0) * 0.1);
    pizzaBonusPercentage =
      (100 + logPop + 1 + (idleGameData.prestigePower || 0)) * skill3Effect -
      100 +
      afterInfinity;
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
 * @returns {Promise<object|null>}
 */
export async function getSingleUserUIData(userId) {
  // 1. 関連データを "並行して" 取得 (Promise.allで高速化)
  const [idleGameData, mee6Level, userAchievement] = await Promise.all([
    IdleGame.findOne({ where: { userId }, raw: true }),
    Mee6Level.findOne({ where: { userId }, raw: true }),
    UserAchievement.findOne({ where: { userId }, raw: true }),
  ]);
  if (!idleGameData) return null; // ユーザーデータがなければ終了

  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);

  // 2. externalData(道具箱)を準備
  const externalData = {
    mee6Level: mee6Level?.level || 0,
    achievementCount: unlockedSet.size,
    unlockedSet: unlockedSet, // ★ Setオブジェクトそのものを梱包！
  };

  // 3. 計算エンジンを呼び出して、最新の状態にする
  const updatedIdleGame = calculateOfflineProgress(idleGameData, externalData);

  // 4. DBに保存する (注意: この関数はUI表示のたびに呼ばれるので、頻繁なDB書き込みになる。将来的には分離も検討)
  // updateに渡すオブジェクトを動的に構築
  const updateData = {
    population: updatedIdleGame.population,
    lastUpdatedAt: updatedIdleGame.lastUpdatedAt,
    pizzaBonusPercentage: updatedIdleGame.pizzaBonusPercentage,
    infinityTime: updatedIdleGame.infinityTime,
    eternityTime: updatedIdleGame.eternityTime,
  };
  // ジェネレーターが更新された場合のみ、updateDataに追加
  if (updatedIdleGame.wasChanged.ipUpgrades) {
    updateData.generatorPower = updatedIdleGame.generatorPower;
    updateData.ipUpgrades = updatedIdleGame.ipUpgrades;
    //IdleGame.changed("ipUpgrades", true);
  }

  await IdleGame.update(updateData, { where: { userId } });

  // --- 5. UI表示に必要なデータを "全て" 計算してまとめる ---
  const pp = updatedIdleGame.prestigePower || 0;
  //const achievementExponentBonus = externalData.achievementCount;
  const gp_d = new Decimal(updatedIdleGame.generatorPower || "1");
  const gpEffect_d = gp_d.pow(4).max(1);

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
  const radianceMultiplier = 1.0 + (skillLevels.s4 || 0) * 0.1;

  // ★表示に必要なデータを displayData オブジェクトに格納する
  const displayData = {
    productionRate_d: calculateProductionRate(
      updatedIdleGame,
      externalData
    ).times(gpEffect_d),
    factoryEffects: factoryEffects,
    skill1Effect:
      (1 + (skillLevels.s1 || 0)) *
      radianceMultiplier *
      (1.0 + externalData.achievementCount * 0.01),
    meatEffect: calculateFinalMeatEffect(updatedIdleGame, externalData),
  };

  // --- 6. 最終的なデータを返す ---
  return {
    idleGame: updatedIdleGame,
    mee6Level: externalData.mee6Level,
    achievementCount: externalData.achievementCount,
    userAchievement: userAchievement,
    displayData: displayData, // ★計算済みの表示用データも一緒に返す！
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

  if (totalSeconds < 60) {
    return `${Math.floor(totalSeconds)}秒`;
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
      purchasedIUs //そのままIU14用に流す！
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
  if (completedChallengeCount >= 9) { //IC9クリア時点で9個達成している必要があり、クリアしていれば2倍されているので。
    baseIP = baseIP.times(2);
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
  // ▼▼▼ この関数をシンプルにする ▼▼▼
  const effectiveLevel = level || 0; // undefinedなら0として扱う
  const budgetPerLevel = config.idle.ghostChip.budgetPerLevel;
  return effectiveLevel * budgetPerLevel; // レベル0なら予算0、レベル1なら予算5000
}

/**
 * 【最終改訂版】ゴーストチップの次のレベルへのアップグレードコストを計算する
 */
export function calculateGhostChipUpgradeCost(level) {
  const currentLevel = level || 0;

  // レベル0から1への強化は、既存ユーザーへの救済として無料にする
  if (currentLevel === 0) {
    return 0;
  }
  // ▲▲▲ 安全策ここまで ▲▲▲

  // レベル1以上の場合は、通常のコスト計算を行う
  const ghostConfig = config.idle.ghostChip;
  const budgetPerLevel = ghostConfig.budgetPerLevel;
  const costConfig = ghostConfig.cost;

  // ★あなたの最初の案「currentLevel - 1」はここで活かすのが最適です！
  // レベル1の時、比例倍率は0に。レベル2の時、比例倍率は1倍になる。
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
