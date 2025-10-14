// commands/slashs/idle.mjs
import Decimal from "break_infinity.js";
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { Point, IdleGame, sequelize } from "../../models/database.mjs";
import { Op } from "sequelize";
import config from "../../config.mjs"; // config.jsにゲーム設定を追加する
import { unlockAchievements } from "../../utils/achievements.mjs";

//idlegameイベント群
import {
  handleFacilityUpgrade,
  handlePrestige,
  handleSkillReset,
  handleNyoboshiHire,
  handleAutoAllocate,
  handleSkillUpgrade,
  handleInfinity,
  handleAscension,
} from "../../idle-game/handlers.mjs";
//idlegame関数群
import {
  formatNumberJapanese_Decimal, // 新しいフォーマッター
  formatNumberDynamic_Decimal, // 新しいフォーマッター
  calculatePotentialTP,
  calculateAllCosts,
  calculateDiscountMultiplier,
  formatNumberDynamic,
  getSingleUserUIData,
  formatInfinityTime,
  calculateAscensionRequirements,
} from "../../utils/idle-game-calculator.mjs";
/**
 * 具材メモ　(基本*乗算)^指数 *ブースト
 * 基本施設：ピザ窯
 * 乗算１：チーズ工場
 * 乗算２：トマト農場（トマトソース）100万
 * 乗算３：マッシュルーム 1000万
 * 乗算４：アンチョビ 1億
 * 追加乗数５：オリーブ　PP12(1兆)
 * 追加乗数６：小麦（ovenLv80+PP16でプレステージ）
 * 追加乗数７：パイナップル(最初の試練制覇)
 * 指数施設：精肉工場（サラミ）
 * ブースト：お手伝い（２４時間ブースト）
 * 予定１：プレステージでパイナップルが指数や乗数に追加
 * プレステージ力　log₁₀(人口)とかか？
 * 予定２：実績などでバジルソースが指数や乗数に追加
 */
export const help = {
  category: "slash",
  description:
    "放置ゲームを始めます。ニョボチップを消費してピザ窯を強化しニョワミヤを増やしましょう！",
  notes:
    "チップの獲得量が少し増えますが見返りとか元を取るとかは考えないでください。",
};
export const data = new SlashCommandBuilder()
  .setName("idle")
  .setNameLocalizations({ ja: "放置ゲーム" })
  .setDescription("あなたの放置ゲームの現在の状況を確認します。")
  .addStringOption((option) =>
    option
      .setName("ranking")
      .setNameLocalizations({ ja: "ランキング表示" })
      .setDescription("ランキングなどを表示できます")
      .setRequired(false)
      .addChoices(
        { name: "ランキング表示（公開）", value: "public" },
        { name: "ランキング表示（非公開）", value: "private" },
        { name: "自分の工場を見せる", value: "view" },
        { name: "表示しない", value: "none" } // あるいは、ephemeral: trueを外した簡易的な自分の工場を見せるオプション
      )
  )
  .addStringOption((option) =>
    option
      .setName("view")
      .setNameLocalizations({ ja: "開始画面" })
      .setDescription(
        "最初に表示する画面を選択します。（スマホでボタンが欠ける時用）"
      )
      .setRequired(false)
      .addChoices(
        { name: "工場画面 (デフォルト)", value: "factory" },
        { name: "スキル画面", value: "skill" }
      )
  );

// --- 2. execute 関数のすぐ上に、UIデータ準備役を追加 ---

