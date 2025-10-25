//idle-game\handlers.mjs
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
  calculateTPSkillCost,
  calculateGhostChipBudget,
  calculateGhostChipUpgradeCost,
} from "./idle-game-calculator.mjs";

import Decimal from "break_infinity.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

/**
 * 【新規】放置ゲームの設定モーダルを表示し、更新処理を行う
 * @param {import("discord.js").Interaction} interaction - コマンドまたはボタンのインタラクション
 */
export async function handleSettings(interaction) {
  const userId = interaction.user.id;
  const idleGame = await IdleGame.findOne({ where: { userId } });

  if (!idleGame) {
    await interaction.reply({
      content: "まだ放置ゲームのデータがありません。",
      ephemeral: true,
    });
    return;
  }

  // 1. 現在の設定を読み込む (データがなければデフォルト値)
  const currentSettings = idleGame.settings || {
    skipPrestigeConfirmation: false,
    skipSkillResetConfirmation: false,
    autoAssignTpEnabled: false,
  };

  // 2. 現在の設定から、セレクトメニューのどの値が選択されているべきかを判断
  let defaultValue = "none"; // デフォルトは「両方しない」
  if (
    currentSettings.skipPrestigeConfirmation &&
    currentSettings.skipSkillResetConfirmation
  ) {
    defaultValue = "both";
  } else if (currentSettings.skipPrestigeConfirmation) {
    defaultValue = "prestige_only";
  } else if (currentSettings.skipSkillResetConfirmation) {
    defaultValue = "reset_only";
  }

  const isAutoTpEnabled = currentSettings.autoAssignTpEnabled === true;
  // 3. モーダルを構築
  const modal = new ModalBuilder()
    .setCustomId("idle_settings_modal") // 固有名詞のID
    .setTitle("放置ゲーム 設定")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("確認スキップ設定")
        .setDescription(
          "周回時、プレステージやスキルリセットの確認画面をスキップします。"
        )
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("skip_confirmation_select") // このモーダル内でのID
            .setPlaceholder("設定を選択してください...")
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("プレステージとスキルリセットの両方をスキップ")
                .setValue("both")
                .setDefault(defaultValue === "both"), // 4. デフォルト値を設定
              new StringSelectMenuOptionBuilder()
                .setLabel("プレステージのみスキップ")
                .setValue("prestige_only")
                .setDefault(defaultValue === "prestige_only"),
              new StringSelectMenuOptionBuilder()
                .setLabel("スキルリセットのみスキップ")
                .setValue("reset_only")
                .setDefault(defaultValue === "reset_only"),
              new StringSelectMenuOptionBuilder()
                .setLabel("スキップしない（通常）")
                .setValue("none")
                .setDefault(defaultValue === "none")
            )
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("IU12「自動調理器」の効果")
        .setDescription(
          "プレステージ時のTP自動割り振りを有効にするか選択します。"
        )
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("auto_tp_assign_select") // 新しいID
            .setPlaceholder("設定を選択...")
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("有効 (ON)")
                .setValue("on")
                .setDefault(isAutoTpEnabled), // 現在の設定を反映
              new StringSelectMenuOptionBuilder()
                .setLabel("無効 (OFF)")
                .setValue("off")
                .setDefault(!isAutoTpEnabled) // 現在の設定を反映
            )
        )
    );
  // 5. モーダルを表示
  await interaction.showModal(modal);

  // 6. ユーザーの送信を待つ
  const submitted = await interaction
    .awaitModalSubmit({ time: 60_000 })
    .catch(() => null);

  if (submitted) {
    try {
      const selectedValue = submitted.fields.getStringSelectValues(
        "skip_confirmation_select"
      )[0];
      const autoAssignChoice = submitted.fields.getStringSelectValues(
        "auto_tp_assign_select"
      )[0];

      const newSettings = { ...currentSettings }; // 現在の設定をコピー

      // 7. 選択された値に応じて設定を更新
      switch (selectedValue) {
        case "both":
          newSettings.skipPrestigeConfirmation = true;
          newSettings.skipSkillResetConfirmation = true;
          break;
        case "prestige_only":
          newSettings.skipPrestigeConfirmation = true;
          newSettings.skipSkillResetConfirmation = false;
          break;
        case "reset_only":
          newSettings.skipPrestigeConfirmation = false;
          newSettings.skipSkillResetConfirmation = true;
          break;
        case "none":
          newSettings.skipPrestigeConfirmation = false;
          newSettings.skipSkillResetConfirmation = false;
          break;
      }
      if (autoAssignChoice === "on") {
        newSettings.autoAssignTpEnabled = true;
      } else if (autoAssignChoice === "off") {
        newSettings.autoAssignTpEnabled = false;
      }
      // 8. データベースを更新
      await IdleGame.update({ settings: newSettings }, { where: { userId } });

      await submitted.reply({
        content: "✅ 設定を保存しました！",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Idle settings update error:", error);
      await submitted.reply({
        content: "❌ 設定の保存中にエラーが発生しました。",
        ephemeral: true,
      });
    }
  }
}

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
  const purchasedIUs = new Set(latestIdleGame.ipUpgrades?.upgrades || []);
  const skillLevel6 = latestIdleGame.skillLevel6 || 0;
  const currentLevel =
    latestIdleGame[config.idle.factories[facilityName].key] || 0;
  const cost = calculateFacilityCost(
    facilityName,
    currentLevel,
    skillLevel6,
    purchasedIUs
  );

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
 * 【新規】プレステージのDB更新処理を実行する内部関数 (修正版)
 * @param {string} userId
 * @param {import("discord.js").Client} client - 実績解除に必要
 * @returns {Promise<object>} プレステージの結果オブジェクト
 */
async function executePrestigeTransaction(userId, client) {
  let prestigeResult = {};

  await sequelize.transaction(async (t) => {
    const latestIdleGame = await IdleGame.findOne({
      where: { userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const currentPopulation_d = new Decimal(latestIdleGame.population);
    const highestPopulation_d = new Decimal(latestIdleGame.highestPopulation);

    // #65 充足の試練チェック
    if (latestIdleGame.skillLevel1 === 0 && currentPopulation_d.gte("1e27")) {
      // ★修正: interaction.client -> client, interaction.user.id -> userId
      await unlockAchievements(client, userId, 65);
    }
    // #62 虚無の試練チェック
    const areFactoriesLevelZero =
      latestIdleGame.pizzaOvenLevel === 0 &&
      latestIdleGame.cheeseFactoryLevel === 0 &&
      latestIdleGame.tomatoFarmLevel === 0 &&
      latestIdleGame.mushroomFarmLevel === 0 &&
      latestIdleGame.anchovyFactoryLevel === 0;
    if (areFactoriesLevelZero && currentPopulation_d.gte("1e24")) {
      // ★修正: interaction.client -> client, interaction.user.id -> userId
      await unlockAchievements(client, userId, 62);
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
      latestIdleGame.pizzaOvenLevel >= 70 &&
      currentPopulation_d.gte("1e16")
    ) {
      // ★修正: interaction.client -> client, interaction.user.id -> userId
      await unlockAchievements(client, userId, 74);
    }

    if (currentPopulation_d.gt(highestPopulation_d)) {
      // --- PP/SPプレステージ (既存のロジック) ---
      if (currentPopulation_d.lte(config.idle.prestige.unlockPopulation)) {
        throw new Error("プレステージの最低人口条件を満たしていません。");
      }

      let newPrestigePower = currentPopulation_d.log10();
      //IU21で+10%
      if (latestIdleGame.ipUpgrades.upgrades.includes("IU21")) {
        // configからボーナス値を取得
        const bonus = config.idle.infinityUpgrades.tiers[1].upgrades.IU21.bonus;
        newPrestigePower *= 1 + bonus; // newPrestigePower = newPrestigePower * 1.1
      }

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
        latestIdleGame.skillLevel8,
        latestIdleGame.challenges
      );

      latestIdleGame.transcendencePoints += gainedTP; //TPだけ先に加算

      // IU12「自動調理器」の処理
      if (
        latestIdleGame.ipUpgrades.upgrades.includes("IU12") &&
        latestIdleGame.transcendencePoints > 0 &&
        latestIdleGame.settings?.autoAssignTpEnabled === true
      ) {
        autoAssignTP(latestIdleGame); // オブジェクトが直接変更される
      }

      // 3. DBに書き込むための「設計図」を作成
      let updateData = {
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
        highestPopulation: currentPopulation_d.toString(),
        transcendencePoints: latestIdleGame.transcendencePoints,
        skillLevel5: latestIdleGame.skillLevel5,
        skillLevel6: latestIdleGame.skillLevel6,
        skillLevel7: latestIdleGame.skillLevel7,
        skillLevel8: latestIdleGame.skillLevel8,
        lastUpdatedAt: new Date(),
        challenges: latestIdleGame.challenges,
      };

      // 4. IU11「ゴーストチップ」の処理
      if (latestIdleGame.ipUpgrades.upgrades.includes("IU11")) {
        const currentGhostLevel =
          latestIdleGame.ipUpgrades?.ghostChipLevel || 0;
        updateData = await applyGhostChipBonus(
          updateData,
          userId,
          currentGhostLevel
        );
      }

      // 5. 最終的な設計図でDBを更新
      await latestIdleGame.update(updateData, { transaction: t });

      // プレステージ実績
      // ★修正: interaction.client -> client, interaction.user.id -> userId
      await unlockAchievements(client, userId, 11);
      prestigeResult = {
        type: "PP_SP",
        population_d: currentPopulation_d,
        gainedTP: gainedTP,
      };
    } else if (currentPopulation_d.gte("1e16")) {
      // --- TPプレステージ (新しいロジック) ---
      const gainedTP = calculatePotentialTP(
        currentPopulation_d,
        latestIdleGame.skillLevel8,
        latestIdleGame.challenges
      );

      latestIdleGame.transcendencePoints += gainedTP; //TPだけ先に加算

      // IU12「自動調理器」の処理
      if (
        latestIdleGame.ipUpgrades.upgrades.includes("IU12") &&
        latestIdleGame.transcendencePoints > 0 &&
        latestIdleGame.settings?.autoAssignTpEnabled === true
      ) {
        autoAssignTP(latestIdleGame); // オブジェクトが直接変更される
      }

      // 3. DBに書き込むための「設計図」を作成
      let updateData = {
        population: "0",
        pizzaOvenLevel: 0,
        cheeseFactoryLevel: 0,
        tomatoFarmLevel: 0,
        mushroomFarmLevel: 0,
        anchovyFactoryLevel: 0,
        oliveFarmLevel: 0,
        wheatFarmLevel: 0,
        pineappleFarmLevel: 0,
        transcendencePoints: latestIdleGame.transcendencePoints,
        skillLevel5: latestIdleGame.skillLevel5,
        skillLevel6: latestIdleGame.skillLevel6,
        skillLevel7: latestIdleGame.skillLevel7,
        skillLevel8: latestIdleGame.skillLevel8,
        lastUpdatedAt: new Date(),
        challenges: latestIdleGame.challenges,
      };

      // 4. IU11「ゴーストチップ」の処理
      if (latestIdleGame.ipUpgrades.upgrades.includes("IU11")) {
        const currentGhostLevel =
          latestIdleGame.ipUpgrades?.ghostChipLevel || 0;
        updateData = await applyGhostChipBonus(
          updateData,
          userId,
          currentGhostLevel
        );
      }

      // 5. 最終的な設計図でDBを更新
      await latestIdleGame.update(updateData, { transaction: t });

      prestigeResult = {
        type: "TP_ONLY",
        population_d: currentPopulation_d,
        gainedTP: gainedTP,
      };
    } else {
      throw new Error("プレステージの条件を満たしていません。");
    }
  });

  return prestigeResult;
}

/**
 * プレステージの確認と実行を担当する司令塔関数
 * @param {import("discord.js").ButtonInteraction} interaction - プレステージボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 * @returns {Promise<boolean>} UIの再描画が必要な場合はtrue、不要な場合はfalseを返す
 */
export async function handlePrestige(interaction, collector) {
  const userId = interaction.user.id;
  const client = interaction.client; // 実績解除用にclientオブジェクトを取得

  // 1. ユーザーの設定をDBから読み込む
  // (トランザクションの外なのでロックは不要)
  const latestIdleGame = await IdleGame.findOne({ where: { userId } });
  if (!latestIdleGame) {
    // 念のためデータ存在チェック
    await interaction.followUp({
      content: "エラー: ユーザーデータが見つかりません。",
      ephemeral: true,
    });
    return false;
  }
  const skipConfirmation =
    latestIdleGame.settings?.skipPrestigeConfirmation || false;

  // 2. 設定値に応じて処理を分岐
  if (skipConfirmation) {
    // --- 【A】確認をスキップするルート ---
    try {
      // プレステージの本体処理を呼び出す
      const result = await executePrestigeTransaction(userId, client);

      // 短い成功通知をユーザーに送信
      await interaction.followUp({
        content: `✅ プレステージを即時実行しました！`,
        ephemeral: true,
      });

      // UI更新が必要なことを呼び出し元に伝える
      return true;
    } catch (error) {
      console.error("Prestige (skip confirmation) Error:", error);
      await interaction.followUp({
        content: `❌ プレステージの実行中にエラーが発生しました: ${error.message}`,
        ephemeral: true,
      });
      return false; // 失敗したのでUI更新は不要
    }
  } else {
    // --- 【B】従来通りの確認ルート ---
    collector.stop(); // 親コレクターを停止

    // 確認用のメッセージとボタンを作成
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

    let confirmationInteraction = null;
    const confirmationMessage = await interaction.followUp({
      content:
        "# ⚠️パイナップル警報！ \n### **本当にプレステージを実行しますか？**\n精肉工場以外の工場レベルと人口がリセットされます。この操作は取り消せません！",
      components: [confirmationRow],
      flags: 64, // 本人にだけ見える確認
      fetchReply: true,
    });

    try {
      // ユーザーの応答を待つ
      confirmationInteraction = await confirmationMessage.awaitMessageComponent(
        {
          filter: (i) => i.user.id === userId,
          time: 60_000,
        }
      );

      if (confirmationInteraction.customId === "prestige_confirm_no") {
        await confirmationInteraction.update({
          content: "プレステージをキャンセルしました。工場は無事です！",
          components: [],
        });
        return false; // UI更新は不要
      }

      // 「はい」が押されたら、プレステージの本体処理を呼び出す
      await confirmationInteraction.deferUpdate();
      const result = await executePrestigeTransaction(userId, client);

      // 結果に応じたストーリー付きの成功メッセージを送信
      if (result.type === "PP_SP") {
        await confirmationInteraction.editReply({
          content: `●プレステージ\n# なんと言うことでしょう！あなたはパイナップル工場を稼働してしまいました！\n凄まじい地響きと共に${formatNumberJapanese_Decimal(result.population_d)}匹のニョワミヤ達が押し寄せてきます！\n彼女（？）たちは怒っているのでしょうか……いえ、違います！ 逆です！ 彼女たちはパイナップルの乗ったピザが大好きなのでした！\n狂った様にパイナップルピザを求めたニョワミヤ達によって、今までのピザ工場は藻屑のように吹き飛ばされてしまいました……\n-# そしてなぜか次の工場は強化されました。`,
          components: [],
        });
      } else if (result.type === "TP_ONLY") {
        await confirmationInteraction.editReply({
          content: `●TPプレステージ\n# そうだ、サイドメニュー作ろう。\nあなた達は${formatNumberJapanese_Decimal(result.population_d)}匹のニョワミヤ達と一緒にサイドメニューを作ることにしました。\n美味しそうなポテトやナゲット、そして何故か天ぷらの数々が揚がっていきます・　・　・　・　・　・。\n-# 何故か終わる頃には工場は蜃気楼のように消えてしまっていました。\n${result.gainedTP.toFixed(2)}TPを手に入れました。`,
          components: [],
        });
      }
    } catch (error) {
      console.error("Prestige (with confirmation) Error:", error);
      if (confirmationInteraction) {
        // DBエラーなど、ボタン操作後のエラー
        await confirmationInteraction.editReply({
          content: `❌ データベースエラーにより、プレステージに失敗しました: ${error.message}`,
          components: [],
        });
      } else {
        // タイムアウトエラー
        await confirmationMessage.edit({
          content:
            "タイムアウトまたは内部エラーにより、プレステージはキャンセルされました。",
          components: [],
        });
      }
    }

    // このルートは親コレクターが停止しており、UI更新は不要
    return false;
  }
}

/**
 * 【新規】スキルリセットのDB更新処理を実行する内部関数
 * @param {string} userId
 * @param {import("discord.js").Client} client - 実績解除に必要
 * @returns {Promise<number>} 返還されたSPの量
 */
async function executeSkillResetTransaction(userId, client) {
  let refundedSP = 0;

  await sequelize.transaction(async (t) => {
    const latestIdleGame = await IdleGame.findOne({
      where: { userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // 返還するSPを計算
    const spent1 = calculateSpentSP(latestIdleGame.skillLevel1);
    const spent2 = calculateSpentSP(latestIdleGame.skillLevel2);
    const spent3 = calculateSpentSP(latestIdleGame.skillLevel3);
    const spent4 = calculateSpentSP(latestIdleGame.skillLevel4);
    const totalRefundSP = spent1 + spent2 + spent3 + spent4;
    refundedSP = totalRefundSP;

    // #64 忍耐の試練記録
    const challenges = latestIdleGame.challenges || {};
    if (!challenges.trial64?.isCleared) {
      challenges.trial64 = {
        lastPrestigeTime: latestIdleGame.infinityTime,
        isCleared: false,
      };
      latestIdleGame.changed("challenges", true);
    }

    // データベースの値を更新
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

  // スキルリセット実績
  await unlockAchievements(client, userId, 15);

  return refundedSP;
}

/**
 * スキルと工場のリセットを担当する司令塔関数
 * @param {import("discord.js").ButtonInteraction} interaction - リセットボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 * @returns {Promise<{success: boolean}>} UI更新の要否を返すオブジェクト
 */
export async function handleSkillReset(interaction, collector) {
  const userId = interaction.user.id;
  const client = interaction.client;

  const latestIdleGame = await IdleGame.findOne({ where: { userId } });
  if (!latestIdleGame) {
    await interaction.followUp({
      content: "エラー: ユーザーデータが見つかりません。",
      flags: 64,
    });
    return false;
  }
  const skipConfirmation =
    latestIdleGame.settings?.skipSkillResetConfirmation || false;

  if (skipConfirmation) {
    // --- 【A】確認をスキップするルート ---
    try {
      const refundedSP = await executeSkillResetTransaction(userId, client);
      await interaction.followUp({
        content: `✅ スキルと工場を即時リセットし、${refundedSP.toFixed(2)} SP が返還されました。`,
        flags: 64,
      });
      return true;
    } catch (error) {
      console.error("Skill Reset (skip confirmation) Error:", error);
      await interaction.followUp({
        content: `❌ スキルリセット中にエラーが発生しました: ${error.message}`,
        flags: 64,
      });
      return false;
    }
  } else {
    // --- 【B】従来通りの確認ルート ---
    collector.stop();

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

    const confirmationMessage = await interaction.followUp({
      content:
        "### ⚠️ **本当にスキルをリセットしますか？**\n消費したSPは全て返還されますが、精肉工場以外の工場レベルと人口も含めて**全てリセット**されます。この操作は取り消せません！",
      components: [confirmationRow],
      flags: 64,
      fetchReply: true,
    });
    try {
      const confirmationInteraction =
        await confirmationMessage.awaitMessageComponent({
          filter: (i) => i.user.id === userId,
          time: 60_000,
        });

      if (confirmationInteraction.customId === "skill_reset_confirm_no") {
        await confirmationInteraction.update({
          content: "スキルリセットをキャンセルしました。",
          components: [],
        });
        return false;
      }

      await confirmationInteraction.deferUpdate();
      const refundedSP = await executeSkillResetTransaction(userId, client);

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

    return false;
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
    const purchasedIUs = new Set(latestIdleGame.ipUpgrades?.upgrades || []);
    const activeChallenge = latestIdleGame.challenges?.activeChallenge;
    const { requiredPopulation_d, requiredChips } =
      calculateAscensionRequirements(
        ascensionCount,
        latestIdleGame.skillLevel6,
        purchasedIUs,
        activeChallenge
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
    let infinityPopulation_d = new Decimal(0);

    let challengeWasCleared = false;
    let challengeWasFailed = false; //IC2
    let activeChallenge = null;
    let newCompletedCount = 0;

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
      //break後に備えて人口を記録
      infinityPopulation_d = new Decimal(latestIdleGame.population);
      //チャレンジクリア処理
      activeChallenge = latestIdleGame.challenges?.activeChallenge;
      const currentChallenges = latestIdleGame.challenges || {};

      if (activeChallenge) {
        let challengeSuccess = true;
        // ここに将来的に「失敗条件」を追加できる （●●時間以内にクリアなど縛れない時）
        //IC2
        if (activeChallenge === "IC2") {
          const GAME_HOURS_12_IN_SECONDS = 12 * 60 * 60;
          if (latestIdleGame.infinityTime > GAME_HOURS_12_IN_SECONDS) {
            challengeSuccess = false; // 12時間を超えていたら失敗
            challengeWasFailed = true; // 失敗したことを記録
          }
        }

        if (challengeSuccess) {
          if (!currentChallenges.completedChallenges) {
            currentChallenges.completedChallenges = [];
          }
          // 重複を防ぎつつ、クリア済みリストに追加
          if (
            !currentChallenges.completedChallenges.includes(activeChallenge)
          ) {
            currentChallenges.completedChallenges.push(activeChallenge);
            challengeWasCleared = true;
          }
          if (activeChallenge === "IC9") {
            // 1. チャレンジ開始時の現実時間を取得
            const startTime = new Date(currentChallenges.IC9.startTime);
            // 2. 現在の現実時間を取得
            const endTime = new Date();
            // 3. 差を計算して、秒単位に変換
            const completionTimeInSeconds =
              (endTime.getTime() - startTime.getTime()) / 1000;
            const bestTime = currentChallenges.IC9?.bestTime || Infinity;
            if (completionTimeInSeconds < bestTime) {
              currentChallenges.IC9.bestTime = completionTimeInSeconds;
            }
            delete currentChallenges.IC9.startTime;
          }
        }
        // 成功・失敗に関わらず、アクティブなチャレンジはリセット
        delete currentChallenges.activeChallenge;
        latestIdleGame.changed("challenges", true);
      }
      newCompletedCount = currentChallenges.completedChallenges?.length || 0;

      //∞を1増やす
      if (latestIdleGame.infinityCount === 0) {
        isFirstInfinity = true;
      }
      newInfinityCount = latestIdleGame.infinityCount + 1;

      // 3. IP獲得量を計算（現在は固定で1）増える要素ができたらutils\idle-game-calculator.mjsで計算する
      gainedIP = calculateGainedIP(latestIdleGame, newCompletedCount);

      // IC6クリア報酬.初期#1~4LvをIPを元に決定
      let initialSkillLevel = 0; // デフォルトの初期スキルレベル
      const completedChallenges = currentChallenges.completedChallenges || [];
      if (completedChallenges.includes("IC6")) {
        // 6-1. 「得られる」IPの桁数を計算 (これがボーナスSPとなる)
        const bonusSP = Math.max(1, Math.floor(gainedIP.abs().log10()) + 1);
        // 6-2. log2の公式でボーナスレベルを計算
        // (小数点以下は切り捨て)
        initialSkillLevel = Math.floor(Math.log2(bonusSP + 1));
      }
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
          skillLevel1: initialSkillLevel,
          skillLevel2: initialSkillLevel,
          skillLevel3: initialSkillLevel,
          skillLevel4: initialSkillLevel,
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
          challenges: currentChallenges,
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

    //IC失敗（２）
    if (challengeWasFailed) {
      await interaction.followUp({
        content: `⌛ **インフィニティチャレンジ ${activeChallenge}** に失敗しました… (条件: ゲーム内時間12時間以内)`,
        ephemeral: true,
      });
    }
    //ICクリア
    if (challengeWasCleared) {
      await unlockAchievements(interaction.client, interaction.user.id, 91); //#91 無限の試練
      if (newCompletedCount === 4) {
        await unlockAchievements(interaction.client, interaction.user.id, 92); // #92 意外と簡単かも？
      }
      if (newCompletedCount === 9) {
        await unlockAchievements(interaction.client, interaction.user.id, 93); // #93 どうだ、見たか！
      }
      await interaction.followUp({
        content: `🎉 **インフィニティチャレンジ ${activeChallenge}** を達成しました！`,
        ephemeral: true,
      });
    }

    // 5. 成功メッセージを送信（初回かどうかで分岐）
    let successMessage;
    if (infinityPopulation_d.gt("1.8e+308")) {
      //break infinity以降
      successMessage = `# ●${formatNumberJapanese_Decimal(infinityPopulation_d)} Break Infinity
## ――ニョワミヤはどこまで増えるのだろう。
数え切れぬチップと時間を注ぎ込み、あなたはついに果てであるべき"無限"すら打ち倒した。
どうやら、宇宙一美味しいピザを作るこの旅はまだまだ終わりそうに無いようだ。

ならば、無限に広がるこの宇宙すら無限で埋め尽くしてしまおう。
**${gainedIP.toString()} IP** と **1 ∞** を手に入れた。
`;
    } else if (isFirstInfinity) {
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
      successMessage = `# ●${formatNumberJapanese_Decimal(infinityPopulation_d)} Infinity
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
    latestIdleGame.ipUpgrades.generators[generatorIndex].amount = new Decimal(
      latestIdleGame.ipUpgrades.generators[generatorIndex].amount
    )
      .add(1)
      .toString();

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
    if (generatorId === 2 && newBoughtCount === 1) {
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

/**
 * インフィニティアップグレードを購入する処理
 * @param {import("discord.js").ButtonInteraction} interaction
 * @param {string} upgradeId - 購入するアップグレードのID (例: "IU13")
 * @returns {Promise<boolean>} 成功した場合はtrue
 */
export async function handleInfinityUpgradePurchase(interaction, upgradeId) {
  const userId = interaction.user.id;
  const t = await sequelize.transaction();

  try {
    const latestIdleGame = await IdleGame.findOne({
      where: { userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!latestIdleGame) throw new Error("ユーザーデータが見つかりません。");

    if (!latestIdleGame.ipUpgrades.upgrades) {
      latestIdleGame.ipUpgrades.upgrades = [];
    }

    // 設定ファイルからアップグレード情報を取得
    let upgradeConfig = null;
    for (const tier of config.idle.infinityUpgrades.tiers) {
      if (tier.upgrades[upgradeId]) {
        upgradeConfig = tier.upgrades[upgradeId];
        break; // 見つかったらループを抜ける
      }
    }
    if (!upgradeConfig) throw new Error("存在しないアップグレードです。");

    // 既に購入済みかチェック
    if (latestIdleGame.ipUpgrades.upgrades.includes(upgradeId)) {
      await interaction.followUp({
        content: "既に購入済みのアップグレードです。",
        ephemeral: true,
      });
      await t.rollback();
      return false;
    }

    const cost_d = new Decimal(upgradeConfig.cost);
    const currentIp_d = new Decimal(latestIdleGame.infinityPoints);

    if (currentIp_d.lt(cost_d)) {
      await interaction.followUp({
        content: "IPが足りません！",
        ephemeral: true,
      });
      await t.rollback();
      return false;
    }

    // IPを減算し、購入済みリストに追加
    latestIdleGame.infinityPoints = currentIp_d.minus(cost_d).toString();
    latestIdleGame.ipUpgrades.upgrades.push(upgradeId);
    //IU11はLv1を入れる
    if (upgradeId === "IU11") {
      if (latestIdleGame.ipUpgrades.ghostChipLevel === undefined) {
        latestIdleGame.ipUpgrades.ghostChipLevel = 0; // 安全策としてまず初期化
      }
      // 既にレベルがある場合は何もしないが、初回購入時は必ず1にする
      if (latestIdleGame.ipUpgrades.ghostChipLevel < 1) {
        latestIdleGame.ipUpgrades.ghostChipLevel = 1;
      }
    }
    latestIdleGame.changed("ipUpgrades", true); // JSONBの変更を通知

    await latestIdleGame.save({ transaction: t });
    await t.commit();

    await interaction.followUp({
      content: `✅ **${upgradeConfig.name}** を購入しました！`,
      ephemeral: true,
    });
    return true;
  } catch (error) {
    await t.rollback();
    console.error("Infinity Upgrade Purchase Error:", error);
    await interaction.followUp({
      content: "❌ 購入中にエラーが発生しました。",
      ephemeral: true,
    });
    return false;
  }
}

/**
 * 【新規】ゴーストチップを強化する処理
 * @param {import("discord.js").ButtonInteraction} interaction
 * @returns {Promise<boolean>}
 */
export async function handleGhostChipUpgrade(interaction) {
  const userId = interaction.user.id;
  const t = await sequelize.transaction();
  try {
    const [latestIdleGame, latestPoint] = await Promise.all([
      IdleGame.findOne({
        where: { userId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      }),
      Point.findOne({ where: { userId }, transaction: t, lock: t.LOCK.UPDATE }),
    ]);

    if (!latestIdleGame || !latestPoint)
      throw new Error("ユーザーデータが見つかりません。");

    // 安全策：ipUpgradesにghostChipLevelキーがなければ初期化
    if (latestIdleGame.ipUpgrades.ghostChipLevel === undefined) {
      latestIdleGame.ipUpgrades.ghostChipLevel = 0;
    }

    const currentLevel = latestIdleGame.ipUpgrades.ghostChipLevel;
    const cost = calculateGhostChipUpgradeCost(currentLevel);

    if (latestPoint.legacy_pizza < cost) {
      await t.rollback();
      await interaction.followUp({
        content: "チップが足りません！",
        flags: 64,
      });
      return false;
    }
    const costBigInt = BigInt(Math.floor(cost));
    //infinityスキルの強化なのでEternityのみ
    const currentSpentEternity = BigInt(
      latestIdleGame.chipsSpentThisEternity || "0"
    );
    latestIdleGame.chipsSpentThisEternity = (
      currentSpentEternity + costBigInt
    ).toString();

    // チップを消費し、レベルを上げる
    await latestPoint.decrement("legacy_pizza", { by: cost, transaction: t });
    latestIdleGame.ipUpgrades.ghostChipLevel++;
    latestIdleGame.changed("ipUpgrades", true); // JSONBの変更を通知

    await latestIdleGame.save({ transaction: t });
    // Pointの変更はdecrementで完了しているのでsaveは不要

    await t.commit();
    await interaction.followUp({
      content: `✅ **ゴーストチップ**が **Lv.${currentLevel + 1}** になりました！`,
      flags: 64,
    });
    return true;
  } catch (error) {
    await t.rollback();
    console.error("Ghost Chip Upgrade Error:", error);
    await interaction.followUp({
      content: `❌ 強化中にエラーが発生しました。`,
      flags: 64,
    });
    return false;
  }
}

/**
 * 【新規】インフィニティチャレンジを開始する
 * @param {import("discord.js").ButtonInteraction} interaction
 * @param {import("discord.js").InteractionCollector} collector
 * @param {string} challengeId - 開始するチャレンジのID
 * @returns {Promise<boolean>} UI更新が必要な場合はtrue
 */
export async function handleStartChallenge(
  interaction,
  collector,
  challengeId
) {
  collector.stop();

  const challengeConfig = config.idle.infinityChallenges.find(
    (c) => c.id === challengeId
  );
  if (!challengeConfig) {
    await interaction.followUp({
      content: "存在しないチャレンジです。",
      ephemeral: true,
    });
    return false;
  }

  const confirmationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_start_${challengeId}`)
      .setLabel("はい、開始します")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("cancel_challenge")
      .setLabel("いいえ")
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmationMessage = await interaction.followUp({
    content: `### ⚔️ **${challengeConfig.name}** を開始しますか？\n**縛り:** ${challengeConfig.description}\n\n⚠️ **警告:** 現在の進行は全て失われ、強制的にインフィニティリセットが実行されます。この操作は取り消せません！`,
    components: [confirmationRow],
    ephemeral: true,
    fetchReply: true,
  });

  try {
    const confirmationInteraction =
      await confirmationMessage.awaitMessageComponent({
        // ▼▼▼ 修正点1: フィルター条件を修正 ▼▼▼
        filter: (i) =>
          i.user.id === interaction.user.id &&
          (i.customId === `confirm_start_${challengeId}` ||
            i.customId === "cancel_challenge"),
        time: 60_000,
      });

    if (confirmationInteraction.customId === "cancel_challenge") {
      await confirmationInteraction.update({
        content: "チャレンジ開始をキャンセルしました。",
        components: [],
      });
      return false;
    }

    await confirmationInteraction.deferUpdate();

    await sequelize.transaction(async (t) => {
      const idleGame = await IdleGame.findOne({
        where: { userId: interaction.user.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const currentChallenges = idleGame.challenges || {};
      currentChallenges.activeChallenge = challengeId;
      if (challengeId === "IC6") {
        currentChallenges.IC6 = {
          startTime: new Date().toISOString(),
        };
      }
      if (challengeId === "IC9") {
        //9は再プレイに備えて開始時間（現実）と以前のデータを入れる
        currentChallenges.IC9 = {
          ...currentChallenges.IC9,
          startTime: new Date().toISOString(),
        };
      }
      idleGame.changed("challenges", true);

      // ▼▼▼ 修正点2: newIpUpgradesの定義を追加 ▼▼▼
      const oldGenerators = idleGame.ipUpgrades?.generators || [];
      const newGenerators = Array.from({ length: 8 }, (_, i) => {
        const oldGen = oldGenerators[i] || { bought: 0 };
        return {
          amount: String(oldGen.bought),
          bought: oldGen.bought,
        };
      });
      const newIpUpgrades = {
        ...(idleGame.ipUpgrades || {}),
        generators: newGenerators,
      };
      // ▲▲▲ ここまで追加 ▲▲▲

      await idleGame.update(
        {
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
          challenges: currentChallenges,
          lastUpdatedAt: new Date(),
        },
        { transaction: t }
      );
    });

    await confirmationInteraction.editReply({
      content: `**${challengeConfig.name}** を開始しました。健闘を祈ります！`,
      components: [],
    });
    return true;
  } catch (error) {
    console.error("Challenge Start Error:", error);
    await interaction.editReply({
      content:
        "タイムアウトまたは内部エラーにより、チャレンジ開始はキャンセルされました。",
      components: [],
    });
    return false;
  }
}

/**
 * 【改訂】挑戦中のインフィニティチャレンジを中止する
 * @param {import("discord.js").ButtonInteraction} interaction
 * @param {import("discord.js").InteractionCollector} collector // 親コレクターはもう不要ですが、呼び出し元の互換性のために残します
 * @returns {Promise<boolean>} UI更新が必要な場合はtrue
 */
export async function handleAbortChallenge(interaction) {
  // ★コレクターは停止しない！★

  // --- 確認メッセージ ---
  const confirmationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_abort_challenge`)
      .setLabel("はい、縛りを解きます")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("cancel_abort")
      .setLabel("いいえ")
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmationMessage = await interaction.followUp({
    content: `### ⚔️ **本当にチャレンジを中止しますか？**\n\n現在の進行状況は **リセットされません** が、この周回ではチャレンジを再開できなくなります。`,
    components: [confirmationRow],
    ephemeral: true,
    fetchReply: true,
  });

  try {
    const confirmationInteraction =
      await confirmationMessage.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000,
      });

    if (confirmationInteraction.customId === "cancel_abort") {
      await confirmationInteraction.update({
        content: "チャレンジ中止をキャンセルしました。",
        components: [],
      });
      return false; // UI更新不要
    }

    // --- 「はい」が押されたらDB更新 ---
    await confirmationInteraction.deferUpdate();

    // ▼▼▼ チャレンジ中止トランザクション ▼▼▼
    await sequelize.transaction(async (t) => {
      const idleGame = await IdleGame.findOne({
        where: { userId: interaction.user.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const currentChallenges = idleGame.challenges || {};
      const abortedChallenge = currentChallenges.activeChallenge; // どのチャレンジを中止したか記録しておく
      delete currentChallenges.activeChallenge; // activeChallengeを削除
      idleGame.changed("challenges", true);

      // ★★★ リセットは行わず、challengesフィールドとlastUpdatedAtのみを更新 ★★★
      await idleGame.update(
        {
          challenges: currentChallenges,
          lastUpdatedAt: new Date(),
        },
        { transaction: t }
      );
    });

    await confirmationInteraction.editReply({
      content: `チャレンジを中止しました。縛りが解除されます。`,
      components: [],
    });

    // ★★★ UIを再描画して縛りが解けたことを反映させるため、trueを返す ★★★
    return true;
  } catch (error) {
    // タイムアウトなどのエラー処理
    await interaction.editReply({
      content: "タイムアウトしました。チャレンジは継続されます。",
      components: [],
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

/**
 * IU12の効果。TPを自動で割り振る。
 * @param {object} idleGame - IdleGameのインスタンス (または素のオブジェクト)
 * @returns {object} 更新されたidleGameオブジェクト
 */
function autoAssignTP(idleGame) {
  let availableTP = idleGame.transcendencePoints;

  // 1. #8のコストを基準に、#5~#7に使える予算を決める
  const skill8Cost = calculateTPSkillCost(8, idleGame.skillLevel8);
  let budget = skill8Cost * 0.5;

  // 2. 予算内で、#5~#7の最も安いものを買い続ける
  while (true) {
    const costs = [
      { id: 5, cost: calculateTPSkillCost(5, idleGame.skillLevel5) },
      { id: 6, cost: calculateTPSkillCost(6, idleGame.skillLevel6) },
      { id: 7, cost: calculateTPSkillCost(7, idleGame.skillLevel7) },
    ];
    // コストで昇順ソートして、一番安いものを取得
    costs.sort((a, b) => a.cost - b.cost);
    const cheapest = costs[0];

    if (cheapest.cost > budget || cheapest.cost > availableTP) {
      break; // 予算オーバー or TP不足ならループ終了
    }

    availableTP -= cheapest.cost;
    budget -= cheapest.cost;
    idleGame[`skillLevel${cheapest.id}`]++;
  }

  // 3. 最後に、#8が買えるだけ買う
  while (true) {
    const finalSkill8Cost = calculateTPSkillCost(8, idleGame.skillLevel8);
    if (availableTP < finalSkill8Cost) break;

    availableTP -= finalSkill8Cost;
    idleGame.skillLevel8++;
  }

  idleGame.transcendencePoints = availableTP;
  return idleGame;
}

/**
 * 【新規】IU11「ゴーストチップ」の効果を適用するヘルパー関数
 * @param {object} idleGameState - リセット直後の状態を持つIdleGameの素のJSオブジェクト
 * @param {string} userId - ユーザーID
 * @returns {Promise<object>} ゴーストチップによる購入が適用された後のIdleGameオブジェクト
 */
async function applyGhostChipBonus(idleGameState, userId, ghostLevel = 1) {
  const userAchievement = await UserAchievement.findOne({
    where: { userId },
    raw: true,
  });
  const unlockedSet = new Set(userAchievement?.achievements?.unlocked || []);

  // 新しい計算関数を呼び出す
  const budget = calculateGhostChipBudget(ghostLevel);

  const { purchases } = simulatePurchases(idleGameState, budget, unlockedSet);

  for (const [facilityName, count] of purchases.entries()) {
    const levelKey = config.idle.factories[facilityName].key;
    idleGameState[levelKey] += count;
  }
  return idleGameState;
}
