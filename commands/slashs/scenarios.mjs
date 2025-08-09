// commands/slashs/scenarios.mjs
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Scenario } from "../../models/database.mjs"; // Sequelizeモデルをインポート
import { parseExpression } from "cron-parser";
import config from "../../config.mjs";
import { Op } from "sequelize"; // SequelizeのOp（演算子）をインポート
import { supabase } from "../../utils/supabaseClient.mjs";
// --- このファイル内だけで使う、小さなヘルパー関数 ---

/**
 * config.mjsから【複数の】cronスケジュールを読み取り、
 * 【最も近い未来の】実行時刻を計算して返す
 * @returns {Date | null} 次の実行時刻のDateオブジェクト、またはエラーの場合はnull
 */
function getNextScenarioCheckTime() {
  try {
    const options = {
      tz: "Asia/Tokyo",
    };
    
    // 1. スケジュールが定義されている配列を作成
    const schedules = [
      config.scenarioChecker.cronSchedule,
      config.scenarioChecker.cronSchedule2,
    ];

    // 2. 各スケジュールの「次の実行時刻」を計算し、Dateオブジェクトの配列にする
    const nextDates = schedules
      // スケジュール文字列が空やnullでないことを確認
      .filter(schedule => schedule) 
      .map(schedule => {
        try {
          const interval = parseExpression(schedule, options);
          return interval.next().toDate();
        } catch (err) {
          // もし片方のパースに失敗しても、全体が止まらないようにする
          console.error(`Cronパースエラー (${schedule}):`, err.message);
          return null;
        }
      })
      // パースに失敗したnullを除外
      .filter(date => date !== null);

    // 3. 計算された時刻が一つもなければ、nullを返す
    if (nextDates.length === 0) {
      return null;
    }

    // 4. 計算された複数の「次の時刻」の中から、最も小さい（＝最も近い）ものを探して返す
    //    reduceを使って、配列の最小値を見つける
    const nearestDate = nextDates.reduce((earliest, current) => {
      return current < earliest ? current : earliest;
    });

    return nearestDate;

  } catch (err) {
    // 全体的な予期せぬエラー
    console.error("getNextScenarioCheckTimeで予期せぬエラー:", err.message);
    return null;
  }
}

// --- コマンドの定義 ---

export const data = new SlashCommandBuilder()
  .setName("scenarios")
  .setNameLocalizations({ ja: "ロスアカシナリオ一覧" })
  .setDescription(
    "現在参加可能な、ロストアーカディアのシナリオ一覧を表示します。"
  );

// --- コマンドの実行ロジック ---

export async function execute(interaction) {
  try {
    // 1. 【絞り込み】DBから「今、参加できるシナリオ」だけを取得
    const activeScenarios = await Scenario.findAll({
      where: {
        [Op.or]: [
          // いずれかの条件に一致するもの
          { status: "JOINABLE" },
          { status: "SUPPORTABLE" },
          { status: "RESERVABLE" },
          { state: "事前公開中" },
        ],
      },
      order: [["createdAt", "DESC"]], // 新しく作られた順に並べる
    });

    if (activeScenarios.length === 0) {
      await interaction.reply({
        content: "現在、DBに記録されているシナリオはありません。",
        flags: 64, // ephemeral
      });
      return;
    }

    // 2. 【情報の付加】最終更新日時と次回更新日時を取得
    const { data: taskLog } = await supabase
      .from('task_logs')
      .select('last_successful_run')
      .eq('task_name', 'scenario-checker')
      .single(); // .single()は、結果が1行であることを保証する

    // taskLogが存在すればその時刻を、なければ現在の時刻をデフォルト値として使用
    const lastUpdateTime = taskLog ? new Date(taskLog.last_successful_run) : new Date();
    
    const nextCheckTime = getNextScenarioCheckTime();

    // 3. 【表示の再現】あなたの素晴らしい通知ロジックを、ここに再利用！
    //    (EmbedBuilderやメッセージ分割ロジックを、activeScenariosを元に組み立てる)

    let descriptionText = "";
    const embedsToSend = [];
    const charLimit = 4000;
    const actionTypeMap = {
      RESERVABLE: "予約期間中",
      JOINABLE: "参加受付中",
      SUPPORTABLE: "サポート可",
    };

    // ループの対象は `activeScenarios`
    for (const s of activeScenarios) {
      // statusが'OUT_OF_ACTION'（DBに保存されていないstate由来）の場合は特別扱い
      const statusText =
        s.state === "事前公開中"
          ? "事前公開中"
          : actionTypeMap[s.status] || "不明";
      const sourceNameDisplay =
        s.source_name && s.source_name.trim() !== ""
          ? `<${s.source_name}> `
          : "";
      const maxMemberText =
        s.max_members === null || s.max_members === -1 ? "∞" : s.max_members;
      const timePart = s.time ? s.time.split(" ")[1].slice(0, 5) : "";
      const specialTimeText =
        (s.time_type === "予約抽選" || s.time_type === "予約開始") &&
        timePart !== config.scenarioChecker.defaultReserveTime
          ? `|**予約抽選: ${timePart}**`
          : "";

      const line = `${sourceNameDisplay}[${s.title}](https://rev2.reversion.jp/scenario/opening/${s.id})\n-# 📖${s.creator_penname}|${s.type}|${s.difficulty}|${s.current_members}/${maxMemberText}人|**${statusText}**${specialTimeText}`;

      if (
        descriptionText.length + line.length + 2 > charLimit &&
        descriptionText !== ""
      ) {
        embedsToSend.push(
          new EmbedBuilder().setColor("Green").setDescription(descriptionText)
        );
        descriptionText = line;
      } else {
        descriptionText += (descriptionText ? "\n-# \u200b\n" : "") + line;
      }
    }

    if (descriptionText !== "") {
      embedsToSend.push(
        new EmbedBuilder().setColor("Green").setDescription(descriptionText)
      );
    }

    // 最後のEmbedに、フッターとタイムスタンプを追加
    const finalEmbed = embedsToSend[embedsToSend.length - 1];
    if (finalEmbed) {
      finalEmbed
        .setTitle(
          `✅ 参加・予約可能なシナリオ一覧 (${activeScenarios.length}件)`
        )
        .setTimestamp(lastUpdateTime)
        .setFooter({
          text: nextCheckTime
            ? `次回DB更新: ${nextCheckTime.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`
            : "次回DB更新時刻は未定です",
        });
    }
    // 最初のEmbedにもタイトルをつける（メッセージが分割されなかった場合のため）
    if (embedsToSend[0] && !embedsToSend[0].data.title) {
      embedsToSend[0].setTitle(
        `✅ 参加・予約可能なシナリオ一覧 (${activeScenarios.length}件)`
      );
    }

    // 作成したEmbedをすべて送信
    for (let i = 0; i < embedsToSend.length; i++) {
      const embed = embedsToSend[i];
      // 最初のメッセージはreply、2通目以降はfollowUp
      if (i === 0) {
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.followUp({ embeds: [embed] });
      }
    }
  } catch (error) {
    console.error("シナリオ一覧コマンドの実行中にエラーが発生しました:", error);
    // deferReplyやreply済みの場合に備えて、followUpでエラー通知
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: "シナリオ一覧の表示中にエラーが発生しました。",
        flags: 64, // ephemeral
      });
    } else {
      await interaction.reply({
        content: "シナリオ一覧の表示中にエラーが発生しました。",
        flags: 64, // ephemeral
      });
    }
  }
}