export async function execute(interaction) {
  const rankingChoice = interaction.options.getString("ranking");
  if (rankingChoice === "public" || rankingChoice === "private") {
    const isPrivate = rankingChoice === "private";
    await executeRankingCommand(interaction, isPrivate);
  } else if (rankingChoice === "view") {
    //プロフ
    await interaction.reply({
      content: "プロフィールを生成しています...",
      ephemeral: true,
    });

    // 1. uiDataを呼び出す
    const uiData = await getSingleUserUIData(interaction.user.id);
    if (!uiData) {
      await interaction.editReply({
        content: "エラー：工場のデータが見つかりませんでした。",
      });
      return;
    }

    // 2. 新しいプロフィール用Embedを生成
    const profileEmbed = generateProfileEmbed(uiData, interaction.user);

    // 3. ephemeral（自分だけに見える）ではない、通常のメッセージとして返信する
    await interaction.followUp({ embeds: [profileEmbed] });
    // ephemeralなメッセージを消す
    await interaction.deleteReply();
  } else {
    //工場
    const initialReply = await interaction.reply({
      content: "Now loading...ニョワミヤを数えています...",
      flags: 64,
    });

    const userId = interaction.user.id;
    const [point, createdPoint] = await Point.findOrCreate({
      where: { userId },
    });

    // 新規ユーザーのためにデータがなければ作る
    await IdleGame.findOrCreate({ where: { userId } });

    // ★新しいUIデータ準備役を呼び出す！
    // これで idleGame, mee6Level, userAchievement が一度に手に入ります
    const uiData = await getSingleUserUIData(userId);
    if (!uiData) {
      // ... (エラー処理: 初回ユーザーなど)
      await interaction.editReply({
        content: "エラーにより、工場のデータを取得できませんでした。",
      });
      return;
    }
    uiData.point = point;
    // 取得したデータを分かりやすい変数に展開
    const { achievementCount, userAchievement } = uiData;
    let { idleGame, mee6Level, displayData } = uiData; // ← これらはcollectorで再代入するので let

    // ★★★ これが最重要！計算用のDecimalオブジェクトをここで作る ★★★
    let population_d = new Decimal(idleGame.population); // ← let に変更
    let highestPopulation_d = new Decimal(idleGame.highestPopulation); // ← let に変更

    // displayDataから変数を取り出す
    let { productionRate_d, factoryEffects, skill1Effect, meatEffect } =
      displayData; // ← これらも let
    //--------------
    //人口系実績など、起動時に取れるもの
    //--------------
    const populationChecks = [
      { id: 0, condition: true }, // 「ようこそ」は常にチェック
      { id: 3, condition: population_d.gte(100) },
      { id: 5, condition: population_d.gte(10000) },
      { id: 6, condition: population_d.gte(1000000) },
      { id: 8, condition: population_d.gte(10000000) },
      { id: 10, condition: population_d.gte(100000000) },
      { id: 19, condition: population_d.gte(1e9) }, // 10億
      { id: 20, condition: population_d.gte(1e10) }, // 100億
      { id: 73, condition: (idleGame.prestigePower || 0) >= 12 }, //PP12(1兆)
      { id: 21, condition: population_d.gte(1e14) }, // 100兆
      { id: 22, condition: population_d.gte(9007199254740991) }, // Number.MAX_SAFE_INTEGER
      {
        id: 51,
        condition: population_d.gte("1e16") || highestPopulation_d.gte("1e16"),
      },
      { id: 52, condition: idleGame.skillLevel8 >= 1 }, //s8実績もここに
      { id: 56, condition: population_d.gte(6.692e30) }, //infinity^0.10
      { id: 61, condition: population_d.gte(4.482e61) }, //infinity^0.20
      { id: 70, condition: population_d.gte(2.9613e92) }, //infinity^0.30
      { id: 71, condition: population_d.gte(1.3407e154) }, //infinity^0.50
      //ニョボチップ消費量(infinity内)、BIGINTなんで扱いには注意
      {
        id: 57,
        condition: BigInt(idleGame.chipsSpentThisInfinity || "0") >= 100000,
      },
      {
        id: 58,
        condition: BigInt(idleGame.chipsSpentThisInfinity || "0") >= 1000000,
      },
      {
        id: 59,
        condition: BigInt(idleGame.chipsSpentThisInfinity || "0") >= 10000000,
      },
      //チップ倍率
      { id: 67, condition: idleGame.pizzaBonusPercentage >= 518 },
      { id: 68, condition: idleGame.pizzaBonusPercentage >= 815 },
      { id: 69, condition: idleGame.pizzaBonusPercentage >= 1254 },
      // 将来ここに人口実績を追加する (例: { id: 4, condition: idleGame.population >= 10000 })
    ];
    const idsToCheck = populationChecks
      .filter((p) => p.condition)
      .map((p) => p.id);
    await unlockAchievements(interaction.client, userId, ...idsToCheck);
    //人口系実績ここまで

    // 実績#78のチェック処理
    // configに定義されている全ての工場のレベルをチェック
    const allFactoriesLevelOne = Object.values(config.idle.factories).every(
      (factoryConfig) => {
        const levelKey = factoryConfig.key;
        const currentLevel = idleGame[levelKey] || 0;
        return currentLevel >= 1;
      }
    );
    // 全ての工場がLv1以上なら、実績#78の解除を試みる
    if (allFactoriesLevelOne) {
      await unlockAchievements(interaction.client, userId, 78);
    }

    // #64 忍耐の試練の「判定」をここで行う
    // userAchievementからではなく、最新のidleGameオブジェクトからchallengesを取得
    const challenges = idleGame.challenges || {};
    const trial64 = challenges.trial64 || {};

    if (trial64.lastPrestigeTime && !trial64.isCleared) {
      const elapsed = idleGame.infinityTime - trial64.lastPrestigeTime;
      const SECONDS_7D = 7 * 24 * 60 * 60;

      if (elapsed >= SECONDS_7D) {
        // isClearedフラグを立ててDBを更新する
        const idleGameInstance = await IdleGame.findOne({ where: { userId } });
        const currentChallenges = idleGameInstance.challenges || {};
        currentChallenges.trial64.isCleared = true;
        idleGameInstance.challenges = currentChallenges;

        // Sequelize v6以降では、JSONBフィールドの変更を明示する必要がある場合があります
        idleGameInstance.changed("challenges", true);

        await idleGameInstance.save();
        await unlockAchievements(interaction.client, userId, 64);

        // 後続の処理で使うidleGameオブジェクトにも変更を反映しておく
        idleGame.challenges.trial64.isCleared = true;
      }
    }

    // ★★★ ピザ窯覗きバフ処理 ★★★
    const now = new Date();
    let needsSave = false; // DBに保存する必要があるかを記録するフラグ

    // --- ステップ1：倍率の決定 ---
    // まず、現在の状態に基づいた「あるべき倍率」を計算する
    let correctMultiplier = 2.0;
    if (idleGame.prestigeCount === 0 && idleGame.population <= 1000000) {
      correctMultiplier = 4.0;
    } else if (idleGame.prestigeCount === 0) {
      correctMultiplier = 3.0;
    }
    // ▼▼▼ #7の効果を計算して乗算する ▼▼▼
    const skill7Level = idleGame.skillLevel7 || 0;
    const spentChips = BigInt(idleGame.chipsSpentThisInfinity || "0");

    // スキル#7のボーナスを計算
    let skill7Bonus = 0; // スキルレベルが0ならボーナスも0
    if (skill7Level > 0 && spentChips > 0) {
      const settings = config.idle.tp_skills.skill7;
      const spentChipsNum = Number(spentChips.toString());
      // べき指数を計算 (例: 0.1 * Lv8 = 0.8)
      const exponent = skill7Level * settings.exponentPerLevel;
      // (消費チップ ^ べき指数) を計算
      skill7Bonus = Math.pow(spentChipsNum, exponent);
    }
    correctMultiplier *= 1 + skill7Bonus;

    //実績コンプ系で倍率強化
    // --- まず、実績の解除状況をSetとして準備 ---
    const unlockedSet = new Set(userAchievement.achievements?.unlocked || []);
    const hiddenUnlockedSet = new Set(
      userAchievement.achievements?.hidden_unlocked || []
    );
    // 実績50「あなたは神谷マリアを遊び尽くした」の効果
    if (unlockedSet.has(50)) {
      correctMultiplier *= 1.5;
    }
    // 隠し実績10「そこに山があるから」の効果
    if (hiddenUnlockedSet.has(10)) {
      correctMultiplier *= 1.1;
    }

    // もし、DBに保存されている倍率と「あるべき倍率」が違ったら、更新する
    if (idleGame.buffMultiplier !== correctMultiplier) {
      idleGame.buffMultiplier = correctMultiplier;
      needsSave = true; // 変更があったので保存フラグを立てる
    }

    // --- ステップ2：時間の決定 ---
    // バフが切れているか、残り24時間を切っているか
    if (
      !idleGame.buffExpiresAt ||
      idleGame.buffExpiresAt < now ||
      idleGame.buffExpiresAt - now < 24 * 60 * 60 * 1000
    ) {
      // 新しい有効期限を設定する
      const newExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // もし、DBに保存されている有効期限と違ったら、更新する
      // (初回付与や時間リセットの場合、必ずこの条件に合致する)
      if (idleGame.buffExpiresAt?.getTime() !== newExpiresAt.getTime()) {
        idleGame.buffExpiresAt = newExpiresAt;
        needsSave = true; // 変更があったので保存フラグを立てる
      }
    }
    // (残り24時間以上の場合は、何もしない)

    // --- ステップ3：保存の実行 ---
    // もし、倍率か時間のどちらかに変更があった場合のみ、DBに保存する
    if (needsSave) {
      // .save() はrawでは使えないので、.update() に変更する ▼▼▼
      await IdleGame.update(
        {
          buffMultiplier: idleGame.buffMultiplier,
          buffExpiresAt: idleGame.buffExpiresAt,
        },
        { where: { userId } }
      );
    }
    //Mee6レベルから精肉取得
    const meatFactoryLevel = mee6Level ?? 0;

    // --- ★★★ ここからが修正箇所 ★★★ ---

    // generateEmbed関数：この関数が呼ばれるたびに、最新のDBオブジェクトから値を読み出すようにする
    const generateEmbed = (uiData, isFinal = false) => {
      // ★★★ 受け取ったuiDataから、必要な変数を取り出す ★★★
      const { idleGame, point, displayData, userAchievement, mee6Level } =
        uiData;
      const population_d = new Decimal(idleGame.population);
      const highestPopulation_d = new Decimal(idleGame.highestPopulation);
      const { productionRate_d, factoryEffects, skill1Effect, meatEffect } =
        displayData;
      const unlockedSet = new Set(
        userAchievement?.achievements?.unlocked || []
      );
      const meatFactoryLevel = mee6Level;
      const skillLevels = {
        s1: idleGame.skillLevel1,
        s2: idleGame.skillLevel2,
        s3: idleGame.skillLevel3,
        s4: idleGame.skillLevel4,
      };
      const radianceMultiplier = 1.0 + (skillLevels.s4 || 0) * 0.1;
      //アセンション回数
      const ascensionCount = idleGame.ascensionCount || 0;
      const ascensionEffect =
        ascensionCount > 0
          ? Math.pow(config.idle.ascension.effect, ascensionCount)
          : 1;
      // 表示用の施設効果
      const effects_display = {};
      effects_display.oven =
        factoryEffects.oven * skill1Effect * ascensionEffect;
      effects_display.cheese =
        factoryEffects.cheese * skill1Effect * ascensionEffect;
      effects_display.tomato =
        factoryEffects.tomato * skill1Effect * ascensionEffect;
      effects_display.mushroom =
        factoryEffects.mushroom * skill1Effect * ascensionEffect;
      effects_display.anchovy =
        factoryEffects.anchovy * skill1Effect * ascensionEffect;
      // 上位施設には skill1Effect を掛けない
      effects_display.olive = factoryEffects.olive * ascensionEffect;
      effects_display.wheat = factoryEffects.wheat * ascensionEffect;
      effects_display.pineapple = factoryEffects.pineapple * ascensionEffect;

      // スキル#2の効果
      const skill2Effect = (1 + skillLevels.s2) * radianceMultiplier;
      const finalSkill2Effect = Math.pow(skill2Effect, 2);
      const skill2EffectDisplay =
        finalSkill2Effect > 1 ? ` × ${finalSkill2Effect.toFixed(1)}` : "";

      // ★ バフ残り時間計算
      let buffField = null;
      if (
        idleGame.buffExpiresAt &&
        new Date(idleGame.buffExpiresAt) > new Date()
      ) {
        const ms = new Date(idleGame.buffExpiresAt) - new Date();
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        buffField = `**${formatNumberDynamic(idleGame.buffMultiplier)}倍** 残り **${hours}時間${minutes}分**`;
      }

      let descriptionText;
      let ascensionText;
      if (ascensionCount > 0) {
        ascensionText = ` <:nyowamiyarika:1264010111970574408>+${ascensionCount}`;
      }
      if (idleGame.prestigeCount > 0) {
        descriptionText = `ニョワミヤ人口: **${formatNumberJapanese_Decimal(population_d)} 匹**
最高人口: **${formatNumberJapanese_Decimal(highestPopulation_d)} 匹**
PP: **${(idleGame.prestigePower || 0).toFixed(2)}** | SP: **${idleGame.skillPoints.toFixed(2)}** | TP: **${idleGame.transcendencePoints.toFixed(2)}**
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
      for (const [name, factoryConfig] of Object.entries(
        config.idle.factories
      )) {
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
          value: `Lv. ${meatFactoryLevel} (${meatEffect.toFixed(2)})`,
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
    };

    // generateButtons関数：こちらも、最新のDBオブジェクトからコストを計算するようにする
    const generateButtons = (uiData, isDisabled = false) => {
      // ★★★ 必要な変数を取り出す ★★★
      const { idleGame, point, userAchievement } = uiData;
      const population_d = new Decimal(idleGame.population);
      const highestPopulation_d = new Decimal(idleGame.highestPopulation);
      const unlockedSet = new Set(
        userAchievement?.achievements?.unlocked || []
      );
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
      // アセンションの要件を計算する
      const ascensionCount = idleGame.ascensionCount || 0;
      const { requiredPopulation_d, requiredChips } =
        calculateAscensionRequirements(ascensionCount, idleGame.skillLevel6);
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
        const newPrestigePower = population_d.log10();
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
            idleGame.skillLevel8
          ); // 先に計算しておくとスッキリします
          prestigeButtonLabel = `Reset PP${newPrestigePower.toFixed(2)}(+${powerGain.toFixed(2)}) TP+${potentialTP.toFixed(1)}`;
        }

        boostRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`idle_prestige`)
            .setEmoji(config.idle.prestige.emoji)
            .setLabel(prestigeButtonLabel)
            .setStyle(ButtonStyle.Danger) // フルリセットなので危険な色
            .setDisabled(isDisabled)
        );
      } else if (
        population_d.lt(highestPopulation_d) &&
        population_d.gte("1e16")
      ) {
        // --- ケース2: TPだけ手に入る新しいプレステージ ---
        const potentialTP = calculatePotentialTP(
          population_d,
          idleGame.skillLevel8
        );

        boostRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`idle_prestige`) // 同じIDでOK
            .setEmoji("🍤") // 天ぷらなのでエビフライ！
            .setLabel(`TP獲得リセット (+${potentialTP.toFixed(2)} TP)`)
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
        infinityRow.addComponents(
          new ButtonBuilder()
            .setCustomId("idle_infinity")
            .setLabel("インフィニティ")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("💥")
            .setDisabled(isDisabled)
        );
      }
      // infinityRowにボタンが1つでも追加されていたら、components配列にpushする
      if (infinityRow.components.length > 0) {
        components.push(infinityRow);
      }

      //5行のボタンを返信
      return components;
    };

    // --- 1. 表示する画面を決定する ---
    let currentView = "factory"; // 'factory' または 'skill'
    // ユーザーが選択した "開始画面" オプションを取得します
    const viewChoice = interaction.options.getString("view");

    // もしユーザーが「スキル画面」を選択した場合
    if (viewChoice === "skill") {
      if (idleGame.prestigePower >= 8) {
        currentView = "skill"; // 条件を満たせばスキル画面に設定
      } else {
        await interaction.followUp({
          content:
            "⚠️ スキル画面はプレステージパワー(PP)が8以上で解放されます。代わりに工場画面を表示します。",
          ephemeral: true,
        });
        // currentViewは'factory'のまま
      }
    }

    // --- 2. 決定した画面を描画する ---
    if (currentView === "skill") {
      // ★ スキル画面の描画はここだけ
      await interaction.editReply({
        content: " ",
        embeds: [generateSkillEmbed(idleGame)],
        components: generateSkillButtons(idleGame),
      });
    } else {
      // ★ 工場画面の描画はここだけ
      const remainingMs = idleGame.buffExpiresAt
        ? idleGame.buffExpiresAt.getTime() - new Date().getTime()
        : 0;
      const remainingHours = remainingMs / (1000 * 60 * 60);
      let content =
        "⏫ ピザ窯を覗いてから **24時間** はニョワミヤの流入量が **2倍** になります！";
      if (remainingHours > 24) {
        content =
          "ニョボシが働いている(残り24時間以上)時はブーストは延長されません。";
      }
      await interaction.editReply({
        content: content,
        embeds: [generateEmbed(uiData)], // ★ uiDataを渡す
        components: generateButtons(uiData), // ★ uiDataを渡す
      });
    }

    const filter = (i) =>
      i.user.id === userId && i.customId.startsWith("idle_");
    const collector = initialReply.createMessageComponentCollector({
      filter,
      time: 120_000, //1分->2分に延長
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();
      collector.resetTimer(); // 操作があるたびにタイマーをリセット
      let success = false; // 処理が成功したかを記録するフラグ
      let viewChanged = false; // ★画面切り替えかどうかのフラグ

      // ★★★ どのボタンが押されても、まず最新のDB情報を取得する ★★★
      const latestIdleGame = await IdleGame.findOne({ where: { userId } });
      if (!latestIdleGame) return; // 万が一データがなかったら終了

      // --- 画面切り替えの処理
      if (i.customId === "idle_show_skills") {
        currentView = "skill";
        viewChanged = true;
      } else if (i.customId === "idle_show_factory") {
        currentView = "factory";
        viewChanged = true;
      } else if (i.customId === "idle_show_infinity") {
        currentView = "infinity";
        viewChanged = true;
      }

      if (i.customId === "idle_show_infinity") {
        await interaction.editReply({
          content: "ピザ工場に果ては無い（ジェネレーターは未実装です）",
          embeds: [generateInfinityEmbed(latestIdleGame)],
          components: generateInfinityButtons(latestIdleGame),
        });
        return; // 画面を切り替えたので終了
      }

      // --- 3. スキル強化の処理 ---
      if (i.customId === "idle_info") {
        const spExplanation = `### ピザ工場の遊び方
放置ゲーム「ピザ工場」はピザ工場を強化し、チーズピザが好きな雨宿りの珍生物「ニョワミヤ」を集めるゲーム(？)です。
このゲームを進めるのに必要なものはゲーム内では稼げません。
雨宿りで発言することで手に入る通貨「ニョボチップ」を使います。
ニョボチップは毎日のログボでも手に入る他、上位通貨であるニョワコインを消費しても入手できます。
ピザ工場を強化すると、計算式に基づき10分に1度ニョワミヤ達が集まってきます。
初めはピザ窯とチーズ工場だけですが、人口が増えるとトマト農場、マッシュルーム農場、アンチョビ工場などの施設が増えて少しずつ早くなっていきます。
また、発言によりMee6(ルカ)の「お得意様レベル」を上げると精肉（サラミ）工場の指数が若干増えて、更に加速します。
更に工場を最後に見てから24時間は人口増加が2倍になります（ニョボシを働かせることで72時間まで延長ができます）
人口が増えるとちょっぴりニョボチップの入手量が増えます。めざせ1億匹！
### プレステージ
1億匹に到達すると、パイナップル農場を稼働できます。（プレステージ）
プレステージすると人口と工場のLvは0になりますが、到達した最高人口に応じたPPとSPを得ることができます。
- PP:プレステージパワー、工場のLVとニョボチップ獲得%が増える他、一定値貯まると色々解禁される。
  - PP8:3施設の人口制限解除。「施設適当強化」「スキル」解禁
  - PP12: オリーブ農園解除。コレ以降も2つ乗算施設が隠されています。
  - PP16:TP解禁、最高人口未満のプレステージ解禁
- SP:スキルポイント。消費する事で強力なスキルが習得できる。
- TP:超越スキルポイント。プレステージ時の人口に応じて獲得。
より詳しいガイドはこちら　-> https://discord.com/channels/1025416221757276242/1425904625692704858
`;
        await i.followUp({
          content: spExplanation,
          flags: 64, // 本人にだけ見えるメッセージ
        });
        return; // 解説を表示したら、このcollectイベントの処理は終了
      }

      if (i.customId.startsWith("idle_upgrade_skill_")) {
        //スキル習得
        const skillNum = parseInt(i.customId.split("_").pop(), 10);
        success = await handleSkillUpgrade(i, skillNum);
      } else if (i.customId.startsWith("idle_upgrade_")) {
        //1施設購入
        // "idle_upgrade_oven" から "oven" の部分を抽出しhandlerへ
        const facility = i.customId.substring("idle_upgrade_".length);
        success = await handleFacilityUpgrade(i, facility);
      } else if (i.customId === "idle_extend_buff") {
        //ブースト延長
        success = await handleNyoboshiHire(i);
      } else if (i.customId === "idle_auto_allocate") {
        //適当に購入
        success = await handleAutoAllocate(i);
      } else if (i.customId === "idle_prestige") {
        // ここで処理して、下の施設強化ロジックには進ませない
        await handlePrestige(i, collector); // プレステージ処理関数を呼び出す
        return; // handlePrestigeが終わったら、このcollectイベントの処理は終了
      } else if (i.customId === "idle_skill_reset") {
        // スキルリセット
        await handleSkillReset(i, collector);
        return;
      } else if (i.customId === "idle_infinity") {
        await handleInfinity(i, collector);
        return;
      } else if (i.customId === "idle_ascension") {
        success = await handleAscension(i);
      } else if (i.customId.startsWith("idle_generator_buy_")) { 
        const generatorId = parseInt(i.customId.split('_').pop(), 10);
        success = await handleGeneratorPurchase(i, generatorId);
      }


      // --- 3. 処理が成功した場合にのみ、UIを更新する ---
      if (success || viewChanged) {
        // ▼▼▼ ここが「成功後の共通処理」の場所 ▼▼▼

        // DB更新が成功したので、もう一度UIデータを"全て"取得し直す！
        const newUiData = await getSingleUserUIData(userId);

        // Point情報も取得して、newUiDataに統合する
        const newPoint = await Point.findOne({ where: { userId } });

        // 万が一データ取得に失敗した場合のエラーハンドリング
        if (!newUiData || !newPoint) {
          console.error("Failed to fetch new UI data after action.");
          await i.followUp({
            content: "データの更新表示に失敗しました。",
            ephemeral: true,
          });
          return;
        }
        newUiData.point = newPoint; // 取得したpointオブジェクトをuiDataに追加
        // ★★★★★★★★★★★★★★★★★★★★★★★★

        // 最新のデータでEmbedとボタンを再描描画する
        // currentView の値に応じて描画する内容を決定
        let replyOptions = {};
        switch (currentView) {
          case "skill":
            replyOptions = {
              embeds: [generateSkillEmbed(newUiData.idleGame)],
              components: generateSkillButtons(newUiData.idleGame),
            };
            break;
          case "infinity": // ★★★ インフィニティ画面の描画を追加 ★★★
            replyOptions = {
              content: "ピザ工場に果ては無い（ジェネレーターは未実装です）",
              embeds: [generateInfinityEmbed(newUiData.idleGame)],
              components: generateInfinityButtons(newUiData.idleGame),
            };
            break;
          case "factory":
          default: // デフォルトは工場画面
            replyOptions = {
              embeds: [generateEmbed(newUiData)],
              components: generateButtons(newUiData),
            };
            break;
        }

        await interaction.editReply(replyOptions);
      }
      // ▲▲▲ UI更新処理は、このifブロックの中だけになる ▲▲▲
    });

    collector.on("end", async (collected) => {
      // asyncを追加
      try {
        await interaction.editReply({
          // awaitを追加
          embeds: [generateEmbed(uiData, true)],
          components: generateButtons(uiData, true),
        });
      } catch (error) {
        // 編集に失敗した場合 (メッセージ削除済みなど) はエラーをコンソールに警告として表示し、
        // ボットはクラッシュさせずに安全に終了させる。
        console.warn(
          `Idle game collector 'end' event failed to edit reply: ${error.message}`
        );
      }
    });
  }
}

/**
 * 人口ランキングを表示し、ページめくり機能を担当する関数
 * @param {import("discord.js").CommandInteraction} interaction - 元のインタラクション
 * @param {boolean} isPrivate - この表示を非公開(ephemeral)にするか (デフォルト: public)
 */
async function executeRankingCommand(interaction, isPrivate) {
  await interaction.reply({
    content: "ランキングを集計しています...",
    ephemeral: isPrivate,
  });

  const excludedUserId = "1123987861180534826";

  // ★★★ 攻略法１：sequelize.cast を使って、TEXTを数字としてソートする ★★★
  const allIdleGames = await IdleGame.findAll({
    where: { userId: { [Op.ne]: excludedUserId } },
    order: [[sequelize.cast(sequelize.col("population"), "DECIMAL"), "DESC"]], // ← これが魔法の呪文！
    limit: 100,
    raw: true, // ★ .findAll() には raw: true を付けると高速になります
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

        // ★★★ 攻略法２：Decimalに変換し、新しいフォーマッターを使う ★★★
        const population_d = new Decimal(game.population);
        const population = formatNumberJapanese_Decimal(population_d);

        return {
          name: `**${rank}位**`,
          value: `${displayName}\n└ ${population} 匹`,
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
      const myPopulation_d = new Decimal(allIdleGames[myIndex].population);
      const myPopulation = formatNumberJapanese_Decimal(myPopulation_d);
      myRankText = `**${myRank}位** └ ${myPopulation} 匹`;
    }

    return new EmbedBuilder()
      .setTitle("👑 ニョワミヤ人口ランキング 👑")
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
    radianceMultiplier: 1 + skillLevels.s4 * 0.1,
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

  let descriptionText = `SP: **${idleGame.skillPoints.toFixed(2)}** TP: **${idleGame.transcendencePoints.toFixed(2)}**`;

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
        value: `基本5施設の効果 **x${((1 + skillLevels.s1) * effects.radianceMultiplier).toFixed(1)}** → **x${((1 + skillLevels.s1 + 1) * effects.radianceMultiplier).toFixed(1)}**  (コスト: ${costs.s1} SP)`,
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
        value: `ニョボチップ収量 **x${((1 + skillLevels.s3) * effects.radianceMultiplier).toFixed(1)}** → **x${((1 + skillLevels.s3 + 1) * effects.radianceMultiplier).toFixed(1)}**(コスト: ${costs.s3} SP)`,
      },
      {
        name: `#4 【光輝10】 x${skillLevels.s4}`,
        value: `スキル#1~3の効果 **x${effects.radianceMultiplier.toFixed(1)}** → **x${(effects.radianceMultiplier + 0.1).toFixed(1)}**(コスト: ${costs.s4} SP)`,
      }
    );
  if (idleGame.prestigePower >= 16) {
    const currentDiscount = 1 - calculateDiscountMultiplier(tp_levels.s6);
    const nextDiscount = 1 - calculateDiscountMultiplier(tp_levels.s6 + 1);
    // ▼▼▼ #7で表示するための消費チップ量を計算 ▼▼▼
    // BigInt を Decimal に変換し、新しいフォーマッターを使う
    const spentChips_d = new Decimal(
      idleGame.chipsSpentThisInfinity.toString() || "0"
    );
    const skill7power = 0.1 * tp_levels.s7;
    const spentChipsFormatted = formatNumberJapanese_Decimal(spentChips_d);

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
        value: `${tp_configs.skill7.description}(**${spentChipsFormatted}枚**)^${skill7power.toFixed(1)} コスト: ${formatNumberDynamic(tp_costs.s7, 1)} TP`,
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
      .setDisabled(idleGame.skillPoints < costs.s4),
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

/**
 * プロフィールカード用のコンパクトなEmbedを生成する
 * @param {object} uiData - getSingleUserUIDataから返されたオブジェクト
 * @param {import("discord.js").User} user - Discordのユーザーオブジェクト
 * @returns {EmbedBuilder}
 */
function generateProfileEmbed(uiData, user) {
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
  
  const formattedEternityTime = formatInfinityTime(idleGame.eternityTime || 0);
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
    `PP: **${(idleGame.prestigePower || 0).toFixed(2)}** | SP: **${(idleGame.skillPoints || 0).toFixed(2)}** | TP: **${(idleGame.transcendencePoints || 0).toFixed(2)}**`,
    `#1:${idleGame.skillLevel1 || 0} #2:${idleGame.skillLevel2 || 0} #3:${idleGame.skillLevel3 || 0} #4:${idleGame.skillLevel4 || 0} / #5:${idleGame.skillLevel5 || 0} #6:${idleGame.skillLevel6 || 0} #7:${idleGame.skillLevel7 || 0} #8:${idleGame.skillLevel8 || 0}`,
    `IP: **${formatNumberDynamic_Decimal(new Decimal(idleGame.infinityPoints))}** | ∞: **${(idleGame.infinityCount || 0).toLocaleString()}** | ∞⏳: ${formattedTime}`,
    `Eternity(合計) | ${config.casino.currencies.legacy_pizza.emoji}: **${formattedChipsEternity}枚** | ⏳: **${formattedEternityTime}**`,
  ].join("\n");

  return new EmbedBuilder()
    .setTitle(`${user.displayName}さんのピザ工場`)
    .setColor("Aqua") // 通常のEmbedと色を変えて区別
    .setDescription(description)
    .setTimestamp();
}

/*
実装草案
G8はG7を生み、G7はG6を生み…G1はGPを生む
GPの初期値は1。G2~G8は1個につき毎分1、G1のみ1個につき毎分∞だけのGPを生産する。　初期個数が増えn個購入されると1個あたりの生産速度は2^(n-1)倍になる
GP^0.500が8つの工場に加算される。つまり最初は4乗
### 実装タスクのまとめ

1.  **DBマイグレーション:** `IdleGame` モデルに `generatorPower` (TEXT, defaultValue: '1') カラムを追加。
2.  **`handleInfinity` (in `handlers.mjs`) 修正:**
    -   `generatorPower` を `'1'` にリセット。
    -   `ipUpgrades.generators` を初期化（初回は8個分の ` { amount: '0', bought: 0 } ` 配列を作成、2回目以降は各ジェネレーターの amount を、そのジェネレーターの bought と同じ値の文字列に設定する）。
3.  **`calculateOfflineProgress` (in `calculator.mjs`) 修正:**
    -   `if (idleGame.infinityCount > 0)` の分岐を追加。
    -   中で、上位から下位へ (G8→G7, ..., G2→G1, G1→GP) と生産量を計算し、各`amount`を加算していくループ処理を実装。
    -   `GP.pow(0.5).pow(8)` の効果を、最終的な工場生産量に乗算する処理を追加。
4.  **`handleGeneratorPurchase` (in `handlers.mjs`) 新規作成:**
    -   ボタンIDからジェネレーター番号を取得。
    -   `config` からコストを計算。
    -   IPが足りるかチェック。
    -   IPを減算し、`ipUpgrades.generators[index].bought` をインクリメント。
    -   DBに保存。
5.  **`collector` (in `idle.mjs`) 修正:**
    -   `if (i.customId.startsWith("idle_generator_buy_"))` の分岐を追加し、`handleGeneratorPurchase` を呼び出す。
*/
/**
 * インフィニティ画面のEmbedを生成する（ジェネレーター）
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {EmbedBuilder}
 */
function generateInfinityEmbed(idleGame) {
  const ip_d = new Decimal(idleGame.infinityPoints);
  const infinityCount = idleGame.infinityCount || 0;
  //GPとその効果を計算するロジックを追加 
  const gp_d = new Decimal(idleGame.generatorPower || "1");
  // GPの効果を計算: GP ^ 0.5
  // GPが1未満になることは通常ないが、念のため .max(1) で最低1倍を保証
  const gpEffect_d = gp_d.pow(0.5).max(1);
  const infinityDescription = `IP: ${formatNumberDynamic_Decimal(ip_d)} | ∞: ${infinityCount.toLocaleString()}
GP: ${formatNumberDynamic_Decimal(gp_d)} (全工場効果 x${formatNumberDynamic_Decimal(gpEffect_d, 2)} 倍)`;

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

    embed.addFields({
      name: `G${generatorConfig.id} ${generatorConfig.name} (購入: ${bought})`,
      value: `所持数: ${formatNumberDynamic_Decimal(amount_d)}\nコスト: ${formatNumberDynamic_Decimal(cost)} IP`,
      inline: false, // 見やすさのためにfalseが良いかも
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
      .setEmoji("🏭")
  );
  components.push(utilityRow);

  return components;
}
