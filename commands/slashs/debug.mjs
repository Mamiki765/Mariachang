// commands/slashs/debug.mjs
import { SlashCommandBuilder } from "discord.js";
import {
  IdleGame,
  Mee6Level,
  UserAchievement,
} from "../../models/database.mjs";
import { calculateOfflineProgress } from "../../idle-game/idle-game-calculator.mjs";
import config from "../../config.mjs";

// このコマンドはデバッグ専用なので、helpには表示しない
export const help = {};

// 'debug'スコープを指定することで、開発環境でのみ登録されるようにする
export const scope = "debug";

export const data = new SlashCommandBuilder()
  .setName("debug-idle")
  .setDescription("【開発用】放置ゲームのデバッグ用コマンド")
  // 開発者自身が使う想定なので、Discordの権限設定は不要
  .addSubcommand((subcommand) =>
    subcommand
      .setName("advance-time")
      .setDescription("指定したユーザーのゲーム内時間を進める（再計算も実行）")
      .addUserOption((option) =>
        option
          .setName("target")
          .setDescription("対象のユーザー")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("hours")
          .setDescription("進める時間（h）")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-mee6-level")
      .setDescription("指定ユーザーのMee6レベルを一時的に設定する")
      .addUserOption((option) =>
        option
          .setName("target")
          .setDescription("対象のユーザー")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("level")
          .setDescription("設定したいMee6レベル")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("clone-data")
      .setDescription("指定IDの工場データを自分にコピーする")
      .addStringOption((option) =>
        option
          .setName("source-id")
          .setDescription("コピー元のユーザーID")
          .setRequired(true)
      )
  );
// .addSubcommand(...) で、今後 'grant-tp' などの機能を追加できます

export async function execute(interaction) {
  // 安全のための二重チェック：Bot管理者(OWNER_ID)でなければ実行させない
  const allowedUserIds = [config.administrator, "1123987861180534826"];
  if (!allowedUserIds.includes(interaction.user.id)) {
    return interaction.reply({
      content: "このコマンドはBot管理者・指定デバッグアカウント専用です。",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const subcommand = interaction.options.getSubcommand();
  // clone-data 以外のコマンドは targetUser が必要
  let targetUser;
  if (subcommand !== "clone-data") {
    targetUser = interaction.options.getUser("target");
  }

  if (subcommand === "advance-time") {
    const hoursToAdvance = interaction.options.getInteger("hours");
    try {
      const idleGame = await IdleGame.findOne({
        where: { userId: targetUser.id },
      });
      if (!idleGame) {
        return interaction.editReply(
          `❌ 対象ユーザー (${targetUser.username}) の工場データが見つかりません。`
        );
      }
      const newLastUpdate = new Date(
        Date.now() - hoursToAdvance * 60 * 60 * 1000
      );
      idleGame.lastUpdatedAt = newLastUpdate;
      await idleGame.save();

      // 2. 関連データを取得して externalData を準備
      const [mee6Level, userAchievement] = await Promise.all([
        Mee6Level.findOne({ where: { userId: targetUser.id }, raw: true }),
        UserAchievement.findOne({
          where: { userId: targetUser.id },
          raw: true,
        }),
      ]);
      const unlockedSet = new Set(
        userAchievement?.achievements?.unlocked || []
      );
      const externalData = {
        mee6Level: mee6Level?.level || 0,
        achievementCount: unlockedSet.size,
        unlockedSet: unlockedSet,
      };

      // 3. 最新のDBデータと externalData を使って再計算
      const latestIdleGame = await IdleGame.findOne({
        where: { userId: targetUser.id },
        raw: true,
      });
      const updatedIdleGame = calculateOfflineProgress(
        latestIdleGame,
        externalData
      );

      // 4. 計算結果をDBに保存 (動的オブジェクト構築)
      const updateData = {
        population: updatedIdleGame.population,
        lastUpdatedAt: updatedIdleGame.lastUpdatedAt,
        pizzaBonusPercentage: updatedIdleGame.pizzaBonusPercentage,
        infinityTime: updatedIdleGame.infinityTime,
        eternityTime: updatedIdleGame.eternityTime,
      };
      if (updatedIdleGame.wasChanged.ipUpgrades) {
        updateData.generatorPower = updatedIdleGame.generatorPower;
        updateData.ipUpgrades = updatedIdleGame.ipUpgrades;
        IdleGame.changed("ipUpgrades", true);
      }
      await IdleGame.update(updateData, { where: { userId: targetUser.id } });
      await interaction.editReply(
        `✅ ${targetUser.username} の時間を **${hoursToAdvance}時間** 進めて、データを再計算しました。`
      );
    } catch (error) {
      console.error("[DEBUG-IDLE] Error in advance-time:", error);
      await interaction.editReply("❌ 処理中にエラーが発生しました。");
    }
  } else if (subcommand === "set-mee6-level") {
    const newLevel = interaction.options.getInteger("level");
    try {
      // findOrCreateだと既存の値が変更されないので、upsertが最適
      // upsert: データがあればUPDATE、なければINSERTを実行してくれる賢いメソッド
      await Mee6Level.upsert({
        userId: targetUser.id,
        level: newLevel,
        // 他のカラムはデフォルト値か現在の値が維持される
      });
      await interaction.editReply(
        `✅ ${targetUser.username} のMee6レベルを一時的に **Lv. ${newLevel}** に設定しました。\n(次回の自動更新で元に戻る可能性があります)`
      );
    } catch (error) {
      console.error("[DEBUG-IDLE] Error in set-mee6-level:", error);
      await interaction.editReply("❌ 処理中にエラーが発生しました。");
    }
  } else if (subcommand === "clone-data") {
    // ★★★ 新しいサブコマンドの処理 ★★★
    const sourceId = interaction.options.getString("source-id");
    const destinationId = interaction.user.id; // コマンド実行者

    if (destinationId === config.administrator) {
      return interaction.editReply(
        "❌ あなたのデータが飛びますよ。"
      );
    }
    // 安全装置: コピー元が自分自身の場合はエラー
    if (sourceId === destinationId) {
      return interaction.editReply("❌ コピー元とコピー先が同じです。");
    }

    try {
      // 1. コピー元のデータを全て取得
      const sourceIdleGame = await IdleGame.findByPk(sourceId, { raw: true });
      const sourceMee6Level = await Mee6Level.findByPk(sourceId, { raw: true });
      const sourceAchievements = await UserAchievement.findByPk(sourceId, {
        raw: true,
      });

      if (!sourceIdleGame) {
        return interaction.editReply(
          `❌ コピー元 (${sourceId}) の工場データが見つかりません。`
        );
      }

      // 2. コピー先のデータを生成 (userId と lastUpdatedAt を除く)
      const clonedIdleGameData = { ...sourceIdleGame };
      delete clonedIdleGameData.userId; // 主キーなので削除
      clonedIdleGameData.lastUpdatedAt = new Date(); // 最終更新日時を現在に

      const clonedMee6Data = { ...sourceMee6Level };
      if (sourceMee6Level) {
        delete clonedMee6Data.userId;
      }

      const clonedAchievementsData = { ...sourceAchievements };
      if (sourceAchievements) {
        delete clonedAchievementsData.userId;
      }

      // 3. upsert を使ってデータを一括で上書き・作成
      await IdleGame.upsert({ userId: destinationId, ...clonedIdleGameData });

      if (sourceMee6Level) {
        await Mee6Level.upsert({ userId: destinationId, ...clonedMee6Data });
      }

      if (sourceAchievements) {
        await UserAchievement.upsert({
          userId: destinationId,
          ...clonedAchievementsData,
        });
      }

      await interaction.editReply(
        `✅ ユーザーID: \`${sourceId}\` のデータを、あなたに正常にコピーしました。`
      );
    } catch (error) {
      console.error("[DEBUG-IDLE] Error in clone-data:", error);
      await interaction.editReply(
        "❌ データのコピー中にエラーが発生しました。"
      );
    }
  }
}
