//idle-game\ui-builder.mjs
import Decimal from "break_infinity.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { IdleGame} from "../models/database.mjs";
import { Op } from "sequelize";
import config from "../config.mjs"; // config.jsにゲーム設定を追加する

//idlegame関数群
import {
  formatNumberJapanese_Decimal, // 新しいフォーマッター
  formatNumberDynamic_Decimal, // 新しいフォーマッター
  calculatePotentialTP,
  calculateAllCosts,
  calculateDiscountMultiplier,
  formatNumberDynamic,
  formatInfinityTime,
  calculateAscensionRequirements,
  calculateGhostChipBudget,
  calculateGhostChipUpgradeCost,
  calculateGainedIP,
  calculateIPBonusMultiplier,
  calculateInfinityCountBonus,
  calculateGeneratorProductionRates,
  calculateIC9TimeBasedBonus,
  calculateRadianceMultiplier,
} from "./idle-game-calculator.mjs";

//---------------
//工場画面切り替え
//---------------
/**
 * 工場画面のUI一式（content, embeds, components）を生成する
 * @param {object} uiData - getSingleUserUIDataから取得したデータ
 * @param {boolean} [isFinal=false] - コレクター終了時の表示か
 * @returns {object} interaction.replyに渡せるオプションオブジェクト
 */
export function buildFactoryView(uiData, isFinal = false) {
  // contentを組み立てるロジックを idle.mjs から持ってくる
  let content = "";
  if (uiData.uiContext?.messages?.length > 0) {
    content += uiData.uiContext.messages.join("\n") + "\n";
  }
  const remainingMs = uiData.idleGame.buffExpiresAt
    ? uiData.idleGame.buffExpiresAt.getTime() - new Date().getTime()
    : 0;
  const remainingHours = remainingMs / (1000 * 60 * 60);
  if (remainingHours > 24) {
    content +=
      "ニョボシが働いている(残り24時間以上)時はブーストは延長されません。";
  } else {
    content +=
      "⏫ ピザ窯を覗いてから **24時間** はニョワミヤの流入量が **2倍** になります！";
  }

  return {
    content: content,
    embeds: [generateFactoryEmbed(uiData, isFinal)],
    components: generateFactoryButtons(uiData, isFinal),
  };
}

/**
 * スキル画面のUI一式を生成する
 * @param {object} uiData
 * @returns {object}
 */
export function buildSkillView(uiData) {
  return {
    content: " ", // スキル画面に固有のメッセージがあればここに書く
    embeds: [generateSkillEmbed(uiData.idleGame)],
    components: generateSkillButtons(uiData.idleGame),
  };
}

/**
 * インフィニティジェネーレーター画面のUI一式を生成する
 * @param {object} uiData
 * @returns {object}
 */
export function buildInfinityView(uiData) {
  return {
    content:
      "ジェネレーターは、一つ下のジェネレーターを生む。追加購入をする度に、その効果は倍になる。\n一番下のジェネレーターは、∞に応じたGPを生む。GPはMultを強化する。",
    embeds: [generateInfinityEmbed(uiData)], //実績も渡す様にuiDataに変更
    components: generateInfinityButtons(uiData.idleGame),
  };
}

/**
 * インフィニティアップグレード画面のUI一式を生成する
 * @param {object} uiData
 * @returns {object}
 */
export function buildInfinityUpgradesView(uiData) {
  return {
    content: " ",
    embeds: [generateInfinityUpgradesEmbed(uiData.idleGame, uiData.point)],
    components: generateInfinityUpgradesButtons(uiData.idleGame, uiData.point),
  };
}

/**
 * インフィニティチャレンジ画面のUI一式を生成する
 * @param {object} uiData
 * @returns {object}
 */
export function buildChallengeView(uiData) {
  return {
    content: " ",
    embeds: [generateChallengeEmbed(uiData.idleGame)],
    components: generateChallengeButtons(uiData.idleGame),
  };
}

//--------------------
//メイン画面
//--------------------
/**
 * 工場画面のメインEmbedを生成する
 * @param {object} uiData - getSingleUserUIDataから返された、UI描画に必要な全てのデータを含むオブジェクト
 * @param {boolean} [isFinal=false] - コレクターが終了した最終表示かどうか。trueの場合、色などを変更する
 * @returns {EmbedBuilder}
 */
