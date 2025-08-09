// commands/slashs/scenarios.mjs
// 仮コマンド
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Scenario } from "../../models/database.mjs"; // Sequelizeモデルをインポート
import cronParser from "cron-parser";
import config from "../../config.mjs";

// --- このファイル内だけで使う、小さなヘルパー関数 ---

/**
 * config.mjsからcronスケジュールを読み取り、次の実行時刻を計算して返す
 * @returns {Date | null} 次の実行時刻のDateオブジェクト、またはエラーの場合はnull
 */
function getNextScenarioCheckTime() {
  try {
    const options = {
      tz: "Asia/Tokyo", // タイムゾーンを忘れずに指定
    };
    const interval = cronParser.parseExpression(
      config.scenarioChecker.cronSchedule,
      options
    );
    return interval.next().toDate();
  } catch (err) {
    console.error("Cronスケジュールのパースに失敗しました:", err.message);
    return null;
  }
}

// --- コマンドの定義 ---

export const data = new SlashCommandBuilder()
  .setName("scenarios")
  .setNameLocalizations({
    ja: "シナリオ一覧（仮）",
  })
  .setDescription("現在DBに記録されている、ロストアーカディアのシナリオ一覧を表示します。");

// --- コマンドの実行ロジック ---

export async function execute(interaction) {
  try {
    // 1. DBからシナリオをすべて取得 (読み取りのみ)
    const allScenarios = await Scenario.findAll({
      order: [
        ['status', 'ASC'], // ステータス順
        ['title', 'ASC']  // タイトル順
      ],
    });

    if (allScenarios.length === 0) {
      await interaction.reply({
        content: "現在、DBに記録されているシナリオはありません。",
        flags: 64, // ephemeral
      });
      return;
    }

    // 2. 最終更新日時と次回更新日時を取得
    //    DBのタイムスタンプ(updatedAt)が最も新しいものを探す
    const lastUpdateTime = allScenarios.reduce((latest, scenario) => {
      return scenario.updatedAt > latest ? scenario.updatedAt : latest;
    }, allScenarios[0].updatedAt);
    
    const nextCheckTime = getNextScenarioCheckTime();

    // 3. Embedを作成
    const embed = new EmbedBuilder()
      .setTitle("📖 現在のシナリオ一覧")
      .setColor("#2f3136")
      // descriptionには、シナリオのリストを入れる（文字数制限に注意）
      // ここでは、簡単化のためにタイトルだけをリストアップ
      .setDescription(
        allScenarios
          .map(s => `・[${s.title}](https://rev2.reversion.jp/scenario/opening/${s.id}) (${s.status})`)
          .join('\n')
          .substring(0, 4000) // 念のため、4000文字でカット
      )
      .setTimestamp(lastUpdateTime) // 最終更新日時を、Embedのタイムスタンプとして表示
      .setFooter({
        text: nextCheckTime 
          ? `次回更新: ${nextCheckTime.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`
          : "次回更新時刻は未定です",
      });
      
    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error("シナリオ一覧コマンドの実行中にエラーが発生しました:", error);
    await interaction.reply({
      content: "シナリオ一覧の表示中にエラーが発生しました。しばらくしてからもう一度お試しください。",
      flags: 64, // ephemeral
    });
  }
}