// commands/utils/idle.mjs
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
  calculateFacilityCost,
  calculateAllCosts,
  updateUserIdleGame,
  formatProductionRate,
  formatNumberJapanese,
  calculateSpentSP, // handleSkillResetで使うので追加
  calculatePotentialTP,
  calculateFactoryEffects,
  calculateDiscountMultiplier,
} from "../../utils/idle-game-calculator.mjs";
/**
 * 具材メモ　(基本*乗算)^指数 *ブースト
 * 基本施設：ピザ窯
 * 乗算１：チーズ工場
 * 乗算２：トマト農場（トマトソース）100万
 * 乗算３：マッシュルーム 1000万
 * 乗算４：アンチョビ 1億
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

export async function execute(interaction) {
  const rankingChoice = interaction.options.getString("ranking");
  if (rankingChoice === "public" || rankingChoice === "private") {
    const isPrivate = rankingChoice === "private";
    await executeRankingCommand(interaction, isPrivate);
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
    const [idleGame, createdIdle] = await IdleGame.findOrCreate({
      where: { userId },
    });
    const [userAchievement, createdAchievement] =
      await UserAchievement.findOrCreate({ where: { userId } });
    //オフライン計算
    await updateUserIdleGame(userId);
    //--------------
    //人口系実績など、起動時に取れるもの
    //--------------
    const populationChecks = [
      { id: 0, condition: true }, // 「ようこそ」は常にチェック
      { id: 3, condition: idleGame.population >= 100 },
      { id: 5, condition: idleGame.population >= 10000 },
      { id: 6, condition: idleGame.population >= 1000000 },
      { id: 8, condition: idleGame.population >= 10000000 },
      { id: 10, condition: idleGame.population >= 100000000 },
      { id: 19, condition: idleGame.population >= 1e9 }, // 10億
      { id: 20, condition: idleGame.population >= 1e10 }, // 100億
      { id: 21, condition: idleGame.population >= 1e14 }, // 100兆
      { id: 22, condition: idleGame.population >= 9007199254740991 }, // Number.MAX_SAFE_INTEGER
      {
        id: 51,
        condition:
          idleGame.population >= 1e16 || idleGame.highestPopulation >= 1e16,
      },
      { id: 52, condition: idleGame.skillLevel8 >= 1 }, //s8実績もここに
      { id: 56, condition: idleGame.population >= 6.692e30 }, //infinity^0.10
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
      // 将来ここに人口実績を追加する (例: { id: 4, condition: idleGame.population >= 10000 })
    ];
    const idsToCheck = populationChecks
      .filter((p) => p.condition)
      .map((p) => p.id);
    await unlockAchievements(interaction.client, userId, ...idsToCheck);
    //人口系実績ここまで

    // ★★★ ピザ窯覗きバフ処理 ★★★
    const now = new Date();
    let needsSave = false; // DBに保存する必要があるかを記録するフラグ

    // --- ステップ1：倍率の決定 ---
    // まず、現在の状態に基づいた「あるべき倍率」を計算する
    let correctMultiplier = 2.0;
    if (idleGame.prestigeCount === 0 && idleGame.population <= 1000000) {
      correctMultiplier = 3.0;
    } else if (idleGame.prestigeCount === 0) {
      correctMultiplier = 2.5;
    }
    // ▼▼▼ #7の効果を計算して加算 ▼▼▼
    const skill7Level = idleGame.skillLevel7 || 0;
    const spentChips = BigInt(idleGame.chipsSpentThisInfinity || "0");
    // log10(0) にならないようにガード
    if (skill7Level > 0 && spentChips > 0) {
      // BigIntは直接Math.log10できないので、文字列に変換してから数値にする
      const spentChipsNum = Number(spentChips.toString());
      const skill7Bonus =
        Math.log10(spentChipsNum) *
        skill7Level *
        config.idle.tp_skills.skill7.effectMultiplier;
      correctMultiplier += skill7Bonus;
    }

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
      await idleGame.save();
    }
    //Mee6レベル取得
    const mee6Level = await Mee6Level.findOne({ where: { userId } });
    const meatFactoryLevel = mee6Level ? mee6Level.level : 0;

    // --- ★★★ ここからが修正箇所 ★★★ ---

    // generateEmbed関数：この関数が呼ばれるたびに、最新のDBオブジェクトから値を読み出すようにする
    const generateEmbed = (isFinal = false) => {
      // 実績数を取得（データがないユーザーのために安全に）
      const achievementCount =
        userAchievement.achievements?.unlocked?.length || 0;
      // 実績による乗算ボーナス (1実績あたり+1%)
      const achievementMultiplier = 1.0 + achievementCount * 0.01;
      // 実績による指数ボーナス (1実績あたりLv+1)
      const achievementExponentBonus = achievementCount;
      //プレステージボーナス
      const pp = idleGame.prestigePower || 0; //未定義で0
      // スキル効果
      const skillLevels = {
        s1: idleGame.skillLevel1 || 0,
        s2: idleGame.skillLevel2 || 0,
        s3: idleGame.skillLevel3 || 0,
        s4: idleGame.skillLevel4 || 0,
      };

      const radianceMultiplier = 1.0 + skillLevels.s4 * 0.1;
      const skill1Effect =
        (1 + skillLevels.s1) * radianceMultiplier * achievementMultiplier; //実績補正
      const skill2Effect = (1 + skillLevels.s2) * radianceMultiplier;
      const skill3Effect = (1 + skillLevels.s3) * radianceMultiplier;
      // 最新のDBオブジェクトから値を読み出す
      // ★★★ 1. 新しい関数で、スキル#5を適用した「素の効果」を計算 ★★★
      const factoryEffects = calculateFactoryEffects(idleGame, pp);

      // ★★★ 2. 表示用に、スキル#1の効果を乗算 ★★★
      const ovenEffect_display = factoryEffects.oven * skill1Effect;
      const cheeseEffect_display = factoryEffects.cheese * skill1Effect;
      const tomatoEffect_display = factoryEffects.tomato * skill1Effect;
      const mushroomEffect_display = factoryEffects.mushroom * skill1Effect;
      const anchovyEffect_display = factoryEffects.anchovy * skill1Effect;
      //サラミ
      const meatEffect =
        1 +
        config.idle.meat.effect *
          (meatFactoryLevel + pp + achievementExponentBonus); //実績補正
      //バフも乗るように
      const productionPerMinute =
        Math.pow(
          factoryEffects.oven *
            factoryEffects.cheese *
            factoryEffects.tomato *
            factoryEffects.mushroom *
            factoryEffects.anchovy *
            Math.pow(skill1Effect, 5),
          meatEffect
        ) *
        idleGame.buffMultiplier *
        skill2Effect; //スキル2
      //スキル2表記用
      const skill2EffectDisplay =
        skill2Effect > 1 ? `× ${skill2Effect.toFixed(1)}` : "";
      let pizzaBonusPercentage = 0;
      if (idleGame.population >= 1) {
        pizzaBonusPercentage = Math.log10(idleGame.population) + 1 + pp; //チップボーナスにもPP
      } else if (pp > 0) {
        pizzaBonusPercentage = pp; //プレステージ直後に0になる不具合の修正
      }
      // スキル3の効果を適用
      pizzaBonusPercentage = (100 + pizzaBonusPercentage) * skill3Effect - 100;
      //生産速度を関数にかけてフォーマット
      const productionString = formatProductionRate(productionPerMinute);

      // ★ バフ残り時間計算
      let buffField = null;
      let hours = null;
      if (idleGame.buffExpiresAt && idleGame.buffExpiresAt > new Date()) {
        const ms = idleGame.buffExpiresAt - new Date();
        hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        buffField = `**${idleGame.buffMultiplier.toFixed(2)}倍** 残り **${hours}時間${minutes}分**`;
      }

      // EmbedのDescriptionをプレステージ回数に応じて変更する
      let descriptionText;
      if (idleGame.prestigeCount > 0) {
        descriptionText = `現在のニョワミヤ人口: **${formatNumberJapanese(
          Math.floor(idleGame.population)
        )} 匹**
最高人口: ${formatNumberJapanese(
          Math.floor(idleGame.highestPopulation)
        )} 匹 \nPP: **${pp.toFixed(2)}** 全工場Lv、獲得ニョボチップ%: **+${pp.toFixed(3)}**
SP: **${idleGame.skillPoints.toFixed(2)}** TP: **${idleGame.transcendencePoints.toFixed(2)}** #1:${idleGame.skillLevel1} #2:${idleGame.skillLevel2} #3:${idleGame.skillLevel3} #4:${idleGame.skillLevel4} / #5:${idleGame.skillLevel5} #6:${idleGame.skillLevel6} #7:${idleGame.skillLevel7} #8:${idleGame.skillLevel8}
🌿${achievementCount}/${config.idle.achievements.length} 基本5施設${skill1Effect.toFixed(2)}倍`;
      } else {
        descriptionText = `現在のニョワミヤ人口: **${formatNumberJapanese(
          Math.floor(idleGame.population)
        )} 匹**\n 🌿${achievementCount}/${config.idle.achievements.length} 基本5施設${skill1Effect.toFixed(2)}倍`;
      }

      //コストを表示するために計算する
      const costs = calculateAllCosts(idleGame);

      const embed = new EmbedBuilder()
        .setTitle("ピザ工場ステータス")
        .setColor(isFinal ? "Grey" : "Gold")
        .setDescription(descriptionText)
        .addFields(
          {
            name: `${config.idle.oven.emoji}ピザ窯`,
            value: `Lv. ${idleGame.pizzaOvenLevel} (${ovenEffect_display.toFixed(0)}) Next.${costs.oven.toLocaleString()}chip`,
            inline: true,
          },
          {
            name: `${config.idle.cheese.emoji}チーズ工場`,
            value: `Lv. ${idleGame.cheeseFactoryLevel} (${cheeseEffect_display.toFixed(2)}) Next.${costs.cheese.toLocaleString()}chip`,
            inline: true,
          },
          {
            name: `${config.idle.tomato.emoji}トマト農場`,
            value:
              idleGame.prestigeCount > 0 ||
              idleGame.population >= config.idle.tomato.unlockPopulation
                ? `Lv. ${idleGame.tomatoFarmLevel} (${tomatoEffect_display.toFixed(2)}) Next.${costs.tomato.toLocaleString()}chip`
                : `(要:人口${formatNumberJapanese(config.idle.tomato.unlockPopulation)})`,
            inline: true,
          },
          {
            name: `${config.idle.mushroom.emoji}マッシュルーム農場`,
            value:
              idleGame.prestigeCount > 0 ||
              idleGame.population >= config.idle.mushroom.unlockPopulation
                ? `Lv. ${idleGame.mushroomFarmLevel} (${mushroomEffect_display.toFixed(3)}) Next.${costs.mushroom.toLocaleString()}chip`
                : `(要:人口${formatNumberJapanese(config.idle.mushroom.unlockPopulation)})`,
            inline: true,
          },
          {
            name: `${config.idle.anchovy.emoji}アンチョビ工場`,
            value:
              idleGame.prestigeCount > 0 ||
              idleGame.population >= config.idle.anchovy.unlockPopulation
                ? `Lv. ${idleGame.anchovyFactoryLevel} (${anchovyEffect_display.toFixed(2)}) Next.${costs.anchovy.toLocaleString()}chip`
                : `(要:人口${formatNumberJapanese(config.idle.anchovy.unlockPopulation)})`,
            inline: true,
          },
          {
            name: `${config.idle.meat.emoji}精肉工場 (Mee6)`,
            value: `Lv. ${meatFactoryLevel} (${meatEffect.toFixed(2)})`,
            inline: true,
          },
          {
            name: "🔥ブースト",
            value: buffField ? buffField : "ブースト切れ", //ここを見てる時点で24時間あるはずだが念のため
            inline: true,
          },
          {
            name: "計算式",
            value: `(${ovenEffect_display.toFixed(1)} × ${cheeseEffect_display.toFixed(
              2
            )} × ${tomatoEffect_display.toFixed(2)} × ${mushroomEffect_display.toFixed(3)} × ${anchovyEffect_display.toFixed(2)}) ^ ${meatEffect.toFixed(2)} × ${idleGame.buffMultiplier.toFixed(1)}${skill2EffectDisplay}`,
          },
          {
            name: "毎分の増加予測",
            value: `${productionString} 匹/分`,
          },
          {
            name: "人口ボーナス(チップ獲得量)",
            value: `${config.casino.currencies.legacy_pizza.emoji}+${pizzaBonusPercentage.toFixed(3)} %`,
          }
        )
        .setFooter({
          text: `現在の所持チップ: ${Math.floor(
            point.legacy_pizza
          ).toLocaleString()}枚 | 10分ごと、あるいは再度/idleで更新されます。`,
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
          .setEmoji(config.idle.oven.emoji)
          .setLabel(`+${config.idle.oven.effect}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(isDisabled || point.legacy_pizza < costs.oven),
        new ButtonBuilder()
          .setCustomId(`idle_upgrade_cheese`)
          .setEmoji(config.idle.cheese.emoji)
          .setLabel(`+${config.idle.cheese.effect}`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(isDisabled || point.legacy_pizza < costs.cheese)
      );
      // ★ 人口が条件を満たしていたらトマトボタンを追加(以下3つともプレステージ後は無条件)
      if (
        idleGame.prestigeCount > 0 ||
        idleGame.population >= config.idle.tomato.unlockPopulation
      ) {
        facilityRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`idle_upgrade_tomato`)
            .setEmoji(config.idle.tomato.emoji)
            .setLabel(`+${config.idle.tomato.effect}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(isDisabled || point.legacy_pizza < costs.tomato)
        );
      }
      // 人口が条件を満たしていたらマッシュルームボタンを追加
      if (
        idleGame.prestigeCount > 0 ||
        idleGame.population >= config.idle.mushroom.unlockPopulation
      ) {
        facilityRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`idle_upgrade_mushroom`)
            .setEmoji(config.idle.mushroom.emoji)
            .setLabel(`+${config.idle.mushroom.effect}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(isDisabled || point.legacy_pizza < costs.mushroom)
        );
      }
      // 人口が条件を満たしていたらアンチョビボタンを追加
      if (
        idleGame.prestigeCount > 0 ||
        idleGame.population >= config.idle.anchovy.unlockPopulation
      ) {
        facilityRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`idle_upgrade_anchovy`)
            .setEmoji(config.idle.anchovy.emoji)
            .setLabel(`+${config.idle.anchovy.effect}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(isDisabled || point.legacy_pizza < costs.anchovy)
        );
      }
      components.push(facilityRow);

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
      //オート振り
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
      // ▼▼▼ この if文全体を置き換える ▼▼▼
      if (
        idleGame.population > idleGame.highestPopulation &&
        idleGame.population >= config.idle.prestige.unlockPopulation
      ) {
        // --- ケース1: PP/SPが手に入る通常のプレステージ ---
        const newPrestigePower = Math.log10(idleGame.population);
        const powerGain = newPrestigePower - idleGame.prestigePower;
        let prestigeButtonLabel;
        if (idleGame.prestigeCount === 0) {
          // 条件1: prestigeCountが0の場合
          prestigeButtonLabel = `プレステージ Power: ${newPrestigePower.toFixed(3)}`;
        } else if (idleGame.population < 1e16) {
          // 条件2: populationが1e16未満の場合
          prestigeButtonLabel = `Prestige Power: ${newPrestigePower.toFixed(2)} (+${powerGain.toFixed(2)})`;
        } else {
          // 条件3: それ以外 (populationが1e16以上) の場合
          const potentialTP = calculatePotentialTP(idleGame.population); // 先に計算しておくとスッキリします
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
        idleGame.population < idleGame.highestPopulation &&
        idleGame.population >= 1e16
      ) {
        // --- ケース2: TPが手に入る新しいプレステージ ---
        const potentialTP = Math.pow(Math.log10(idleGame.population) - 15, 2.5);

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
      //3行のボタンを返信
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
`;
        await i.followUp({
          content: spExplanation,
          flags: 64, // 本人にだけ見えるメッセージ
        });
        return; // 解説を表示したら、このcollectイベントの処理は終了
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
        };

        // ★★★ DBから最新のデータを取得することが非常に重要！ ★★★
        const latestPoint = await Point.findOne({ where: { userId } });
        const latestIdleGame = await IdleGame.findOne({ where: { userId } });
        let currentSpent = BigInt(latestIdleGame.chipsSpentThisInfinity || "0");

        // 2. ループ処理
        while (iterations < MAX_ITERATIONS) {
          const currentChips = latestPoint.legacy_pizza;
          const costs = calculateAllCosts(latestIdleGame);

          // 購入可能な施設をフィルタリングし、最も安いものを探す
          const affordableFacilities = Object.entries(costs)
            .filter(([name, cost]) => currentChips >= cost)
            .sort((a, b) => a[1] - b[1]); // コストの昇順でソート

          if (affordableFacilities.length === 0) {
            // 購入できる施設が何もない
            break;
          }

          const [cheapestFacilityName, cheapestCost] = affordableFacilities[0];

          // 3. 購入処理
          latestPoint.legacy_pizza -= cheapestCost;
          totalCost += cheapestCost;
          levelsPurchased[cheapestFacilityName]++;

          switch (cheapestFacilityName) {
            case "oven":
              latestIdleGame.pizzaOvenLevel++;
              break;
            case "cheese":
              latestIdleGame.cheeseFactoryLevel++;
              break;
            case "tomato":
              latestIdleGame.tomatoFarmLevel++;
              break;
            case "mushroom":
              latestIdleGame.mushroomFarmLevel++;
              break;
            case "anchovy":
              latestIdleGame.anchovyFactoryLevel++;
              break;
          }

          iterations++;
        }

        //#7用に使用チップを加算
        latestIdleGame.chipsSpentThisInfinity = (
          currentSpent + BigInt(totalCost)
        ).toString();
        // 4. DBへの一括保存
        await latestPoint.save();
        await latestIdleGame.save();

        // ★★★ メインのidleGameオブジェクトにも変更を反映させる ★★★
        point.legacy_pizza = latestPoint.legacy_pizza;
        Object.assign(idleGame, latestIdleGame.dataValues);

        // 5. 結果のフィードバック
        let summaryMessage = `**🤖 自動割り振りが完了しました！**\n- 消費チップ: ${totalCost.toLocaleString()}枚\n`;
        const purchasedList = Object.entries(levelsPurchased)
          .filter(([name, count]) => count > 0)
          .map(
            ([name, count]) =>
              `- ${config.idle[name].emoji}${name}: +${count}レベル`
          )
          .join("\n");

        if (purchasedList.length > 0) {
          summaryMessage += purchasedList;
        } else {
          summaryMessage += "購入可能な施設がありませんでした。";
        }

        await i.followUp({ content: summaryMessage, flags: 64 });
        await unlockAchievements(interaction.client, userId, 14);
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

      if (i.customId === "idle_upgrade_oven") {
        facility = "oven";
        cost = calculateFacilityCost(
          "oven",
          latestIdleGame.pizzaOvenLevel,
          skillLevel6
        );
        facilityName = "ピザ窯";
      } else if (i.customId === "idle_upgrade_cheese") {
        facility = "cheese";
        cost = calculateFacilityCost(
          "cheese",
          latestIdleGame.cheeseFactoryLevel,
          skillLevel6
        );
        facilityName = "チーズ工場";
      } else if (i.customId === "idle_upgrade_tomato") {
        facility = "tomato";
        cost = calculateFacilityCost(
          "tomato",
          latestIdleGame.tomatoFarmLevel,
          skillLevel6
        );
        facilityName = "トマト農場";
      } else if (i.customId === "idle_upgrade_mushroom") {
        facility = "mushroom";
        cost = calculateFacilityCost(
          "mushroom",
          latestIdleGame.mushroomFarmLevel,
          skillLevel6
        );
        facilityName = "マッシュルーム農場";
      } else if (i.customId === "idle_upgrade_anchovy") {
        facility = "anchovy";
        cost = calculateFacilityCost(
          "anchovy",
          latestIdleGame.anchovyFactoryLevel,
          skillLevel6
        );
        facilityName = "アンチョビ工場(ニボシじゃないよ！)";
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
          if (facility === "oven") {
            await latestIdleGame.increment("pizzaOvenLevel", {
              by: 1,
              transaction: t,
            });
          } else if (facility === "cheese") {
            //elseから念の為cheeseが必要な様に変更
            await latestIdleGame.increment("cheeseFactoryLevel", {
              by: 1,
              transaction: t,
            });
          } else if (facility === "tomato") {
            await latestIdleGame.increment("tomatoFarmLevel", {
              by: 1,
              transaction: t,
            });
          } else if (facility === "mushroom") {
            await latestIdleGame.increment("mushroomFarmLevel", {
              by: 1,
              transaction: t,
            });
          } else if (facility === "anchovy") {
            await latestIdleGame.increment("anchovyFactoryLevel", {
              by: 1,
              transaction: t,
            });
          } else if (facility === "nyobosi") {
            const now = new Date();
            const currentBuff =
              latestIdleGame.buffExpiresAt && latestIdleGame.buffExpiresAt > now
                ? latestIdleGame.buffExpiresAt
                : now;
            latestIdleGame.buffExpiresAt = new Date(
              currentBuff.getTime() + 24 * 60 * 60 * 1000
            );
            await latestIdleGame.save({ transaction: t });
          }
        });

        // ★★★ 成功したら、DBから更新された最新の値を、関数のスコープ内にあるオリジナルのDBオブジェクトに再代入する ★★★
        point.legacy_pizza = latestPoint.legacy_pizza;
        idleGame.pizzaOvenLevel = latestIdleGame.pizzaOvenLevel;
        idleGame.cheeseFactoryLevel = latestIdleGame.cheeseFactoryLevel;
        idleGame.tomatoFarmLevel = latestIdleGame.tomatoFarmLevel;
        idleGame.mushroomFarmLevel = latestIdleGame.mushroomFarmLevel;
        idleGame.anchovyFactoryLevel = latestIdleGame.anchovyFactoryLevel;
        idleGame.buffExpiresAt = latestIdleGame.buffExpiresAt;
        idleGame.buffMultiplier = latestIdleGame.buffMultiplier;

        // そして、更新されたオブジェクトを使って、メッセージを再描画する
        await interaction.editReply({
          embeds: [generateEmbed()],
          components: generateButtons(),
        });

        const successMsg =
          facility === "nyobosi"
            ? `✅ **ニョボシ** を雇い、ブーストを24時間延長しました！`
            : `✅ **${facilityName}** の強化に成功しました！`;

        await i.followUp({
          content: successMsg,
          ephemeral: true,
        });
        //施設強化系実績
        if (facility === "oven") {
          await unlockAchievements(interaction.client, userId, 1);
        } else if (facility === "cheese") {
          await unlockAchievements(interaction.client, userId, 2);
        } else if (facility === "tomato") {
          await unlockAchievements(interaction.client, userId, 7);
        } else if (facility === "mushroom") {
          await unlockAchievements(interaction.client, userId, 9);
        } else if (facility === "anchovy") {
          await unlockAchievements(interaction.client, userId, 12);
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

  // 除外したいユーザーIDを定義
  const excludedUserId = "1123987861180534826";

  const allIdleGames = await IdleGame.findAll({
    where: {
      // userIdが、指定したIDと「等しくない(!=)」という条件
      userId: {
        [Op.ne]: excludedUserId,
      },
    },
    order: [["population", "DESC"]],
    limit: 100, // DBから取得する時点で除外されるので、100人のランキングが維持される
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

        // ★ 改善ポイント1：退会ユーザーの表示を親切に ★
        try {
          const member =
            interaction.guild.members.cache.get(game.userId) ||
            (await interaction.guild.members.fetch(game.userId));
          displayName = member.displayName;
        } catch (e) {
          displayName = "(退会したユーザー)";
        }

        const population = formatNumberJapanese(Math.floor(game.population));
        return {
          name: `**${rank}位**`,
          value: `${displayName}\n└ ${population} 匹`,
          inline: false,
        };
      })
    );

    // 自分の順位を探す
    const myIndex = allIdleGames.findIndex(
      (game) => game.userId === interaction.user.id
    );
    let myRankText = "あなたはまだピザ工場を持っていません。";
    if (myIndex !== -1) {
      const myRank = myIndex + 1;
      const myPopulation = formatNumberJapanese(
        Math.floor(allIdleGames[myIndex].population)
      );
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
    const confirmationInteraction =
      await confirmationMessage.awaitMessageComponent({
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

      currentPopulation = latestIdleGame.population;

      // ▼▼▼ ここから分岐ロジック ▼▼▼
      if (currentPopulation > latestIdleGame.highestPopulation) {
        // --- PP/SPプレステージ (既存のロジック) ---
        if (currentPopulation <= config.idle.prestige.unlockPopulation) {
          throw new Error("プレステージの最低人口条件を満たしていません。");
        }

        const newPrestigePower = Math.log10(currentPopulation);
        let newSkillPoints = latestIdleGame.skillPoints;

        if (latestIdleGame.prestigeCount === 0) {
          const deduction = config.idle.prestige.spBaseDeduction;
          newSkillPoints = Math.max(0, newPrestigePower - deduction);
        } else {
          const powerGain = newPrestigePower - latestIdleGame.prestigePower;
          newSkillPoints += powerGain;
        }

        const skill8Multiplier =
          1 +
          (latestIdleGame.skillLevel8 || 0) *
            config.idle.tp_skills.skill8.effectMultiplier;
        const gainedTP =
          calculatePotentialTP(currentPopulation) * skill8Multiplier;

        await latestIdleGame.update(
          {
            population: 0,
            pizzaOvenLevel: 0,
            cheeseFactoryLevel: 0,
            tomatoFarmLevel: 0,
            mushroomFarmLevel: 0,
            anchovyFactoryLevel: 0,
            prestigeCount: latestIdleGame.prestigeCount + 1,
            prestigePower: newPrestigePower,
            skillPoints: newSkillPoints,
            highestPopulation: currentPopulation, // 最高記録を更新
            transcendencePoints: latestIdleGame.transcendencePoints + gainedTP,
            lastUpdatedAt: new Date(),
          },
          { transaction: t }
        );

        // プレステージ実績
        await unlockAchievements(interaction.client, interaction.user.id, 11);
        prestigeResult = {
          type: "PP_SP",
          population: currentPopulation,
          gainedTP: gainedTP,
        };
      } else if (currentPopulation >= 1e16) {
        // --- TPプレステージ (新しいロジック) ---
        const skill8Multiplier =
          1 +
          (latestIdleGame.skillLevel8 || 0) *
            config.idle.tp_skills.skill8.effectMultiplier;
        const gainedTP =
          calculatePotentialTP(currentPopulation) * skill8Multiplier;

        await latestIdleGame.update(
          {
            population: 0,
            pizzaOvenLevel: 0,
            cheeseFactoryLevel: 0,
            tomatoFarmLevel: 0,
            mushroomFarmLevel: 0,
            anchovyFactoryLevel: 0,
            transcendencePoints: latestIdleGame.transcendencePoints + gainedTP, // TPを加算
            // PP, SP, highestPopulation は更新しない！
            lastUpdatedAt: new Date(),
          },
          { transaction: t }
        );
        prestigeResult = {
          type: "TP_ONLY",
          population: currentPopulation,
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
凄まじい地響きと共に${formatNumberJapanese(prestigeResult.population)}匹のニョワミヤ達が押し寄せてきます！
彼女（？）たちは怒っているのでしょうか……いえ、違います！ 逆です！ 彼女たちはパイナップルの乗ったピザが大好きなのでした！
狂った様にパイナップルピザを求めたニョワミヤ達によって、今までのピザ工場は藻屑のように吹き飛ばされてしまいました……
-# そしてなぜか次の工場は強化されました。`,
        components: [], // ボタンを消す
      });
    } else if (prestigeResult.type === "TP_ONLY") {
      await confirmationInteraction.editReply({
        content: `●TPプレステージ
# そうだ、サイドメニュー作ろう。
あなた達は${formatNumberJapanese(currentPopulation)}匹のニョワミヤ達と一緒にサイドメニューを作ることにしました。
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
      // タイムアウトエラー
      await confirmationMessage.edit({
        content: "タイムアウトしました。プレステージはキャンセルされました。",
        components: [],
      });
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
  descriptionText += `\n> スマホ等でボタンが欠ける場合、\`/放置ゲーム 開始画面:スキル画面\`をお試しください。`;

  const embed = new EmbedBuilder()
    .setTitle("✨ スキル強化 ✨")
    .setColor("Purple")
    .setDescription(descriptionText)
    .addFields(
      {
        name: `#1 燃え上がるピザ工場 x${skillLevels.s1}`,
        value: `精肉工場以外の効果 **x${(1 + skillLevels.s1) * effects.radianceMultiplier}** → **x${(1 + skillLevels.s1 + 1) * effects.radianceMultiplier}**  (コスト: ${costs.s1} SP)`,
      },
      {
        name: `#2 加速する時間 x${skillLevels.s2}`,
        value: `ニョワミヤが増えるスピード **x${(1 + skillLevels.s2) * effects.radianceMultiplier}** → **x${(1 + skillLevels.s2 + 1) * effects.radianceMultiplier}** (コスト: ${costs.s2} SP)`,
      },
      {
        name: `#3 ニョボシの怒り x${skillLevels.s3}`,
        value: `ニョボチップ収量 **x${(1 + skillLevels.s3) * effects.radianceMultiplier}** → **x${(1 + skillLevels.s3 + 1) * effects.radianceMultiplier}**(コスト: ${costs.s3} SP)`,
      },
      {
        name: `#4 【光輝10】 x${skillLevels.s4}`,
        value: `スキル#1~3の効果 **x${effects.radianceMultiplier.toFixed(1)}** → **x${(effects.radianceMultiplier + 0.1).toFixed(1)}**(コスト: ${costs.s4} SP)`,
      }
    );
  if (idleGame.prestigePower >= 16 || idleGame.highestPopulation >= 1e16) {
    const currentDiscount = 1 - calculateDiscountMultiplier(tp_levels.s6);
    const nextDiscount = 1 - calculateDiscountMultiplier(tp_levels.s6 + 1);
    // ▼▼▼ #7で表示するための消費チップ量を計算 ▼▼▼
    const spentChips = BigInt(idleGame.chipsSpentThisInfinity || "0");
    // BigIntは直接フォーマット関数に渡せないので、一度Number型に変換する
    const spentChipsFormatted = formatNumberJapanese(
      Number(spentChips.toString())
    );
    embed.addFields(
      { name: "---TPスキル---", value: "\u200B" },
      {
        name: `#5 熱々ポテト x${tp_levels.s5}`,
        value: `${tp_configs.skill5.description} コスト: ${tp_costs.s5.toFixed(1)} TP`,
      },
      {
        name: `#6 スパイシーコーラ x${tp_levels.s6}`,
        value: `${tp_configs.skill6.description} **${(currentDiscount * 100).toFixed(2)}%** → **${(nextDiscount * 100).toFixed(2)}%** コスト: ${tp_costs.s6.toFixed(1)} TP`,
      },
      {
        name: `#7 山盛りのチキンナゲット x${tp_levels.s7}`,
        value: `${tp_configs.skill7.description}(**${spentChipsFormatted}枚**) コスト: ${tp_costs.s7.toFixed(1)} TP`,
      },
      {
        name: `#8 至高の天ぷら x${tp_levels.s8}`, // TenPura
        value: `${tp_configs.skill8.description} コスト: ${tp_costs.s8.toFixed(1)} TP`,
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

  if (idleGame.prestigePower >= 16 || idleGame.highestPopulation >= 1e16) {
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

      // 6. データベースの値を更新
      await latestIdleGame.update(
        {
          population: 0,
          pizzaOvenLevel: 0,
          cheeseFactoryLevel: 0,
          tomatoFarmLevel: 0,
          mushroomFarmLevel: 0,
          anchovyFactoryLevel: 0,
          skillLevel1: 0,
          skillLevel2: 0,
          skillLevel3: 0,
          skillLevel4: 0,
          skillPoints: latestIdleGame.skillPoints + totalRefundSP,
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