function generateFactoryEmbed(uiData, isFinal = false) {
  // ★★★ 受け取ったuiDataから、必要な変数を取り出す ★★★
  const {
    idleGame,
    point,
    displayData,
    userAchievement,
    mee6Level,
    achievementCount,
  } = uiData;
  const population_d = new Decimal(idleGame.population);
  const highestPopulation_d = new Decimal(idleGame.highestPopulation);
  const { productionRate_d, factoryEffects, skill1Effect, meatEffect } =
    displayData;
  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);
  const purchasedUpgrades = new Set(idleGame.ipUpgrades?.upgrades || []);
  const meatFactoryLevel = mee6Level;
  const activeChallenge = idleGame.challenges?.activeChallenge;
  const skillLevels = {
    s1: idleGame.skillLevel1,
    s2: idleGame.skillLevel2,
    s3: idleGame.skillLevel3,
    s4: idleGame.skillLevel4,
  };
  const radianceMultiplier = calculateRadianceMultiplier(idleGame);
  //アセンション回数
  const ascensionCount = idleGame.ascensionCount || 0;
  const ascensionEffect =
    ascensionCount > 0
      ? Math.pow(config.idle.ascension.effect, ascensionCount)
      : 1;
  //ジェネレーター
  const gp_d = new Decimal(idleGame.generatorPower || "1");
  let baseGpExponent = 0.5;
  if (purchasedUpgrades.has("IU42")) {
    baseGpExponent += config.idle.infinityUpgrades.tiers[3].upgrades.IU42.bonus;
  }
  if (purchasedUpgrades.has("IU74")) {
    baseGpExponent += config.idle.infinityUpgrades.tiers[6].upgrades.IU74.bonus;
  }
  const gpEffect = gp_d.pow(baseGpExponent).max(1).toNumber();

  // スキル#2の効果
  const skill2Effect = (1 + skillLevels.s2) * radianceMultiplier;
  const finalSkill2Effect = Math.pow(skill2Effect, 2);
  const skill2EffectDisplay =
    finalSkill2Effect > 1 ? ` × ${finalSkill2Effect.toFixed(1)}` : "";

  //IC2ボーナス
  let ic2BonusForOne = 1.0;
  const completedChallenges =
    uiData.idleGame.challenges?.completedChallenges || [];
  if (completedChallenges.includes("IC2")) {
    ic2BonusForOne = Math.pow(skill2Effect, 0.5);
    if (ic2BonusForOne < 1.0) ic2BonusForOne = 1.0;
  }

  // IU24「惑星間高速道路」の効果を計算
  let iu24Effect = 1.0;
  if (purchasedUpgrades.has("IU24")) {
    const iu24Config = config.idle.infinityUpgrades.tiers[1].upgrades.IU24;
    const infinityCount = idleGame.infinityCount || 0;
    // 8工場それぞれにかかる倍率なので、ここではまだ累乗しない
    iu24Effect = 1 + infinityCount * iu24Config.bonus;
  }

  // 表示用の施設効果
  const effects_display = {};
  for (const [factoryName, factoryConfig] of Object.entries(
    config.idle.factories
  )) {
    // (IC9中は上位3施設が無効になるため、ここで事前チェック)
    if (activeChallenge === "IC9" && factoryConfig.type === "multiplicative2") {
      effects_display[factoryName] = 1.0;
      continue; // ループの次のイテレーションへ
    }
    // ベースとなる工場効果を取得
    const baseEffect = factoryEffects[factoryName] || 1.0;

    // 8施設共通で適用される倍率を先にまとめておく
    let multiplier = ascensionEffect * gpEffect * iu24Effect;
    // 施設タイプに応じた倍率を計算する
    if (
      factoryConfig.type === "additive" ||
      factoryConfig.type === "multiplicative"
    ) {
      // 基本5施設（additive, multiplicative）には skill1Effect を乗算
      multiplier *= skill1Effect;
    } else if (factoryConfig.type === "multiplicative2") {
      // 上位3施設（multiplicative2）には ic2BonusForOne を乗算
      multiplier *= ic2BonusForOne;
    }
    // 最終的な効果を計算して格納
    effects_display[factoryName] = baseEffect * multiplier;
  }

  // ★ バフ残り時間計算
  let buffField = null;
  if (idleGame.buffExpiresAt && new Date(idleGame.buffExpiresAt) > new Date()) {
    const ms = new Date(idleGame.buffExpiresAt) - new Date();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    buffField = `**${formatNumberDynamic(idleGame.buffMultiplier)}倍** 残り **${hours}時間${minutes}分**`;
  }

  let descriptionText;
  let ascensionText = "";
  if (ascensionCount > 0) {
    ascensionText = ` <:nyowamiyarika:1264010111970574408>+${ascensionCount}`;
  }
  if (idleGame.prestigeCount > 0 || idleGame.infinityCount > 0) {
    descriptionText = `ニョワミヤ人口: **${formatNumberJapanese_Decimal(population_d)} 匹**
最高人口: **${formatNumberJapanese_Decimal(highestPopulation_d)} 匹**
PP: **${(idleGame.prestigePower || 0).toFixed(2)}** | SP: **${idleGame.skillPoints.toFixed(2)}** | TP: **${formatNumberDynamic(idleGame.transcendencePoints)}**
#1:${skillLevels.s1} #2:${skillLevels.s2} #3:${skillLevels.s3} #4:${skillLevels.s4} / #5:${idleGame.skillLevel5} #6:${idleGame.skillLevel6} #7:${idleGame.skillLevel7} #8:${idleGame.skillLevel8}
🌿${achievementCount}/${config.idle.achievements.length} 基本5施設${skill1Effect.toFixed(2)}倍${ascensionText}`;
  } else {
    descriptionText = `ニョワミヤ人口: **${formatNumberJapanese_Decimal(population_d)} 匹**
🌿${achievementCount}/${config.idle.achievements.length} 基本5施設${skill1Effect.toFixed(2)}倍`;
  }

  const costs = calculateAllCosts(idleGame);

  const embed = new EmbedBuilder()
    .setTitle("ピザ工場ステータス")
    .setColor(isFinal ? "Grey" : "Gold")
    .setDescription(descriptionText);
  // --- ループで施設のFieldを追加 ---
  let hasShownFirstLocked = false;
  for (const [name, factoryConfig] of Object.entries(config.idle.factories)) {
    // --- この施設が解禁されているかを判定 ---
    let isUnlocked = true;
    if (
      factoryConfig.unlockPopulation &&
      !idleGame.prestigeCount &&
      population_d.lt(factoryConfig.unlockPopulation)
    ) {
      isUnlocked = false;
    }
    if (
      factoryConfig.unlockAchievementId &&
      !unlockedSet.has(factoryConfig.unlockAchievementId)
    ) {
      isUnlocked = false;
    }
    if (!isUnlocked && hasShownFirstLocked) {
      // 2つ目以降の未解禁施設は、何もせずスキップ
      continue;
    }
    // --- 表示するテキストを準備 ---
    const effectText = formatNumberDynamic(
      effects_display[name],
      name === "oven" ? 0 : 2
    );
    const valueText = isUnlocked
      ? `Lv. ${idleGame[factoryConfig.key] || 0} (${effectText}) Next.${costs[name].toLocaleString()}©`
      : `(要: ${
          factoryConfig.unlockAchievementId
            ? `実績「${config.idle.achievements[factoryConfig.unlockAchievementId].name}」`
            : `人口 ${formatNumberJapanese_Decimal(new Decimal(factoryConfig.unlockPopulation))}`
        })`;

    embed.addFields({
      name: `${factoryConfig.emoji} ${factoryConfig.name}`, // configから名前を取得
      value: valueText,
      inline: true,
    });
    if (!isUnlocked) {
      // 未解禁施設を表示したら、フラグを立てる
      hasShownFirstLocked = true;
    }
  }

  // --- 固定のFieldを追加 ---
  embed.addFields(
    {
      name: `${config.idle.meat.emoji}精肉工場 (Mee6)`,
      value: `Lv. ${activeChallenge === "IC4" ? "**0**" : meatFactoryLevel} (${meatEffect.toFixed(2)})`,
      inline: true,
    },
    {
      name: "🔥ブースト",
      value: buffField || "ブースト切れ",
      inline: true,
    },
    {
      name: "計算式",
      value: (() => {
        // ★ 即時関数で囲んで、中でロジックを組む
        const baseFactors = [
          formatNumberDynamic(effects_display.oven),
          formatNumberDynamic(effects_display.cheese),
          formatNumberDynamic(effects_display.tomato),
          formatNumberDynamic(effects_display.mushroom),
          formatNumberDynamic(effects_display.anchovy),
        ];

        // 上位施設が解禁されていて、効果が1.0より大きい場合のみ追加
        if (effects_display.olive > 1.0) {
          baseFactors.push(formatNumberDynamic(effects_display.olive));
        }
        if (effects_display.wheat > 1.0) {
          baseFactors.push(formatNumberDynamic(effects_display.wheat));
        }
        if (effects_display.pineapple > 1.0) {
          baseFactors.push(formatNumberDynamic(effects_display.pineapple));
        }

        const baseFormula = `(${baseFactors.join(" × ")})`;

        return `${baseFormula} ^ ${meatEffect.toFixed(2)} × ${formatNumberDynamic(idleGame.buffMultiplier, 1)}${skill2EffectDisplay}`;
      })(),
    },
    {
      name: "毎分の増加予測",
      value: `${formatNumberJapanese_Decimal(productionRate_d)} 匹/分`,
    },
    {
      name: "人口ボーナス(チップ獲得量)",
      value: `${config.casino.currencies.legacy_pizza.emoji}+${idleGame.pizzaBonusPercentage.toFixed(3)} %`,
    }
  );

  embed.setFooter({
    text: `現在の所持チップ: ${Math.floor(point.legacy_pizza).toLocaleString()}枚`,
  });
  return embed;
}

/**
 * 工場画面のボタンコンポーネント一式を生成する
 * @param {object} uiData - getSingleUserUIDataから返された、UI描画に必要な全てのデータを含むオブジェクト
 * @param {boolean} [isDisabled=false] - 全てのボタンを無効化するかどうか
 * @returns {ActionRowBuilder[]}
 */
