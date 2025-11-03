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
  formatNumberDynamic_Decimal,
  simulateGhostAscension,
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
  TextInputBuilder,
  TextInputStyle,
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
  const currentSettings = idleGame.settings || {};
  if (
    currentSettings.skipPrestigeConfirmation !== undefined ||
    currentSettings.skipSkillResetConfirmation !== undefined
  ) {
    // 古い形式のデータが存在する場合、新しい形式に変換する
    console.log(`[データ移行] ユーザー ${userId} の古い設定を変換します。`);
    const newSkipConfirmations = [];
    if (currentSettings.skipPrestigeConfirmation === true) {
      newSkipConfirmations.push("prestige");
    }
    if (currentSettings.skipSkillResetConfirmation === true) {
      newSkipConfirmations.push("reset");
    }
    currentSettings.skipConfirmations = newSkipConfirmations;

    delete currentSettings.skipPrestigeConfirmation;
    delete currentSettings.skipSkillResetConfirmation;
  }
  //設定を用意
  const skippedConfirmations = new Set(currentSettings.skipConfirmations || []);
  const isAutoTpEnabled = currentSettings.autoAssignTpEnabled === true;
  const currentSpPriority = currentSettings.autoAssignSpPriority || "0000";

  // 2. モーダルを構築
  const modal = new ModalBuilder()
    .setCustomId("idle_settings_modal") // 固有名詞のID
    .setTitle("放置ゲーム 設定");

  //3.項目を作る
  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("確認スキップ設定")
      .setDescription("リセット時に表示される確認画面をスキップします。")
      .setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId("skip_confirmations_select")
          .setPlaceholder("スキップしたい確認画面を選択...")
          .setMaxValues(4) // 4つまで選択可能
          .setRequired(false) //これがないと「何もスキップしない」設定ができない
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("プレステージ")
              .setValue("prestige")
              .setDefault(skippedConfirmations.has("prestige")),
            new StringSelectMenuOptionBuilder()
              .setLabel("スキルリセット")
              .setValue("reset")
              .setDefault(skippedConfirmations.has("reset")),
            new StringSelectMenuOptionBuilder()
              .setLabel("インフィニティ")
              .setValue("infinity")
              .setDefault(skippedConfirmations.has("infinity")),
            new StringSelectMenuOptionBuilder()
              .setLabel("チャレンジ")
              .setValue("challenge") // challengeという値を設定
              .setDefault(skippedConfirmations.has("challenge"))
          )
      )
  );

  // 4. ★★★ LabelBuilderを使ってTP自動割り振り設定を追加 ★★★
  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("IU12「自動調理器」のTP効果")
      .setDescription(
        "プレステージ時のTP自動割り振りを有効にするか選択します。"
      )
      .setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId("auto_tp_assign_select")
          .setMaxValues(1) //どちらかしか選べないべきである
          .setPlaceholder("設定を選択...")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("有効 (ON)")
              .setValue("on")
              .setDefault(isAutoTpEnabled),
            new StringSelectMenuOptionBuilder()
              .setLabel("無効 (OFF)")
              .setValue("off")
              .setDefault(!isAutoTpEnabled)
          )
      )
  );

  // 4. ★★★ SPスキル自動割り振り設定を追加 ★★★
  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("IU12「自動調理器」のSPスキル優先度")
      .setDescription(
        '"1234"のように#1~#4の優先順を並べてください。"0000"で無効化します。'
      )
      .setTextInputComponent(
        new TextInputBuilder()
          // customIdは可読性の高いものをおすすめします
          .setCustomId("auto_sp_priority_input")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("例: 1234 (スキル#1を最優先)")
          // DBから読み込んだ現在の設定値をセット
          .setValue(currentSpPriority)
          .setMinLength(4)
          .setMaxLength(4)
          .setRequired(true) // 必須入力にする
      )
  );

  // 5. モーダルを表示
  await interaction.showModal(modal);

  // 6. ユーザーの送信を待つ
  const submitted = await interaction
    .awaitModalSubmit({
      time: 60_000,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === "idle_settings_modal",
    })
    .catch(() => null);

  if (submitted) {
    try {
      const selectedSkips = submitted.fields.getStringSelectValues(
        "skip_confirmations_select"
      );
      const autoAssignChoice = submitted.fields.getStringSelectValues(
        "auto_tp_assign_select"
      )[0];
      // IU12SPは厳密に
      const spPriorityInput = submitted.fields.getTextInputValue(
        "auto_sp_priority_input"
      );

      // --- 入力値の検証ロジック ---
      let isValidSpPriority = false;
      if (spPriorityInput === "0000") {
        isValidSpPriority = true; // 無効化はOK
      } else if (/^[1-4]{4}$/.test(spPriorityInput)) {
        // "1"から"4"までの数字4桁であるか？
        const uniqueChars = new Set(spPriorityInput.split(""));
        if (uniqueChars.size === 4) {
          // 4つの数字が全てユニークか？
          isValidSpPriority = true;
        }
      }

      if (!isValidSpPriority) {
        await submitted.reply({
          content:
            "❌ SP優先度の入力が正しくありません。\n`0000` または `1234` のように1から4までの数字を重複なく4桁で入力してください。",
          ephemeral: true,
        });
        return; // エラーなので処理を中断
      }
      // IU12SPここまで

      const newSettings = { ...currentSettings }; // 現在の設定をコピー
      // スキップ登録
      newSettings.skipConfirmations = selectedSkips;
      // IU12はそのまま
      if (autoAssignChoice === "on") {
        newSettings.autoAssignTpEnabled = true;
      } else if (autoAssignChoice === "off") {
        newSettings.autoAssignTpEnabled = false;
      }
      newSettings.autoAssignSpPriority = spPriorityInput;
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
      latestIdleGame[levelKey] += 1;
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
        latestIdleGame[levelKey] += count;
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

      //TP,SPはだけ先に加算
      latestIdleGame.transcendencePoints += gainedTP;
      latestIdleGame.skillPoints = newSkillPoints;

      // IU12「自動調理器」の処理
      if (
        latestIdleGame.ipUpgrades.upgrades.includes("IU12") &&
        latestIdleGame.transcendencePoints > 0 &&
        latestIdleGame.settings?.autoAssignTpEnabled === true
      ) {
        autoAssignTP(latestIdleGame); // オブジェクトが直接変更される
      }
      // IU12-2. SP自動割り振り (新規追加)
      const spPriority = latestIdleGame.settings?.autoAssignSpPriority;
      if (
        latestIdleGame.ipUpgrades.upgrades.includes("IU12") &&
        spPriority &&
        spPriority !== "0000" &&
        latestIdleGame.skillPoints > 0
      ) {
        // autoAssignSPはlatestIdleGameオブジェクトを直接変更します
        autoAssignSP(latestIdleGame, spPriority);
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
        skillPoints: latestIdleGame.skillPoints,
        highestPopulation: currentPopulation_d.toString(),
        transcendencePoints: latestIdleGame.transcendencePoints,
        skillLevel1: latestIdleGame.skillLevel1,
        skillLevel2: latestIdleGame.skillLevel2,
        skillLevel3: latestIdleGame.skillLevel3,
        skillLevel4: latestIdleGame.skillLevel4,
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
  //スキップ設定を読み込み
  const settings = latestIdleGame.settings || {};
  const skipConfirmation =
    settings.skipConfirmations?.includes("prestige") || // 新しい形式
    settings.skipPrestigeConfirmation === true; // 古い形式

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
  // スキップ設定を読み込み
  const settings = latestIdleGame.settings || {};
  const skipConfirmation =
    settings.skipConfirmations?.includes("reset") || // 新しい形式
    settings.skipSkillResetConfirmation === true; // 古い形式

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
 * 【新規】インフィニティのDB更新処理を実行する内部関数
 * @param {string} userId - 実行するユーザーのID
 * @param {import("discord.js").Client} client - 実績解除に必要
 * @returns {Promise<object>} インフィニティの結果オブジェクト
 */
async function executeInfinityTransaction(userId, client) {
  let gainedIP = new Decimal(0);
  let isFirstInfinity = false;
  let newInfinityCount = 0;
  let infinityPopulation_d = new Decimal(0);
  let challengeWasCleared = false;
  let challengeWasFailed = false;
  let activeChallenge = null;
  let newCompletedCount = 0;
  let infinitiesGained = 1; // ∞。基本は1

  await sequelize.transaction(async (t) => {
    const latestIdleGame = await IdleGame.findOne({
      where: { userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (new Decimal(latestIdleGame.population).lt(config.idle.infinity)) {
      throw new Error("インフィニティの条件を満たしていません。");
    }

    infinityPopulation_d = new Decimal(latestIdleGame.population);
    activeChallenge = latestIdleGame.challenges?.activeChallenge;
    const currentChallenges = latestIdleGame.challenges || {};

    //IU73 最速infinity記録
    if (latestIdleGame.ipUpgrades.upgrades.includes("IU73")) {
      const startTime = currentChallenges.currentInfinityStartTime;
      if (startTime) {
        // 1. 現実時間の経過を秒単位で計算
        const durationInSeconds =
          (new Date().getTime() - new Date(startTime).getTime()) / 1000;

        // 2. 既存のベストタイムを取得（なければ無限大）
        const bestTime = currentChallenges.bestInfinityRealTime || Infinity;

        // 3. 自己ベストを更新していたら記録
        if (durationInSeconds < bestTime) {
          currentChallenges.bestInfinityRealTime = durationInSeconds;
        }
      }
      // 4. ★重要：次の周回のための新しいスタート時間を記録
      currentChallenges.currentInfinityStartTime = new Date().toISOString();
      latestIdleGame.changed("challenges", true);
    }

    //チャレンジ成功処理
    if (activeChallenge) {
      let challengeSuccess = true;
      // IC2は12時間を超えてたら失敗
      if (activeChallenge === "IC2") {
        const GAME_HOURS_12_IN_SECONDS = 12 * 60 * 60;
        if (latestIdleGame.infinityTime > GAME_HOURS_12_IN_SECONDS) {
          challengeSuccess = false;
          challengeWasFailed = true;
        }
      }

      if (challengeSuccess) {
        if (!currentChallenges.completedChallenges) {
          currentChallenges.completedChallenges = [];
        }
        // 重複を防ぎつつ、クリア済みリストに追加
        if (!currentChallenges.completedChallenges.includes(activeChallenge)) {
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

    //実績104「星なんて小指一本で作れる」
    // Infinityリセット直前に、その周回の消費チップを確認する
    const chipsSpent = BigInt(latestIdleGame.chipsSpentThisInfinity || "0");
    if (chipsSpent < 100n) {
      // BigIntで比較するために `100n` を使う
      // unlockAchievementsはclientとuserIdを必要とする
      await unlockAchievements(client, userId, 104);
    }

    if (latestIdleGame.infinityCount === 0) {
      isFirstInfinity = true;
    }
    //獲得∞を計算
    const purchasedIUs = new Set(latestIdleGame.ipUpgrades?.upgrades || []);
    if (purchasedIUs.has("IU62")) {
      const chipsSpent_d = new Decimal(
        latestIdleGame.chipsSpentThisEternity || "0"
      );
      // IU62は、log10(消費チップ + 1) + 1
      const multiplier = chipsSpent_d.add(1).log10() + 1;
      infinitiesGained = Math.floor(multiplier); //小数点以下切り捨て
    }
    newInfinityCount = latestIdleGame.infinityCount + infinitiesGained;
    // IP獲得量を計算
    gainedIP = calculateGainedIP(latestIdleGame, newCompletedCount);

    // IC6クリア報酬.初期#1~4LvをIPを元に決定
    let initialSkillLevel = 0;
    const completedChallenges = currentChallenges.completedChallenges || [];
    if (completedChallenges.includes("IC6")) {
      const bonusSP = Math.max(1, Math.floor(gainedIP.abs().log10()) + 1);
      initialSkillLevel = Math.floor(Math.log2(bonusSP + 1));
    }

    const oldGenerators = latestIdleGame.ipUpgrades?.generators || [];
    const newGenerators = Array.from({ length: 8 }, (_, i) => {
      const oldGen = oldGenerators[i] || { bought: 0 };
      return {
        amount: String(oldGen.bought),
        bought: oldGen.bought,
      };
    });
    const newIpUpgrades = {
      ...(latestIdleGame.ipUpgrades || {}),
      generators: newGenerators,
    };
    latestIdleGame.changed("ipUpgrades", true);

    // 1. まずリセット後の状態を「設計図」として変数に格納する
    let updateData = {
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
      infinityPoints: new Decimal(latestIdleGame.infinityPoints)
        .add(gainedIP)
        .toString(),
      infinityCount: newInfinityCount,
      challenges: currentChallenges,
      lastUpdatedAt: new Date(),
    };

    // 2. IU44を所持している場合、設計図にゴーストチップの効果を上乗せする
    if (latestIdleGame.ipUpgrades.upgrades.includes("IU44")) {
      const currentGhostLevel = latestIdleGame.ipUpgrades?.ghostChipLevel || 0;
      updateData = await applyGhostChipBonus(
        updateData,
        userId,
        currentGhostLevel
      );
    }

    // 3. IU54を所持している場合、ゴーストアセンションを実行する
    if (latestIdleGame.ipUpgrades.upgrades.includes("IU54")) {
      const currentGhostLevel = latestIdleGame.ipUpgrades?.ghostChipLevel || 0;
      const budget = calculateGhostChipBudget(currentGhostLevel);

      // updateDataにはリセット後のascensionCount(0)などが含まれている
      const { ascensions } = simulateGhostAscension(budget, updateData);

      // シミュレーション結果を設計図に反映
      updateData.ascensionCount += ascensions;
    }

    // 4. 最終的な設計図でデータベースを更新する
    await latestIdleGame.update(updateData, { transaction: t });
  });

  // 結果をオブジェクトで返す
  return {
    gainedIP,
    isFirstInfinity,
    newInfinityCount,
    infinityPopulation_d,
    challengeWasCleared,
    challengeWasFailed,
    activeChallenge,
    newCompletedCount,
    infinitiesGained,
  };
}

/**
 * 【改訂版】Infinityを実行し、世界をリセットする関数
 * @param {import("discord.js").ButtonInteraction} interaction - Infinityボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 */
export async function handleInfinity(interaction, collector) {
  const userId = interaction.user.id;
  const client = interaction.client;

  try {
    // --- 1. 事前チェック ---
    const latestIdleGame = await IdleGame.findOne({ where: { userId } });
    if (!latestIdleGame) throw new Error("ユーザーデータが見つかりません。");

    const currentPopulation_d = new Decimal(latestIdleGame.population);
    if (currentPopulation_d.lt(config.idle.infinity)) {
      throw new Error("インフィニティの条件を満たしていません。");
    }

    const settings = latestIdleGame.settings || {};
    const skipConfirmation =
      settings.skipConfirmations?.includes("infinity") || false;

    // --- 2. 条件に応じて処理を分岐 ---
    if (!skipConfirmation) {
      collector.stop();
      // --- 【A】確認を表示するルート ---
      const confirmationRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("infinity_confirm_yes")
          .setLabel("はい、実行します")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("infinity_confirm_no")
          .setLabel("いいえ、まだ続けます")
          .setStyle(ButtonStyle.Secondary)
      );

      // 確認メッセージを人口に応じて動的に変更
      let confirmationText =
        "## ⚠️ **インフィニットを実行しますか？**\nあなたは世界の果てに到達しました。全てがリセットされますが、新たな力を得ることができます。";
      if (currentPopulation_d.gt(new Decimal("1.8e308"))) {
        confirmationText =
          "## ⚠️ **インフィニットを実行しますか？**\nあなたは既にブレイクインフィニティをしています。より多くのニョワミヤを集めればIPが増える可能性があります、それでも行いますか？";
      }

      const confirmationMessage = await interaction.followUp({
        content: confirmationText,
        components: [confirmationRow],
        ephemeral: true,
        fetchReply: true,
      });

      const confirmationInteraction =
        await confirmationMessage.awaitMessageComponent({
          filter: (i) => i.user.id === userId,
          time: 60_000,
        });

      if (confirmationInteraction.customId === "infinity_confirm_no") {
        await confirmationInteraction.update({
          content: "インフィニットをキャンセルしました。",
          components: [],
        });
        return false; // 処理を中断
      }

      // 「はい」が押されたら、処理を続行
      await confirmationInteraction.deferUpdate();
      // ★リセット本体を呼び出し
      const result = await executeInfinityTransaction(userId, client);
      // ★結果に応じてメッセージを編集
      await postInfinityTasks(
        confirmationInteraction,
        result,
        client,
        userId,
        true
      );
      return false;
    } else {
      // --- 【B】通常のインフィニティフロー ---
      // ★リセット本体を呼び出し
      const result = await executeInfinityTransaction(userId, client);
      // メッセージを送信
      await postInfinityTasks(interaction, result, client, userId, false);
      return true;
    }
  } catch (error) {
    console.error("Infinity Error:", error);
    // エラーがタイムアウト（.awaitMessageComponent起因）か、それ以外かを判定
    if (error.code === "InteractionCollectorError") {
      await interaction.editReply({
        content: "タイムアウトしました。インフィニティはキャンセルされました。",
        components: [],
      });
    } else {
      await interaction.followUp({
        content: `❌ エラーによりインフィニティに失敗しました: ${error.message}`,
        flags: 64,
      });
    }
    return false;
  }
}

/**
 * インフィニティ後の実績解除とメッセージ送信を担当するヘルパー関数
 * @param {import("discord.js").Interaction} interaction - 元のインタラクション
 * @param {object} result - executeInfinityTransactionから返された結果
 * @param {import("discord.js").Client} client
 * @param {string} userId
 * @param {boolean} isEditing - followUpの代わりにeditReplyを使うか
 */
async function postInfinityTasks(
  interaction,
  result,
  client,
  userId,
  isEditing = false
) {
  const {
    gainedIP,
    isFirstInfinity,
    newInfinityCount,
    infinityPopulation_d,
    challengeWasCleared,
    challengeWasFailed,
    activeChallenge,
    newCompletedCount,
    infinitiesGained,
  } = result;

  // --- 実績解除 ---
  await unlockAchievements(client, userId, 72);
  if (newInfinityCount === 2) await unlockAchievements(client, userId, 83);
  if (newInfinityCount === 5) await unlockAchievements(client, userId, 84);
  if (gainedIP.gte("1e6")) {
    await unlockAchievements(client, userId, 102);
  }

  // --- チャレンジ結果の通知 (followUpは複数回可能) ---
  if (challengeWasFailed) {
    await interaction.followUp({
      content: `⌛ **インフィニティチャレンジ ${activeChallenge}** に失敗しました… (条件: ゲーム内時間12時間以内)`,
      ephemeral: true,
    });
  }
  if (challengeWasCleared) {
    await unlockAchievements(client, userId, 91);
    if (newCompletedCount === 4) await unlockAchievements(client, userId, 92);
    if (newCompletedCount === 9) await unlockAchievements(client, userId, 93);
    await interaction.followUp({
      content: `🎉 **インフィニティチャレンジ ${activeChallenge}** を達成しました！`,
      ephemeral: true,
    });
  }

  // --- メインの成功メッセージ作成 ---
  let successMessage;
  if (infinityPopulation_d.gt("1.8e+308")) {
    successMessage = `# ●${formatNumberJapanese_Decimal(infinityPopulation_d)} Break Infinity
## ――ニョワミヤはどこまで増えるのだろう。
数え切れぬチップと時間を注ぎ込み、あなたはついに果てであるべき"無限"すら打ち倒した。
どうやら、宇宙一美味しいピザを作るこの旅はまだまだ終わりそうに無いようだ。
ならば、無限に広がるこの宇宙すら無限で埋め尽くしてしまおう。
**${formatNumberDynamic_Decimal(gainedIP, 0)} IP** と **${infinitiesGained.toLocaleString()} ∞** を手に入れた。`;
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

インフィニット（インフィニティリセット）を行った。
**${gainedIP.toString()} IP** と **1 ∞** を手に入れた。`;
  }

  // --- メッセージ送信 ---
  const replyOptions = { content: successMessage, components: [], flags: 64 };
  if (isEditing) {
    await interaction.editReply(replyOptions);
  } else {
    await interaction.followUp(replyOptions);
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
    //  #101:半分のジェネレーター
    if (generatorId === 4 && newBoughtCount === 1) {
      await unlockAchievements(interaction.client, userId, 101);
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
 * 【新規】インフィニティチャレンジ開始のDB更新処理を実行する内部関数
 * @param {string} userId
 * @param {string} challengeId
 * @param {import("discord.js").Client} client - 実績解除に必要
 * @returns {Promise<object>} 開始したチャレンジの設定オブジェクト
 */
async function executeStartChallengeTransaction(userId, challengeId, client) {
  const challengeConfig = config.idle.infinityChallenges.find(
    (c) => c.id === challengeId
  );
  if (!challengeConfig) {
    throw new Error("存在しないチャレンジです。");
  }

  await sequelize.transaction(async (t) => {
    const idleGame = await IdleGame.findOne({
      where: { userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // 1. まずリセット後の状態を「設計図」として変数に格納する
    const purchasedIUs = new Set(idleGame.ipUpgrades?.upgrades || []);
    const completedChallenges = new Set(idleGame.challenges?.completedChallenges || []);
    let initialSkillLevel = 0;
    //ここで一旦チャレンジを更新する
    const currentChallenges = idleGame.challenges || {};
    currentChallenges.activeChallenge = challengeId;

    // IC6クリア報酬: 初期スキルレベルを決定
    if (completedChallenges.has("IC6")) {
      // チャレンジ開始時はIPが0なので、Lv1で固定するのが妥当
      initialSkillLevel = 1; 
    }
    
    const oldGenerators = idleGame.ipUpgrades?.generators || [];
    const newGenerators = Array.from({ length: 8 }, (_, i) => {
      const oldGen = oldGenerators[i] || { bought: 0 };
      return { amount: String(oldGen.bought), bought: oldGen.bought };
    });
    const newIpUpgrades = {
      ...(idleGame.ipUpgrades || {}),
      generators: newGenerators,
    };

    let updateData = {
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
      lastUpdatedAt: new Date(), // lastUpdatedAtは一旦ここで設定
      challenges: currentChallenges, // challengesも一旦設定
    };
    
    // 2. IU44/IU11「ゴーストチップ」の効果を適用する
    //    ★ IC9挑戦中は上位3施設が購入不可になるロジックが `calculateFacilityCost` に
    //       組み込まれているため、`applyGhostChipBonus` をそのまま呼び出すだけでOK
    if (purchasedIUs.has("IU44") || purchasedIUs.has("IU11")) {
      const currentGhostLevel = idleGame.ipUpgrades?.ghostChipLevel || 0;
      // applyGhostChipBonusはシミュレーション用のidleGameStateを引数に取る
      // updateDataは素のJSオブジェクトなので、そのまま渡せる
      updateData = await applyGhostChipBonus(updateData, userId, currentGhostLevel);
    }

    // 3. IU54「ゴーストアセンション」の効果を適用する
    //    ★ IC7, IC8ではアセンションのルールが変わるため、現在のチャレンジIDを渡す必要がある
    if (purchasedIUs.has("IU54") && challengeId !== "IC7" && challengeId !== "IC8") {
        const currentGhostLevel = idleGame.ipUpgrades?.ghostChipLevel || 0;
        const budget = calculateGhostChipBudget(currentGhostLevel);
        
        // シミュレーション用のオブジェクトを準備
        const simIdleGame = { ...updateData, challenges: { activeChallenge: challengeId } };
        const { ascensions } = simulateGhostAscension(budget, simIdleGame);
        updateData.ascensionCount += ascensions;
    }
    
    // 4. IC6,9のタイムスタンプを最後に更新する
    if (challengeId === "IC6" || challengeId === "IC9") {
        currentChallenges[challengeId] = {
            ...currentChallenges[challengeId],
            startTime: new Date().toISOString(),
        };
    }
    updateData.challenges = currentChallenges;
    idleGame.changed("challenges", true); //念の為
    updateData.lastUpdatedAt = new Date(); // 処理の最後にタイムスタンプを再設定

    // ▲▲▲ 新しいロジックはここまで ▲▲▲

    await idleGame.update(updateData, { transaction: t });
  });

  return challengeConfig;
}

/**
 * 【改訂版】インフィニティチャレンジを開始する司令塔関数
 * @param {import("discord.js").ButtonInteraction} interaction
 * @param {import("discord.js").InteractionCollector} collector
 * @param {string} challengeId - 開始するチャレンジのID
 * @returns {Promise<boolean>} UI更新が必要な場合はtrue
 */
export async function handleStartChallenge(interaction, collector, challengeId) {
  const userId = interaction.user.id;
  const client = interaction.client;

  // 1. ユーザーの設定を読み込む
  const latestIdleGame = await IdleGame.findOne({ where: { userId } });
  const skipConfirmation = latestIdleGame.settings?.skipConfirmations?.includes("challenge") || false;

  if (skipConfirmation) {
    // --- 【A】確認をスキップするルート ---
    try {
      const challengeConfig = await executeStartChallengeTransaction(userId, challengeId, client);
      await interaction.followUp({
        content: `✅ **${challengeConfig.name}** を即時開始しました。`,
        ephemeral: true,
      });
      // ★UIの再描画が必要なことを呼び出し元に伝える
      return true; 
    } catch (error) {
      console.error("Challenge Start (skip confirmation) Error:", error);
      await interaction.followUp({
        content: `❌ チャレンジ開始中にエラーが発生しました: ${error.message}`,
        ephemeral: true,
      });
      return false;
    }
  } else {
    // --- 【B】従来通りの確認ルート ---
    collector.stop();

    const challengeConfig = config.idle.infinityChallenges.find((c) => c.id === challengeId);
    if (!challengeConfig) {
      // 念のため
      await interaction.followUp({ content: "存在しないチャレンジです。", ephemeral: true });
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
      const confirmationInteraction = await confirmationMessage.awaitMessageComponent({
        filter: (i) => i.user.id === userId,
        time: 60_000,
      });

      if (confirmationInteraction.customId === "cancel_challenge") {
        await confirmationInteraction.update({ content: "チャレンジ開始をキャンセルしました。", components: [] });
        return false;
      }

      await confirmationInteraction.deferUpdate();
      // ★分離した実行処理を呼び出す
      await executeStartChallengeTransaction(userId, challengeId, client);

      await confirmationInteraction.editReply({
        content: `**${challengeConfig.name}** を開始しました。健闘を祈ります！`,
        components: [],
      });
    } catch (error) {
      console.error("Challenge Start Error:", error);
      await interaction.editReply({
        content: "タイムアウトまたは内部エラーにより、チャレンジ開始はキャンセルされました。",
        components: [],
      });
    }
    // このルートはUI更新が不要なためfalseを返す
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
 * IU12の効果。SPをユーザー設定とレベルに基づき自動で割り振る。
 * @param {object} idleGame - IdleGameのインスタンス (または素のオブジェクト)
 * @param {string} spPriority - ユーザーが設定した優先順位文字列 (例: "1234")
 * @returns {object} 更新されたidleGameオブジェクト
 */
function autoAssignSP(idleGame, spPriority) {
  let availableSP = idleGame.skillPoints;

  // 無限ループ防止のためのカウンター
  const MAX_ITERATIONS = 500;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 1. 現在の全SPスキルの状態をリスト化する
    const skillList = [1, 2, 3, 4].map((skillNum) => {
      const level = idleGame[`skillLevel${skillNum}`] || 0;
      return {
        id: skillNum,
        level: level,
        cost: Math.pow(2, level),
        // spPriority文字列内での登場順（インデックス）を優先度とする
        priority: spPriority.indexOf(String(skillNum)),
      };
    });

    // 2. 購入可能なスキルのみをフィルタリングする
    const affordableSkills = skillList.filter(
      (skill) => availableSP >= skill.cost
    );

    // 3. 購入可能なスキルがなければループを終了
    if (affordableSkills.length === 0) {
      break;
    }

    // 4. 仕様通りにソートして、購入すべき最適なスキルを決定する
    //    - a.level - b.level => レベルが低い順
    //    - || a.priority - b.priority => レベルが同じなら、priorityの値が小さい（＝文字列の先頭に近い）順
    affordableSkills.sort(
      (a, b) => a.level - b.level || a.priority - b.priority
    );

    const bestSkillToBuy = affordableSkills[0];

    // 5. 最適なスキルを購入する
    availableSP -= bestSkillToBuy.cost;
    idleGame[`skillLevel${bestSkillToBuy.id}`]++;
  }

  // 6. 残ったSPを反映して返す
  idleGame.skillPoints = availableSP;
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
