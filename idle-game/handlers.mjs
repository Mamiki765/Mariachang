import {
  sequelize,
  Point,
  IdleGame,
  UserAchievement,
} from "../models/database.mjs";
import {
  unlockAchievements,
  unlockHiddenAchievements,
} from "../utils/achievements.mjs";
import config from "../config.mjs";

import {
  calculateGainedIP, 
  calculateFacilityCost,
  calculateAllCosts,
  calculatePotentialTP,
  calculateSpentSP,
  formatNumberJapanese_Decimal,
  calculateAscensionRequirements,
  calculateGeneratorCost,
} from "../utils/idle-game-calculator.mjs";

import Decimal from "break_infinity.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

/**
 * 施設のアップグレード処理を担当する
 * @param {import("discord.js").ButtonInteraction} interaction - ボタンのインタラクション
 * @param {string} facilityName - 強化する施設の種類 (e.g., "oven", "cheese")
 * @returns {Promise<boolean>} 成功した場合はtrue、失敗した場合はfalseを返す
 */
export async function handleFacilityUpgrade(interaction, facilityName) {
  const userId = interaction.user.id;

  // 1. 必要な最新データをDBから取得
  const latestPoint = await Point.findOne({ where: { userId } });
  const latestIdleGame = await IdleGame.findOne({ where: { userId } });
  if (!latestPoint || !latestIdleGame) {
    await interaction.followUp({
      content: "エラー：ユーザーデータが見つかりません。",
      ephemeral: true,
    });
    return false;
  }

  // 2. コストを計算
  const skillLevel6 = latestIdleGame.skillLevel6 || 0;
  const currentLevel =
    latestIdleGame[config.idle.factories[facilityName].key] || 0;
  const cost = calculateFacilityCost(facilityName, currentLevel, skillLevel6);

  // 3. チップが足りるかチェック
  if (latestPoint.legacy_pizza < cost) {
    await interaction.followUp({
      content: `チップが足りません！ (必要: ${cost.toLocaleString()} / 所持: ${Math.floor(latestPoint.legacy_pizza).toLocaleString()})`,
      ephemeral: true,
    });
    return false;
  }

  // 4. トランザクションでDBを更新
  try {
    await sequelize.transaction(async (t) => {
      await latestPoint.decrement("legacy_pizza", { by: cost, transaction: t });

      const currentSpent = BigInt(latestIdleGame.chipsSpentThisInfinity || "0");
      latestIdleGame.chipsSpentThisInfinity = (
        currentSpent + BigInt(cost)
      ).toString();
      latestIdleGame.chipsSpentThisEternity = (
        BigInt(latestIdleGame.chipsSpentThisEternity || "0") + BigInt(cost)
      ).toString();

      const levelKey = config.idle.factories[facilityName].key;
      await latestIdleGame.increment(levelKey, { by: 1, transaction: t });
      await latestIdleGame.save({ transaction: t }); // saveも忘れずに
    });
  } catch (error) {
    console.error("Facility Upgrade Error:", error);
    await interaction.followUp({
      content: "❌ アップグレード中にエラーが発生しました。",
      ephemeral: true,
    });
    return false;
  }

  // 5. 成功メッセージと実績解除
  const facilityConfig = config.idle.factories[facilityName];
  const successName = facilityConfig.successName || facilityConfig.name;
  await interaction.followUp({
    content: `✅ **${successName}** の強化に成功しました！`,
    ephemeral: true,
  });

  await latestIdleGame.reload();

  // 実績解除ロジック
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
  if (achievementMap[facilityName]) {
    await unlockAchievements(
      interaction.client,
      userId,
      achievementMap[facilityName]
    );
  }

  // 隠し実績
  // i5条件: 強化した施設が 'oven' や 'nyobosi' 以外で、かつ強化前の 'oven' レベルが 0 だった場合
  if (facilityName !== "oven" && latestIdleGame.pizzaOvenLevel === 0) {
    await unlockHiddenAchievements(interaction.client, userId, 5);
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
  return true; // 成功したことを伝える
}

/**
 * ニョボシを雇用してブースト時間を延長する処理
 * @param {import("discord.js").ButtonInteraction} interaction - ボタンのインタラクション
 * @returns {Promise<boolean>} 成功した場合はtrue、失敗した場合はfalseを返す
 */
export async function handleNyoboshiHire(interaction) {
  const userId = interaction.user.id;

  // 1. 必要な最新データをDBから取得
  const latestPoint = await Point.findOne({ where: { userId } });
  const latestIdleGame = await IdleGame.findOne({ where: { userId } });
  if (!latestPoint || !latestIdleGame) {
    await interaction.followUp({
      content: "エラー：ユーザーデータが見つかりません。",
      ephemeral: true,
    });
    return false;
  }

  // 2. コストを決定
  const now = new Date();
  const remainingMs = latestIdleGame.buffExpiresAt
    ? latestIdleGame.buffExpiresAt.getTime() - now.getTime()
    : 0;
  const remainingHours = remainingMs / (1000 * 60 * 60);

  let cost = 0;
  if (remainingHours > 0 && remainingHours < 24) {
    cost = 500;
  } else if (remainingHours >= 24 && remainingHours < 48) {
    cost = 1000;
  } else {
    // 本来ボタンが無効化されているはずだが、念のためチェック
    await interaction.followUp({
      content: "現在はニョボシを雇用できません。",
      ephemeral: true,
    });
    return false;
  }

  // 3. チップが足りるかチェック
  if (latestPoint.legacy_pizza < cost) {
    await interaction.followUp({
      content: `チップが足りません！ (必要: ${cost.toLocaleString()} / 所持: ${Math.floor(latestPoint.legacy_pizza).toLocaleString()})`,
      ephemeral: true,
    });
    return false;
  }

  // 4. トランザクションでDBを更新
  try {
    await sequelize.transaction(async (t) => {
      await latestPoint.decrement("legacy_pizza", { by: cost, transaction: t });

      const currentSpent = BigInt(latestIdleGame.chipsSpentThisInfinity || "0");
      latestIdleGame.chipsSpentThisInfinity = (
        currentSpent + BigInt(cost)
      ).toString();
      latestIdleGame.chipsSpentThisEternity = (
        BigInt(latestIdleGame.chipsSpentThisEternity || "0") + BigInt(cost)
      ).toString();

      const currentBuffEnd =
        latestIdleGame.buffExpiresAt && latestIdleGame.buffExpiresAt > now
          ? latestIdleGame.buffExpiresAt
          : now;
      latestIdleGame.buffExpiresAt = new Date(
        currentBuffEnd.getTime() + 24 * 60 * 60 * 1000
      );

      await latestIdleGame.save({ transaction: t });
    });
  } catch (error) {
    console.error("Nyoboshi Hire Error:", error);
    await interaction.followUp({
      content: "❌ ニョボシ雇用中にエラーが発生しました。",
      ephemeral: true,
    });
    return false;
  }

  // 5. 成功メッセージと実績解除
  await interaction.followUp({
    content: `✅ **ニョボシ** を雇い、ブーストを24時間延長しました！`,
    ephemeral: true,
  });
  await unlockAchievements(interaction.client, userId, 4); // 実績#4: ニョワミヤ監督官

  return true; // 成功
}

export async function handleAutoAllocate(interaction) {
  const userId = interaction.user.id;

  // 1. 必要な最新データをDBから取得
  // (UserAchievementも実績ロック判定に必要なので取得)
  const [latestPoint, latestIdleGame, userAchievement] = await Promise.all([
    Point.findOne({ where: { userId } }),
    IdleGame.findOne({ where: { userId } }),
    UserAchievement.findOne({ where: { userId }, raw: true }),
  ]);

  if (!latestPoint || !latestIdleGame) {
    await interaction.followUp({
      content: "エラー：ユーザーデータが見つかりません。",
      ephemeral: true,
    });
    return false;
  }

  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);

  // 2. シミュレーション関数を呼び出して購入プランを得る
  const { purchases, totalCost, purchasedCount } = simulatePurchases(
    latestIdleGame.get({ plain: true }), // Sequelizeオブジェクトを素のJSオブジェクトに変換
    latestPoint.legacy_pizza,
    unlockedSet
  );

  if (purchasedCount === 0) {
    await interaction.followUp({
      content: "購入可能な施設がありませんでした。",
      ephemeral: true,
    });
    return false;
  }

  // 3. トランザクションで購入プランをDBに適用
  try {
    await sequelize.transaction(async (t) => {
      await latestPoint.decrement("legacy_pizza", {
        by: totalCost,
        transaction: t,
      });

      // 各施設のレベルをまとめて上げる
      for (const [facilityName, count] of purchases.entries()) {
        const levelKey = config.idle.factories[facilityName].key;
        await latestIdleGame.increment(levelKey, { by: count, transaction: t });
      }

      const currentSpent = BigInt(latestIdleGame.chipsSpentThisInfinity || "0");
      latestIdleGame.chipsSpentThisInfinity = (
        currentSpent + BigInt(totalCost)
      ).toString();
      latestIdleGame.chipsSpentThisEternity = (
        BigInt(latestIdleGame.chipsSpentThisEternity || "0") + BigInt(totalCost)
      ).toString();

      await latestIdleGame.save({ transaction: t });
    });
  } catch (error) {
    console.error("Auto Allocate Error:", error); // エラー名を分かりやすく
    await interaction.followUp({
      content: "❌ 自動割り振り中にエラーが発生しました。",
      ephemeral: true,
    });
    return false;
  }

  // 4. 結果をユーザーに報告 & 実績解除
  let summaryMessage = `**🤖 自動割り振りが完了しました！**\n- 消費チップ: ${totalCost.toLocaleString()}枚\n`;
  const purchasedList = Array.from(purchases.entries())
    .map(
      ([name, count]) =>
        `- ${config.idle.factories[name].emoji}${config.idle.factories[name].name}: +${count}レベル`
    )
    .join("\n");
  summaryMessage += purchasedList;

  await interaction.followUp({ content: summaryMessage, ephemeral: true });

  await unlockAchievements(interaction.client, userId, 14); // 適当強化
  if (totalCost >= 1000000) {
    await unlockAchievements(interaction.client, userId, 63); // 散財の試練
  }

  return true; // 成功
}