function generateFactoryButtons(uiData, isDisabled = false) {
  // ★★★ 必要な変数を取り出す ★★★
  const { idleGame, point, userAchievement } = uiData;
  const population_d = new Decimal(idleGame.population);
  const highestPopulation_d = new Decimal(idleGame.highestPopulation);
  // ボタンを描画するたびに、コストを再計算する
  const costs = calculateAllCosts(idleGame);
  const components = [];
  //ブースト延長
  //ブーストの残り時間を計算 (ミリ秒で)
  const now = new Date();
  const remainingMs = idleGame.buffExpiresAt
    ? idleGame.buffExpiresAt.getTime() - now.getTime()
    : 0;
  const remainingHours = remainingMs / (1000 * 60 * 60);
  // 残り時間に応じて、ニョボシの雇用コストを決定（1回目500,2回目1000)
  let nyoboshiCost = 0;
  let nyoboshiemoji = "1293141862634229811";
  if (remainingHours > 0 && remainingHours < 24) {
    nyoboshiCost = 500;
  } else if (remainingHours >= 24 && remainingHours < 48) {
    nyoboshiCost = 1000;
    nyoboshiemoji = "1396542940096237658";
  } else if (remainingHours >= 48) {
    nyoboshiCost = 999999; //そもそもすぐ下を見ればわかるがこの時は押せないわけで無言の圧もとい絵文字用
    nyoboshiemoji = "1414076963592736910";
  }
  // ボタンを無効化する条件を決定
  const isNyoboshiDisabled =
    isDisabled || // 全体的な無効化フラグ
    remainingHours >= 48 || // 残り48時間以上
    point.legacy_pizza < nyoboshiCost || // チップが足りない
    nyoboshiCost === 0; // コストが0 (バフが切れているなど)

  if (idleGame.prestigePower >= 8) {
    const autoAllocateRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("idle_auto_allocate")
        .setLabel("適当に強化(全チップ)")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("1416912717725438013")
        .setDisabled(isDisabled)
    );
    // 条件を満たした場合のみ、この行をcomponents配列に追加します
    components.push(autoAllocateRow);
  }

  const facilityRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`idle_upgrade_oven`)
      .setEmoji(config.idle.factories.oven.emoji)
      .setLabel(`+${config.idle.factories.oven.effect}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isDisabled || point.legacy_pizza < costs.oven),
    new ButtonBuilder()
      .setCustomId(`idle_upgrade_cheese`)
      .setEmoji(config.idle.factories.cheese.emoji)
      .setLabel(`+${config.idle.factories.cheese.effect}`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(isDisabled || point.legacy_pizza < costs.cheese)
  );
  //トマトキノコアンチョビはgte グレーターザンイコールで見る
  if (
    idleGame.prestigeCount > 0 ||
    population_d.gte(config.idle.factories.tomato.unlockPopulation)
  ) {
    // ★ .gte()で比較
    facilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`idle_upgrade_tomato`)
        .setEmoji(config.idle.factories.tomato.emoji)
        .setLabel(`+${config.idle.factories.tomato.effect}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(isDisabled || point.legacy_pizza < costs.tomato)
    );
  }
  if (
    idleGame.prestigeCount > 0 ||
    population_d.gte(config.idle.factories.mushroom.unlockPopulation)
  ) {
    // ★ .gte()で比較
    facilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`idle_upgrade_mushroom`)
        .setEmoji(config.idle.factories.mushroom.emoji)
        .setLabel(`+${config.idle.factories.mushroom.effect}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isDisabled || point.legacy_pizza < costs.mushroom)
    );
  }
  if (
    idleGame.prestigeCount > 0 ||
    population_d.gte(config.idle.factories.anchovy.unlockPopulation)
  ) {
    // ★ .gte()で比較
    facilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`idle_upgrade_anchovy`)
        .setEmoji(config.idle.factories.anchovy.emoji)
        .setLabel(`+${config.idle.factories.anchovy.effect}`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(isDisabled || point.legacy_pizza < costs.anchovy)
    );
  }
  components.push(facilityRow);
  //Lv6~8
  const advancedFacilityRow = new ActionRowBuilder();
  const unlockedAchievements = new Set(
    userAchievement.achievements?.unlocked || []
  ); // ★ 実績情報を取得

  // オリーブ農園のボタン
  if (unlockedAchievements.has(73)) {
    // 73: 極限に至る道
    advancedFacilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_upgrade_olive")
        .setEmoji(config.idle.factories.olive.emoji)
        .setLabel(`+${config.idle.factories.olive.effect}`)
        .setStyle(ButtonStyle.Secondary) // 色を分けると分かりやすい
        .setDisabled(
          isDisabled || point.legacy_pizza < (costs.olive || Infinity)
        )
    );
  }

  // 小麦の品種改良のボタン
  if (unlockedAchievements.has(74)) {
    // 74: 原点への回帰
    advancedFacilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_upgrade_wheat")
        .setEmoji(config.idle.factories.wheat.emoji)
        .setLabel(`+${config.idle.factories.wheat.effect}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(
          isDisabled || point.legacy_pizza < (costs.wheat || Infinity)
        )
    );
  }

  // パイナップル農場のボタン
  if (unlockedAchievements.has(66)) {
    // 66: 工場の試練
    advancedFacilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_upgrade_pineapple")
        .setEmoji(config.idle.factories.pineapple.emoji)
        .setLabel(`+${config.idle.factories.pineapple.effect}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(
          isDisabled || point.legacy_pizza < (costs.pineapple || Infinity)
        )
    );
  }
  //アセンションは9個目みたいなノリで入る
  const purchasedIUs = new Set(idleGame.ipUpgrades?.upgrades || []);
  // アセンションの要件を計算する
  const ascensionCount = idleGame.ascensionCount || 0;
  const activeChallenge = idleGame.challenges?.activeChallenge;
  const { requiredPopulation_d, requiredChips } =
    calculateAscensionRequirements(
      ascensionCount,
      idleGame.skillLevel6,
      purchasedIUs,
      activeChallenge
    );
  // アセンションボタンを表示する条件を定義
  // 1. 人口が要件を満たしている
  // 2. チップが要件を満たしている
  // 3. 8つの施設がアンロックされているか (実績#78=全施設Lv1以上で代用)
  const canAscend =
    population_d.gte(requiredPopulation_d) &&
    point.legacy_pizza >= requiredChips &&
    unlockedAchievements.has(78); // 実績#78: 今こそ目覚めの時
  if (population_d.gte(requiredPopulation_d)) {
    advancedFacilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_ascension") // 新しいID
        .setLabel(`アセンション (${requiredChips}©)`)
        .setStyle(ButtonStyle.Danger) // 重大なリセットなのでDanger
        .setEmoji("🚀") // 宇宙へ！
        .setDisabled(isDisabled || !canAscend)
    );
  }
  //Lv6~8解禁でボタンの行を挿入
  if (advancedFacilityRow.components.length > 0) {
    components.push(advancedFacilityRow);
  }
  //ブースト関連の行
  //ブーストボタンを後から追加
  const boostRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("idle_extend_buff")
      .setLabel(
        nyoboshiCost >= 999999
          ? "ニョボシは忙しそうだ…"
          : `ニョボシを雇う (+24h) (${nyoboshiCost.toLocaleString()}枚)`
      )
      .setStyle(ButtonStyle.Success)
      .setEmoji(nyoboshiemoji)
      .setDisabled(isNyoboshiDisabled)
  );
  if (idleGame.prestigePower >= 8) {
    //SP強化
    boostRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_show_skills") // スキル画面に切り替えるID
        .setLabel("SPを使用")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✨")
        .setDisabled(isDisabled)
    );
  }

  // 250923 プレステージボタンの表示ロジック
  if (
    population_d.gt(highestPopulation_d) &&
    population_d.gte(config.idle.prestige.unlockPopulation)
  ) {
    // --- ケース1: PP/SP/(e16でTP)が手に入る通常のプレステージ ---
    // 1. purchasedIUsを準備（アセンションコスト計算から流用、またはここで再度定義）
    const purchasedIUs = new Set(idleGame.ipUpgrades?.upgrades || []);
    // 2. 基本となるPPを計算し、変数をletに変更
    let newPrestigePower = population_d.log10();
    // 3. IU21を所持しているかチェックし、ボーナスを乗算
    if (purchasedIUs.has("IU21")) {
      const bonus = config.idle.infinityUpgrades.tiers[1].upgrades.IU21.bonus;
      newPrestigePower *= 1 + bonus;
    }
    const powerGain = newPrestigePower - idleGame.prestigePower;
    let prestigeButtonLabel;
    if (idleGame.prestigeCount === 0) {
      // 条件1: prestigeCountが0の場合
      prestigeButtonLabel = `プレステージ Power: ${newPrestigePower.toFixed(3)}`;
    } else if (population_d.lt("1e16")) {
      //lower than
      // 条件2: populationが1e16未満の場合
      prestigeButtonLabel = `Prestige Power: ${newPrestigePower.toFixed(2)} (+${powerGain.toFixed(2)})`;
    } else {
      // 条件3: それ以外 (populationが1e16以上) の場合
      const potentialTP = calculatePotentialTP(
        population_d,
        idleGame.skillLevel8,
        idleGame.challenges
      ); // 先に計算しておくとスッキリします
      prestigeButtonLabel = `Reset PP${newPrestigePower.toFixed(2)}(+${powerGain.toFixed(2)}) TP+${formatNumberDynamic(potentialTP)}`;
    }

    boostRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`idle_prestige`)
        .setEmoji(config.idle.prestige.emoji)
        .setLabel(prestigeButtonLabel)
        .setStyle(ButtonStyle.Danger) // フルリセットなので危険な色
        .setDisabled(isDisabled)
    );
  } else if (population_d.lt(highestPopulation_d) && population_d.gte("1e16")) {
    // --- ケース2: TPだけ手に入る新しいプレステージ ---
    const potentialTP = calculatePotentialTP(
      population_d,
      idleGame.skillLevel8,
      idleGame.challenges
    );

    boostRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`idle_prestige`) // 同じIDでOK
        .setEmoji("🍤") // 天ぷらなのでエビフライ！
        .setLabel(`TP獲得リセット (+${formatNumberDynamic(potentialTP)} TP)`)
        .setStyle(ButtonStyle.Success) // 報酬がもらえるのでポジティブな色
        .setDisabled(isDisabled)
    );
  }
  //遊び方のボタン
  boostRow.addComponents(
    new ButtonBuilder()
      .setCustomId("idle_info")
      .setLabel("遊び方")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("💡")
      .setDisabled(isDisabled)
  );
  if (boostRow.components.length > 0) {
    components.push(boostRow);
  }

  //infinityRow
  const infinityRow = new ActionRowBuilder();
  // Infinityを1回以上経験している場合、「ジェネレーター」画面への切り替えボタンを追加
  if (idleGame.infinityCount > 0) {
    infinityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_show_infinity")
        .setLabel("ジェネレーター")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🌌")
        .setDisabled(isDisabled)
    );
  }
  // 人口がインフィニティに到達した場合、「インフィニティ実行」ボタンを追加
  if (population_d.gte(config.idle.infinity)) {
    const challengeCompletedCount =
      idleGame.challenges?.completedChallenges?.length || 0;
    const potentialIP = calculateGainedIP(idleGame, challengeCompletedCount);
    const buttonLabel = `インフィニット ${formatNumberDynamic_Decimal(potentialIP)} IP`;

    infinityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_infinity")
        .setLabel(buttonLabel) // ★生成したラベルをここに設定
        .setStyle(ButtonStyle.Danger)
        .setEmoji("💥")
        .setDisabled(isDisabled)
    );
  }
  infinityRow.addComponents(
    new ButtonBuilder()
      .setCustomId("idle_show_settings") // 新しいID
      .setLabel("設定")
      .setStyle(ButtonStyle.Secondary) // 他のユーティリティボタンと統一
      .setEmoji("⚙️") // 設定の定番絵文字
      .setDisabled(isDisabled)
  );
  // infinityRowにボタンが1つでも追加されていたら、components配列にpushする
  if (infinityRow.components.length > 0) {
    components.push(infinityRow);
  }

  //5行のボタンを返信
  return components;
}

//-------------------
//スキル
//-------------------
/**
 * スキル強化画面のEmbedを生成する
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {EmbedBuilder}
 */
function generateSkillEmbed(idleGame) {
  const skillLevels = {
    s1: idleGame.skillLevel1 || 0,
    s2: idleGame.skillLevel2 || 0,
    s3: idleGame.skillLevel3 || 0,
    s4: idleGame.skillLevel4 || 0,
  };

  const costs = {
    s1: Math.pow(2, skillLevels.s1),
    s2: Math.pow(2, skillLevels.s2),
    s3: Math.pow(2, skillLevels.s3),
    s4: Math.pow(2, skillLevels.s4),
  };

  const effects = {
    // 光輝の効果を先に計算
    radianceMultiplier: calculateRadianceMultiplier(idleGame),
  };

  // --- TPスキル計算 (新規) ---
  const tp_levels = {
    s5: idleGame.skillLevel5 || 0,
    s6: idleGame.skillLevel6 || 0,
    s7: idleGame.skillLevel7 || 0,
    s8: idleGame.skillLevel8 || 0,
  };
  const tp_configs = config.idle.tp_skills;
  const tp_costs = {
    s5:
      tp_configs.skill5.baseCost *
      Math.pow(tp_configs.skill5.costMultiplier, tp_levels.s5),
    s6:
      tp_configs.skill6.baseCost *
      Math.pow(tp_configs.skill6.costMultiplier, tp_levels.s6),
    s7:
      tp_configs.skill7.baseCost *
      Math.pow(tp_configs.skill7.costMultiplier, tp_levels.s7),
    s8:
      tp_configs.skill8.baseCost *
      Math.pow(tp_configs.skill8.costMultiplier, tp_levels.s8),
  };

  let descriptionText = `SP: **${idleGame.skillPoints.toFixed(2)}** TP: **${formatNumberDynamic(idleGame.transcendencePoints)}**`;

  // TPをまだ獲得したことがない場合のみ、初心者向けメッセージを追加
  if (idleGame.transcendencePoints === 0) {
    descriptionText += "\n(初回は#1強化を強く推奨します)";
  }

  // ボタンが欠ける問題に関する案内を常に追加する
  // 引用(>)を使うと、他のテキストと区別しやすくなります。
  descriptionText += `\n-# スマホ等でボタンが欠ける場合、\`/放置ゲーム 開始画面:スキル画面\`をお試しください。`;

  const embed = new EmbedBuilder()
    .setTitle("✨ スキル強化 ✨")
    .setColor("Purple")
    .setDescription(descriptionText)
    .addFields(
      {
        name: `#1 燃え上がるピザ工場 x${skillLevels.s1}`,
        value: `基本5施設の効果 **x${((1 + skillLevels.s1) * effects.radianceMultiplier).toFixed(2)}** → **x${((1 + skillLevels.s1 + 1) * effects.radianceMultiplier).toFixed(2)}**  (コスト: ${costs.s1} SP)`,
      },
      {
        name: `#2 加速する時間 x${skillLevels.s2}`,
        value: (() => {
          // ★★★ 計算が複雑になるので、即時関数で囲むとスッキリします ★★★
          const currentEffect = Math.pow(
            (1 + skillLevels.s2) * effects.radianceMultiplier,
            2
          );
          const nextEffect = Math.pow(
            (1 + skillLevels.s2 + 1) * effects.radianceMultiplier,
            2
          );
          return `ゲームスピード **x${currentEffect.toFixed(2)}** → **x${nextEffect.toFixed(2)}** (コスト: ${costs.s2} SP)`;
        })(),
      },
      {
        name: `#3 ニョボシの怒り x${skillLevels.s3}`,
        value: `ニョボチップ収量 **x${((1 + skillLevels.s3) * effects.radianceMultiplier).toFixed(2)}** → **x${((1 + skillLevels.s3 + 1) * effects.radianceMultiplier).toFixed(2)}**(コスト: ${costs.s3} SP)`,
      },
      {
        name: `#4 【光輝10】 x${skillLevels.s4}`,
        value: `スキル#1~3の効果 **x${effects.radianceMultiplier.toFixed(2)}** → **x${(effects.radianceMultiplier + 0.1).toFixed(2)}**(コスト: ${costs.s4} SP)`,
      }
    );
  if (idleGame.prestigePower >= 16) {
    const currentDiscount = 1 - calculateDiscountMultiplier(tp_levels.s6);
    const nextDiscount = 1 - calculateDiscountMultiplier(tp_levels.s6 + 1);
    // ▼▼▼ #7で表示するための消費チップ量を計算 ▼▼▼
    // BigInt を Decimal に変換し、新しいフォーマッターを使い、更にIC1のクリアでeternity依存になる
    const completedChallenges = new Set(
      idleGame.challenges?.completedChallenges || []
    );
    const isIc1Completed = completedChallenges.has("IC1");
    const spentChipsForDisplay_d = isIc1Completed
      ? new Decimal(idleGame.chipsSpentThisEternity?.toString() || "0")
      : new Decimal(idleGame.chipsSpentThisInfinity?.toString() || "0");
    const descriptionForSkill7 = isIc1Completed
      ? tp_configs.skill7.descriptionIc1 // IC1クリア後の説明文
      : tp_configs.skill7.description; // 通常の説明文

    // 3. 表示用にフォーマット
    const spentChipsFormatted = formatNumberJapanese_Decimal(
      spentChipsForDisplay_d
    );
    const skill7power = 0.1 * tp_levels.s7;

    embed.addFields(
      { name: "---TPスキル---", value: "\u200B" },
      {
        name: `#5 熱々ポテト x${tp_levels.s5}`,
        value: `${tp_configs.skill5.description} コスト: ${formatNumberDynamic(tp_costs.s5, 1)} TP`,
      },
      {
        name: `#6 スパイシーコーラ x${tp_levels.s6}`,
        value: `${tp_configs.skill6.description} **${(currentDiscount * 100).toFixed(2)}%** → **${(nextDiscount * 100).toFixed(2)}%** コスト: ${formatNumberDynamic(tp_costs.s6, 1)} TP`,
      },
      {
        name: `#7 山盛りのチキンナゲット x${tp_levels.s7}`,
        value: `${descriptionForSkill7}(**${spentChipsFormatted}枚**)^${skill7power.toFixed(1)} コスト: ${formatNumberDynamic(tp_costs.s7, 1)} TP`,
      },
      {
        name: `#8 至高の天ぷら x${tp_levels.s8}`, // TenPura
        value: `${tp_configs.skill8.description} コスト: ${formatNumberDynamic(tp_costs.s8, 1)} TP`,
      }
    );
  }

  return embed;
}

/**
 * スキル強化画面のボタンを生成する
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {ActionRowBuilder[]}
 */
function generateSkillButtons(idleGame) {
  // スキルレベルとコストをここで一括計算
  const skillLevels = {
    s1: idleGame.skillLevel1 || 0,
    s2: idleGame.skillLevel2 || 0,
    s3: idleGame.skillLevel3 || 0,
    s4: idleGame.skillLevel4 || 0,
  };
  const costs = {
    s1: Math.pow(2, skillLevels.s1),
    s2: Math.pow(2, skillLevels.s2),
    s3: Math.pow(2, skillLevels.s3),
    s4: Math.pow(2, skillLevels.s4),
  };
  const tp_levels = {
    s5: idleGame.skillLevel5 || 0,
    s6: idleGame.skillLevel6 || 0,
    s7: idleGame.skillLevel7 || 0,
    s8: idleGame.skillLevel8 || 0,
  };
  const tp_configs = config.idle.tp_skills;
  const tp_costs = {
    s5:
      tp_configs.skill5.baseCost *
      Math.pow(tp_configs.skill5.costMultiplier, tp_levels.s5),
    s6:
      tp_configs.skill6.baseCost *
      Math.pow(tp_configs.skill6.costMultiplier, tp_levels.s6),
    s7:
      tp_configs.skill7.baseCost *
      Math.pow(tp_configs.skill7.costMultiplier, tp_levels.s7),
    s8:
      tp_configs.skill8.baseCost *
      Math.pow(tp_configs.skill8.costMultiplier, tp_levels.s8),
  };

  const activeChallenge = idleGame.challenges?.activeChallenge;

  const skillRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("idle_upgrade_skill_1")
      .setLabel("#1強化")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(idleGame.skillPoints < costs.s1),
    new ButtonBuilder()
      .setCustomId("idle_upgrade_skill_2")
      .setLabel("#2強化")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(idleGame.skillPoints < costs.s2),
    new ButtonBuilder()
      .setCustomId("idle_upgrade_skill_3")
      .setLabel("#3強化")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(idleGame.skillPoints < costs.s3),
    new ButtonBuilder()
      .setCustomId("idle_upgrade_skill_4")
      .setLabel("#4強化")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(
        idleGame.skillPoints < costs.s4 || activeChallenge === "IC5"
      ), //IC5でも押せない
    new ButtonBuilder()
      .setCustomId("idle_skill_reset") // 新しいID
      .setLabel("SPリセット")
      .setStyle(ButtonStyle.Danger) // 危険な操作なので赤色に
      .setEmoji("🔄")
      // SPが1以上、または何かしらのスキルが振られていないと押せないようにする
      .setDisabled(
        idleGame.skillPoints < 1 &&
          idleGame.skillLevel1 === 0 &&
          idleGame.skillLevel2 === 0 &&
          idleGame.skillLevel3 === 0 &&
          idleGame.skillLevel4 === 0
      )
  );
  const components = [skillRow];

  if (idleGame.prestigePower >= 16) {
    const tpSkillRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("idle_upgrade_skill_5")
        .setLabel("#5強化(TP)")
        .setStyle(ButtonStyle.Success) // TPスキルは緑色に
        .setDisabled(idleGame.transcendencePoints < tp_costs.s5),
      new ButtonBuilder()
        .setCustomId("idle_upgrade_skill_6")
        .setLabel("#6強化(TP)")
        .setStyle(ButtonStyle.Success)
        .setDisabled(idleGame.transcendencePoints < tp_costs.s6),
      new ButtonBuilder()
        .setCustomId("idle_upgrade_skill_7")
        .setLabel("#7強化(TP)")
        .setStyle(ButtonStyle.Success)
        .setDisabled(idleGame.transcendencePoints < tp_costs.s7),
      new ButtonBuilder()
        .setCustomId("idle_upgrade_skill_8")
        .setLabel("#8強化(TP)")
        .setStyle(ButtonStyle.Success)
        .setDisabled(idleGame.transcendencePoints < tp_costs.s8)
    );
    components.push(tpSkillRow);
  }

  const utilityRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("idle_show_factory") // 工場画面に戻るためのID
      .setLabel("工場画面に戻る")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏭")
  );
  components.push(utilityRow);

  return components;
}

