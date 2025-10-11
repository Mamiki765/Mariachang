//utils/idle-game-calculator.mjs
//commands/utils/idle.mjsの各種計算や、処理部分を移植する
//UIとかユーザーが直接操作する部分は今のところidle.mjsに残す
import Decimal from "break_infinity.js";
import config from "../config.mjs";
import { IdleGame,  Mee6Level, UserAchievement } from "../models/database.mjs";

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
 * 施設のアップグレードコストを計算する (Decimal版)
 * @param {string} type
 * @param {number} level
 * @param {number} skillLevel6 - TPスキル#6のレベル
 * @returns {number}
 */
export function calculateFacilityCost(type, level, skillLevel6 = 0) {
  const facility = config.idle[type];
  if (!facility) return Infinity;

  // 1. 計算に使う数値をDecimalオブジェクトに変換
  const baseCost_d = new Decimal(facility.baseCost);
  const multiplier_d = new Decimal(facility.multiplier);
  const discountMultiplier_d = new Decimal(
    calculateDiscountMultiplier(skillLevel6)
  );

  // 2. 全ての計算をDecimalメソッドで行う
  const finalCost_d = baseCost_d
    .times(multiplier_d.pow(level)) // .times() は * (乗算), .pow() はべき乗
    .times(discountMultiplier_d);

  // 3. 最終結果を通常の数値に戻して返す (コストがe308を超えることはないので安全)
  return finalCost_d.floor().toNumber(); // .floor()で小数点以下を切り捨て、.toNumber()で数値に変換
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
  const achievementMultiplier = 1.0 + achievementCount * 0.01;
  const achievementExponentBonus = achievementCount;

  // スキル効果 (これらは通常のNumberでOK)
  const skillLevels = {
    s1: idleGameData.skillLevel1,
    s2: idleGameData.skillLevel2,
    s3: idleGameData.skillLevel3,
    s4: idleGameData.skillLevel4,
  };
  const radianceMultiplier = 1.0 + skillLevels.s4 * 0.1;
  const skill1Effect =
    (1 + skillLevels.s1) * radianceMultiplier * achievementMultiplier;
  const skill2Effect = (1 + skillLevels.s2) * radianceMultiplier;
  const finalSkill2Effect = Math.pow(skill2Effect, 2); // 時間加速

  // 工場効果 (これもNumberでOK)
  const factoryEffects = calculateFactoryEffects(idleGameData, pp);
  const meatFactoryLevel =
    (externalData.mee6Level || 0) + pp + achievementExponentBonus;
  const meatEffect = 1 + config.idle.meat.effect * meatFactoryLevel;

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
    .times(new Decimal(skill1Effect).pow(5));

  let finalProduction = baseProduction
    .pow(meatEffect)
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

  // --- 2. 経過時間に基づいた人口計算 ---
  const now = new Date();
  const lastUpdate = new Date(idleGameData.lastUpdatedAt);
  const elapsedSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;

  if (elapsedSeconds > 0) {
    const productionPerMinute_d = calculateProductionRate(
      idleGameData,
      externalData
    );
    const productionPerSecond_d = productionPerMinute_d.div(60);
    const addedPopulation_d = productionPerSecond_d.times(elapsedSeconds);
    population_d = population_d.add(addedPopulation_d);
  }

  // --- 3. ピザボーナスの再計算 ---
  let pizzaBonusPercentage = 0;
  // populationが1以上の場合のみ計算
  if (population_d.gte(1)) {
    // population_d.log10() は通常の Number を返すので、以降はNumber計算でOK
    const logPop = population_d.log10();
    const skill3Effect =
      (1 + (idleGameData.skillLevel3 || 0)) *
      (1.0 + (idleGameData.skillLevel4 || 0) * 0.1);
    pizzaBonusPercentage =
      (100 + logPop + 1 + (idleGameData.prestigePower || 0)) * skill3Effect -
      100;
  }

  // --- 4. 更新されたデータをオブジェクトとして返す ---
  return {
    ...idleGameData, // 変更がないデータはそのままコピー
    population: population_d.toString(), // ★ 文字列に戻して返す
    lastUpdatedAt: now,
    pizzaBonusPercentage: pizzaBonusPercentage,
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
  if (dec.isZero()) {
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

  // 2. externalData(道具箱)を準備
  const externalData = {
    mee6Level: mee6Level?.level || 0,
    achievementCount: userAchievement?.achievements?.unlocked?.length || 0,
  };

  // 3. 計算エンジンを呼び出して、最新の状態にする
  const updatedIdleGame = calculateOfflineProgress(idleGameData, externalData);

  // 4. DBに保存する (注意: この関数はUI表示のたびに呼ばれるので、頻繁なDB書き込みになる。将来的には分離も検討)
  await IdleGame.update(
    {
      population: updatedIdleGame.population,
      lastUpdatedAt: updatedIdleGame.lastUpdatedAt,
      pizzaBonusPercentage: updatedIdleGame.pizzaBonusPercentage,
    },
    { where: { userId } }
  );

  // 5. UIで必要なデータをまとめて返す
  return {
    idleGame: updatedIdleGame,
    mee6Level: externalData.mee6Level,
    achievementCount: externalData.achievementCount,
    userAchievement: userAchievement, // 実績コンプチェックなどで使うので渡す
  };
}
