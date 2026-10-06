// utils/achievements.mjs

import { UserAchievement } from "../models/database.mjs";
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
let notificationGuild = null;
let notificationMembersReady = false;

// --- 内部関数 ---

async function loadUserAchievements(userId) {
  if (achievementCache.has(userId)) return achievementCache.get(userId);
  const [userAchievement, created] = await UserAchievement.findOrCreate({
    where: { userId },
  });
  if (!userAchievement) return null;

  const achievements = userAchievement.achievements;

  // 互換性確保のために念の為なければ作る
  if (!achievements.unlocked) {
    achievements.unlocked = [];
  }
  if (!achievements.progress) {
    achievements.progress = {};
  }
  // hidden_unlockedはあとから増えたからなおさら
  if (!achievements.hidden_unlocked) {
    achievements.hidden_unlocked = [];
  }
  achievementCache.set(userId, achievements);
  return achievements;
}

async function saveDirtyUsers() {
  if (dirtyUsers.size === 0) return;
  const usersToSave = [...dirtyUsers];
  dirtyUsers.clear();
  console.log(
    `[AchievementCache] ${usersToSave.length}件のユーザー実績データをDBに保存します...`
  );
  try {
    await Promise.all(
      usersToSave.map(async (userId) => {
        if (!achievementCache.has(userId)) return;
        await UserAchievement.update(
          { achievements: achievementCache.get(userId) },
          { where: { userId } }
        );
      })
    );
    console.log(`[AchievementCache] 保存が完了しました。`);
  } catch (error) {
    console.error(
      "[AchievementCache] 実績データの一括保存中にエラーが発生しました:",
      error
    );
    usersToSave.forEach((id) => dirtyUsers.add(id));
  }
}

/**
 * 【内部用】実績解除とキャッシュ更新だけを行う
 * @returns {Promise<object|null>} 新しく解除した場合、実績オブジェクトを返す
 */
async function _tryUnlockAchievement(userId, achievementId) {
  const achievements = await loadUserAchievements(userId);
  if (!achievements || achievements.unlocked.includes(achievementId))
    return null;

  const achievement = config.idle.achievements.find(
    (a) => a.id === achievementId
  );
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
  console.log("[AchievementCache] 実績キャッシュシステムが初期化されました。");
}

// 起動時に一度だけ取得。以後の加入・退出はDiscord.jsがmembers.cacheへ反映する。
export async function initializeAchievementMemberCache(client) {
  const guildId = config.achievementNotification.guildId;
  if (!guildId) return;
  notificationMembersReady = false;
  try {
    notificationGuild = await client.guilds.fetch(guildId);
    await notificationGuild.members.fetch();
    notificationMembersReady = true;
    console.log("[Achievement] 雨宿りの通知用メンバーcacheを取得しました。");
  } catch {
    console.warn("[Achievement] メンバーcacheを取得できません。実績を保存し、通知は省略します。");
  }
}

function canNotifyAchievement(userId) {
  if (!config.achievementNotification.guildId) return true;
  if (!notificationMembersReady) {
    console.warn("[Achievement] メンバーcache未準備のため通知を省略します。");
    return false;
  }
  if (!notificationGuild.members.cache.has(userId)) {
    console.log("[Achievement] 雨宿りの非所属者への通知を省略します。");
    return false;
  }
  return true;
}

export async function shutdownAchievementSystem() {
  console.log("[AchievementCache] シャットダウン処理を開始します...");
  clearInterval(saveIntervalId);
  await saveDirtyUsers();
  console.log("[AchievementCache] シャットダウン処理が完了しました。");
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
  if (mode === "none") return;
  if (!canNotifyAchievement(userId)) return;

  // 1. 解除した実績を、25個ずつのグループに分割する
  const achievementChunks = [];
  const chunkSize = 25;
  for (let i = 0; i < newlyUnlocked.length; i += chunkSize) {
    const chunk = newlyUnlocked.slice(i, i + chunkSize);
    achievementChunks.push(chunk);
  }

  // 2. グループごとにEmbedを作成し、送信する
  for (const chunk of achievementChunks) {
    let embed;

    // 分割されたグループ(chunk)の数が1個なら、既存の単独解除ロジックを使う
    if (chunk.length === 1) {
      const ach = chunk[0];
      embed = new EmbedBuilder()
        .setColor("Gold")
        .setTitle("🎉 実績解除！")
        .setDescription(`<@${userId}> が新しい実績を達成しました！`)
        .addFields({
          name: ach.name,
          value: `${ach.description}${ach.effect ? `\n__${ach.effect}__` : ""}`,
        })
        .setFooter({ text: "効果は1分後に反映されます。" })
        .setTimestamp();
    } else {
      // 2個以上なら、既存の複数解除ロジックを使う
      embed = new EmbedBuilder()
        .setColor("Gold")
        .setTitle("🎉 複数の実績を同時に達成！")
        .setDescription(
          `<@${userId}> が **${chunk.length}個** の実績をまとめて達成しました！`
        )
        .addFields(
          chunk.map((ach) => ({
            name: `✅ ${ach.name}`,
            value: `${ach.description}${ach.effect ? `\n__${ach.effect}__` : ""}`,
          }))
        )
        .setFooter({ text: "効果は1分後に反映されます。" })
        .setTimestamp();
    }

    // 3. 送信処理 (ここは共通)
    const content = `<@${userId}>`;
    if (mode === "public") {
      try {
        const channel = await client.channels.fetch(channelId);
        await channel.send({ content, embeds: [embed] });
      } catch (error) {
        console.error(`[Achievement] 公開通知の送信に失敗`, error);
      }
    } else if (mode === "dm") {
      try {
        const user = await client.users.fetch(userId);
        await user.send({ embeds: [embed] });
      } catch (error) {
        console.error(`[Achievement] DM通知の送信に失敗`, error);
      }
    }

    // 複数のメッセージを連続で送信する場合、APIへの負荷を考慮して少し待つ
    if (achievementChunks.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5秒待機
    }
  }
}