//-------------------
//インフィニティジェネレーター
//-------------------
/**
 * インフィニティ画面のEmbedを生成する（ジェネレーター）
 * @param {object} uiData - getSingleUserUIDataから取得したUI描画用データ
 * @returns {EmbedBuilder}
 */
function generateInfinityEmbed(uiData) {
  //データを取り出す
  const { idleGame, userAchievement } = uiData;
  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);
  const ip_d = new Decimal(idleGame.infinityPoints);
  const infinityCount = idleGame.infinityCount || 0;
  //GPとその効果を計算するロジックを追加
  const gp_d = new Decimal(idleGame.generatorPower || "1");
  // GPの効果を計算: GP ^ 0.5
  const purchasedUpgrades = new Set(idleGame.ipUpgrades?.upgrades || []);
  let baseGpExponent = 0.5;
  if (purchasedUpgrades.has("IU42")) {
    //0.5 -> 0.75
    baseGpExponent += config.idle.infinityUpgrades.tiers[3].upgrades.IU42.bonus;
  }
  if (purchasedUpgrades.has("IU74")) {
    baseGpExponent += config.idle.infinityUpgrades.tiers[6].upgrades.IU74.bonus;
  }
  // GPが1未満になることは通常ないが、念のため .max(1) で最低1倍を保証
  const gpEffect_d = gp_d.pow(baseGpExponent).max(1);
  const infinityDescription = `IP: ${formatNumberDynamic_Decimal(ip_d)} | ∞: ${Math.floor(infinityCount).toLocaleString()}
GP: ${formatNumberDynamic_Decimal(gp_d)}^${baseGpExponent.toFixed(3)} (全工場効果 x${formatNumberDynamic_Decimal(gpEffect_d, 2)} 倍)`;
  const productionRates = calculateGeneratorProductionRates(
    idleGame,
    unlockedSet
  );
  const embed = new EmbedBuilder()
    .setTitle("🌌 インフィニティジェネレーター 🌌")
    .setColor("Aqua")
    .setDescription(infinityDescription);

  // ユーザーのジェネレーター進行状況を取得 (データがない場合は空の配列)
  const userGenerators = idleGame.ipUpgrades?.generators || [];

  // configをループしてフィールドを動的に生成
  for (const generatorConfig of config.idle.infinityGenerators) {
    const index = generatorConfig.id - 1;

    // --- 表示条件のチェック ---
    if (index > 0) {
      // ジェネレーターII (index=1) 以降が対象
      const prevGeneratorData = userGenerators[index - 1];
      // 1つ前のジェネレーターの購入数(bought)が0なら、このジェネレーターは表示しない
      if (!prevGeneratorData || prevGeneratorData.bought === 0) {
        break; // 以降のジェネレーターも表示しないのでループを抜ける
      }
    }

    // --- 表示するデータを準備 ---
    const generatorData = userGenerators[index] || { amount: "0", bought: 0 };
    const amount_d = new Decimal(generatorData.amount);
    const bought = generatorData.bought;
    // 仮のコスト計算 (将来的にはcalculator.mjsに)
    const cost = new Decimal(generatorConfig.baseCost).times(
      new Decimal(generatorConfig.costMultiplier).pow(bought)
    );

    //レートを取得
    // productionRatesは[G1レート, G2レート,...]の順なので、(id-1)でアクセス
    const rate_d = productionRates[generatorConfig.id - 1] || new Decimal(0);
    const targetName =
      generatorConfig.id === 1 ? "GP" : `G${generatorConfig.id - 1}`;

    embed.addFields({
      name: `G${generatorConfig.id} ${generatorConfig.name} (購入: ${bought})`,
      value:
        `所持数: ${formatNumberDynamic_Decimal(amount_d)}` +
        ` | 生産速度: **${formatNumberDynamic_Decimal(rate_d)} ${targetName}/分**` +
        `\nコスト: ${formatNumberDynamic_Decimal(cost)} IP`,
      inline: false,
    });
  }

  return embed;
}

