// utils/achievements.mjs
import { IdleGame } from "../models/database.mjs";
import config from "../config.mjs";
import { EmbedBuilder } from "discord.js";

// --- モジュール内変数 (外部から直接アクセスさせない) ---
const achievementCache = new Map();
const dirtyUsers = new Set();
let saveIntervalId = null;

// ★★★ ここから新しい通知関数を追加 ★★★
/**
 * ユーザーに実績解除を通知する
 * @param {Client} client - Discordクライアント
 * @param {string} userId - ユーザーID
 * @param {object} achievement - 解除した実績オブジェクト
 */
async function notifyUserAchievement(client, userId, achievement) {
  const { mode, channelId } = config.achievementNotification;
  if (mode === 'none') return; // 通知しない設定なら何もしない

  const embed = new EmbedBuilder()
    .setColor("Gold")
    .setTitle("🎉 実績解除！")
    .setDescription(`<@${userId}> が新しい実績を達成しました！`)
    .addFields(
        { name: achievement.name, value: `> ${achievement.description}` }
    )
    .setFooter({text: "効果は1分後に反映されます。"})
    .setTimestamp();

  if (mode === 'public') {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error(`[Achievement] 公開通知の送信に失敗しました (Channel: ${channelId})`, error);
    }
  } else if (mode === 'dm') {
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
    } catch (error) {
      // ユーザーがDMを拒否している場合など
      console.error(`[Achievement] DM通知の送信に失敗しました (User: ${userId})`, error);
    }
  }
}

// --- 内部関数 ---

/**
 * キャッシュにユーザーの実績データがなければDBから読み込む
 */
async function loadUserAchievements(userId) {
  if (achievementCache.has(userId)) {
    return achievementCache.get(userId);
  }

  const idleGame = await IdleGame.findOne({ where: { userId }, attributes: ['achievements', 'userId'] });
  if (!idleGame) return null;

  const achievements = idleGame.achievements;
  achievementCache.set(userId, achievements);
  return achievements;
}

/**
 * 未保存のユーザーデータをDBに一括で保存する
 */
async function saveDirtyUsers() {
  if (dirtyUsers.size === 0) return;

  const usersToSave = [...dirtyUsers];
  dirtyUsers.clear();
  console.log(`[AchievementCache] ${usersToSave.length}件のユーザー実績データをDBに保存します...`);

  try {
    await Promise.all(usersToSave.map(async (userId) => {
      if (!achievementCache.has(userId)) return;
      const achievements = achievementCache.get(userId);
      await IdleGame.update({ achievements }, { where: { userId } });
    }));
    console.log(`[AchievementCache] 保存が完了しました。`);
  } catch (error) {
    console.error('[AchievementCache] 実績データの一括保存中にエラーが発生しました:', error);
    usersToSave.forEach(id => dirtyUsers.add(id));
  }
}

// --- 公開するインターフェース ---

/**
 * 実績キャッシュシステムの初期化
 */
export function initializeAchievementSystem() {
  if (saveIntervalId) clearInterval(saveIntervalId);
  saveIntervalId = setInterval(saveDirtyUsers, 60_000);
  console.log('[AchievementCache] 実績キャッシュシステムが初期化されました。');
}

/**
 * アプリケーション終了時に呼ばれるべき関数
 */
export async function shutdownAchievementSystem() {
  console.log('[AchievementCache] シャットダウン処理を開始します...');
  clearInterval(saveIntervalId);
  await saveDirtyUsers();
  console.log('[AchievementCache] シャットダウン処理が完了しました。');
}

/**
 * 特定の実績を解除しようと試みる
 * ★ client を第一引数に追加する
 * @param {Client} client - Discordクライアント
 * @param {string} userId - ユーザーID
 * @param {number} achievementId - 実績ID
 * @returns {Promise<object|null>}
 */
export async function tryUnlockAchievement(client, userId, achievementId) { // ★ ここ！
  const achievements = await loadUserAchievements(userId);
  if (!achievements) return null;

  if (achievements.unlocked.includes(achievementId)) return null;

  const achievement = config.idle.achievements.find(a => a.id === achievementId);
  if (!achievement) return null;

  achievements.unlocked.push(achievementId);
  dirtyUsers.add(userId);

  console.log(`[Achievement] ${userId} が実績「${achievement.name}」を解除！ (次回のバッチで保存されます)`);
  
  await notifyUserAchievement(client, userId, achievement); 
  
  return achievement;
}