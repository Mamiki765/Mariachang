//utils/idle-game-calculator.mjs
//commands/utils/idle.mjsの各種計算や、処理部分を移植する
//UIとかユーザーが直接操作する部分は今のところidle.mjsに残す

import config from "../config.mjs";
import { IdleGame, Mee6Level, UserAchievement } from "../models/database.mjs";

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
export function calculateFactoryEffects(idleGame, pp) {
  const s5_level = idleGame.skillLevel5 || 0;
  const s5_config = config.idle.tp_skills.skill5;
  const baseLevelBonusPerLevel = s5_level * s5_config.effect;

  // --- ピザ窯 ---
  const oven_base_lv = idleGame.pizzaOvenLevel || 0;
  const ovenFinalEffect =
    (oven_base_lv + pp) * (1 + baseLevelBonusPerLevel * oven_base_lv);

  // --- チーズ工場 ---
  const cheese_base_lv = idleGame.cheeseFactoryLevel || 0;
  const cheese_base_effect = config.idle.cheese.effect;
  // 1. まず、スキル#5で「基本効果」そのものを強化する
  const cheese_boosted_effect =
    cheese_base_effect * (1 + baseLevelBonusPerLevel * cheese_base_lv);
  // 2. その強化された効果を使って、最終的な効果を計算する
  const cheeseFinalEffect = 1 + cheese_boosted_effect * (cheese_base_lv + pp);

  // --- トマト農場 ---
  const tomato_base_lv = idleGame.tomatoFarmLevel || 0;
  const tomato_base_effect = config.idle.tomato.effect;
  const tomato_boosted_effect =
    tomato_base_effect * (1 + baseLevelBonusPerLevel * tomato_base_lv);
  const tomatoFinalEffect = 1 + tomato_boosted_effect * (tomato_base_lv + pp);

  // --- マッシュルーム農場 ---
  const mushroom_base_lv = idleGame.mushroomFarmLevel || 0;
  const mushroom_base_effect = config.idle.mushroom.effect;
  const mushroom_boosted_effect =
    mushroom_base_effect * (1 + baseLevelBonusPerLevel * mushroom_base_lv);
  const mushroomFinalEffect =
    1 + mushroom_boosted_effect * (mushroom_base_lv + pp);

  // --- アンチョビ工場 ---
  const anchovy_base_lv = idleGame.anchovyFactoryLevel || 0;
  const anchovy_base_effect = config.idle.anchovy.effect;
  const anchovy_boosted_effect =
    anchovy_base_effect * (1 + baseLevelBonusPerLevel * anchovy_base_lv);
  const anchovyFinalEffect =
    1 + anchovy_boosted_effect * (anchovy_base_lv + pp);

  return {
    oven: ovenFinalEffect,
    cheese: cheeseFinalEffect,
    tomato: tomatoFinalEffect,
    mushroom: mushroomFinalEffect,
    anchovy: anchovyFinalEffect,
  };
}

/**
 * 施設のアップグレードコストを計算する (割引適用版)
 * @param {string} type
 * @param {number} level
 * @param {number} skillLevel6 - TPスキル#6のレベル
 * @returns {number}
 */
export function calculateFacilityCost(type, level, skillLevel6 = 0) {
  const facility = config.idle[type];
  if (!facility) return Infinity;

  const baseCost = facility.baseCost * Math.pow(facility.multiplier, level);
  const discountMultiplier = calculateDiscountMultiplier(skillLevel6);

  return Math.floor(baseCost * discountMultiplier);
}

/**
 * 全ての施設のコストを計算し、オブジェクトとして返す (割引適用版)
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {object}
 */
