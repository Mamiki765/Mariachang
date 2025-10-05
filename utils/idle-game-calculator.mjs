//utils/idle-game-calculator.mjs
//commands/utils/idle.mjsの各種計算や、処理部分を移植する
//UIとかユーザーが直接操作する部分は今のところidle.mjsに残す

import config from "../config.mjs";
import {
  IdleGame,
  Mee6Level,
  UserAchievement,
} from "../models/database.mjs";

/**
 * 施設のアップグレードコストを計算する
 * @param {string} type - 'oven', 'cheese' などの施設名
 * @param {number} level - 現在の施設レベル
 * @returns {number} 次のレベルへのアップグレードコスト
 */
export function calculateFacilityCost(type, level) {
  const facility = config.idle[type];
  if (!facility) return Infinity; // 念のため
  return Math.floor(facility.baseCost * Math.pow(facility.multiplier, level));
}

/**
 * 全ての施設のコストを計算し、オブジェクトとして返す
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {object} 各施設のコストが格納されたオブジェクト
 */
export function calculateAllCosts(idleGame) {
  return {
    oven: calculateFacilityCost("oven", idleGame.pizzaOvenLevel),
    cheese: calculateFacilityCost("cheese", idleGame.cheeseFactoryLevel),
    tomato: calculateFacilityCost("tomato", idleGame.tomatoFarmLevel),
    mushroom: calculateFacilityCost("mushroom", idleGame.mushroomFarmLevel),
    anchovy: calculateFacilityCost("anchovy", idleGame.anchovyFactoryLevel),
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
  if (!idleGame) {
    return null;
  }
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
  };
  const radianceMultiplier = 1.0 + skillLevels.s4 * 0.1;
  const skill1Effect =
    (1 + skillLevels.s1) * radianceMultiplier * achievementMultiplier;
  const skill2Effect = (1 + skillLevels.s2) * radianceMultiplier;
  const skill3Effect = (1 + skillLevels.s3) * radianceMultiplier;
  const mee6Level = await Mee6Level.findOne({ where: { userId } });
  const meatFactoryLevel =
    (mee6Level ? mee6Level.level : 0) + pp + achievementExponentBonus;
  const now = new Date();
  const lastUpdate = idleGame.lastUpdatedAt || now;
  const elapsedSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;
  const ovenEffect = idleGame.pizzaOvenLevel + pp;
  const cheeseEffect =
    1 + config.idle.cheese.effect * (idleGame.cheeseFactoryLevel + pp);
  const tomatoEffect =
    1 + config.idle.tomato.effect * (idleGame.tomatoFarmLevel + pp);
  const mushroomEffect =
    1 + config.idle.mushroom.effect * (idleGame.mushroomFarmLevel + pp);
  const anchovyEffect =
    1 + config.idle.anchovy.effect * (idleGame.anchovyFactoryLevel + pp);
  const meatEffect = 1 + config.idle.meat.effect * meatFactoryLevel;
  let currentBuffMultiplier = 1.0;
  if (idleGame.buffExpiresAt && new Date(idleGame.buffExpiresAt) > now) {
    currentBuffMultiplier = idleGame.buffMultiplier;
  }
  const productionPerMinute =
    Math.pow(
      ovenEffect *
        cheeseEffect *
        tomatoEffect *
        mushroomEffect *
        anchovyEffect *
        Math.pow(skill1Effect, 5), //工場は5個なのでこれで内部的にはおなじになる
      meatEffect
    ) *
    currentBuffMultiplier *
    skill2Effect;

  if (elapsedSeconds > 0) {
    const addedPopulation = (productionPerMinute / 60) * elapsedSeconds;
    idleGame.population += addedPopulation;
  }
  let pizzaBonusPercentage = 0;
  if (idleGame.population >= 1) {
    pizzaBonusPercentage = Math.log10(idleGame.population) + 1 + pp;
  } else if (pp > 0) {
    pizzaBonusPercentage = pp;
  }
  pizzaBonusPercentage = (100 + pizzaBonusPercentage) * skill3Effect - 100;
  idleGame.pizzaBonusPercentage = pizzaBonusPercentage;
  idleGame.lastUpdatedAt = now;
  await idleGame.save();
  let buffRemaining = null;
  if (idleGame.buffExpiresAt && new Date(idleGame.buffExpiresAt) > now) {
    const ms = idleGame.buffExpiresAt - now;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    buffRemaining = { hours, minutes };
  }
  return {
    population: idleGame.population,
    pizzaBonusPercentage: pizzaBonusPercentage,
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