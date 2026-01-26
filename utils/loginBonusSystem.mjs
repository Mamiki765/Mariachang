// utils/loginBonusSystem.mjs
import { Point, Mee6Level, sequelize } from "../models/database.mjs";
import {
  unlockAchievements,
  unlockHiddenAchievements,
} from "./achievements.mjs";
import { getSupabaseClient } from "./supabaseClient.mjs";
import config from "../config.mjs";

const loggedInUsersCache = new Set();

export function resetLoginBonusCache() {
  loggedInUsersCache.clear();
  console.log("[LoginBonus] Daily login cache has been reset.");
}

export async function checkLoginBonusEligibility(userId) {
  if (loggedInUsersCache.has(userId)) return false;

  const pointEntry = await Point.findOne({
    where: { userId: userId },
    attributes: ["lastAcornDate"],
  });

  if (!pointEntry) return true;
  if (!pointEntry.lastAcornDate) return true;

  const now = new Date();
  const lastClaim = new Date(pointEntry.lastAcornDate);
  const last8AM = new Date();
  last8AM.setHours(8, 0, 0, 0);

  // 現在時刻が8時前なら、基準は「昨日の8時」
  if (now < last8AM) {
    last8AM.setDate(last8AM.getDate() - 1);
  }

  if (lastClaim > last8AM) {
    loggedInUsersCache.add(userId);
    return false;
  }
  return true;
}

/**
 * 報酬計算ロジック (経験値進捗込み)
 */
export function calculateRewards(params) {
  const { mee6Level, boosterCount, member } = params;
  const pizzaConfig = config.loginBonus.legacy_pizza;
  const coinConfig = config.loginBonus.nyowacoin;

  // --- 1. コイン計算 ---
  let coinAmount = coinConfig.baseAmount;
  let coinBonusMessage = ""; // リッチメッセージ用
  if (Math.floor(Math.random() * coinConfig.bonus.chance) === 0) {
    const bonus =
      Math.floor(
        Math.random() *
          (coinConfig.bonus.amount.max - coinConfig.bonus.amount.min + 1)
      ) + coinConfig.bonus.amount.min;
    coinAmount += bonus;
    coinBonusMessage = `(ボーナス +${bonus})`;
  }

  // --- 2. ピザ計算 (Mee6詳細版) ---
  const basePizza =
    Math.floor(
      Math.random() *
        (pizzaConfig.baseAmount.max - pizzaConfig.baseAmount.min + 1)
    ) + pizzaConfig.baseAmount.min;

  // Mee6レベル & 経験値進捗ボーナス
  let mee6Bonus = 0;
  let mee6MessagePart = "";

  if (mee6Level) {
    const levelBonus = mee6Level.level * pizzaConfig.bounsPerMee6Level;
    // 進捗率 (0.0 ~ 1.0)
    const xpProgress =
      mee6Level.xpForNextLevel > 0
        ? mee6Level.xpInLevel / mee6Level.xpForNextLevel
        : 0;
    // 進捗ボーナス (例: 50%ならLvボーナスの半分を加算)
    const xpBonus = Math.floor(xpProgress * pizzaConfig.bounsPerMee6Level);

    mee6Bonus = levelBonus + xpBonus;
    const xpPercentage = Math.floor(xpProgress * 100);
    mee6MessagePart = `Lv.${mee6Level.level} Exp.${xpPercentage}%`;
  }

  // ロールボーナス (DBデータがない場合や、特定の記念ロールなどでの上書き用として Math.max は保険として残します)
  let roleBonus = 0;
  let winningRoleId = null;
  if (member) {
    for (const [roleId, bonusAmount] of Object.entries(
      pizzaConfig.mee6LevelBonuses
    )) {
      if (member.roles.cache.has(roleId)) {
        if (bonusAmount > roleBonus) {
          roleBonus = bonusAmount;
          winningRoleId = roleId;
        }
      }
    }
  }

  // 最終的なMee6系ボーナス
  const finalMee6Bonus = Math.max(mee6Bonus, roleBonus);

  // 表示用メッセージの調整 (ロールの方が高かった場合などの補足)
  if (roleBonus > mee6Bonus) {
    mee6MessagePart = `(ロール特典優先)`;
  }

  // ブースターボーナス
  let boosterBonus = 0;
  // DBまたはロールから判定
  if (boosterCount > 0) {
    const boosterConfig = pizzaConfig.boosterBonus;
    boosterBonus = boosterConfig.base + boosterConfig.perServer * boosterCount;
  } else if (member && member.roles.cache.has(pizzaConfig.boosterRoleId)) {
    // DB接続失敗時の最低保証
    const boosterConfig = pizzaConfig.boosterBonus;
    boosterBonus = boosterConfig.base + boosterConfig.perServer;
  }

  const totalPizza = basePizza + finalMee6Bonus + boosterBonus;

  return {
    acorn: 1,
    coin: coinAmount,
    pizza: totalPizza,
    // リッチなメッセージ構築に必要な詳細データを返す
    details: {
      basePizza,
      finalMee6Bonus,
      boosterBonus,
      mee6MessagePart,
      coinBonusMessage,
      boosterCount, // 表示用
    },
  };
}