/**
 * プレステージの確認と実行を担当する関数
 * @param {import("discord.js").ButtonInteraction} interaction - プレステージボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 */
export async function handlePrestige(interaction, collector) {
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
 * スキルと工場のリセットを担当する関数
 * @param {import("discord.js").ButtonInteraction} interaction - リセットボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 */
export async function handleSkillReset(interaction, collector) {
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
 * SP/TPスキルの強化処理を担当する
 * @param {import("discord.js").ButtonInteraction} interaction - ボタンのインタラクション
 * @param {number} skillNum - 強化するスキルの番号 (1-8)
 * @returns {Promise<boolean>} 成功した場合はtrue、失敗した場合はfalseを返す
 */
export async function handleSkillUpgrade(interaction, skillNum) {
  const userId = interaction.user.id;
  const latestIdleGame = await IdleGame.findOne({ where: { userId } });
  if (!latestIdleGame) {
    await interaction.followUp({
      content: "エラー：ユーザーデータが見つかりません。",
      ephemeral: true,
    });
    return false;
  }

  const skillLevelKey = `skillLevel${skillNum}`;
  const currentLevel = latestIdleGame[skillLevelKey] || 0;

  try {
    if (skillNum >= 1 && skillNum <= 4) {
      // SPスキル
      const cost = Math.pow(2, currentLevel);
      if (latestIdleGame.skillPoints < cost) {
        await interaction.followUp({
          content: "SPが足りません！",
          ephemeral: true,
        });
        return false;
      }
      latestIdleGame.skillPoints -= cost;
      latestIdleGame[skillLevelKey] += 1;
    } else if (skillNum >= 5 && skillNum <= 8) {
      // TPスキル
      const skillConfig = config.idle.tp_skills[`skill${skillNum}`];
      const cost =
        skillConfig.baseCost *
        Math.pow(skillConfig.costMultiplier, currentLevel);
      if (latestIdleGame.transcendencePoints < cost) {
        await interaction.followUp({
          content: "TPが足りません！",
          ephemeral: true,
        });
        return false;
      }
      latestIdleGame.transcendencePoints -= cost;
      latestIdleGame[skillLevelKey] += 1;
    } else {
      return false; // 不正なスキル番号
    }

    await latestIdleGame.save();
  } catch (error) {
    console.error(`Skill #${skillNum} Upgrade Error:`, error);
    await interaction.followUp({
      content: `❌ スキル #${skillNum} 強化中にエラーが発生しました。`,
      ephemeral: true,
    });
    return false;
  }

  // 実績解除
  const achievementMap = { 1: 13, 2: 18, 3: 17, 4: 16 };
  if (achievementMap[skillNum]) {
    await unlockAchievements(
      interaction.client,
      userId,
      achievementMap[skillNum]
    );
  }

  await interaction.followUp({
    content: `✅ スキル #${skillNum} を強化しました！`,
    ephemeral: true,
  });
  return true;
}

/**
 * アセンションを実行し、チップと人口を消費して新たな力を得る関数
 * @param {import("discord.js").ButtonInteraction} interaction - ボタンのインタラクション
 * @returns {Promise<boolean>} 成功した場合はtrue、失敗した場合はfalseを返す
 */
export async function handleAscension(interaction) {
  const userId = interaction.user.id;
  const t = await sequelize.transaction(); // トランザクション開始

  try {
    // 1. 必要な最新データをDBから取得 (ロックをかけて安全に)
    const [latestPoint, latestIdleGame] = await Promise.all([
      Point.findOne({ where: { userId }, transaction: t, lock: t.LOCK.UPDATE }),
      IdleGame.findOne({
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      }),
    ]);
    if (!latestPoint || !latestIdleGame) {
      throw new Error("ユーザーデータが見つかりません。");
    }

    // 2. アセンション要件を再計算して最終チェック
    const ascensionCount = latestIdleGame.ascensionCount || 0;
    const { requiredPopulation_d, requiredChips } =
      calculateAscensionRequirements(
        ascensionCount,
        latestIdleGame.skillLevel6
      );

    if (
      new Decimal(latestIdleGame.population).lt(requiredPopulation_d) ||
      latestPoint.legacy_pizza < requiredChips
    ) {
      await interaction.followUp({
        content: "アセンションの条件を満たしていません。",
        ephemeral: true,
      });
      await t.rollback(); // 条件を満たさないのでロールバック
      return false;
    }

    // 3. データベースを更新
    // 3-1. チップと人口を消費
    latestPoint.legacy_pizza -= requiredChips;
    latestIdleGame.population = new Decimal(latestIdleGame.population)
      .minus(requiredPopulation_d)
      .toString();

    // 3-1b.チップを計上
    const spentChipsBigInt = BigInt(Math.floor(requiredChips));
    const currentSpentInfinity = BigInt(
      latestIdleGame.chipsSpentThisInfinity || "0"
    );
    latestIdleGame.chipsSpentThisInfinity = (
      currentSpentInfinity + spentChipsBigInt
    ).toString();
    const currentSpentEternity = BigInt(
      latestIdleGame.chipsSpentThisEternity || "0"
    );
    latestIdleGame.chipsSpentThisEternity = (
      currentSpentEternity + spentChipsBigInt
    ).toString();

    // 3-2. アセンション回数を増やす
    latestIdleGame.ascensionCount += 1;

    // 3-3. 変更を保存
    await latestPoint.save({ transaction: t });
    await latestIdleGame.save({ transaction: t });

    // 4. トランザクションをコミット (全てのDB操作が成功した場合)
    await t.commit();

    // 5. 成功メッセージと実績解除
    await interaction.followUp({
      content: `🚀 **賃金として${requiredChips}チップを貰った${requiredPopulation_d}匹のニョワミヤ達は何処かへと旅立っていった… (現在: ${latestIdleGame.ascensionCount}回)**`,
      ephemeral: true,
    });

    // 実績解除
    await unlockAchievements(interaction.client, userId, 79); // #79: あるものはニョワミヤでも使う
    if (latestIdleGame.ascensionCount >= 10) {
      await unlockAchievements(interaction.client, userId, 80); // #80: ニョワミヤがニョワミヤを呼ぶ
    }
    if (latestIdleGame.ascensionCount >= 50) {
      await unlockAchievements(interaction.client, userId, 81); // #81: ニョワミヤ永久機関
    }

    return true; // 成功
  } catch (error) {
    console.error("Ascension Error:", error);
    await t.rollback(); // エラーが発生したらロールバック
    await interaction.followUp({
      content: "❌ アセンション中にエラーが発生しました。",
      ephemeral: true,
    });
    return false;
  }
}

/**
 * Infinityを実行し、世界をリセットする関数
 * @param {import("discord.js").ButtonInteraction} interaction - Infinityボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 */
export async function handleInfinity(interaction, collector) {
  // 1. コレクターを停止
  collector.stop();

  try {
    let gainedIP = new Decimal(0);
    let isFirstInfinity = false;
    let newInfinityCount = 0;

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
      newInfinityCount = latestIdleGame.infinityCount + 1;

      // 3. IP獲得量を計算（現在は固定で1）増える要素ができたらutils\idle-game-calculator.mjsで計算する
      gainedIP = calculateGainedIP(latestIdleGame);

      // 4.ジェネレーターをリセットし
      const oldGenerators = latestIdleGame.ipUpgrades?.generators || [];
      const newGenerators = Array.from({ length: 8 }, (_, i) => {
        // 既存のi番目のジェネレーターデータを取得。なければデフォルト値 { bought: 0 } を使う
        const oldGen = oldGenerators[i] || { bought: 0 };
        return {
          amount: String(oldGen.bought), // 2回目以降: 購入数(bought)が初期所持数(amount)になる
          bought: oldGen.bought,
        };
      });
      const newIpUpgrades = {
        ...(latestIdleGame.ipUpgrades || {}), // 既存のipUpgradesの全プロパティを展開
        generators: newGenerators, // generatorsプロパティだけを新しいもので上書き
      };
      latestIdleGame.changed("ipUpgrades", true); //changedを入れないとjsonbは更新してくれない、めんどくさい！

      // 5. データベースの値をリセット＆更新
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
          ascensionCount: 0,
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
          generatorPower: "1",
          ipUpgrades: newIpUpgrades,
          buffMultiplier: 2.0,

          // --- 更新される項目 ---
          infinityPoints: new Decimal(latestIdleGame.infinityPoints)
            .add(gainedIP)
            .toString(),
          infinityCount: newInfinityCount, // infinityCountはDouble型なので、JSのNumberでOK
          lastUpdatedAt: new Date(),
        },
        { transaction: t }
      );
    });

    await unlockAchievements(interaction.client, interaction.user.id, 72); //THE END
    if (newInfinityCount === 2) {
      await unlockAchievements(interaction.client, interaction.user.id, 83); // #83: 再び果てへ
    }
    if (newInfinityCount === 5) {
      await unlockAchievements(interaction.client, interaction.user.id, 84); // #84: それはもはや目標ではない
    }

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
 * ジェネレーターを購入する処理
 * @param {import("discord.js").ButtonInteraction} interaction - ボタンのインタラクション
 * @param {number} generatorId - 購入するジェネレーターのID
 * @returns {Promise<boolean>} 成功した場合はtrue、失敗した場合はfalseを返す
 */
