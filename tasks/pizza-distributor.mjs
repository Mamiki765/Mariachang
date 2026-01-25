// tasks/pizza-distributor.mjs (RPCバージョン)
import cron from "node-cron";
import { activeUsersForPizza } from "../handlers/messageCreate.mjs";
import { activeUsersForSunflower } from "../handlers/messageReactionAdd.mjs";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";
import config from "../config.mjs";
import {
  IdleGame,
  Mee6Level,
  UserAchievement,
  Point,
} from "../models/database.mjs";
import { calculateOfflineProgress } from "../idle-game/idle-game-calculator.mjs";
import { Op } from "sequelize";
import {
  checkLoginBonusEligibility,
  executeLoginBonus,
  calculateRewards,
} from "../utils/loginBonusSystem.mjs";

const allowedGuildIds = (process.env.GUILD_IDS || "")
  .split(",")
  .map((id) => id.trim());

/**
 * 定期的にピザを配布するタスクを開始する
 * @param {import("discord.js").Client} client - DM送信に必要
 */
export function startPizzaDistribution(client) {
  // 毎時 0分, 10分, 20分, 30分, 40分, 50分に実行
  //人口を増加させ、ボーナス率を記録しておく
  cron.schedule("*/10 * * * *", async () => {
    if (config.isProduction) {
      console.log("[CALC_ALL] 全ユーザーの人口ボーナス更新処理を開始します。");
      try {
        await updateAllUsersIdleGame(); // 新しく作る全体更新関数を呼び出す
        console.log("[CALC_ALL] 更新処理が正常に完了しました。");
      } catch (error) {
        console.error(
          "[CALC_ALL] ボーナス更新処理でエラーが発生しました:",
          error
        );
      }
    }
  });
  // ------------------------------------
  // 毎分実行：発言者へのピザ配布 ＋ 【追加】即時ログボ付与　＋　ひまわり配布
  // ------------------------------------
  cron.schedule("*/1 * * * *", async () => {
    if (activeUsersForPizza.size === 0) return;

    // Mapをコピーしてクリア
    const currentActiveUsers = new Map(activeUsersForPizza);
    activeUsersForPizza.clear();

    // フィルタリング処理
    // RPCに渡すための「許可されたユーザーIDリスト」を作成
    const validUserIds = [];

    for (const [userId, member] of currentActiveUsers) {
      // 条件1: memberがない (null) = DMからの発言 (許可)
      // 条件2: memberがあり、かつギルドIDが許可リストに含まれている (許可)
      const isDm = !member;
      const isAllowedGuild =
        member && allowedGuildIds.includes(member.guild.id);

      if (isDm || isAllowedGuild) {
        validUserIds.push(userId);
      } else {
        // 対象外ギルドでの発言は何もしない（ログも出さなくて良いでしょう）
      }
    }

    // 対象者がいなければここで終了（RPCも叩かない）
    if (validUserIds.length === 0) return;

    const supabase = getSupabaseClient();

    // 1. ピザトークン配布 (RPC)
    // validUserIds (フィルタリング済み) を使用
    try {
      const { min, max } = config.chatBonus.legacy_pizza.amount;
      const { error } = await supabase.rpc(
        "increment_legacy_pizza_with_bonus",
        {
          user_ids: validUserIds,
          min_amount: min,
          max_amount: max,
        }
      );
      if (error) throw error;
    } catch (error) {
      console.error("[RPC]ピザ配布タスクでエラーが発生しました:", error);
    }

    // 2. ブースターコイン配布 (RPC)
    // validUserIds (フィルタリング済み) を使用
    try {
      const { error } = await supabase.rpc("increment_booster_coin", {
        user_ids_list: validUserIds,
      });
      // console.log(`[RPC] Booster coin distribution completed.`);
    } catch (error) {
      console.error("[RPC] Booster coin distribution task failed:", error);
    }

    // 260125追加: ひまわり報酬配布処理 ▼▼▼ ===
    if (activeUsersForSunflower.size > 0) {
      // 1. Mapをコピーしてクリア
      const currentReactors = new Map(activeUsersForSunflower);
      activeUsersForSunflower.clear();

      // 2. 配布対象IDリストの作成
      // ★★★ 変数名を変更 (validUserIds -> validSunflowerUserIds) ★★★
      const validSunflowerUserIds = [];
      
      for (const [userId, data] of currentReactors) {
        const isDm = !data.guildId;
        const isAllowedGuild =
          data.guildId && allowedGuildIds.includes(data.guildId);

        if (isDm || isAllowedGuild) {
          validSunflowerUserIds.push(userId); // ★ここも変更
        }
      }

      // 3. 対象者がいればRPC実行
      if (validSunflowerUserIds.length > 0) { // ★ここも変更
        const supabase = getSupabaseClient();
        try {
          const { error } = await supabase.rpc("increment_sunflower_rewards", {
            user_ids: validSunflowerUserIds, // ★ここも変更
          });

          if (error) {
            console.error("[RPC] ひまわり配布処理でエラーが発生しました:", error);
          }
        } catch (error) {
          console.error("[RPC] ひまわり配布タスク呼び出し失敗:", error);
        }
      }
    }

    // 3. チャット発言者への「即時ログボ」チェック
    // validUserIds に含まれるユーザーのみチェックすればOK
    for (const userId of validUserIds) {
      // executeLoginBonusにはmemberオブジェクトが必要なのでMapから取り出す
      const member = currentActiveUsers.get(userId);

      checkLoginBonusEligibility(userId).then(async (isEligible) => {
        if (isEligible) {
          console.log(
            `[AutoLogin] Chat detected for ${userId}. Granting login bonus.`
          );
          await executeLoginBonus(client, userId, member, "chat");
        }
      });
    }
  });

  // --------------------------------------------------------
  // 7:50 自動回収 (拾い忘れ配布)
  // --------------------------------------------------------
  if (config.isProduction) {
    cron.schedule(
      "50 7 * * *",
      async () => {
        console.log(
          "[LOGIBO_AUTOCLAIM] 拾い忘れログボの配布処理を開始します。"
        );
        try {
          await distributeForgottenLoginBonus(client);
          console.log("[LOGIBO_AUTOCLAIM] 配布処理が正常に完了しました。");
        } catch (error) {
          console.error(
            "[LOGIBO_AUTOCLAIM] 配布処理でエラーが発生しました:",
            error
          );
        }
      },
      { timezone: "Asia/Tokyo" }
    );
  }
}