/**
 * インフィニティ画面のボタンを生成する
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {ActionRowBuilder[]}
 */
function generateInfinityButtons(idleGame) {
  const components = [];
  let currentRow = new ActionRowBuilder();
  const userGenerators = idleGame.ipUpgrades?.generators || [];
  const ip_d = new Decimal(idleGame.infinityPoints);

  for (const generatorConfig of config.idle.infinityGenerators) {
    const index = generatorConfig.id - 1;

    // --- 表示条件のチェック ---
    if (index > 0) {
      const prevGeneratorData = userGenerators[index - 1];
      if (!prevGeneratorData || prevGeneratorData.bought === 0) {
        break;
      }
    }

    // --- ボタンのデータを準備 ---
    const generatorData = userGenerators[index] || { amount: "0", bought: 0 };
    // 仮のコスト計算
    const cost = new Decimal(generatorConfig.baseCost).times(
      new Decimal(generatorConfig.costMultiplier).pow(generatorData.bought)
    );

    currentRow.addComponents(
      new ButtonBuilder()
        // IDの命名規則を意識
        .setCustomId(`idle_generator_buy_${generatorConfig.id}`)
        .setLabel(`G${generatorConfig.id} 購入`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(ip_d.lt(cost)) // IPが足りなければ無効化
    );

    // 1行に4つのボタンを置く (5つだとスマホで詰まることがあるため)
    if (currentRow.components.length === 4) {
      components.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  }

  // ループ後、中途半端な行があればそれも追加
  if (currentRow.components.length > 0) {
    components.push(currentRow);
  }

  // 最後に「工場画面に戻る」ボタンを追加
  const utilityRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("idle_show_factory")
      .setLabel("工場画面に戻る")
      .setStyle(ButtonStyle.Primary) // 色を変えて目立たせる
      .setEmoji("🏭"),
    new ButtonBuilder()
      .setCustomId("idle_show_iu_upgrades") // 新しいID
      .setLabel("アップグレード")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("💡")
  );
  if (idleGame.ipUpgrades?.upgrades?.includes("IU22")) {
    utilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_show_challenges")
        .setLabel("チャレンジ")
        .setStyle(ButtonStyle.Success) // 新しいコンテンツなので目立つ色に
        .setEmoji("⚔️")
    );
  }
  components.push(utilityRow);

  return components;
}

