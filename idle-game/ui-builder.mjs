//idle-game\ui-builder.mjs
import Decimal from "break_infinity.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { IdleGame } from "../models/database.mjs";
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
  calculateGalaxyCost,
  calculateGalaxyUpgradeCost,
  calculateEternityBonuses,
  calculateGravityUpgradeCost,
  calculateCpGainCost,
  calculateGainedEP,
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
  const costs = calculateAllCosts(uiData.idleGame);
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
    embeds: [generateFactoryEmbed(uiData, costs, isFinal)],
    components: generateFactoryButtons(uiData, costs, isFinal),
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
    embeds: [
      generateSkillEmbed(uiData.idleGame, uiData.displayData.radianceMultiplier),
    ],
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
    components: generateInfinityButtons(uiData),
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

/**
 * エタニティ画面のUI一式を生成する
 * @param {object} uiData
 * @returns {object}
 */
export function buildEternityView(uiData) {
  return {
    content: " ",
    embeds: [generateEternityEmbed(uiData)],
    components: generateEternityButtons(uiData),
  };
}

//--------------------
//メイン画面
//--------------------
/**
 * 工場画面のメインEmbedを生成する
 * @param {object} uiData - getSingleUserUIDataから返された、UI描画に必要な全てのデータを含むオブジェクト
 * @param {object} costs - 埋め込みとボタンで共有する施設コスト
 * @param {boolean} [isFinal=false] - コレクターが終了した最終表示かどうか。trueの場合、色などを変更する
 * @returns {EmbedBuilder}
 */