/**
 * 全ての放置ゲームユーザーのデータを更新する (完成版)
 */
async function updateAllUsersIdleGame() {
  // --- 1. ループの前に、必要な外部データを"全員分"まとめて取得 ---
  const allMee6Levels = await Mee6Level.findAll({ raw: true });
  const allAchievements = await UserAchievement.findAll({ raw: true });

  // --- 2. ユーザーIDで高速に検索できるよう、Mapオブジェクトに変換 ---
  const mee6Map = new Map(
    allMee6Levels.map((item) => [item.userId, item.level])
  );
  const achievementMap = new Map(
    allAchievements.map((item) => [
      item.userId,
      new Set(item.achievements?.unlocked || []),
    ])
  );

  const CHUNK_SIZE = 100; // 一度に処理するユーザー数
  let offset = 0;

  while (true) {
    // 全ユーザーのデータをチャンク単位で取得
    const users = await IdleGame.findAll({
      limit: CHUNK_SIZE,
      offset: offset,
      raw: true, // 高速化のため
    });

    if (users.length === 0) break; // 全ユーザーの処理が終わったらループを抜ける

    // --- 3. 各ユーザーのオフライン進行を計算 ---
    const updatedUsersData = users.map((user) => {
      const unlockedSet = achievementMap.get(user.userId) || new Set();
      // 3-1. 各ユーザーの「道具箱 (externalData)」を準備する
      const externalData = {
        mee6Level: mee6Map.get(user.userId) || 0, // Mapから高速に取得
        achievementCount: unlockedSet.size, // .lengthではなく.sizeを使う
        unlockedSet: unlockedSet,
      };

      // 3-2. 計算エンジンに、idleGameデータと道具箱を渡す！
      return calculateOfflineProgress(user, externalData);
    });

    // --- 4. SequelizeのbulkCreateを使って一括更新 ---
    await IdleGame.bulkCreate(updatedUsersData, {
      updateOnDuplicate: [
        "population",
        "lastUpdatedAt",
        "pizzaBonusPercentage",
        "infinityTime",
        "eternityTime",
        "generatorPower",
        "ipUpgrades",
        "infinityCount",
      ],
    });

    console.log(
      `[CALC_ALL] ${offset + users.length}人までのデータ更新が完了しました。`
    );
    offset += CHUNK_SIZE;
  }
}

/**
 * 【共通ロジック適用版】ログインボーナスを拾い忘れたユーザーに報酬を配布する
 * 手動受取と同じ計算式(calculateRewards)を使用します。
 * @param {import("discord.js").Client} client
 */