//------------------------
//アップグレード
//------------------------
/**
 * 【新規】インフィニティアップグレード画面のEmbedを生成する
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {EmbedBuilder}
 */
function generateInfinityUpgradesEmbed(idleGame, point) {
  const ip_d = new Decimal(idleGame.infinityPoints);
  const purchasedUpgrades = new Set(idleGame.ipUpgrades.upgrades || []);
  const currentLevel = idleGame.ipUpgrades?.ghostChipLevel || 0; //IU11のLVをあらかじめ取る
  // 【取得済み】リストの作成 (変更なし)
  const purchasedList =
    config.idle.infinityUpgrades.tiers
      .flatMap((tier) => Object.entries(tier.upgrades))
      .filter(([id]) => purchasedUpgrades.has(id))
      .map(([id, config]) => {
        // まず基本となるテキストを生成
        let displayText = `✅${config.name}: ${config.text}`;

        // もしIDがIU33かIU34なら、動的な倍率情報を付け加える
        if (id === "IU11") {
          displayText += ` Lv.${currentLevel}`;
        } else if (id === "IU33" || id === "IU34") {
          const multiplier = calculateIPBonusMultiplier(id, ip_d);
          displayText += ` (現在x${multiplier.toFixed(3)}倍)`;
        } else if (id === "IU41") {
          const bonus = calculateInfinityCountBonus(idleGame.infinityCount);
          displayText += ` (現在x${bonus.toFixed(3)}倍)`;
        } else if (id === "IU51" || id === "IU52" || id === "IU53") {
          // mapの第二引数であるconfigオブジェクトをそのまま渡す
          const multiplier = calculateIC9TimeBasedBonus(idleGame, config);
          displayText += ` (現在x${multiplier.toFixed(3)}倍)`;
        } else if (id === "IU55") {
          const multiplier =
            Math.log10((idleGame.infinityCount || 0) + 1) * config.bonusBase +
            1;
          displayText += ` (現在x${multiplier.toFixed(3)}倍)`;
        } else if (id === "IU65") {
          const multiplier =
            Math.log10((idleGame.infinityCount || 0) + 1) /
              config.bonusDivisor +
            1.0;
          displayText += ` (現在x${multiplier.toFixed(3)}倍)`;
        } else if (id === "IU63") {
          const bonus =
            1 + Math.log10((idleGame.infinityCount || 0) + 1) * config.bonus;
          displayText += ` (現在x${bonus.toFixed(3)}倍)`;
        } else if (id === "IU64") {
          // config変数を直接利用
          const bonus =
            1 + Math.log10((idleGame.infinityCount || 0) + 1) * config.bonus;
          displayText += ` (現在x${bonus.toFixed(3)}倍)`;
        }

        // 最終的に生成したテキストを返す
        return displayText;
      })
      .join("\n") || "まだありません";

  const embed = new EmbedBuilder()
    .setTitle("🌌 インフィニティアップグレード 🌌")
    .setColor("Aqua")
    .setDescription(
      `IP: **${formatNumberDynamic_Decimal(ip_d)}** | ${config.casino.currencies.legacy_pizza.emoji}: **${Math.floor(point.legacy_pizza).toLocaleString()}枚**\n\n**【取得済み】**\n${purchasedList}`
    );

  if (purchasedUpgrades.has("IU11")) {
    const budget = calculateGhostChipBudget(currentLevel);
    embed.addFields({
      name: `\n--- ${config.idle.infinityUpgrades.tiers[0].upgrades.IU11.name} ---`, // Configから名前を取得
      value: `プレステージの度に幻のチップを得て工場を自動強化します。\n**現在Lv.${currentLevel} / 200  | 次回リセット時の予算: ${budget.toLocaleString()}©**`,
    });
  }

  //iu73
  if (purchasedUpgrades.has("IU73")) {
    const iu73Config = config.idle.infinityUpgrades.tiers[6].upgrades.IU73;
    const bestTime = idleGame.challenges?.bestInfinityRealTime;
    let valueText = "まだ自己最速記録がありません。";

    if (bestTime && bestTime > 0) {
      // ▼▼▼ ここをcalculatorと同じロジックに修正 ▼▼▼
      const adjustedBestTime =
        bestTime > 0.3 ? Math.max(0.3, bestTime - 0.5) : bestTime;
      // ▲▲▲ ここまで修正 ▲▲▲

      const chipsSpent_d = new Decimal(idleGame.chipsSpentThisEternity || "0");
      const iu62Multiplier = Math.floor(chipsSpent_d.add(1).log10() + 1);
      const infinitiesPerHour =
        (1 / (adjustedBestTime * iu73Config.rateDivisor)) *
        3600 *
        iu62Multiplier;

      valueText = `自己最速記録: **${formatInfinityTime(bestTime)}** (min(${formatInfinityTime(bestTime)},max(${formatInfinityTime(adjustedBestTime)},0.3秒))\n受動的収入: **${formatNumberDynamic(infinitiesPerHour, 2)} ∞/h**(現実時間)`;
    }

    embed.addFields({
      name: `\n--- 🔭 ${iu73Config.name} ---`,
      value: valueText,
    });
  }

  // --- 表示すべきTierを決定するロジック ---
  let displayTier = null;
  for (const tier of config.idle.infinityUpgrades.tiers) {
    const tierUpgradeIds = Object.keys(tier.upgrades);
    const isTierComplete = tierUpgradeIds.every((id) =>
      purchasedUpgrades.has(id)
    );
    if (!isTierComplete) {
      displayTier = tier;
      break; // 未完了のTierが見つかったら、それを表示対象とする
    }
  }
  // 全て完了していたら、最後のTierを表示する
  if (!displayTier) {
    displayTier = config.idle.infinityUpgrades.tiers.at(-1);
  }

  // --- 購入可能なアップグレードをFieldとして追加 ---
  embed.addFields({
    name: `\n--- Tier ${displayTier.id} ---`,
    value: "\u200B",
  });

  // forループの中から、IU11に関する特別処理を削除するだけでOK
  for (const [id, upgradeConfig] of Object.entries(displayTier.upgrades)) {
    const status = purchasedUpgrades.has(id)
      ? "✅ 購入済み"
      : `**${formatNumberDynamic(upgradeConfig.cost)} IP**`;
    embed.addFields({
      name: `${upgradeConfig.name} [${status}]`,
      value: upgradeConfig.description,
      inline: false,
    });
  }

  return embed;
}

/**
 * 【新規】インフィニティアップグレード画面のボタンを生成する
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {ActionRowBuilder[]}
 */