export function calculateAllCosts(idleGame) {
  const skillLevel6 = idleGame.skillLevel6 || 0;
  return {
    oven: calculateFacilityCost("oven", idleGame.pizzaOvenLevel, skillLevel6),
    cheese: calculateFacilityCost(
      "cheese",
      idleGame.cheeseFactoryLevel,
      skillLevel6
    ),
    tomato: calculateFacilityCost(
      "tomato",
      idleGame.tomatoFarmLevel,
      skillLevel6
    ),
    mushroom: calculateFacilityCost(
      "mushroom",
      idleGame.mushroomFarmLevel,
      skillLevel6
    ),
    anchovy: calculateFacilityCost(
      "anchovy",
      idleGame.anchovyFactoryLevel,
      skillLevel6
    ),
  };
}

/**
 *  * ==========================================================================================
 * ★★★ 将来の自分へ: 計算式に関する超重要メモ ★★★
 *
 * この updateUserIdleGame 関数内の人口計算ロジックは、
 * SupabaseのSQL関数 `update_all_idle_games_and_bonuses` 内でも、
 * 全く同じ計算式でSQLとして再現されています。
 *
 * (SQL関数は、tasks/pizza-distributor.mjsから10分毎に呼び出され、
 * 全ユーザーの人口を一括で更新するために使われています)
 *
 * そのため、将来ここで計算式を変更する場合 (例: 施設の補正数値をconfigで変える、新しい施設を追加する) は、
 * 必ずSupabaseにある `update_all_idle_games_and_bonuses` 関数も
 * 同じロジックになるよう修正してください！
 *
 * ==========================================================================================
 *
 * 特定ユーザーの放置ゲームデータを更新し、最新の人口を返す関数
 * @param {string} userId - DiscordのユーザーID
 * @returns {Promise<object|null>} 成功した場合は { population, pizzaBonusPercentage }、データがなければ null
 */
/**
 * 特定ユーザーの放置ゲームデータを更新し、最新の人口を返す関数
 * @param {string} userId - DiscordのユーザーID
 * @returns {Promise<object|null>} 成功した場合は { population, pizzaBonusPercentage }、データがなければ null
 */
