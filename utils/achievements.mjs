// utils/achievements.mjs

import { IdleGame } from "../models/database.mjs";
import config from "../config.mjs";
import { EmbedBuilder } from "discord.js";

/**
 * @summary 実績を解除し、まとめて通知する万能関数。
 * @description 指定されたIDの実績解除を試みます。新しく解除された実績があった場合、
 *              configの設定に基づいて通知を送信します。
 *              レート制限を防ぐため、一度に複数の実績が解除されても通知は1回にまとめられます。
 *              内部でキャッシュ管理されており、一定時間ごとにDBにまとめて保存されます。
 * @param {Client} client - Discordのクライアントオブジェクト。
 * @param {string} userId - 実績を解除するユーザーのID。
 * @param {...number} achievementIds - 解除を試みる実績のID。単独でも複数でも渡せます。
 * @example
 * // 単独の実績IDを渡す場合
 * await unlockAchievements(client, userId, 1);
 *
 * // 複数の実績IDを配列で渡す場合 (スプレッド構文 ... を使う)
 * const ids = [3, 4, 5];
 * await unlockAchievements(client, userId, ...ids);
 */


// --- モジュール内変数 ---
const achievementCache = new Map();
const dirtyUsers = new Set();
let saveIntervalId = null;

// --- 内部関数 ---

async function loadUserAchievements(userId) {
  if (achievementCache.has(userId)) {
    return achievementCache.get(userId);
  }
  const idleGame = await IdleGame.findOne({ where: { userId }, attributes: ['achievements', 'userId'] });
  if (!idleGame) return null;
  achievementCache.set(userId, idleGame.achievements);
  return idleGame.achievements;
}

async function saveDirtyUsers() {
  if (dirtyUsers.size === 0) return;
  const usersToSave = [...dirtyUsers];
  dirtyUsers.clear();
  console.log(`[AchievementCache] ${usersToSave.length}件のユーザー実績データをDBに保存します...`);
  try {
    await Promise.all(usersToSave.map(async (userId) => {
      if (!achievementCache.has(userId)) return;
      await IdleGame.update({ achievements: achievementCache.get(userId) }, { where: { userId } });
    }));
    console.log(`[AchievementCache] 保存が完了しました。`);
  } catch (error) {
    console.error('[AchievementCache] 実績データの一括保存中にエラーが発生しました:', error);
    usersToSave.forEach(id => dirtyUsers.add(id));
  }
}

/**
 * 【内部用】実績解除とキャッシュ更新だけを行う
 * @returns {Promise<object|null>} 新しく解除した場合、実績オブジェクトを返す
 */
async function _tryUnlockAchievement(userId, achievementId) {
  const achievements = await loadUserAchievements(userId);
  if (!achievements || achievements.unlocked.includes(achievementId)) return null;

  const achievement = config.idle.achievements.find(a => a.id === achievementId);
  if (!achievement) return null;

  achievements.unlocked.push(achievementId);
  dirtyUsers.add(userId);
  console.log(`[Achievement] ${userId} が「${achievement.name}」を解除！`);
  return achievement;
}


// --- 公開するインターフェース ---

export function initializeAchievementSystem() {
  if (saveIntervalId) clearInterval(saveIntervalId);
  saveIntervalId = setInterval(saveDirtyUsers, 60_000);
  console.log('[AchievementCache] 実績キャッシュシステムが初期化されました。');
}

export async function shutdownAchievementSystem() {
  console.log('[AchievementCache] シャットダウン処理を開始します...');
  clearInterval(saveIntervalId);
  await saveDirtyUsers();
  console.log('[AchievementCache] シャットダウン処理が完了しました。');
}

/**
 * 【外部から呼ぶ本命】実績を解除し、まとめて通知する
 * @param {Client} client
 * @param {string} userId
 * @param {...number} achievementIds - 解除したい実績IDをカンマ区切りで好きなだけ渡せる
 */
export async function unlockAchievements(client, userId, ...achievementIds) {
  const newlyUnlocked = [];
  for (const id of achievementIds) {
    const unlocked = await _tryUnlockAchievement(userId, id);
    if (unlocked) {
      newlyUnlocked.push(unlocked);
    }
  }

  if (newlyUnlocked.length === 0) return;

  // --- 通知処理 ---
  const { mode, channelId } = config.achievementNotification;
  if (mode === 'none') return;

  let embed;
  if (newlyUnlocked.length === 1) {
    const ach = newlyUnlocked[0];
    embed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🎉 実績解除！")
      .setDescription(`<@${userId}> が新しい実績を達成しました！`)
      .addFields({ 
          name: ach.name, 
          value: `> ${ach.description}${ach.effect ? `\n\n__${ach.effect}__` : ''}`
      })
      .setFooter({text: "効果は1分後に反映されます。"})
      .setTimestamp();
  } else {
    embed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🎉 複数の実績を同時に達成！")
      .setDescription(`<@${userId}> が **${newlyUnlocked.length}個** の実績をまとめて達成しました！`)
      .addFields(
        newlyUnlocked.map(ach => ({
          name: `✅ ${ach.name}`,
          value: `> ${ach.description}${ach.effect ? `\n\n__${ach.effect}__` : ''}`
        }))
      )
      .setFooter({text: "効果は1分後に反映されます。"})
      .setTimestamp();
  }

  const content = `<@${userId}>`;
  if (mode === 'public') {
    try {
      const channel = await client.channels.fetch(channelId);
      await channel.send({ content, embeds: [embed] });
    } catch (error) { console.error(`[Achievement] 公開通知(バッチ)の送信に失敗`, error); }
  } else if (mode === 'dm') {
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
    } catch (error) { console.error(`[Achievement] DM通知(バッチ)の送信に失敗`, error); }
  }
}