function generateInfinityUpgradesButtons(idleGame, point) {
  const components = [];
  const ip_d = new Decimal(idleGame.infinityPoints);
  const purchasedUpgrades = new Set(idleGame.ipUpgrades.upgrades || []);

  // Embed生成時と同じロジックで表示Tierを決定
  let displayTier = null;
  // ... (generateInfinityUpgradesEmbedと同じTier決定ロジックをここにコピー) ...
  for (const tier of config.idle.infinityUpgrades.tiers) {
    const tierUpgradeIds = Object.keys(tier.upgrades);
    const isTierComplete = tierUpgradeIds.every((id) =>
      purchasedUpgrades.has(id)
    );
    if (!isTierComplete) {
      displayTier = tier;
      break;
    }
  }
  if (!displayTier) {
    displayTier = config.idle.infinityUpgrades.tiers.at(-1);
  }

  // --- 購入ボタンの行を作成 ---
  // ゴーストチップ
  if (purchasedUpgrades.has("IU11")) {
    const ghostChipRow = new ActionRowBuilder();
    const currentLevel = idleGame.ipUpgrades?.ghostChipLevel || 0;
    const cost = calculateGhostChipUpgradeCost(currentLevel);
    //  purchasedUpgradesに応じて動的にレベルキャップを決定
    const currentCap = purchasedUpgrades.has("IU54")
      ? config.idle.ghostChip.levelCap2nd
      : config.idle.ghostChip.levelCap;

    ghostChipRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_iu_upgrade_ghostchip") // 新しい固有名詞ID
        .setLabel(
          `ゴーストチップ強化(Lv.${currentLevel} -> ${currentLevel + 1})  ${cost.toLocaleString()}©`
        )
        .setStyle(ButtonStyle.Primary) // IP購入ボタン(Success)と区別
        .setEmoji(config.casino.currencies.legacy_pizza.emoji)
        .setDisabled(point.legacy_pizza < cost || currentLevel >= currentCap)
    );
    // 強化ボタンの行をcomponents配列の先頭に追加
    components.unshift(ghostChipRow);
  }
  //IP
  const purchaseRow = new ActionRowBuilder();
  for (const [id, upgradeConfig] of Object.entries(displayTier.upgrades)) {
    purchaseRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`idle_iu_purchase_${id}`)
        .setLabel(`「${upgradeConfig.name}」購入`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(purchasedUpgrades.has(id) || ip_d.lt(upgradeConfig.cost))
    );
  }
  if (purchaseRow.components.length > 0) components.push(purchaseRow);

  // --- ナビゲーションボタンの行を作成 ---
  const navigationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("idle_show_factory")
      .setLabel("工場画面へ")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏭"),
    new ButtonBuilder()
      .setCustomId("idle_show_infinity")
      .setLabel("ジェネレーター画面へ")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🌌")
  );
  components.push(navigationRow);

  return components;
}

//------------------------
//インフィニティチャレンジ
//------------------------
/**
 * インフィニティチャレンジ画面のEmbedを生成する
 * @param {object} idleGame - ユーザーの放置ゲームデータ (`IdleGame` モデルのインスタンス)
 * @returns {EmbedBuilder}
 */
function generateChallengeEmbed(idleGame) {
  const completed = new Set(idleGame.challenges?.completedChallenges || []);
  const active = idleGame.challenges?.activeChallenge || null;

  const embed = new EmbedBuilder()
    .setTitle("⚔️ インフィニティチャレンジ ⚔️")
    .setColor("DarkRed")
    .setDescription(
      "呪い(縛り)を受けながらインフィニティを目指す試練です。\nチャレンジを開始すると、強制的にインフィニティリセットが行われます。\n【注意】現在ICは難易度調整期間です。クリアは保障されていません"
    );

  const completedCount = completed.size;
  const challengesToShow = config.idle.infinityChallenges.filter((chal) => {
    // もしチャレンジがIC9なら、クリア数が8以上の時だけ表示する
    if (chal.id === "IC9") {
      return completedCount >= 8;
    }
    // それ以外のチャレンジは常に表示
    return true;
  });

  for (const chal of challengesToShow) {
    let status = "未挑戦";
    if (active === chal.id) status = "挑戦中";
    else if (completed.has(chal.id)) status = "✅ 達成済み";
    let bonusText = `**報酬:** ${chal.bonus}`;
    // チャレンジがIC9で、かつベストタイムが記録されている場合
    if (chal.id === "IC9" && idleGame.challenges?.IC9?.bestTime) {
      const bestTimeFormatted = formatInfinityTime(
        idleGame.challenges.IC9.bestTime
      );
      // 報酬テキストにベストタイムを追記
      bonusText += `\n**自己ベスト（現実時間):** ${bestTimeFormatted}`;
    }

    embed.addFields({
      name: `${chal.id}: ${chal.name} [${status}]`,
      value: `**縛り:** ${chal.description}\n**報酬:** ${bonusText}`,
    });
  }
  return embed;
}

/**
 * インフィニティチャレンジ画面のボタンを生成する
 * @param {object} idleGame - ユーザーの放置ゲームデータ (`IdleGame` モデルのインスタンス)
 * @returns {ActionRowBuilder[]}
 */
function generateChallengeButtons(idleGame) {
  const completed = new Set(idleGame.challenges?.completedChallenges || []);
  const active = idleGame.challenges?.activeChallenge || null;
  const components = [];

  // ▼▼▼ 1. 表示するチャレンジを動的にフィルタリング ▼▼▼
  const completedCount = completed.size;
  const challengesToShow = config.idle.infinityChallenges.filter((chal) => {
    if (chal.id === "IC9") {
      return completedCount >= 8;
    }
    return true;
  });

  // ▼▼▼ 2. フィルタリングされたリストでボタンを生成 ▼▼▼
  for (let i = 0; i < challengesToShow.length; i += 4) {
    const row = new ActionRowBuilder();
    const chunk = challengesToShow.slice(i, i + 4);

    for (const chal of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`idle_start_challenge_${chal.id}`)
          .setLabel(`${chal.id} 開始`)
          .setStyle(
            chal.id === "IC9" ? ButtonStyle.Success : ButtonStyle.Primary
          ) // IC9だけ色を変えて特別感を出す
          //クリア済み(ただしIC9を除く)、あるいはプレイ中は押せない
          .setDisabled(
            (completed.has(chal.id) && chal.id !== "IC9") || !!active
          )
      );
    }
    components.push(row);
  }

  // 挑戦中のチャレンジがある場合、「中止ボタン」の行を追加
  if (active) {
    const abortRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("idle_abort_challenge")
        .setLabel("チャレンジを中止する")
        .setStyle(ButtonStyle.Danger)
    );
    components.push(abortRow);
  }

  // 「戻るボタン」の行を追加
  const navigationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("idle_show_infinity")
      .setLabel("ジェネレーター画面へ戻る")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🌌")
  );
  components.push(navigationRow);

  return components;
}

//-------------------------
//プロフィールカード
//-------------------------
/**
 * プロフィールカード用のコンパクトなEmbedを生成する
 * @param {object} uiData - getSingleUserUIDataから返されたオブジェクト
 * @param {import("discord.js").User} user - Discordのユーザーオブジェクト
 * @returns {EmbedBuilder}
 */