export async function updateUserIdleGame(userId) {
  const idleGame = await IdleGame.findOne({ where: { userId } });
  if (!idleGame) return null;

  const pp = idleGame.prestigePower || 0;
  const userAchievement = await UserAchievement.findOne({ where: { userId } });
  const achievementCount = userAchievement?.achievements?.unlocked?.length || 0;
  const achievementMultiplier = 1.0 + achievementCount * 0.01;
  const achievementExponentBonus = achievementCount;

  const skillLevels = {
    s1: idleGame.skillLevel1 || 0,
    s2: idleGame.skillLevel2 || 0,
    s3: idleGame.skillLevel3 || 0,
    s4: idleGame.skillLevel4 || 0,
    s5: idleGame.skillLevel5 || 0,
  };

  // 光輝
  const radianceMultiplier = 1.0 + skillLevels.s4 * 0.1;
  const skill1Effect =
    (1 + skillLevels.s1) * radianceMultiplier * achievementMultiplier;
  const skill2Effect = (1 + skillLevels.s2) * radianceMultiplier;
  const skill3Effect = (1 + skillLevels.s3) * radianceMultiplier;

  //#2は②乗
  const finalSkill2Effect = Math.pow(skill2Effect, 2);

  // --- スキル#5対応の工場効果を反映 ---
  const factoryEffects = calculateFactoryEffects(idleGame, pp);
  const ovenEffect = factoryEffects.oven;
  const cheeseEffect = factoryEffects.cheese;
  const tomatoEffect = factoryEffects.tomato;
  const mushroomEffect = factoryEffects.mushroom;
  const anchovyEffect = factoryEffects.anchovy;

  // --- Mee6レベル由来の肉工場 ---
  const mee6Level = await Mee6Level.findOne({ where: { userId } });
  const meatFactoryLevel =
    (mee6Level ? mee6Level.level : 0) + pp + achievementExponentBonus;
  const meatEffect = 1 + config.idle.meat.effect * meatFactoryLevel;

  // --- 経過時間計算 ---
  const now = new Date();
  const lastUpdate = idleGame.lastUpdatedAt || now;
  const elapsedSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;
  //#2に依って時間を「加速」させる
  const effectiveElapsedSeconds = elapsedSeconds * finalSkill2Effect;

  // --- バフ確認 ---
  let currentBuffMultiplier = 1.0;
  if (idleGame.buffExpiresAt && new Date(idleGame.buffExpiresAt) > now) {
    currentBuffMultiplier = idleGame.buffMultiplier;
  }

  // --- 生産量（人口増加）計算 ---
  const productionPerMinute =
    Math.pow(
      ovenEffect *
        cheeseEffect *
        tomatoEffect *
        mushroomEffect *
        anchovyEffect *
        Math.pow(skill1Effect, 5), // 工場5個なので
      meatEffect
    ) * currentBuffMultiplier;

  // --- 経過分の人口加算 ---
  if (elapsedSeconds > 0) {
    const addedPopulation =
      (productionPerMinute / 60) * effectiveElapsedSeconds;
    idleGame.population += addedPopulation;
  }

  // --- ピザボーナス算出 ---
  let pizzaBonusPercentage = 0;
  if (idleGame.population >= 1) {
    pizzaBonusPercentage = Math.log10(idleGame.population) + 1 + pp;
  } else if (pp > 0) {
    pizzaBonusPercentage = pp;
  }
  pizzaBonusPercentage = (100 + pizzaBonusPercentage) * skill3Effect - 100;

  // --- 保存 ---
  idleGame.pizzaBonusPercentage = pizzaBonusPercentage;
  idleGame.lastUpdatedAt = now;
  await idleGame.save();

  // --- バフ残り時間を返却 ---
  let buffRemaining = null;
  if (idleGame.buffExpiresAt && new Date(idleGame.buffExpiresAt) > now) {
    const ms = idleGame.buffExpiresAt - now;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    buffRemaining = { hours, minutes };
  }

  return {
    population: idleGame.population,
    pizzaBonusPercentage,
    buffRemaining,
    currentBuffMultiplier,
  };
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

/**
 * 巨大な数値を、日本の単位（兆、億、万）を使った最も自然な文字列に整形します。
 * 人間が日常的に読み書きする形式を再現します。
 * @param {number} n - フォーマットしたい数値。
 * @returns {string} フォーマットされた文字列。
 * @example
 * formatNumberJapanese(1234567890123); // "1兆2345億6789万123"
 * formatNumberJapanese(100010001);     // "1億1万1"
 * formatNumberJapanese(100000023);     // "1億23"
 * formatNumberJapanese(12345);         // "1万2345"
 * formatNumberJapanese(123);           // "123"
 */
export function formatNumberJapanese(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return String(n);
  }
  if (n > Number.MAX_SAFE_INTEGER) {
    return n.toExponential(4);
  }
  const num = Math.floor(n);
  if (num === 0) {
    return "0";
  }
  const units = [
    { value: 1_0000_0000_0000, name: "兆" },
    { value: 1_0000_0000, name: "億" },
    { value: 1_0000, name: "万" },
  ];
  let result = "";
  let tempNum = num;
  for (const unit of units) {
    if (tempNum >= unit.value) {
      const part = Math.floor(tempNum / unit.value);
      result += part + unit.name;
      tempNum %= unit.value;
    }
  }
  if (tempNum > 0) {
    result += tempNum;
  }
  return result || String(num);
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
 * @param {number} population - 現在の人口
 * @param {number} skillLevel8 - スキル#8の現在のレベル
 * @returns {number} 獲得できるTPの量
 */
export function calculatePotentialTP(population, skillLevel8 = 0) {
  // 閾値に達していない場合は0を返す
  if (population < 1e16) {
    return 0;
  }

  // 基礎となるTPを計算
  const baseTP = Math.pow(Math.log10(population) - 15, 2.5);

  // スキル#8の倍率を計算 (+100% * level なので、1 + 1.0 * level)
  const multiplier =
    1 + skillLevel8 * config.idle.tp_skills.skill8.effectMultiplier;

  return baseTP * multiplier;
}