export async function handleGeneratorPurchase(interaction, generatorId) {
  const userId = interaction.user.id;
  const t = await sequelize.transaction();

  try {
    // 1. 最新データを取得
    const latestIdleGame = await IdleGame.findOne({
      where: { userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!latestIdleGame) throw new Error("ユーザーデータが見つかりません。");

    // 2. コストを計算
    const generatorIndex = generatorId - 1;
    const currentBought =
      latestIdleGame.ipUpgrades?.generators?.[generatorIndex]?.bought || 0;
    const cost_d = calculateGeneratorCost(generatorId, currentBought);

    // 3. IPが足りるかチェック
    const currentIp_d = new Decimal(latestIdleGame.infinityPoints);
    if (currentIp_d.lt(cost_d)) {
      await interaction.followUp({
        content: "IPが足りません！",
        ephemeral: true,
      });
      await t.rollback();
      return false;
    }

    // 4. データベースを更新
    // 4-1. IPを減算
    latestIdleGame.infinityPoints = currentIp_d.minus(cost_d).toString();

    // 4-2. ジェネレーターの購入回数をインクリメント
    latestIdleGame.ipUpgrades.generators[generatorIndex].bought += 1;
    //個数も
    generatorData.amount = new Decimal(generatorData.amount).add(1).toString();

    // ★★★ ここでは .save() を使うので changed が必要！ ★★★
    latestIdleGame.changed("ipUpgrades", true);

    // 4-3. 変更を保存
    await latestIdleGame.save({ transaction: t });

    // 5. トランザクションをコミット
    await t.commit();

    // ▼▼▼ 6. 実績解除処理を追加 ▼▼▼
    const newBoughtCount =
      latestIdleGame.ipUpgrades.generators[generatorIndex].bought;

    // #85: ダブル・ジェネレーター (ジェネレーターIを2個購入)
    if (generatorId === 1 && newBoughtCount === 2) {
      await unlockAchievements(interaction.client, userId, 85);
    }
    // #86: アンチマター・ディメンジョンズ (ジェネレーターIIを2個購入)
    if (generatorId === 2 && newBoughtCount === 2) {
      await unlockAchievements(interaction.client, userId, 86);
    }

    // #82: 放置は革命だ (いずれかのジェネレーターを初めて購入)
    // 全ジェネレーターの合計購入数を計算
    const totalBought = latestIdleGame.ipUpgrades.generators.reduce(
      (sum, gen) => sum + gen.bought,
      0
    );
    if (totalBought === 1) {
      await unlockAchievements(interaction.client, userId, 82);
    }

    // 7. 成功メッセージ
    await interaction.followUp({
      content: `✅ **${config.idle.infinityGenerators[generatorIndex].name}** を購入しました！`,
      ephemeral: true,
    });

    return true;
  } catch (error) {
    console.error("Generator Purchase Error:", error);
    await t.rollback();
    await interaction.followUp({
      content: "❌ 購入中にエラーが発生しました。",
      ephemeral: true,
    });
    return false;
  }
}

//-------------------------
//ここからは補助的なもの
//--------------------------
/**
 * 指定された予算内で購入可能な施設をシミュレートする純粋な計算関数
 * @param {object} initialIdleGame - シミュレーション開始時のIdleGameデータ
 * @param {number} budget - 利用可能なチップの予算
 * @param {Set<number>} unlockedSet - 解放済み実績IDのSet
 * @returns {{purchases: Map<string, number>, totalCost: number, purchasedCount: number}} 購入プラン
 */
function simulatePurchases(initialIdleGame, budget, unlockedSet) {
  let availableChips = budget;
  // 元のデータを壊さないように、操作用のコピーを作成する
  const tempIdleGame = JSON.parse(JSON.stringify(initialIdleGame));

  const purchases = new Map(); // { "oven": 3, "cheese": 2 } のような購入結果を格納
  let totalCost = 0;
  let purchasedCount = 0;
  const MAX_ITERATIONS = 1000; // 無限ループ防止

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const costs = calculateAllCosts(tempIdleGame);

    // 購入可能な施設をフィルタリングし、コストの安い順にソート
    const affordableFacilities = Object.entries(costs)
      .filter(([name, cost]) => {
        const factoryConfig = config.idle.factories[name];
        if (!factoryConfig || availableChips < cost) return false;

        // 実績によるロックを判定
        if (
          factoryConfig.unlockAchievementId &&
          !unlockedSet.has(factoryConfig.unlockAchievementId)
        ) {
          return false;
        }
        // (PP8以上で自動購入が解放されるので、人口制限は考慮しなくてOK)
        return true;
      })
      .sort(([, costA], [, costB]) => costA - costB);

    // 買えるものがなければループ終了
    if (affordableFacilities.length === 0) {
      break;
    }

    const [cheapestFacilityName, cheapestCost] = affordableFacilities[0];

    // 予算を消費し、結果を記録
    availableChips -= cheapestCost;
    totalCost += cheapestCost;
    purchasedCount++;

    // Mapに購入数を記録 (すでにあれば+1, なければ1)
    purchases.set(
      cheapestFacilityName,
      (purchases.get(cheapestFacilityName) || 0) + 1
    );

    // シミュレーション用の施設レベルを上げる
    const levelKey = config.idle.factories[cheapestFacilityName].key;
    tempIdleGame[levelKey]++;
  }

  return { purchases, totalCost, purchasedCount };
}