/**
 * 実績の進捗を更新し、条件を満たしたら実績を解除する
 * @param {Client} client
 * @param {string} userId
 * @param {number} achievementId - 進捗を更新したい実績のID
 * @param {number} increment - 今回加算する進捗量 (デフォルトは1)
 */
export async function updateAchievementProgress(
  client,
  userId,
  achievementId,
  increment = 1
) {
  const achievements = await loadUserAchievements(userId);

  // configから実績定義を取得
  const achievementDef = config.idle.achievements.find(
    (a) => a.id === achievementId
  );

  // 実績定義がない、目標値がない、または既に解除済みなら何もしない
  if (
    !achievementDef ||
    !achievementDef.goal ||
    achievements.unlocked.includes(achievementId)
  ) {
    return;
  }

  // progressオブジェクトがなければ初期化
  if (!achievements.progress) {
    achievements.progress = {};
  }

  const currentProgress = achievements.progress[achievementId] || 0;
  const newProgress = currentProgress + increment;

  if (newProgress >= achievementDef.goal) {
    // 目標達成！ unlockAchievementsに処理を任せる
    await unlockAchievements(client, userId, achievementId);
    // 達成後は不要なのでprogressから削除
    delete achievements.progress[achievementId];
  } else {
    // まだ途中なら進捗を保存
    achievements.progress[achievementId] = newProgress;
  }

  // 変更があったので保存対象にする
  dirtyUsers.add(userId);
}

/**
 * 【内部用】隠し実績の解除とキャッシュ更新
 * @returns {Promise<object|null>} 新しく解除した場合、隠し実績オブジェクトを返す
 */
async function _tryUnlockHiddenAchievement(userId, achievementId) {
  // 共通のloadUserAchievementsを呼ぶだけでOK
  const achievements = await loadUserAchievements(userId);
  // 既に解除済みかチェックする配列を hidden_unlocked に変更
  if (!achievements || achievements.hidden_unlocked.includes(achievementId))
    return null;

  // 参照する実績リストを config.idle.hidden_achievements に変更
  const achievement = config.idle.hidden_achievements.find(
    (a) => a.id === achievementId
  );
  if (!achievement) return null;

  // 保存先の配列を hidden_unlocked に変更
  achievements.hidden_unlocked.push(achievementId);
  dirtyUsers.add(userId); // 変更があったので保存対象にする
  console.log(
    `[Achievement] ${userId} が隠し実績「${achievement.name}」を解除！`
  );
  return achievement;
}

/**
 * 【外部から呼ぶ隠し実績版】隠し実績を解除し、本人にのみDMで通知する
 * @param {Client} client
 * @param {string} userId
 * @param {...number} hiddenAchievementIds - 解除したい隠し実績ID
 */
export async function unlockHiddenAchievements(
  client,
  userId,
  ...hiddenAchievementIds
) {
  const newlyUnlocked = [];
  for (const id of hiddenAchievementIds) {
    // 内部関数を隠し実績用に変更
    const unlocked = await _tryUnlockHiddenAchievement(userId, id);
    if (unlocked) {
      newlyUnlocked.push(unlocked);
    }
  }

  if (newlyUnlocked.length === 0) return;

  // --- 通知処理 ---
  // 隠し実績はネタバレ防止のため、本人にのみDMで通知するのが望ましいです。
  if (!canNotifyAchievement(userId)) return;

  let embed;
  if (newlyUnlocked.length === 1) {
    const ach = newlyUnlocked[0];
    embed = new EmbedBuilder()
      .setColor("DarkPurple") // 色を少し変えて特別感を演出
      .setTitle(" SECRET ACHIEVEMENT UNLOCKED ")
      .setDescription(`あなたは隠し実績を見つけた`)
      .addFields({
        name: `??? -> ${ach.name}`, // 解除前後の名前がわかる演出
        value: ach.description,
      })
      .setTimestamp();
  } else {
    embed = new EmbedBuilder()
      .setColor("DarkPurple")
      .setTitle(" MULTIPLE SECRET ACHIEVEMENTS UNLOCKED ")
      .setDescription(
        `あなたは **${newlyUnlocked.length}個** もの秘密を同時に解き明かした`
      )
      .addFields(
        newlyUnlocked.map((ach) => ({
          name: `✅ ${ach.name}`,
          value: ach.description,
        }))
      )
      .setTimestamp();
  }

  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
  } catch (error) {
    // DMが送れなくてもエラーで止まらないようにする
    console.error(`[Achievement] 隠し実績のDM通知に失敗`, error);
  }
}
