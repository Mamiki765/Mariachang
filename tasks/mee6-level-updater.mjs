import Mee6LevelsApi from "mee6-levels-api";
// Sequelizeではなく、Supabaseクライアントを直接使う
import { getSupabaseClient } from "../utils/supabaseClient.mjs";

const GUILD_ID = process.env.MEE6_GUILD_ID;

/**
 * Mee6から全ユーザーのレベル情報を取得し、DBを更新する関数
 * scenario-checker.mjsの設計思想に基づき、Supabase SDKを直接使用して
 * APIコールを最小限に抑える。
 */
export async function syncMee6Levels() {
  const supabase = getSupabaseClient(); // 関数内でクライアントを取得

  if (!GUILD_ID) {
    console.error("[TASK][Mee6] MEE6_GUILD_IDが.envに設定されていません。");
    return;
  }

  console.log("[TASK][Mee6] 全ユーザーのレベル同期を開始します...");
  try {
    // 1. Mee6 APIから全プレイヤーデータを取得
    const allPlayers = await Mee6LevelsApi.getLeaderboard(GUILD_ID);

    if (!allPlayers || allPlayers.length === 0) {
      console.warn(
        "[TASK][Mee6] Mee6からプレイヤーデータを取得できませんでした。"
      );
      return;
    }

    // 2. DBから既存の全レベルデータを取得
    const { data: dbLevels, error: fetchError } = await supabase
      .from("mee6_levels")
      .select("userId, level, xpInLevel, totalXp, xpForNextLevel"); // 必要なカラムだけ取得

    if (fetchError) {
      console.error("[TASK][Mee6] DBからのレベルデータ取得に失敗:", fetchError);
      return; // DBエラー時は中断
    }

    // 3. メモリ上で差分比較を行う
    const dbLevelMap = new Map(dbLevels.map((l) => [l.userId, l]));
    const levelsToUpsert = [];

    for (const player of allPlayers) {
      const existing = dbLevelMap.get(player.id);

      const newData = {
        userId: player.id,
        level: player.level,
        xpInLevel: player.xp.userXp,
        totalXp: player.xp.totalXp,
        xpForNextLevel: player.xp.levelXp,
      };

      // DBに存在しないか、データに何らかの変更があった場合のみupsert対象とする
      if (
        !existing ||
        existing.level !== newData.level ||
        existing.xpInLevel !== newData.xpInLevel
        // totalXpやxpForNextLevelも比較対象に加えても良いが、
        // levelかxpInLevelが変われば他も変わるはずなので、これで十分効率的
      ) {
        levelsToUpsert.push(newData);
      }
    }

    // 4. 差分があったデータのみをDBに一括で反映
    if (levelsToUpsert.length > 0) {
      console.log(
        `${levelsToUpsert.length}件のユーザーデータをDBに反映します。`
      );
      const { error: upsertError } = await supabase
        .from("mee6_levels")
        .upsert(levelsToUpsert); // onConflictはSDKが自動で主キー(userId)を見てくれる

      if (upsertError) {
        console.error("[TASK][Mee6] DBへのupsert処理に失敗:", upsertError);
      } else {
        console.log(
          `[TASK][Mee6] ${levelsToUpsert.length}人のユーザーデータを正常に同期しました。`
        );
      }
    } else {
      console.log("[TASK][Mee6] レベルの更新はありませんでした。");
    }

    // タスク実行ログを記録（scenario-checkerと同様のテーブルがあれば）
    await supabase.from("task_logs").upsert({
      task_name: "mee6-level-updater",
      last_successful_run: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[TASK][Mee6] レベル同期タスク実行中に致命的なエラー:",
      error
    );
  }
}
