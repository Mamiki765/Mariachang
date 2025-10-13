// commands/slashs/idle.mjs
import Decimal from "break_infinity.js";
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  Point,
  IdleGame,
  Mee6Level,
  sequelize,
  UserAchievement,
} from "../../models/database.mjs";
import { Op } from "sequelize";
import config from "../../config.mjs"; // config.jsにゲーム設定を追加する
import {
  unlockAchievements,
  unlockHiddenAchievements,
} from "../../utils/achievements.mjs";

//idlegame関数群
import {
  formatNumberJapanese_Decimal, // 新しいフォーマッター
  formatNumberDynamic_Decimal, // 新しいフォーマッター
  calculatePotentialTP,
  calculateAllCosts,
  calculateFacilityCost,
  calculateSpentSP, // handleSkillResetで使うので追加
  calculateDiscountMultiplier,
  formatNumberDynamic,
  getSingleUserUIData,
  formatInfinityTime,
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
    const generateEmbed = (isFinal = false) => {
      const skillLevels = {
        s1: idleGame.skillLevel1,
        s2: idleGame.skillLevel2,
        s3: idleGame.skillLevel3,
        s4: idleGame.skillLevel4,
      };
      const radianceMultiplier = 1.0 + (skillLevels.s4 || 0) * 0.1;
      // 表示用の施設効果
      const effects_display = {};
      effects_display.oven = factoryEffects.oven * skill1Effect;
      effects_display.cheese = factoryEffects.cheese * skill1Effect;
      effects_display.tomato = factoryEffects.tomato * skill1Effect;
      effects_display.mushroom = factoryEffects.mushroom * skill1Effect;
      effects_display.anchovy = factoryEffects.anchovy * skill1Effect;
      // 上位施設には skill1Effect を掛けない
      effects_display.olive = factoryEffects.olive;
      effects_display.wheat = factoryEffects.wheat;
      effects_display.pineapple = factoryEffects.pineapple;

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
      if (idleGame.prestigeCount > 0) {
        descriptionText = `ニョワミヤ人口: **${formatNumberJapanese_Decimal(population_d)} 匹**
最高人口: **${formatNumberJapanese_Decimal(highestPopulation_d)} 匹**
PP: **${(idleGame.prestigePower || 0).toFixed(2)}** | SP: **${idleGame.skillPoints.toFixed(2)}** | TP: **${idleGame.transcendencePoints.toFixed(2)}**
#1:${skillLevels.s1} #2:${skillLevels.s2} #3:${skillLevels.s3} #4:${skillLevels.s4} / #5:${idleGame.skillLevel5} #6:${idleGame.skillLevel6} #7:${idleGame.skillLevel7} #8:${idleGame.skillLevel8}
🌿${achievementCount}/${config.idle.achievements.length} 基本5施設${skill1Effect.toFixed(2)}倍`;
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
    const generateButtons = (isDisabled = false) => {
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
      const unlockedSet = new Set(userAchievement.achievements?.unlocked || []); // ★ 実績情報を取得

      // オリーブ農園のボタン
      if (unlockedSet.has(73)) {
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
      if (unlockedSet.has(74)) {
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
      if (unlockedSet.has(66)) {
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

    // 1. ユーザーが選択した "開始画面" オプションを取得します
    const viewChoice = interaction.options.getString("view");

    // 2. もしユーザーが「スキル画面」を選択した場合
    if (viewChoice === "skill") {
      // 3. ただし、プレステージをしていない場合は表示できないのでチェック
      if (idleGame.prestigePower < 8) {
        // PP8未満はスキルがそもそもないのでこの条件がより正確
        // エラーメッセージを本人にだけ送り、処理はこのまま下の「工場画面の表示」へ流す
        await interaction.followUp({
          content:
            "⚠️ スキル画面はプレステージパワー(PP)が8以上で解放されます。代わりに工場画面を表示します。",
          ephemeral: true,
        });
      } else {
        // 4. 条件を満たしていれば、スキル画面を最初に表示する
        await interaction.editReply({
          content: " ", // メッセージは空にする
          embeds: [generateSkillEmbed(idleGame)],
          components: generateSkillButtons(idleGame),
        });
      }
    }

    // 5. デフォルト（オプション未指定）の場合、またはスキル画面表示の条件を満たさなかった場合
    if (viewChoice !== "skill" || idleGame.prestigePower < 8) {
      // 6. 従来どおり、工場画面を表示する（ここのコードは以前と同じです）
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
        embeds: [generateEmbed()],
        components: generateButtons(),
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

      // ★★★ どのボタンが押されても、まず最新のDB情報を取得する ★★★
      const latestIdleGame = await IdleGame.findOne({ where: { userId } });
      if (!latestIdleGame) return; // 万が一データがなかったら終了

      // --- 1. スキル画面への切り替え ---
      if (i.customId === "idle_show_skills") {
        await interaction.editReply({
          content: " ", // contentを空にするとメッセージがスッキリします
          embeds: [generateSkillEmbed(latestIdleGame)],
          components: generateSkillButtons(latestIdleGame),
        });
        return; // 画面を切り替えたので、この回の処理は終了
      }

      // --- 2. 工場画面への切り替え ---
      if (i.customId === "idle_show_factory") {
        // 工場画面を描画するには、Point と Mee6Level の情報も必要なので再取得します
        const latestPoint = await Point.findOne({ where: { userId } });
        const mee6Level = await Mee6Level.findOne({ where: { userId } });
        const meatFactoryLevel = mee6Level ? mee6Level.level : 0;

        // ★重要★ 再描画する際は、必ず最新のDBオブジェクトを渡してあげる
        // (こうしないと、古い情報でUIが描画されてしまう)
        // ※generateEmbed/Buttonsがグローバル変数に依存しないように改修すると、より安全です
        point.legacy_pizza = latestPoint.legacy_pizza;
        Object.assign(idleGame, latestIdleGame.dataValues);

        await interaction.editReply({
          content:
            "⏫ ピザ窯を覗いてから **24時間** はニョワミヤの流入量が **2倍** になります！", // 元のメッセージに戻す
          embeds: [generateEmbed()],
          components: generateButtons(),
        });
        return;
      }

      if (i.customId === "idle_show_infinity") {
        await interaction.editReply({
          content: "ピザ工場に果ては無い（未実装です）",
          embeds: [generateInfinityEmbed(latestIdleGame)],
          components: generateInfinityButtons(latestIdleGame),
        });
        return; // 画面を切り替えたので終了
      }

      // --- 3. スキル強化の処理 ---
      if (i.customId.startsWith("idle_upgrade_skill_")) {
        const skillNum = parseInt(i.customId.split("_").pop(), 10);
        const skillLevelKey = `skillLevel${skillNum}`;

        // ===================================
        //  SPスキル (スキル#1～#4) の処理
        // ===================================
        if (skillNum >= 1 && skillNum <= 4) {
          const currentLevel = latestIdleGame[skillLevelKey] || 0;
          const cost = Math.pow(2, currentLevel);

          if (latestIdleGame.skillPoints < cost) {
            await i.followUp({ content: "SPが足りません！", ephemeral: true });
            return; // 処理を中断
          }

          try {
            await sequelize.transaction(async (t) => {
              latestIdleGame.skillPoints -= cost;
              latestIdleGame[skillLevelKey] += 1;
              await latestIdleGame.save({ transaction: t });
            });

            // 実績解除
            switch (skillNum) {
              case 1:
                await unlockAchievements(interaction.client, userId, 13);
                break;
              case 2:
                await unlockAchievements(interaction.client, userId, 18);
                break;
              case 3:
                await unlockAchievements(interaction.client, userId, 17);
                break;
              case 4:
                await unlockAchievements(interaction.client, userId, 16);
                break;
            }

            // UIを更新してフィードバック
            await interaction.editReply({
              embeds: [generateSkillEmbed(latestIdleGame)],
              components: generateSkillButtons(latestIdleGame),
            });
            await i.followUp({
              content: `✅ SPスキル #${skillNum} を強化しました！`,
              ephemeral: true,
            });
          } catch (error) {
            console.error("SP Skill Upgrade Error:", error);
            await i.followUp({
              content: "❌ SPスキル強化中にエラーが発生しました。",
              ephemeral: true,
            });
          }
        }

        // ===================================
        //  TPスキル (スキル#5～#8) の処理
        // ===================================
        else if (skillNum >= 5 && skillNum <= 8) {
          const skillKey = `skill${skillNum}`;
          const currentLevel = latestIdleGame[skillLevelKey] || 0;
          const skillConfig = config.idle.tp_skills[skillKey];
          const cost =
            skillConfig.baseCost *
            Math.pow(skillConfig.costMultiplier, currentLevel);

          if (latestIdleGame.transcendencePoints < cost) {
            await i.followUp({ content: "TPが足りません！", ephemeral: true });
            return; // 処理を中断
          }

          try {
            await sequelize.transaction(async (t) => {
              latestIdleGame.transcendencePoints -= cost;
              latestIdleGame[skillLevelKey] += 1;
              await latestIdleGame.save({ transaction: t });
            });

            // UIを更新してフィードバック
            await interaction.editReply({
              embeds: [generateSkillEmbed(latestIdleGame)],
              components: generateSkillButtons(latestIdleGame),
            });
            await i.followUp({
              content: `✅ TPスキル #${skillNum} を強化しました！`,
              ephemeral: true,
            });
          } catch (error) {
            console.error("TP Skill Upgrade Error:", error);
            await i.followUp({
              content: "❌ TPスキル強化中にエラーが発生しました。",
              ephemeral: true,
            });
          }
        }

        return; // スキル強化処理はここで終わり
      } else if (i.customId === "idle_prestige") {
        // プレステージ処理は特別なので、ここで処理して、下の施設強化ロジックには進ませない
        await handlePrestige(i, collector); // プレステージ処理関数を呼び出す
        return; // handlePrestigeが終わったら、このcollectイベントの処理は終了
      } else if (i.customId === "idle_skill_reset") {
        // スキルリセット
        await handleSkillReset(i, collector);
        return;
        //遊び方
      } else if (i.customId === "idle_info") {
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
      } else if (i.customId === "idle_infinity") {
        await handleInfinity(i, collector);
        return;
        //全自動購入
      } else if (i.customId === "idle_auto_allocate") {
        // 1. ループの準備
        const MAX_ITERATIONS = 1000; // 安全装置
        let iterations = 0;
        let totalCost = 0;
        const levelsPurchased = {
          oven: 0,
          cheese: 0,
          tomato: 0,
          mushroom: 0,
          anchovy: 0,
          olive: 0,
          wheat: 0,
          pineapple: 0,
        };

        // ★★★ DBから最新のデータを取得することが非常に重要！ ★★★
        const latestPoint = await Point.findOne({ where: { userId } });
        const latestIdleGame = await IdleGame.findOne({ where: { userId } });
        const userAchievement = await UserAchievement.findOne({
          where: { userId },
          raw: true,
        });
        const unlockedSet = new Set(
          userAchievement?.achievements?.unlocked || []
        );
        let currentSpent = BigInt(latestIdleGame.chipsSpentThisInfinity || "0");

        // 2. ループ処理
        while (iterations < MAX_ITERATIONS) {
          const currentChips = latestPoint.legacy_pizza;
          const costs = calculateAllCosts(latestIdleGame);

          const affordableFacilities = Object.entries(costs)
            .filter(([name, cost]) => {
              const factoryConfig = config.idle.factories[name];
              if (!factoryConfig) return false;

              let isUnlocked = true;
              // ★ populationの取得を new Decimal(...) から修正
              //自動購入の解禁で人口要求系は解禁されてるはずなのでコメントアウト
              //if (factoryConfig.unlockPopulation && !latestIdleGame.prestigeCount && new Decimal(latestIdleGame.population).lt(factoryConfig.unlockPopulation)) {
              //    isUnlocked = false;
              //}
              // ★ unlockedSet はループの外で準備したものを使う
              if (
                factoryConfig.unlockAchievementId &&
                !unlockedSet.has(factoryConfig.unlockAchievementId)
              ) {
                isUnlocked = false;
              }

              return isUnlocked && currentChips >= cost;
            })
            .sort((a, b) => a[1] - b[1]);

          if (affordableFacilities.length === 0) {
            break;
          }

          const [cheapestFacilityName, cheapestCost] = affordableFacilities[0];

          // 3. 購入処理
          latestPoint.legacy_pizza -= cheapestCost;
          totalCost += cheapestCost;
          levelsPurchased[cheapestFacilityName]++;

          const factoryConfig = config.idle.factories[cheapestFacilityName];
          if (factoryConfig) {
            const levelKey = factoryConfig.key;
            latestIdleGame[levelKey]++;
          }

          iterations++;
        }

        //#7用に使用チップを加算
        latestIdleGame.chipsSpentThisInfinity = (
          currentSpent + BigInt(totalCost)
        ).toString();
        latestIdleGame.chipsSpentThisEternity = (
          BigInt(latestIdleGame.chipsSpentThisEternity || "0") +
          BigInt(totalCost)
        ).toString();
        // 4. DBへの一括保存
        await latestPoint.save();
        await latestIdleGame.save();

        // ★★★ メインのidleGameオブジェクトにも変更を反映させる ★★★
        const newUiData = await getSingleUserUIData(userId);

        // 古い変数を、取得し直した新しいデータで"全て"上書きする
        // (この部分は、施設強化の時と全く同じコードです)
        Object.assign(idleGame, newUiData.idleGame);
        point.legacy_pizza = (
          await Point.findOne({ where: { userId } })
        ).legacy_pizza;

        population_d = new Decimal(newUiData.idleGame.population);
        highestPopulation_d = new Decimal(newUiData.idleGame.highestPopulation);

        ({ productionRate_d, factoryEffects, skill1Effect, meatEffect } =
          newUiData.displayData);

        // 5. 結果のフィードバック
        let summaryMessage = `**🤖 自動割り振りが完了しました！**\n- 消費チップ: ${totalCost.toLocaleString()}枚\n`;
        const purchasedList = Object.entries(levelsPurchased)
          .filter(([name, count]) => count > 0)
          .map(
            ([name, count]) =>
              `- ${config.idle.factories[name].emoji}${name}: +${count}レベル`
          )
          .join("\n");

        if (purchasedList.length > 0) {
          summaryMessage += purchasedList;
        } else {
          summaryMessage += "購入可能な施設がありませんでした。";
        }

        await i.followUp({ content: summaryMessage, flags: 64 });
        await unlockAchievements(interaction.client, userId, 14);
        if (totalCost >= 1000000) {
          await unlockAchievements(interaction.client, userId, 63);
        }
        // 6. Embedとボタンの再描画
        await interaction.editReply({
          embeds: [generateEmbed()],
          components: generateButtons(),
        });

        return;
      }

      // ★★★ コレクター内では、必ずDBから最新のデータを再取得する ★★★
      const latestPoint = await Point.findOne({ where: { userId } });
      //const latestIdleGame = await IdleGame.findOne({ where: { userId } });

      let facility, cost, facilityName;
      const skillLevel6 = latestIdleGame.skillLevel6 || 0;

      if (i.customId.startsWith("idle_upgrade_")) {
        // "idle_upgrade_oven" から "oven" の部分を抽出
        facility = i.customId.substring("idle_upgrade_".length);

        const factoryConfig = config.idle.factories[facility];

        if (factoryConfig) {
          // 該当する施設がconfigに存在するかチェック
          const levelKey = factoryConfig.key;
          const currentLevel = latestIdleGame[levelKey] || 0;

          cost = calculateFacilityCost(facility, currentLevel, skillLevel6);
          facilityName = factoryConfig.successName || factoryConfig.name; // configから正式名称を取得
        } else {
          // nyobosi などの特殊なケースや、エラーハンドリング
          // ...
        }
      } else if (i.customId === "idle_extend_buff") {
        //extend_buff
        facility = "nyobosi";
        const now = new Date();
        const remainingMs = latestIdleGame.buffExpiresAt
          ? latestIdleGame.buffExpiresAt.getTime() - now.getTime()
          : 0;
        const remainingHours = remainingMs / (1000 * 60 * 60);

        if (remainingHours > 0 && remainingHours < 24) {
          cost = 500;
        } else if (remainingHours >= 24 && remainingHours < 48) {
          cost = 1000;
        } else {
          cost = 1e300; // 絶対通らない
        }
        facilityName = "ニョボシ";
      }

      if (latestPoint.legacy_pizza < cost) {
        await i.followUp({
          content: `チップが足りません！ (必要: ${cost.toLocaleString()} / 所持: ${Math.floor(latestPoint.legacy_pizza).toLocaleString()})`,
          ephemeral: true,
        });
        return; // この場合はコレクターを止めず、続けて操作できるようにする
      }

      try {
        await sequelize.transaction(async (t) => {
          // DB更新は、必ず再取得した最新のオブジェクトに対して行う
          // チップを減らす
          await latestPoint.decrement("legacy_pizza", {
            by: cost,
            transaction: t,
          });

          // S7用BIGINTに加算する処理
          const currentSpent = BigInt(
            latestIdleGame.chipsSpentThisInfinity || "0"
          );
          latestIdleGame.chipsSpentThisInfinity = (
            currentSpent + BigInt(cost)
          ).toString();
          latestIdleGame.chipsSpentThisEternity = (
            BigInt(latestIdleGame.chipsSpentThisEternity || "0") + BigInt(cost)
          ).toString();
          if (facility === "nyobosi") {
            const now = new Date();
            const currentBuff =
              latestIdleGame.buffExpiresAt && latestIdleGame.buffExpiresAt > now
                ? latestIdleGame.buffExpiresAt
                : now;
            latestIdleGame.buffExpiresAt = new Date(
              currentBuff.getTime() + 24 * 60 * 60 * 1000
            );
            await latestIdleGame.save({ transaction: t });
          } else {
            //8工場はこっち
            const factoryConfig = config.idle.factories[facility];
            if (factoryConfig) {
              const levelKey = factoryConfig.key;
              await latestIdleGame.increment(levelKey, {
                by: 1,
                transaction: t,
              });
            }
          }
        });

        // DB更新が成功したので、もう一度UIデータを"全て"取得し直す！
        const newUiData = await getSingleUserUIData(userId);

        // 古い変数を、取得し直した新しいデータで"全て"上書きする
        Object.assign(idleGame, newUiData.idleGame); // idleGameオブジェクトを丸ごと更新
        point.legacy_pizza = (
          await Point.findOne({ where: { userId } })
        ).legacy_pizza; // pointも再取得

        // Decimalオブジェクトも再生成
        population_d = new Decimal(newUiData.idleGame.population);
        highestPopulation_d = new Decimal(newUiData.idleGame.highestPopulation);

        // 表示用データも再代入
        productionRate_d = newUiData.displayData.productionRate_d;
        factoryEffects = newUiData.displayData.factoryEffects;
        skill1Effect = newUiData.displayData.skill1Effect;
        meatEffect = newUiData.displayData.meatEffect;
        // ★★★★★★★★★★★★★★★★★★★★★★★★

        // 最新のデータでEmbedとボタンを再描画する
        await interaction.editReply({
          embeds: [generateEmbed()],
          components: generateButtons(),
        });

        const successMsg =
          facility === "nyobosi"
            ? `✅ **ニョボシ** を雇い、ブーストを24時間延長しました！`
            : `✅ **${facilityName}** の強化に成功しました！`;
        await i.followUp({ content: successMsg, ephemeral: true });

        //施設強化系実績
        //5施設はここにまとめる
        const achievementMap = {
          oven: 1,
          cheese: 2,
          tomato: 7,
          mushroom: 9,
          anchovy: 12,
          olive: 75,
          wheat: 76,
          pineapple: 77,
        };
        if (achievementMap[facility]) {
          await unlockAchievements(
            interaction.client,
            userId,
            achievementMap[facility]
          );
        } else if (facility === "nyobosi") {
          await unlockAchievements(interaction.client, userId, 4);
        }
        // i5条件: 強化した施設が 'oven' や 'nyobosi' 以外で、かつ強化前の 'oven' レベルが 0 だった場合
        if (
          facility !== "oven" &&
          facility !== "nyobosi" &&
          latestIdleGame.pizzaOvenLevel === 0
        ) {
          await unlockHiddenAchievements(
            interaction.client,
            interaction.user.id,
            5 //実績i5
          );
        }
        // i6条件 5つの施設のレベルが逆さまになる
        // 5つの施設のレベルを定数に入れておくと、コードが読みやすくなります
        const {
          pizzaOvenLevel: oven,
          cheeseFactoryLevel: cheese,
          tomatoFarmLevel: tomato,
          mushroomFarmLevel: mushroom,
          anchovyFactoryLevel: anchovy,
        } = latestIdleGame;

        // 条件: a > m > t > c > o
        if (
          anchovy > mushroom &&
          mushroom > tomato &&
          tomato > cheese &&
          cheese > oven
        ) {
          // この条件を満たした場合、実績を解除
          await unlockHiddenAchievements(
            interaction.client,
            interaction.user.id,
            6 // 実績ID: i6
          );
        }
      } catch (error) {
        console.error("IdleGame Collector Upgrade Error:", error);
        await i.followUp({
          content: "❌ アップグレード中にエラーが発生しました。",
          ephemeral: true,
        });
      }
    });

    collector.on("end", (collected) => {
      interaction.editReply({
        embeds: [generateEmbed(true)],
        components: generateButtons(true),
      });
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
 * プレステージの確認と実行を担当する関数
 * @param {import("discord.js").ButtonInteraction} interaction - プレステージボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 */
async function handlePrestige(interaction, collector) {
  // 1. まず、現在のコレクターを止めて、ボタン操作を一旦リセットする
  collector.stop();

  // 2. 確認用のメッセージとボタンを作成
  const confirmationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prestige_confirm_yes")
      .setLabel("はい、リセットします")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🍍"),
    new ButtonBuilder()
      .setCustomId("prestige_confirm_no")
      .setLabel("いいえ、やめておきます")
      .setStyle(ButtonStyle.Danger)
  );

  // ✅ ここで先に宣言しておく！
  let confirmationInteraction = null;

  const confirmationMessage = await interaction.followUp({
    content:
      "# ⚠️パイナップル警報！ \n### **本当にプレステージを実行しますか？**\n精肉工場以外の工場レベルと人口がリセットされます。この操作は取り消せません！",
    components: [confirmationRow],
    flags: 64, // 本人にだけ見える確認
    fetchReply: true, // 送信したメッセージオブジェクトを取得するため
  });

  try {
    // 3. ユーザーの応答を待つ (60秒)
    //    .awaitMessageComponent() は、ボタンが押されるまでここで処理を「待機」します
    confirmationInteraction = await confirmationMessage.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      time: 60_000,
    });

    // 4. 押されたボタンに応じて処理を分岐
    if (confirmationInteraction.customId === "prestige_confirm_no") {
      // 「いいえ」が押された場合
      await confirmationInteraction.update({
        content: "プレステージをキャンセルしました。工場は無事です！",
        components: [], // ボタンを消す
      });
      return; // 処理を終了
    }

    // --- 「はい」が押された場合の処理 ---
    await confirmationInteraction.deferUpdate(); // 「考え中...」の状態にする

    let currentPopulation;
    let prestigeResult = {};
    // 5. トランザクションを使って、安全にデータベースを更新
    await sequelize.transaction(async (t) => {
      const latestIdleGame = await IdleGame.findOne({
        where: { userId: interaction.user.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // ★★★ 1. Decimalに変換 ★★★
      const currentPopulation_d = new Decimal(latestIdleGame.population);
      const highestPopulation_d = new Decimal(latestIdleGame.highestPopulation);

      // #65 充足の試練チェック
      if (latestIdleGame.skillLevel1 === 0 && currentPopulation_d.gte("1e27")) {
        await unlockAchievements(interaction.client, interaction.user.id, 65);
      }
      // #62 虚無の試練チェック
      const areFactoriesLevelZero =
        latestIdleGame.pizzaOvenLevel === 0 &&
        latestIdleGame.cheeseFactoryLevel === 0 &&
        latestIdleGame.tomatoFarmLevel === 0 &&
        latestIdleGame.mushroomFarmLevel === 0 &&
        latestIdleGame.anchovyFactoryLevel === 0;
      if (areFactoriesLevelZero && currentPopulation_d.gte("1e24")) {
        await unlockAchievements(interaction.client, interaction.user.id, 62);
      }
      // #64 忍耐の試練記録
      const challenges = latestIdleGame.challenges || {};
      if (!challenges.trial64?.isCleared) {
        challenges.trial64 = {
          lastPrestigeTime: latestIdleGame.infinityTime,
          isCleared: false, // リセットなので未クリア状態に戻す
        };
        latestIdleGame.changed("challenges", true);
      }

      // 「原点への回帰」実績のチェック
      if (
        latestIdleGame.pizzaOvenLevel >= 80 &&
        currentPopulation_d.gte("1e16")
      ) {
        // トランザクションの外で実行した方が安全
        unlockAchievements(interaction.client, interaction.user.id, 74);
      }

      // ▼▼▼ ここから分岐ロジック ▼▼▼
      if (currentPopulation_d.gt(highestPopulation_d)) {
        // --- PP/SPプレステージ (既存のロジック) ---
        if (currentPopulation_d.lte(config.idle.prestige.unlockPopulation)) {
          // .lte() = less than or equal
          throw new Error("プレステージの最低人口条件を満たしていません。");
        }

        const newPrestigePower = currentPopulation_d.log10();
        let newSkillPoints = latestIdleGame.skillPoints;

        if (latestIdleGame.prestigeCount === 0) {
          const deduction = config.idle.prestige.spBaseDeduction;
          newSkillPoints = Math.max(0, newPrestigePower - deduction);
        } else {
          const powerGain = newPrestigePower - latestIdleGame.prestigePower;
          newSkillPoints += powerGain;
        }

        const gainedTP = calculatePotentialTP(
          currentPopulation_d,
          latestIdleGame.skillLevel8
        );

        await latestIdleGame.update(
          {
            population: "0",
            pizzaOvenLevel: 0,
            cheeseFactoryLevel: 0,
            tomatoFarmLevel: 0,
            mushroomFarmLevel: 0,
            anchovyFactoryLevel: 0,
            oliveFarmLevel: 0,
            wheatFarmLevel: 0,
            pineappleFarmLevel: 0,
            prestigeCount: latestIdleGame.prestigeCount + 1,
            prestigePower: newPrestigePower,
            skillPoints: newSkillPoints,
            highestPopulation: currentPopulation_d.toString(), // 最高記録を更新
            transcendencePoints: latestIdleGame.transcendencePoints + gainedTP,
            lastUpdatedAt: new Date(),
            challenges,
          },
          { transaction: t }
        );

        // プレステージ実績
        await unlockAchievements(interaction.client, interaction.user.id, 11);
        prestigeResult = {
          type: "PP_SP",
          population_d: currentPopulation_d,
          gainedTP: gainedTP,
        };
      } else if (currentPopulation_d.gte("1e16")) {
        // --- TPプレステージ (新しいロジック) ---
        const gainedTP = calculatePotentialTP(
          currentPopulation_d,
          latestIdleGame.skillLevel8
        );

        await latestIdleGame.update(
          {
            population: "0",
            pizzaOvenLevel: 0,
            cheeseFactoryLevel: 0,
            tomatoFarmLevel: 0,
            mushroomFarmLevel: 0,
            anchovyFactoryLevel: 0,
            oliveFarmLevel: 0,
            wheatFarmLevel: 0,
            pineappleFarmLevel: 0,
            transcendencePoints: latestIdleGame.transcendencePoints + gainedTP, // TPを加算
            // PP, SP, highestPopulation は更新しない！
            lastUpdatedAt: new Date(),
            challenges,
          },
          { transaction: t }
        );
        prestigeResult = {
          type: "TP_ONLY",
          population_d: currentPopulation_d,
          gainedTP: gainedTP,
        };
      } else {
        // どちらの条件も満たさない場合 (ボタン表示ロジックのおかげで通常はありえない)
        throw new Error("プレステージの条件を満たしていません。");
      }
    });

    // 6. トランザクション成功後、結果に応じてメッセージを送信
    if (prestigeResult.type === "PP_SP") {
      await confirmationInteraction.editReply({
        content: `●プレステージ
# なんと言うことでしょう！あなたはパイナップル工場を稼働してしまいました！
凄まじい地響きと共に${formatNumberJapanese_Decimal(prestigeResult.population_d)}匹のニョワミヤ達が押し寄せてきます！
彼女（？）たちは怒っているのでしょうか……いえ、違います！ 逆です！ 彼女たちはパイナップルの乗ったピザが大好きなのでした！
狂った様にパイナップルピザを求めたニョワミヤ達によって、今までのピザ工場は藻屑のように吹き飛ばされてしまいました……
-# そしてなぜか次の工場は強化されました。`,
        components: [], // ボタンを消す
      });
    } else if (prestigeResult.type === "TP_ONLY") {
      await confirmationInteraction.editReply({
        content: `●TPプレステージ
# そうだ、サイドメニュー作ろう。
あなた達は${formatNumberJapanese_Decimal(prestigeResult.population_d)}匹のニョワミヤ達と一緒にサイドメニューを作ることにしました。
美味しそうなポテトやナゲット、そして何故か天ぷらの数々が揚がっていきます・　・　・　・　・　・。
-# 何故か終わる頃には工場は蜃気楼のように消えてしまっていました。
${prestigeResult.gainedTP.toFixed(2)}TPを手に入れました。`,
        components: [], // ボタンを消す
      });
    }
  } catch (error) {
    console.error("Prestige Error:", error); // エラー内容はコンソールに出力

    if (confirmationInteraction) {
      // ボタン操作後のエラー (DBエラーなど)
      await confirmationInteraction.editReply({
        content: "❌ データベースエラーにより、プレステージに失敗しました。",
        components: [],
      });
    } else {
      try {
        // タイムアウトエラー
        await confirmationMessage.edit({
          content:
            "タイムアウトまたは内部エラーにより、プレステージはキャンセルされました。",
          components: [],
        });
      } catch (editError) {
        // メッセージの編集に失敗した場合 (すでに削除されている、トークンが失効しているなど)
        // エラーをコンソールに警告として表示するが、ボットはクラッシュさせない
        console.warn(
          "タイムアウト後の確認メッセージの編集に失敗しました:",
          editError.message
        );
      }
    }
  }
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
 * スキルと工場のリセットを担当する関数
 * @param {import("discord.js").ButtonInteraction} interaction - リセットボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 */
async function handleSkillReset(interaction, collector) {
  // 1. コレクターを止めて、ボタン操作をリセット
  collector.stop();

  // 2. 確認メッセージを作成
  const confirmationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("skill_reset_confirm_yes")
      .setLabel("はい、リセットします")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("skill_reset_confirm_no")
      .setLabel("いいえ、やめておきます")
      .setStyle(ButtonStyle.Secondary)
  );

  // ★★★ .followUp() を使うのが重要！ ★★★
  const confirmationMessage = await interaction.followUp({
    content:
      "### ⚠️ **本当にスキルをリセットしますか？**\n消費したSPは全て返還されますが、精肉工場以外の工場レベルと人口も含めて**全てリセット**されます。この操作は取り消せません！",
    components: [confirmationRow],
    flags: 64,
    fetchReply: true,
  });

  try {
    // 3. ユーザーの応答を待つ
    const confirmationInteraction =
      await confirmationMessage.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000,
      });

    if (confirmationInteraction.customId === "skill_reset_confirm_no") {
      await confirmationInteraction.update({
        content: "スキルリセットをキャンセルしました。",
        components: [],
      });
      return;
    }

    // --- 「はい」が押された場合 ---
    await confirmationInteraction.deferUpdate();

    let refundedSP = 0;

    // 4. トランザクションで安全にデータベースを更新
    await sequelize.transaction(async (t) => {
      const latestIdleGame = await IdleGame.findOne({
        where: { userId: interaction.user.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // 5. 返還するSPを計算
      const spent1 = calculateSpentSP(latestIdleGame.skillLevel1);
      const spent2 = calculateSpentSP(latestIdleGame.skillLevel2);
      const spent3 = calculateSpentSP(latestIdleGame.skillLevel3);
      const spent4 = calculateSpentSP(latestIdleGame.skillLevel4);
      const totalRefundSP = spent1 + spent2 + spent3 + spent4;
      refundedSP = totalRefundSP; // メッセージ表示用に保存

      // #64 忍耐の試練記録
      const challenges = latestIdleGame.challenges || {};
      if (!challenges.trial64?.isCleared) {
        challenges.trial64 = {
          lastPrestigeTime: latestIdleGame.infinityTime,
          isCleared: false, // リセットなので未クリア状態に戻す
        };
        latestIdleGame.changed("challenges", true);
      }

      // 6. データベースの値を更新
      await latestIdleGame.update(
        {
          population: 0,
          pizzaOvenLevel: 0,
          cheeseFactoryLevel: 0,
          tomatoFarmLevel: 0,
          mushroomFarmLevel: 0,
          anchovyFactoryLevel: 0,
          oliveFarmLevel: 0,
          wheatFarmLevel: 0,
          pineappleFarmLevel: 0,
          skillLevel1: 0,
          skillLevel2: 0,
          skillLevel3: 0,
          skillLevel4: 0,
          skillPoints: latestIdleGame.skillPoints + totalRefundSP,
          challenges,
          lastUpdatedAt: new Date(),
        },
        { transaction: t }
      );
    });

    //スキルリセット実績
    await unlockAchievements(interaction.client, interaction.user.id, 15);

    // 7. 成功メッセージを送信
    await confirmationInteraction.editReply({
      content: `🔄 **スキルと工場をリセットしました！**\n**${refundedSP.toFixed(2)} SP** が返還されました。`,
      components: [],
    });
  } catch (error) {
    // タイムアウトなどのエラー処理
    await interaction.editReply({
      content: "タイムアウトしました。リセットはキャンセルされました。",
      components: [],
    });
  }
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
    `${factoryLevelsString} 🌿${achievementCount}/${config.idle.achievements.length} 🔥x${new Decimal(idleGame.buffMultiplier).toExponential(2)}`,
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

/**
 * Infinityを実行し、世界をリセットする関数
 * @param {import("discord.js").ButtonInteraction} interaction - Infinityボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 */
async function handleInfinity(interaction, collector) {
  // 1. コレクターを停止
  collector.stop();
  await interaction.deferUpdate(); // 「考え中...」の状態にする

  try {
    let gainedIP = new Decimal(0);
    let isFirstInfinity = false;

    // 2. トランザクションで安全にデータベースを更新
    await sequelize.transaction(async (t) => {
      const latestIdleGame = await IdleGame.findOne({
        where: { userId: interaction.user.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // 人口がInfinityに達しているか最終チェック
      if (new Decimal(latestIdleGame.population).lt(config.idle.infinity)) {
        throw new Error("インフィニティの条件を満たしていません。");
      }

      if (latestIdleGame.infinityCount === 0) {
        isFirstInfinity = true;
      }

      // 3. IP獲得量を計算（現在は固定で1）増える要素ができたらutils\idle-game-calculator.mjsで計算する
      gainedIP = new Decimal(1);

      // 4. データベースの値をリセット＆更新
      await latestIdleGame.update(
        {
          // --- リセットされる項目 ---
          population: "0",
          highestPopulation: "0",
          pizzaOvenLevel: 0,
          cheeseFactoryLevel: 0,
          tomatoFarmLevel: 0,
          mushroomFarmLevel: 0,
          anchovyFactoryLevel: 0,
          oliveFarmLevel: 0,
          wheatFarmLevel: 0,
          pineappleFarmLevel: 0,
          prestigeCount: 0,
          prestigePower: 0,
          skillPoints: 0,
          skillLevel1: 0,
          skillLevel2: 0,
          skillLevel3: 0,
          skillLevel4: 0,
          transcendencePoints: 0,
          skillLevel5: 0,
          skillLevel6: 0,
          skillLevel7: 0,
          skillLevel8: 0,
          infinityTime: 0,
          chipsSpentThisInfinity: "0",
          buffMultiplier: 2.0,
          // challenges はリセットしない

          // --- 更新される項目 ---
          infinityPoints: new Decimal(latestIdleGame.infinityPoints)
            .add(gainedIP)
            .toString(),
          infinityCount: latestIdleGame.infinityCount + 1, // infinityCountはDouble型なので、JSのNumberでOK
          lastUpdatedAt: new Date(),
        },
        { transaction: t }
      );
    });

    await unlockAchievements(interaction.client, interaction.user.id, 72); //THE END

    // 5. 成功メッセージを送信（初回かどうかで分岐）
    let successMessage;
    if (isFirstInfinity) {
      successMessage = `# ●1.79e+308 Infinity
## ――あなたは果てにたどり着いた。
終わりは意外とあっけないものだった。
ピザを求めてどこからか増え続けたニョワミヤ達はついに宇宙に存在する全ての分子よりも多く集まり、
それは一塊に集まると、凄まじい光を放ち膨張し……そして新たな星が誕生した。
## ニョワミヤは、青かった。
……。
おめでとう、あなたの努力はついに報われた。
キミは満足しただろうか、或いは途方もない徒労感と緊張の糸が切れた感覚があるだろうか。
いずれにせよ……ここが終点だ。さあ、君たちの星、君たちの世界の戦場に帰するときが来た。
……君達が満足していなければ、あるいはまたここに戻ってくるのだろうか。

あなたは全ての工場に関する能力を失った。
しかし、あなたは強くなった。
**${gainedIP.toString()} IP** と **1 ∞** を手に入れた。
ピザ生産ジェネレーターが解禁された。`;
    } else {
      successMessage = `# ●1.79e+308 Infinity
## ――あなたは果てにたどり着いた。
終わりは意外とあっけないものだった。
ピザを求めてどこからか増え続けたニョワミヤ達はついに宇宙に存在する全ての分子よりも多く集まり、
それは一塊に集まると、凄まじい光を放ち膨張し……そして新たな星が誕生した。
## ニョワミヤは、青かった。
……。
たとえ一度見た光景であろうと、あなたの努力と活動は称賛されるべきである。
然るべき達成感と褒章を得るべきで……え？　早くIPと∞よこせって？

インフィニティリセットを行った。
**${gainedIP.toString()} IP** と **1 ∞** を手に入れた。`;
    }

    await interaction.followUp({
      content: successMessage,
      flags: 64, // 本人にだけ見えるメッセージ
    });
  } catch (error) {
    console.error("Infinity Error:", error);
    await interaction.followUp({
      content: "❌ エラーによりインフィニティに失敗しました。",
      flags: 64,
    });
  }
}

/**
 * インフィニティ画面のEmbedを生成する（ジェネレーター）
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {EmbedBuilder}
 */
function generateInfinityEmbed(idleGame) {
  const ip_d = new Decimal(idleGame.infinityPoints);
  const infinityCount = idleGame.infinityCount || 0;
  const infinityDescription = `IP: ${formatNumberDynamic_Decimal(ip_d)} | ∞: ${infinityCount.toLocaleString()}
GP:1^0.5 = 1倍`; //GPはinfinityのたびに1にリセットされる…revoのパクリやんけ～～～！

  const embed = new EmbedBuilder()
    .setTitle("🌌 インフィニティ 🌌")
    .setColor("Aqua")
    .setDescription(infinityDescription)
    .addFields(
      {
        //ダミー
        name: "Lv1.ピザ工場複製装置(1個)",
        value:
          "10コス。毎分、GPを1生産する。Lv1増やすと初期個数が1増え効果が2倍になる。\n生産速度は∞倍される", //revoの（ｒｙ
      },
      {
        //ダミー
        name: "Lv0.ピザ工場複製装置Ⅱ(0個)",
        value:
          "100コス。毎分、ピザ工場複製装置を1生産する。Lv1増やすと初期個数が1増え効果が2倍になる。", //アンチマターニョワミヤ
      } // そしてジェネレーターのジェネレーターのジェネレーターへ…
    );
  return embed;
}

/**
 * インフィニティ画面のボタンを生成する
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {ActionRowBuilder[]}
 */
function generateInfinityButtons(idleGame) {
  // 将来的には、ここにジェネレーターやアップグレードの購入ボタンを追加します
  const utilityRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("idle_show_factory") // 工場画面に戻る
      .setLabel("工場画面に戻る")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏭")
  );
  return [utilityRow];
}