/**
 * ログボ付与実行 (DB更新)
 */
export async function executeLoginBonus(client, userId, member, source) {
  // キャッシュ更新
  loggedInUsersCache.add(userId);
  const now = new Date();

  // データ準備
  const [pointEntry, mee6Info] = await Promise.all([
    Point.findOrCreate({ where: { userId } }).then(([p]) => p),
    Mee6Level.findOne({ where: { userId } }),
  ]);

  // ブースト数取得
  let boosterCount = 0;
  try {
    const supabase = getSupabaseClient();
    const { count } = await supabase
      .from("booster_status")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    boosterCount = count || 0;
  } catch (e) {
    console.error("Supabase Error", e);
  }

  // 計算
  const rewards = calculateRewards({
    mee6Level: mee6Info,
    boosterCount,
    member,
  });

  // DB更新
  const updateData = {
    acorn: sequelize.literal("acorn + 1"),
    totalacorn: sequelize.literal("totalacorn + 1"),
    lastAcornDate: now,
    coin: sequelize.literal(`coin + ${rewards.coin}`),
    nyobo_bank: sequelize.literal(`nyobo_bank + ${rewards.pizza}`),
  };

  // チャット自動取得の場合はここでメッセージ送信
  if (source === "chat") {
    if (pointEntry.loginBonusNotification) {
      const dmMessage =
        `雨宿りで発言したため、今日のログインボーナスを自動で受け取りましたにゃ！\n` +
        `- あまやどんぐり: 1個\n` +
        `- ${config.nyowacoin}: ${rewards.coin}枚 ${rewards.details.coinBonusMessage}\n` +
        `- ${config.casino.currencies.legacy_pizza.displayName}: ${rewards.pizza.toLocaleString()}枚\n` +
        `-# /ログボ通知変更 コマンドでDM通知をOFFにできます。`;

      try {
        await client.users.send(userId, { content: dmMessage }).catch((e) => {
          if (e.code !== 50007)
            console.error(`[AutoLogin] DM Failed for ${userId}`);
        });
      } catch (e) {}
    } else {
      console.log(`[AutoLogin] Silent claim for ${userId} (Notification OFF)`);
    }
  }

  await pointEntry.update(updateData);
  const updatedPoint = await pointEntry.reload();

  // 実績解除チェック
  const acornChecks = [
    { id: 23, condition: updatedPoint.totalacorn >= 1 },
    { id: 24, condition: updatedPoint.totalacorn >= 5 },
    { id: 25, condition: updatedPoint.totalacorn >= 10 },
    { id: 26, condition: updatedPoint.totalacorn >= 20 },
    { id: 27, condition: updatedPoint.totalacorn >= 30 },
  ];
  const idsToCheck = acornChecks.filter((p) => p.condition).map((p) => p.id);
  if (idsToCheck.length > 0)
    await unlockAchievements(client, userId, ...idsToCheck);

  const acornHiddenChecks = [
    { id: 12, condition: updatedPoint.totalacorn >= 50 },
    { id: 13, condition: updatedPoint.totalacorn >= 100 },
  ];
  const idsToCheckHidden = acornHiddenChecks
    .filter((p) => p.condition)
    .map((p) => p.id);
  if (idsToCheckHidden.length > 0)
    await unlockHiddenAchievements(client, userId, ...idsToCheckHidden);

  // 更新後のデータを返す（ボタン側での表示用）
  return { rewards, updatedPoint };
}