function generateFactoryEmbed(uiData, costs, isFinal = false) {
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
  const {
    productionRate_d,
    factoryEffects,
    skill1Effect,
    meatEffect,
    singleFactoryMult_d,
    radianceMultiplier,
    eternityBonuses: bonuses,
  } = displayData;
  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);
  const purchasedUpgrades = new Set(idleGame.ipUpgrades?.upgrades || []);
  const completedChallenges =
    uiData.idleGame.challenges?.completedChallenges || [];
  const meatFactoryLevel = mee6Level;
  const activeChallenge = idleGame.challenges?.activeChallenge;
  const skillLevels = {
    s1: idleGame.skillLevel1,
    s2: idleGame.skillLevel2,
    s3: idleGame.skillLevel3,
    s4: idleGame.skillLevel4,
  };
  //アセンション回数
  const ascensionCount = idleGame.ascensionCount || 0;
  let ascensionBaseEffect = config.idle.ascension.effect; // 1.125
  if (idleGame.infinityCount > 0) {
    if (completedChallenges.includes("IC7")) {
      ascensionBaseEffect += 0.025;
    }
    if (purchasedUpgrades.has("IU23")) {
      ascensionBaseEffect +=
        config.idle.infinityUpgrades.tiers[1].upgrades.IU23.bonus;
    }
    if (completedChallenges.includes("IC8")) {
      ascensionBaseEffect *= 1.2;
    }
    // IU65 の効果を適用
    if (purchasedUpgrades.has("IU65")) {
      const iu65Config = config.idle.infinityUpgrades.tiers[5].upgrades.IU65;
      const infinityCount = idleGame.infinityCount || 0;
      const multiplier =
        Math.log10(infinityCount + 1) / iu65Config.bonusDivisor + 1.0;
      ascensionBaseEffect *= multiplier;
    }
  }
  if (bonuses.ascension > 1) {
    ascensionBaseEffect *= bonuses.ascension;
  }
  // ★ 修正: Math.pow ではなく Decimal の pow を使う ★
  const ascensionEffect_d = 
    ascensionCount > 0 ? new Decimal(ascensionBaseEffect).pow(ascensionCount) : new Decimal(1);
  //GP効果をDecimalで取得
  const gpEffect_d = singleFactoryMult_d;

  // スキル#2の効果
  const skill2Effect = (1 + skillLevels.s2) * radianceMultiplier;
  const finalSkill2Effect = Math.pow(skill2Effect, 2);
  const skill2EffectDisplay =
    finalSkill2Effect > 1 ? ` × ${finalSkill2Effect.toFixed(1)}` : "";

  //IC2ボーナス
  let ic2BonusForOne = 1.0;
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

  // 表示用の施設効果 (Decimalオブジェクトで保持)
  const effects_display_d = {}; // _d をつけてDecimalであることを示す
  for (const [factoryName, factoryConfig] of Object.entries(
    config.idle.factories
  )) {
    // (IC9中は上位3施設が無効になるため、ここで事前チェック)
    if (activeChallenge === "IC9" && factoryConfig.type === "multiplicative2") {
      effects_display_d[factoryName] = new Decimal(1.0);
      continue; // ループの次のイテレーションへ
    }
    // ベースとなる工場効果をDecimalで取得
    const baseEffect_d = new Decimal(factoryEffects[factoryName] || 1.0);

    // 8施設共通で適用される倍率を先にまとめておく (Decimalで計算)
    let multiplier_d = ascensionEffect_d
      .times(gpEffect_d)
      .times(iu24Effect)
      .times(bonuses.factory);
    // 施設タイプに応じた倍率を計算する
    if (
      factoryConfig.type === "additive" ||
      factoryConfig.type === "multiplicative"
    ) {
      // 基本5施設（additive, multiplicative）には skill1Effect を乗算
      multiplier_d = multiplier_d.times(skill1Effect);
    } else if (factoryConfig.type === "multiplicative2") {
      // 上位3施設（multiplicative2）には ic2BonusForOne を乗算
      multiplier_d = multiplier_d.times(ic2BonusForOne);
    }
    // 最終的な効果をDecimalオブジェクトとして格納
    effects_display_d[factoryName] = baseEffect_d.times(multiplier_d);
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
    if (population_d.lt(config.idle.infinity)) {
      const population_log10 = population_d.log10();
      const infinity_milestone_d = new Decimal(config.idle.infinity);
      const infinity_log10 = infinity_milestone_d.log10();
      // 対数ベースで進捗率（%）を計算
      // (現在の桁数 / 目標の桁数) * 100
      const progress_percentage = (population_log10 / infinity_log10) * 100;
      ascensionText += ` 無限への進捗度:${progress_percentage.toFixed(2)}%`;
    }
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
    const effectText = formatNumberDynamic_Decimal(
      effects_display_d[name],
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
        // 各工場の効果を、Decimalフォー-マッターで表示
        const baseFactors = Object.keys(config.idle.factories)
          .map((name) => {
            const effect_d = effects_display_d[name];
            // nameが'oven'なら、無条件で表示
            if (name === "oven") {
              return formatNumberDynamic_Decimal(effect_d, 0);
            }
            // それ以外の施設は、効果が1.0より大きい場合のみ表示
            if (effect_d.gt(1.0)) {
              return formatNumberDynamic_Decimal(effect_d);
            }

            return null;
          })
          .filter(Boolean);

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
      value: `${config.casino.currencies.legacy_pizza.emoji}+${formatNumberDynamic(idleGame.pizzaBonusPercentage)} %`,
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
 * @param {object} costs - 埋め込みとボタンで共有する施設コスト
 * @param {boolean} [isDisabled=false] - 全てのボタンを無効化するかどうか
 * @returns {ActionRowBuilder[]}
 */
function generateFactoryButtons(uiData, costs, isDisabled = false) {
  // ★★★ 必要な変数を取り出す ★★★
  const { idleGame, point, userAchievement } = uiData;
  const population_d = new Decimal(idleGame.population);
  const highestPopulation_d = new Decimal(idleGame.highestPopulation);
  const components = [];
  //工場強化非表示設定
  const hideFactoryButtons = idleGame.settings?.hideFactoryButtons === true;
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

  if (!hideFactoryButtons) {
    // 工場強化非表示がoffなら
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
  }
  //Lv6~8
  const advancedFacilityRow = new ActionRowBuilder();
  const unlockedAchievements = new Set(
    userAchievement.achievements?.unlocked || []
  ); // ★ 実績情報を取得

  if (!hideFactoryButtons) {
    // 同様に工場強化非表示がoffなら
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
  } //アセンションは非表示設定とは無関係
  //アセンションは9個目みたいなノリで入る
  const purchasedIUs = new Set(idleGame.ipUpgrades?.upgrades || []);
  // アセンションの要件を計算する
  const ascensionCount = idleGame.ascensionCount || 0;
  const activeChallenge = idleGame.challenges?.activeChallenge;
  const realityDiscountLevel =
    idleGame.epUpgrades?.chronoUpgrades?.realityDiscount || 0;
  const { requiredPopulation_d, requiredChips } =
    calculateAscensionRequirements(
      ascensionCount,
      idleGame.skillLevel6,
      purchasedIUs,
      activeChallenge,
      realityDiscountLevel
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
  // インフィニティ・エタニティ後は10回まとめても追加
  if (idleGame.infinityCount > 0 || idleGame.eternityCount > 0) {
    // 10回後のアセンションに必要な人口をチェック
    const reqsFor10 = calculateAscensionRequirements(
      ascensionCount + 9, // 0回目なら9, 10回目なら19...
      idleGame.skillLevel6,
      purchasedIUs,
      activeChallenge,
      realityDiscountLevel
    );

    advancedFacilityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_ascension_max") // 新しいID
        .setLabel("x10")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🚀")
        // 人口が10回分に足りているか、チップが最初の1回分に足りているか
        .setDisabled(
          isDisabled ||
            population_d.lt(reqsFor10.requiredPopulation_d) ||
            point.legacy_pizza < requiredChips
        )
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
  const ip_d = new Decimal(idleGame.infinityPoints);
  const eternityUnlockIP_d = new Decimal(config.idle.eternity.unlockIP);
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
  if (idleGame.eternityCount > 0) {
    infinityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_show_eternity")
        .setLabel("エタニティ")
        .setStyle(ButtonStyle.Primary)
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
  if (ip_d.gte(eternityUnlockIP_d)) {
    const potentialEP_d = calculateGainedEP(idleGame);
    const buttonLabel = `エターネート ${formatNumberDynamic_Decimal(potentialEP_d)} EP`;
    infinityRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_eternity")
        .setLabel(buttonLabel)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🌠")
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
 * @param {number} radianceMultiplier - 計算済みの光輝倍率
 * @returns {EmbedBuilder}
 */
function generateSkillEmbed(idleGame, radianceMultiplier) {
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
    radianceMultiplier,
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
  const { idleGame, userAchievement, displayData } = uiData;
  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);
  const ip_d = new Decimal(idleGame.infinityPoints);
  const infinityCount = idleGame.infinityCount || 0;
  const bonuses = displayData.eternityBonuses;
  //GPとその効果を計算するロジックを追加
  const gp_d = new Decimal(idleGame.generatorPower || "1");
  // GPの効果をuiDataから取り出す
  const baseGpExponent = displayData.baseGpExponent;
  // GPが1未満になることは通常ないが、念のため .max(1) で最低1倍を保証
  const gpEffect_d = displayData.singleFactoryMult_d.max(1);
  const softcapLabel = displayData.singleFactoryMult_d.gte("1e1000")
    ? "(ソフトキャップ)"
    : "";

  // #2スキル効果を計算
  const radianceMultiplier = displayData.radianceMultiplier;
  const skill2Level = idleGame.skillLevel2 || 0;
  const skill2Effect = Math.pow((1 + skill2Level) * radianceMultiplier, 2);
  // 説明文を組み立て
  const infinityDescription = `IP: ${formatNumberDynamic_Decimal(ip_d)} | ∞: ${Math.floor(infinityCount).toLocaleString()}
GP: ${formatNumberDynamic_Decimal(gp_d)}^${baseGpExponent.toFixed(3)} (全工場効果 x${formatNumberDynamic_Decimal(gpEffect_d, 2)} 倍${softcapLabel})
⏳ 時間加速: **x${formatNumberDynamic(skill2Effect, 2)}** 倍`;
  const { productionRates, gravityEffect } = calculateGeneratorProductionRates(
    idleGame,
    unlockedSet
  );
  const embed = new EmbedBuilder()
    .setTitle("🌌 インフィニティジェネレーター 🌌")
    .setColor("Aqua")
    .setDescription(infinityDescription);

  // ユーザーのジェネレーター進行状況を取得 (データがない場合は空の配列)
  const purchasedIUs = new Set(idleGame.ipUpgrades?.upgrades || []);
  const userGenerators = idleGame.ipUpgrades?.generators || [];

  let galaxyCount;
  let currentGalaxyBase;
  let currentGravityExponent;
  let galaxyData;
  const galaxyConfig = config.idle.galaxy;
  if (purchasedIUs.has("IU91")) {
    const currentGravity_d = new Decimal(idleGame.ipUpgrades?.gravity || "1");
    // TODO: calculatorからグラビティ産出量を計算する関数を呼び出す
    // 一旦ここで組み立てる。
    galaxyData = idleGame.ipUpgrades?.galaxy || {
      count: 0,
      baseValueUpgrades: 0,
      gravityExponentUpgrades: 0,
      chipBaseValueUpgrades: 0,
    };
    galaxyCount = galaxyData.count;
    // config と 購入回数 から現在の値を計算
    const chipLv = galaxyData.chipBaseValueUpgrades || 0;
    currentGalaxyBase =
      galaxyConfig.upgrades.baseValue.initial +
      (galaxyData.baseValueUpgrades + chipLv) *
        galaxyConfig.upgrades.baseValue.increment;
    currentGravityExponent =
      galaxyConfig.upgrades.gravityExponent.initial +
      galaxyData.gravityExponentUpgrades *
        galaxyConfig.upgrades.gravityExponent.increment;
    const gravityPerMinute_d =
      galaxyCount > 0
        ? new Decimal(currentGalaxyBase) // まずベース値をDecimal化
            .pow(galaxyCount) // 次にギャラクシー数分だけ累乗
            .times(config.idle.galaxy.productionBaseMultiplier) // その結果に基本倍率を掛ける
            .times(bonuses.gravity)
        : new Decimal(0); // ギャラクシーが0個なら0

    embed.addFields({
      name: "🪐 ギャラクシー",
      value: `${galaxyCount}個のギャラクシーが毎分${formatNumberDynamic_Decimal(gravityPerMinute_d, 3)}グラビティを産みます。
現在のグラビティ: **${formatNumberDynamic_Decimal(currentGravity_d)}**^${formatNumberDynamic(currentGravityExponent, 2)}\n全ジェネレーター強化倍率: **x${formatNumberDynamic_Decimal(gravityEffect)}**`,
      inline: false, // 他のフィールドと区切る
    });
  }

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

  if (purchasedIUs.has("IU91")) {
    // ギャラクシーのコスト計算
    const nextGalaxyCost = calculateGalaxyCost(galaxyCount);
    const nextBaseValueCost = calculateGalaxyUpgradeCost(
      "baseValue",
      galaxyData.baseValueUpgrades
    );
    const nextGravityExponentCost = calculateGalaxyUpgradeCost(
      "gravityExponent",
      galaxyData.gravityExponentUpgrades
    );

    embed.addFields([
      {
        name: "🪐 ギャラクシー数",
        value: `${galaxyCount} -> ${galaxyCount + 1}  (費用 ${formatNumberDynamic_Decimal(nextGalaxyCost)} IP)`,
        inline: true,
      },
      {
        name: "⚙ ベース値",
        value: `${currentGalaxyBase.toFixed(2)} -> ${(currentGalaxyBase + galaxyConfig.upgrades.baseValue.increment).toFixed(2)}  (費用 ${formatNumberDynamic_Decimal(nextBaseValueCost)} IP)`,
        inline: true,
      },
      {
        name: "🧲 グラビティ指数",
        value: `${currentGravityExponent.toFixed(2)} -> ${(currentGravityExponent + galaxyConfig.upgrades.gravityExponent.increment).toFixed(2)}  (費用 ${formatNumberDynamic_Decimal(nextGravityExponentCost)} IP)`,
        inline: true,
      },
    ]);
  }

  // --- グラビティアップグレードの情報を表示 ---
  const gravityUpgradesConfig = config.idle.gravityUpgrades;
  // 全てのアップグレードを一度に表示すると長すぎるので、購入可能なものやレベルが上がっているものを優先して表示する
  if (Object.keys(gravityUpgradesConfig).length > 0) {
    embed.addFields({
      name: "🪐 グラビティアップグレード",
      value: "グラビティを消費してアップグレードできます",
    });

    const gravity_d = new Decimal(idleGame.ipUpgrades?.gravity || "1");
    const upgrades = idleGame.ipUpgrades?.gravityUpgrades || {};

    for (const [id, config] of Object.entries(gravityUpgradesConfig)) {
      const level = upgrades[id] || 0;
      const cost = calculateGravityUpgradeCost(id, level);
      const isMaxLevel = level >= config.maxLevel;

      const status = isMaxLevel
        ? "✅ 最大"
        : `コスト: ${formatNumberDynamic_Decimal(cost)}`;

      embed.addFields({
        name: `${config.name} [Lv.${level}]`,
        value: `${config.description(level)}\n${status}`,
        inline: true, // 横並びにしてコンパクトに
      });
    }
  }

  return embed;
}

/**
 * インフィニティ画面のボタンを生成する
 * @param {object} uiData - getSingleUserUIDataから取得したUI描画用データ
 * @returns {ActionRowBuilder[]}
 */
function generateInfinityButtons(uiData) {
  const { idleGame, point } = uiData;
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

  const purchasedIUs = new Set(idleGame.ipUpgrades?.upgrades || []);
  if (purchasedIUs.has("IU91")) {
    const galaxyRow = new ActionRowBuilder();
    const galaxyData = idleGame.ipUpgrades?.galaxy || {
      count: 0,
      baseValueUpgrades: 0,
      gravityExponentUpgrades: 0,
      chipBaseValueUpgrades: 0,
    };
    const realityDiscountLevel =
      idleGame.epUpgrades?.chronoUpgrades?.realityDiscount || 0;

    // 各コストを計算
    const galaxyCost = calculateGalaxyCost(galaxyData.count);
    const baseValueCost = calculateGalaxyUpgradeCost(
      "baseValue",
      galaxyData.baseValueUpgrades
    );
    const chipCost = calculateGalaxyUpgradeCost(
      "chipBaseValue",
      galaxyData.chipBaseValueUpgrades || 0,
      realityDiscountLevel
    );
    const gravityExponentCost = calculateGalaxyUpgradeCost(
      "gravityExponent",
      galaxyData.gravityExponentUpgrades
    );

    galaxyRow.addComponents(
      new ButtonBuilder()
        .setCustomId("idle_galaxy_buy_galaxy")
        .setLabel("ギャラクシー購入")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🪐")
        .setDisabled(ip_d.lt(galaxyCost)),
      new ButtonBuilder()
        .setCustomId("idle_galaxy_upgrade_baseValue")
        .setLabel("ベース値強化")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⚙️")
        .setDisabled(ip_d.lt(baseValueCost)),
      new ButtonBuilder()
        .setCustomId("idle_galaxy_upgrade_chipBaseValue")
        .setLabel(
          `ベース値強化(${formatNumberJapanese_Decimal(new Decimal(chipCost))}©)`
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️")
        .setDisabled(point.legacy_pizza < chipCost),
      new ButtonBuilder()
        .setCustomId("idle_galaxy_upgrade_gravityExponent")
        .setLabel("グラビティ指数強化")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🧲")
        .setDisabled(ip_d.lt(gravityExponentCost)),
      new ButtonBuilder()
        .setCustomId("idle_generator_buy_all")
        .setLabel("ジェネレーター適当購入")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🤖")
        .setDisabled(ip_d.lt(1))
    );
    components.push(galaxyRow);
  }

  const gravityUpgradesConfig = config.idle.gravityUpgrades;
  if (Object.keys(gravityUpgradesConfig).length > 0) {
    const gravityUpgradeRow = new ActionRowBuilder();
    const gravity_d = new Decimal(idleGame.ipUpgrades?.gravity || "1");
    const upgrades = idleGame.ipUpgrades?.gravityUpgrades || {};

    for (const [id, config] of Object.entries(gravityUpgradesConfig)) {
      const level = upgrades[id] || 0;
      const cost = calculateGravityUpgradeCost(id, level);
      gravityUpgradeRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`idle_gravity_upgrade_${id}`)
          .setLabel(config.name)
          .setStyle(ButtonStyle.Success)
          .setDisabled(gravity_d.lt(cost) || level >= config.maxLevel)
      );
    }
    components.push(gravityUpgradeRow);
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
      `IP: **${formatNumberDynamic_Decimal(ip_d)}** | ∞: **${Math.floor(idleGame.infinityCount).toLocaleString()}** | ${config.casino.currencies.legacy_pizza.emoji}: **${Math.floor(point.legacy_pizza).toLocaleString()}枚**\n\n**【取得済み】**\n${purchasedList}`
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
    let fieldName = `--- 🔭 ${iu73Config.name} ---`;
    let valueText = "まだ自己最速記録がありません。";

    if (bestTime && bestTime > 0) {
      // ▼▼▼ ここをcalculatorと同じロジックに修正 ▼▼▼
      let adjustedBestTime =
        bestTime > 0.3 ? Math.max(0.3, bestTime - 0.5) : bestTime;
      if (purchasedUpgrades.has("IU81")) {
        adjustedBestTime = Math.max(0.001, adjustedBestTime / 3);
      }

      const bonuses = calculateEternityBonuses(idleGame.eternityCount);

      const chipsSpent_d = new Decimal(idleGame.chipsSpentThisEternity || "0");
      const iu62Multiplier = Math.floor(chipsSpent_d.add(1).log10() + 1);
      const gravityUpgrades = idleGame.ipUpgrades?.gravityUpgrades || {};
      const infGainBonus = 1 + (gravityUpgrades.infGain || 0);
      let telescopeMultiplier = 1.0;
      if (gravityUpgrades.telescopeBoost > 0) {
        const bonusConfig = config.idle.gravityUpgrades.telescopeBoost;
        telescopeMultiplier = Math.pow(
          bonusConfig.effectBase,
          gravityUpgrades.telescopeBoost
        );
      }
      const infinitiesPerHour =
        (1 / (adjustedBestTime * iu73Config.rateDivisor)) *
        3600 *
        iu62Multiplier *
        infGainBonus *
        telescopeMultiplier *
        bonuses.infinity;

      valueText =
        `自己最速記録: **${formatInfinityTime(bestTime)}**\n` +
        `スキル用時間: **${formatInfinityTime(adjustedBestTime)}**\n` +
        `受動的収入: **${formatNumberDynamic(infinitiesPerHour, 2)} ∞/h**(現実時間)`;

      // ★ IU81を所持している場合の追加処理 ★
      if (purchasedUpgrades.has("IU81")) {
        const iu81Config = config.idle.infinityUpgrades.tiers[7].upgrades.IU81;
        fieldName = `---🚀 ${iu81Config.name} & ${iu73Config.name} 🔭---`; // フィールド名をリッチに

        // ジェネレーター強化倍率を計算
        const bestTimeInMs = adjustedBestTime * 1000;
        const iu81Multiplier = 1 + iu81Config.max / bestTimeInMs;

        // valueTextに追記
        valueText += `\n全ジェネレーター強化: **x${formatNumberDynamic(iu81Multiplier, 3)}**`;
      }
    }

    embed.addFields({
      name: fieldName,
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

//--------------------------
//エタニティ
//--------------------------
/**
 * エタニティ画面のEmbedを生成する
 * @param {object} uiData
 * @returns {EmbedBuilder}
 */
function generateEternityEmbed(uiData) {
  const { idleGame } = uiData;
  const eternityCount = idleGame.eternityCount || 0;
  const eternityPoints = new Decimal(idleGame.eternityPoints || "0");
  const epUpgrades = idleGame.epUpgrades || {};
  const chronoPoints = new Decimal(epUpgrades.chronoPoints || "0");

  const embed = new EmbedBuilder()
    .setTitle("Σ エタニティ Σ")
    .setColor("White")
    .setDescription(
      `**${eternityCount} Σ** を達成し、**${formatNumberDynamic_Decimal(eternityPoints)} EP** を所持しています。\n` +
        `**${formatNumberDynamic_Decimal(chronoPoints)} CP** を所持しています。`
    );
  //CP
  const timesNyo = epUpgrades.cpGainedFrom?.nyowamiya || 0;
  const timesIp = epUpgrades.cpGainedFrom?.ip || 0;
  const timesEp = epUpgrades.cpGainedFrom?.ep || 0;

  const costNyo = calculateCpGainCost("nyowamiya", timesNyo);
  const costIp = calculateCpGainCost("ip", timesIp);
  const costEp = calculateCpGainCost("ep", timesEp);

  embed.addFields({
    name: "🕰️ クロノポイント獲得",
    value:
      `以下のリソースを捧げて、クロノポイント(CP)を獲得できます。` +
      `\n- **ニョワミヤ:** ${formatNumberDynamic_Decimal(costNyo)} 匹で 1 CP` +
      `\n- **IP:** ${formatNumberDynamic_Decimal(costIp)} IPで 1 CP` +
      `\n- **EP:** ${formatNumberDynamic_Decimal(costEp)} EPで 1 CP`,
  });

  // マイルストーンの表示
  const milestonesText = config.idle.eternity.milestones
    .map((milestone) => {
      const statusIcon = eternityCount >= milestone.count ? "✅" : "　";
      return `${statusIcon} **${milestone.count}Σ:** ${milestone.description}`;
    })
    .join("\n");
  embed.addFields({
    name: "🌌 エタニティマイルストーン",
    value: milestonesText,
  });

  // CPアップグレードの表示を追加
  const chronoUpgradesConfig = config.idle.eternity.chronoUpgrades;
  const currentChronoUpgrades = epUpgrades.chronoUpgrades || {};
  let chronoFieldsText = "";

  for (const [id, upgrade] of Object.entries(chronoUpgradesConfig)) {
    const level = currentChronoUpgrades[id] || 0;
    const cost = upgrade.cost(level);
    const isMaxLevel = level >= upgrade.maxLevel;
    const costText = isMaxLevel ? "✅" : `${cost} CP`;

    chronoFieldsText += `**${upgrade.name}** [Lv.${level}] (${costText})\n${upgrade.description(level)}\n`;
  }
  embed.addFields({
    name: "🌠 クロノアップグレード",
    value: chronoFieldsText || "利用可能なアップグレードはありません。",
  });

  // エタニティボーナスの表示 (マイルストーン#1達成時)
  if (eternityCount >= 1) {
    // ここに各ボーナスの現在値を表示するロジックを追加します
    // （次のステップで作成する計算関数を呼び出す想定）
    const bonuses = calculateEternityBonuses(eternityCount);
    let bonusText = `
- **Σ工場倍率:** x${formatNumberDynamic(bonuses.factory, 2)}
- **Σチップ獲得量:** x${formatNumberDynamic(bonuses.chips, 2)}
- **Σアセンションパワー:** x${formatNumberDynamic(bonuses.ascension, 3)}
- **Σインフィニティ獲得量:** x${formatNumberDynamic(bonuses.infinity, 2)}
- **Σジェネレーターパワー:** x${formatNumberDynamic(bonuses.gp, 2)}
- **Σグラビティ獲得量:** x${formatNumberDynamic(bonuses.gravity, 2)}
`;
    if (eternityCount >= 100) {
      bonusText += `- **ΣIP獲得量:** x${formatNumberDynamic(bonuses.ip, 2)}`;
    }
    embed.addFields({ name: "🌠 現在のエタニティボーナス", value: bonusText });
  }

  return embed;
}

/**
 * エタニティ画面のボタンを生成する (CP対応版)
 * @param {object} uiData
 * @returns {ActionRowBuilder[]}
 */
export function generateEternityButtons(uiData) {
  const components = [];
  const { idleGame } = uiData;

  const population_d = new Decimal(idleGame.population);
  const ip_d = new Decimal(idleGame.infinityPoints);
  const ep_d = new Decimal(idleGame.eternityPoints);
  const epUpgrades = idleGame.epUpgrades || {};
  const chronoPoints_d = new Decimal(epUpgrades.chronoPoints || "0");

  const cpGainRow = new ActionRowBuilder();

  // --- CP購入ボタン (ニョワミヤ) ---
  const nyoTimes = epUpgrades.cpGainedFrom?.nyowamiya || 0;
  const nyoCost = calculateCpGainCost("nyowamiya", nyoTimes);
  cpGainRow.addComponents(
    new ButtonBuilder()
      .setCustomId("idle_gain_max_cp_nyowamiya")
      .setLabel("CP購入 (ニョワミヤ)")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("<:nyowamiyarika:1264010111970574408>")
      .setDisabled(population_d.lt(nyoCost))
  );

  // --- CP購入ボタン (IP) ---
  const ipTimes = epUpgrades.cpGainedFrom?.ip || 0;
  const ipCost = calculateCpGainCost("ip", ipTimes);
  cpGainRow.addComponents(
    new ButtonBuilder()
      .setCustomId("idle_gain_max_cp_ip")
      .setLabel("CP購入 (IP)")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🌌")
      .setDisabled(ip_d.lt(ipCost))
  );

  // --- CP購入ボタン (EP) ---
  const epTimes = epUpgrades.cpGainedFrom?.ep || 0;
  const epCost = calculateCpGainCost("ep", epTimes);
  cpGainRow.addComponents(
    new ButtonBuilder()
      .setCustomId("idle_gain_max_cp_ep")
      .setLabel("CP購入 (EP)")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🌠")
      .setDisabled(ep_d.lt(epCost))
  );

  components.push(cpGainRow);

  // ★★★ CPアップグレードボタンを追加 ★★★
  const chronoUpgradesConfig = config.idle.eternity.chronoUpgrades;
  if (Object.keys(chronoUpgradesConfig).length > 0) {
    const chronoUpgradeRow = new ActionRowBuilder();
    const currentChronoUpgrades = epUpgrades.chronoUpgrades || {};

    for (const [id, upgrade] of Object.entries(chronoUpgradesConfig)) {
      const level = currentChronoUpgrades[id] || 0;
      const cost = upgrade.cost(level);
      const isMaxLevel = level >= upgrade.maxLevel;

      chronoUpgradeRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`idle_chrono_upgrade_${id}`)
          .setLabel(upgrade.name)
          .setStyle(ButtonStyle.Success)
          .setDisabled(chronoPoints_d.lt(cost) || isMaxLevel)
      );
    }
    const hasPurchasedAny = Object.values(currentChronoUpgrades).some(
      (lv) => lv > 0
    );

    if (hasPurchasedAny) {
      chronoUpgradeRow.addComponents(
        new ButtonBuilder()
          .setCustomId("idle_chrono_reset")
          .setLabel("CP振り直し")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔄")
      );
    }
    // ボタンが1つでもあれば行を追加
    if (chronoUpgradeRow.components.length > 0) {
      components.push(chronoUpgradeRow);
    }
  }

  // 既存のナビゲーションボタン
  const navigationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("idle_show_factory")
      .setLabel("工場画面に戻る")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏭"),
    new ButtonBuilder()
      .setCustomId("idle_story_mode")
      .setLabel("ストーリー回想")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("📖")
  );
  components.push(navigationRow);
  return components;
}

//-------------------------
//プロフィールカード
//-------------------------
/**
 * プロフィールカード用のコンパクトなEmbedを生成する (エタニティ対応版)
 * @param {object} uiData - getSingleUserUIDataから返されたオブジェクト
 * @param {import("discord.js").User} user - Discordのユーザーオブジェクト
 * @returns {EmbedBuilder}
 */
export function generateProfileEmbed(uiData, user) {
  const { idleGame, achievementCount, userAchievement } = uiData;
  const population_d = new Decimal(idleGame.population);
  const highestPopulation_d = new Decimal(idleGame.highestPopulation);
  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);

  // --- 1. 表示に必要な各パーツの文字列を事前に生成 ---

  const formattedTime = formatInfinityTime(idleGame.infinityTime);

  //アセンション
  const ascensionCount = idleGame.ascensionCount || 0;
  let ascensionText = "";
  if (ascensionCount > 0) {
    ascensionText = ` <:nyowamiyarika:1264010111970574408>+${ascensionCount}`;
  }

  //ジェネレーター
  let generatorText = "";
  if (idleGame.infinityCount > 0) {
    const generators = idleGame.ipUpgrades?.generators || [];
    const boughtCounts = [];
    const romanNumerals = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ"];
    for (let i = 0; i < generators.length; i++) {
      const bought = generators[i]?.bought || 0;
      if (bought > 0) {
        boughtCounts.push(`${romanNumerals[i]}:**${bought}**`);
      }
    }
    if (boughtCounts.length > 0) {
      const gp_d = new Decimal(idleGame.generatorPower || "1");
      generatorText = `\nGP:**${formatNumberDynamic_Decimal(gp_d, 0)}** | ${boughtCounts.join(" ")}`;
    }
    const galaxyCount = idleGame.ipUpgrades?.galaxy?.count || 0;
    if (galaxyCount > 0) {
      // generatorTextが空（G1購入前）の可能性も考慮して、\nから始める
      if (generatorText === "") {
        generatorText = `\n🪐**${galaxyCount}**`;
      } else {
        // 既にGPなどの表示がある場合は区切り文字を追加
        generatorText += ` | 🪐**${galaxyCount}**`;
      }
    }
  }

  //ICクリア数
  const completedICCount =
    uiData.idleGame.challenges?.completedChallenges?.length || 0;
  const icCountText = completedICCount > 0 ? ` | ⚔️${completedICCount}/9` : "";

  //工場レベル
  const factoryLevels = [];
  for (const [name, factoryConfig] of Object.entries(config.idle.factories)) {
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
    const level = idleGame[factoryConfig.key] || 0;
    if (isUnlocked) {
      factoryLevels.push(`${factoryConfig.emoji}Lv.${level}`);
    }
  }
  const factoryLevelsString = factoryLevels.join(" ");

  // --- 2. エタニティ達成状況に応じて、最終的な説明文を組み立てる ---

  let description;
  const eternityCount = idleGame.eternityCount || 0;

  // 全ての行で共通して使う前半部分
  const commonLines = [
    `<:nyowamiyarika:1264010111970574408>: **${formatNumberJapanese_Decimal(population_d)} 匹** | Max<a:nyowamiyarika_color2:1265940814350127157>: **${formatNumberJapanese_Decimal(highestPopulation_d)} 匹**`,
    `${factoryLevelsString} 🌿${achievementCount}/${config.idle.achievements.length}${ascensionText} 🔥x${new Decimal(idleGame.buffMultiplier).toExponential(2)}`,
    `PP: **${(idleGame.prestigePower || 0).toFixed(2)}** | SP: **${(idleGame.skillPoints || 0).toFixed(2)}** | TP: **${formatNumberDynamic(idleGame.transcendencePoints || 0)}**`,
    `#1:${idleGame.skillLevel1 || 0} #2:${idleGame.skillLevel2 || 0} #3:${idleGame.skillLevel3 || 0} #4:${idleGame.skillLevel4 || 0} / #5:${idleGame.skillLevel5 || 0} #6:${idleGame.skillLevel6 || 0} #7:${idleGame.skillLevel7 || 0} #8:${idleGame.skillLevel8 || 0}`,
    `IP: **${formatNumberDynamic_Decimal(new Decimal(idleGame.infinityPoints))}** | ∞: **${Math.floor(idleGame.infinityCount || 0).toLocaleString()}**${icCountText} | ∞⏳: ${formattedTime}${generatorText}`,
  ];

  if (eternityCount > 0) {
    // 【エタニティ達成者向けの表示】
    const eternityPoints_d = new Decimal(idleGame.eternityPoints || "0");
    const formattedEternityTime = formatInfinityTime(
      idleGame.eternityTime || 0
    );

    const bestEternitySeconds = idleGame.epUpgrades?.bestEternityRealTime;
    const formattedBestEternity = bestEternitySeconds
      ? formatInfinityTime(bestEternitySeconds)
      : "記録なし";

    const totalCalamityTime =
      (idleGame.calamityTime || 0) + (idleGame.eternityTime || 0);
    const formattedCalamityTime = formatInfinityTime(totalCalamityTime);

    const totalCalamityChips_d = new Decimal(
      idleGame.chipsSpentThisCalamity || "0"
    ).add(idleGame.chipsSpentThisEternity || "0");
    const formattedCalamityChips =
      formatNumberJapanese_Decimal(totalCalamityChips_d);

    description = [
      ...commonLines,
      `EP: **${formatNumberDynamic_Decimal(eternityPoints_d)}** | Σ: **${eternityCount.toLocaleString()}** | Σ⏳: **${formattedEternityTime}** | ΣBest: **${formattedBestEternity}**`,
      `𝒞alamity(累計) | ${config.casino.currencies.legacy_pizza.emoji}: **${formattedCalamityChips}枚** | ⏳: **${formattedCalamityTime}** | Score: **${formatNumberDynamic(idleGame.rankScore, 4)}**`,
    ].join("\n");
  } else {
    // 【エタニティ未達成者向けの表示（従来通り）】
    const formattedChipsEternity = formatNumberJapanese_Decimal(
      new Decimal(idleGame.chipsSpentThisEternity?.toString() || "0")
    );
    const formattedEternityTime = formatInfinityTime(
      idleGame.eternityTime || 0
    );

    description = [
      ...commonLines,
      `Σternity(合計) | ${config.casino.currencies.legacy_pizza.emoji}: **${formattedChipsEternity}枚** | ⏳: **${formattedEternityTime}** | Score: **${formatNumberDynamic(idleGame.rankScore, 4)}**`,
    ].join("\n");
  }

  // --- 3. Embedを生成して返す ---
  return new EmbedBuilder()
    .setTitle(`${user.displayName}さんのピザ工場`)
    .setColor("Aqua")
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
        const ep_d = new Decimal(game.eternityPoints || "0");
        const population_d = new Decimal(game.population);

        // EPはΣ1以上で表示
        const epText =
          game.eternityCount > 0
            ? `EP:**${formatNumberDynamic_Decimal(ep_d)}** | `
            : "";

        // IPはΣ1以上または∞1以上で表示
        const ipText =
          game.eternityCount > 0 || game.infinityCount > 0
            ? `IP:**${formatNumberDynamic_Decimal(ip_d)}** | `
            : "";

        return {
          name: `**${rank}位** ${displayName}`,
          value: `└Score:**${score}** | ${epText}${ipText} <:nyowamiyarika:1264010111970574408>:${formatNumberJapanese_Decimal(population_d)} 匹`,
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
      const myEp_d = new Decimal(allIdleGames[myIndex].eternityPoints || "0");
      const myPopulation_d = new Decimal(allIdleGames[myIndex].population);

      const myScore = allIdleGames[myIndex].rankScore
        ? formatNumberDynamic(allIdleGames[myIndex].rankScore, 4)
        : "N/A";
      const myEpText =
        allIdleGames[myIndex].eternityCount > 0
          ? `EP:**${formatNumberDynamic_Decimal(myEp_d)}** | `
          : "";
      const myIpText =
        allIdleGames[myIndex].eternityCount > 0 ||
        allIdleGames[myIndex].infinityCount > 0
          ? `IP:**${formatNumberDynamic_Decimal(myIp_d)}** | `
          : "";
      myRankText = `**${myRank}位** └Score:**${myScore}** | ${myEpText}${myIpText}<:nyowamiyarika:1264010111970574408>:${formatNumberJapanese_Decimal(myPopulation_d)} 匹`;
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