export function generateProfileEmbed(uiData, user) {
  const { idleGame, achievementCount, userAchievement } = uiData;
  const population_d = new Decimal(idleGame.population);
  const highestPopulation_d = new Decimal(idleGame.highestPopulation);
  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);

  const formattedTime = formatInfinityTime(idleGame.infinityTime);

  const formattedChipsEternity = formatNumberJapanese_Decimal(
    new Decimal(idleGame.chipsSpentThisEternity?.toString() || "0")
  );
  //アセンション
  const ascensionCount = idleGame.ascensionCount || 0;
  let ascensionText = "";
  if (ascensionCount > 0) {
    ascensionText = ` <:nyowamiyarika:1264010111970574408>+${ascensionCount}`;
  }
  //ジェネレーター
  let generatorText = "";
  // インフィニティを1回以上経験している場合のみ処理
  if (idleGame.infinityCount > 0) {
    const generators = idleGame.ipUpgrades?.generators || [];
    const boughtCounts = [];

    // ローマ数字の配列
    const romanNumerals = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ"];

    for (let i = 0; i < generators.length; i++) {
      const bought = generators[i]?.bought || 0;
      // 購入数が1以上の場合のみ表示リストに追加
      if (bought > 0) {
        boughtCounts.push(`${romanNumerals[i]}:**${bought}**`);
      }
    }

    // 表示するジェネレーターが1つ以上あれば、テキストを組み立てる
    if (boughtCounts.length > 0) {
      const gp_d = new Decimal(idleGame.generatorPower || "1");
      generatorText = `\nGP:**${formatNumberDynamic_Decimal(gp_d, 0)}** | ${boughtCounts.join(" ")}`;
    }
  }
  //ICクリア数
  const completedICCount =
    uiData.idleGame.challenges?.completedChallenges?.length || 0;
  const icCountText = completedICCount > 0 ? ` | ⚔️${completedICCount}/9` : "";

  const formattedEternityTime = formatInfinityTime(idleGame.eternityTime || 0);
  //工場
  const factoryLevels = [];
  for (const [name, factoryConfig] of Object.entries(config.idle.factories)) {
    // --- この施設が解禁されているかを判定 ---
    let isUnlocked = true;
    if (
      factoryConfig.unlockPopulation &&
      !idleGame.prestigeCount &&
      population_d.lt(factoryConfig.unlockPopulation)
    ) {
      isUnlocked = false;
    }
    if (
      factoryConfig.unlockAchievementId &&
      !unlockedSet.has(factoryConfig.unlockAchievementId)
    ) {
      isUnlocked = false;
    }

    // 解禁済みの場合のみ表示する
    const level = idleGame[factoryConfig.key] || 0;
    if (isUnlocked) {
      factoryLevels.push(`${factoryConfig.emoji}Lv.${level}`);
    }
  }
  const factoryLevelsString = factoryLevels.join(" ");

  // Descriptionを組み立てる
  const description = [
    `<:nyowamiyarika:1264010111970574408>: **${formatNumberJapanese_Decimal(population_d)} 匹** | Max<a:nyowamiyarika_color2:1265940814350127157>: **${formatNumberJapanese_Decimal(highestPopulation_d)} 匹**`,
    `${factoryLevelsString} 🌿${achievementCount}/${config.idle.achievements.length}${ascensionText} 🔥x${new Decimal(idleGame.buffMultiplier).toExponential(2)}`,
    `PP: **${(idleGame.prestigePower || 0).toFixed(2)}** | SP: **${(idleGame.skillPoints || 0).toFixed(2)}** | TP: **${formatNumberDynamic(idleGame.transcendencePoints || 0)}**`,
    `#1:${idleGame.skillLevel1 || 0} #2:${idleGame.skillLevel2 || 0} #3:${idleGame.skillLevel3 || 0} #4:${idleGame.skillLevel4 || 0} / #5:${idleGame.skillLevel5 || 0} #6:${idleGame.skillLevel6 || 0} #7:${idleGame.skillLevel7 || 0} #8:${idleGame.skillLevel8 || 0}`,
    `IP: **${formatNumberDynamic_Decimal(new Decimal(idleGame.infinityPoints))}** | ∞: **${Math.floor(idleGame.infinityCount || 0).toLocaleString()}**${icCountText} | ∞⏳: ${formattedTime}${generatorText}`,
    `Σternity(合計) | ${config.casino.currencies.legacy_pizza.emoji}: **${formattedChipsEternity}枚** | ⏳: **${formattedEternityTime}** | Score: **${formatNumberDynamic(idleGame.rankScore, 4)}**`,
  ].join("\n");

  return new EmbedBuilder()
    .setTitle(`${user.displayName}さんのピザ工場`)
    .setColor("Aqua") // 通常のEmbedと色を変えて区別
    .setDescription(description)
    .setTimestamp();
}

//-----------------------
//ランキング
//------------------------
/**
 * 人口ランキングを表示し、ページめくり機能を担当する関数
 * @param {import("discord.js").CommandInteraction} interaction - 元のインタラクション
 * @param {boolean} isPrivate - この表示を非公開(ephemeral)にするか (デフォルト: public)
 */
export async function executeRankingCommand(interaction, isPrivate) {
  await interaction.reply({
    content: "ランキングを集計しています...",
    ephemeral: isPrivate,
  });

  const excludedUserId = "1123987861180534826";

  // rankScoreカラムを直接使い、降順(DESC)で並べ替える
  const allIdleGames = await IdleGame.findAll({
    where: {
      userId: { [Op.ne]: excludedUserId },
      rankScore: { [Op.gt]: 0 }, // スコアが0より大きいユーザーのみ対象
    },
    order: [
      ["rankScore", "DESC"], // 'rankScore'を大きい順に並べる
    ],
    limit: 100,
    raw: true,
  });

  if (allIdleGames.length === 0) {
    await interaction.editReply({
      content: "まだ誰もニョワミヤを集めていません。",
    });
    return;
  }

  const itemsPerPage = 10;
  const totalPages = Math.ceil(allIdleGames.length / itemsPerPage);
  let currentPage = 0;

  const generateEmbed = async (page) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = allIdleGames.slice(start, end);

    const rankingFields = await Promise.all(
      currentItems.map(async (game, index) => {
        const rank = start + index + 1;
        let displayName;
        try {
          const member =
            interaction.guild.members.cache.get(game.userId) ||
            (await interaction.guild.members.fetch(game.userId));
          displayName = member.displayName;
        } catch (e) {
          displayName = "(退会したユーザー)";
        }

        const score = game.rankScore
          ? formatNumberDynamic(game.rankScore, 4)
          : "N/A";
        const ip_d = new Decimal(game.infinityPoints);
        const population_d = new Decimal(game.population);

        // infinityCountが1以上の時IPを表示する（0IPでも∞済みなら表示する）
        const ipText =
          game.infinityCount > 0
            ? ` IP:**${formatNumberDynamic_Decimal(ip_d)}** | `
            : "";

        return {
          name: `**${rank}位** ${displayName}`,
          value: `└Score:**${score}** |${ipText} <:nyowamiyarika:1264010111970574408>:${formatNumberJapanese_Decimal(population_d)} 匹`,
          inline: false,
        };
      })
    );

    const myIndex = allIdleGames.findIndex(
      (game) => game.userId === interaction.user.id
    );
    let myRankText = "あなたはまだピザ工場を持っていません。";
    if (myIndex !== -1) {
      const myRank = myIndex + 1;
      // ★★★ 攻略法２（自分用） ★★★
      const myIp_d = new Decimal(allIdleGames[myIndex].infinityPoints);
      const myPopulation_d = new Decimal(allIdleGames[myIndex].population);

      const myScore = allIdleGames[myIndex].rankScore
        ? formatNumberDynamic(allIdleGames[myIndex].rankScore, 4)
        : "N/A";
      const myIpText =
        allIdleGames[myIndex].infinityCount > 0
          ? ` IP:**${formatNumberDynamic_Decimal(myIp_d)}** | `
          : "";
      myRankText = `**${myRank}位** └Score:**${myScore}** |${myIpText}<:nyowamiyarika:1264010111970574408>:${formatNumberJapanese_Decimal(myPopulation_d)} 匹`;
    }

    return new EmbedBuilder()
      .setTitle("👑 ピザ工場ランキング 👑")
      .setColor("Gold")
      .setFields(rankingFields)
      .setFooter({ text: `ページ ${page + 1} / ${totalPages}` })
      .addFields({ name: "📌 あなたの順位", value: myRankText });
  };
  const generateButtons = (page) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev_page")
        .setLabel("◀ 前へ")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("next_page")
        .setLabel("次へ ▶")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === totalPages - 1)
    );
  };

  const replyMessage = await interaction.editReply({
    content: "",
    embeds: [await generateEmbed(currentPage)],
    components: [generateButtons(currentPage)],
  });

  const filter = (i) => i.user.id === interaction.user.id;
  const collector = replyMessage.createMessageComponentCollector({
    filter,
    time: 120_000,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();
    if (i.customId === "next_page") currentPage++;
    else if (i.customId === "prev_page") currentPage--;

    await interaction.editReply({
      embeds: [await generateEmbed(currentPage)],
      components: [generateButtons(currentPage)],
    });
  });

  collector.on("end", async () => {
    // ★ 改善ポイント2：コレクター終了時のエラー対策 ★
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        generateButtons(currentPage).components.map((c) => c.setDisabled(true))
      );
      await interaction.editReply({ components: [disabledRow] });
    } catch (error) {
      // メッセージが削除済みの場合などのエラーを無視する
      console.warn(
        "ランキング表示の終了処理中にエラーが発生しました:",
        error.message
      );
    }
  });
}