async function distributeForgottenLoginBonus(client) {
  // --- 1. 条件設定 ---
  const yesterday8AM = new Date();
  yesterday8AM.setDate(yesterday8AM.getDate() - 1);
  yesterday8AM.setHours(8, 0, 0, 0);

  const today7_50AM = new Date();
  today7_50AM.setHours(7, 50, 0, 0);

  // --- 2. 対象ユーザーをDBから抽出 ---
  // 条件: 昨日の朝8時以降に活動(updatedAt更新)があるが、昨日の朝8時以降にログボを受け取っていない(lastAcornDateが古い)
  const targetUsers = await Point.findAll({
    where: {
      lastAcornDate: { [Op.lt]: yesterday8AM },
      updatedAt: { [Op.gte]: yesterday8AM },
    },
  });

  if (targetUsers.length === 0) {
    console.log("[LOGIBO_AUTOCLAIM] 対象ユーザーはいませんでした。");
    return;
  }
  console.log(
    `[LOGIBO_AUTOCLAIM] ${targetUsers.length}人の対象ユーザーに配布します。`
  );

  const userIds = targetUsers.map((u) => u.userId);

  // --- 3. 必要な外部データを一括取得 ---
  // ① Mee6レベル (計算に必要なので取得、Map化)
  const allMee6Levels = await Mee6Level.findAll({
    where: { userId: { [Op.in]: userIds } },
    raw: true,
  });
  // Mapの値としてオブジェクト全体(level, xpInLevel等)を保持する
  const mee6Map = new Map(allMee6Levels.map((item) => [item.userId, item]));

  // ② サーバーブースト数 (Supabase RPCを利用)
  const supabase = getSupabaseClient();
  let boosterMap = new Map();

  try {
    const { data: boosterCounts, error: rpcError } = await supabase.rpc(
      "get_booster_counts_for_users",
      { user_ids: userIds }
    );
    if (rpcError) {
      console.error("[LOGIBO_AUTOCLAIM] Supabase RPC failed:", rpcError);
    } else {
      boosterMap = new Map(
        boosterCounts?.map((item) => [item.user_id, item.boost_count]) || []
      );
    }
  } catch (e) {
    console.error("[LOGIBO_AUTOCLAIM] Error fetching booster counts:", e);
  }

  // --- 4. 各ユーザーの報酬を計算し、一括更新用のデータを作成 ---
  const bulkUpdateData = [];
  const dmPromises = [];

  for (const userPoint of targetUsers) {
    const userId = userPoint.userId;

    // ★★★ 共通ロジックを使って報酬を計算 ★★★
    // 自動回収時はAPI制限の都合上 member(ロール)取得は行わず、
    // DBにあるMee6レベルとブースト数のみで計算する方針とします。
    const rewards = calculateRewards({
      mee6Level: mee6Map.get(userId),
      boosterCount: boosterMap.get(userId) || 0,
      member: null, // memberは渡さない
    });

    // 更新用データを作成
    bulkUpdateData.push({
      userId: userId,
      acorn: userPoint.acorn + 1, // どんぐりは固定+1
      totalacorn: userPoint.totalacorn + 1,
      coin: userPoint.coin + rewards.coin, // 計算されたコイン(ランダムボーナス含む)
      nyobo_bank: userPoint.nyobo_bank + rewards.pizza, // 計算されたピザ
      lastAcornDate: today7_50AM,
    });

    // DM送信処理
    // calculateRewards が返してくれた details を使って内訳を表示
    const { details } = rewards;
    let breakdownMsg = `-# (内訳: 基本${details.basePizza} + ランク${details.finalMee6Bonus}`;
    if (details.boosterBonus > 0) {
      breakdownMsg += ` + ブースト${details.boosterBonus}`;
    }
    breakdownMsg += `)`;

    const dmMessage =
      `おはようございますにゃ、昨日のログインボーナスを少しだけお届けに参りましたにゃ。\n` +
      `- あまやどんぐり: 1個\n` +
      `- ${config.nyowacoin}: ${rewards.coin}枚 ${details.coinBonusMessage}\n` +
      `- ${config.casino.currencies.legacy_pizza.displayName}: ${rewards.pizza.toLocaleString()}枚 \n` +
      `${breakdownMsg}\n` +
      `-# 本日のログインボーナスは、いつも通り8:00以降に雑談や /ログボ コマンドで出るボタンから受け取れます\n` +
      `-# 詫び石配布などでログイン扱いになっているかもしれません、ごめんなさい！`;

    const dmPromise = client.users
      .send(userId, { content: dmMessage, flags: 4096 })
      .catch((error) => {
        // エラーコード 50007 (DM送信不可) は無視
        if (error.code !== 50007) {
          console.error(`[LOGIBO_AUTOCLAIM] DM Error (${userId}):`, error);
        }
      });
    dmPromises.push(dmPromise);
  }

  // --- 5. DBを一括更新 & DMを一斉送信 ---
  await Point.bulkCreate(bulkUpdateData, {
    updateOnDuplicate: [
      "acorn",
      "totalacorn",
      "coin",
      "nyobo_bank",
      "lastAcornDate",
    ],
  });

  await Promise.all(dmPromises);
}
