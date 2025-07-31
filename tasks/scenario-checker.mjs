// ES Modules形式のインポート
import axios from "axios";
import { EmbedBuilder } from "discord.js";
import { Op } from "sequelize";
import { Scenario } from "../models/roleplay.mjs";
import config from "../config.mjs";

// 通知を送るチャンネルIDを環境変数から取得
const ANNOUNCE_CHANNEL_ID = config.rev2ch; // ここはconfig.mjsから取得するように変更

// export をつけて関数を定義
export async function checkNewScenarios(client) {
  if (!client || !ANNOUNCE_CHANNEL_ID) {
    console.error(
      "Discordクライアントまたは通知用チャンネルIDが設定されていません。"
    );
    return;
  }
  console.log("シナリオの新規・終了チェックを開始します...");

  try {
    // 1. 最新のシナリオリストをAPIから取得
    // (あなたがスラッシュコマンドで完成させた、APIのURL、ペイロード、ヘッダーを含む、あのコードをここに持ってきます)
    const apiUrl = "https://rev2.reversion.jp/graphql?opname=OpeningList";
    // curlの --data-raw に相当するリクエスト本体（ペイロード）
    const payload = {
      operationName: "OpeningList",
      variables: {
        input: {
          states: ["PUBLISHED", "RESERVING", "DISCUSSION", "DEPARTED"],
          type: null,
          character_id: null,
          creator_id: null,
          penname: null,
          heading: null,
          title: null,
          include_gm: null,
          include_nm: null,
          include_old_rally: null,
          supportable: null,
          allow_ex_playing: null,
        },
      },
      query:
        "query OpeningList($input: Rev2ScenarioSearchInput!) {\n  rev2OpeningList(input: $input) {\n    ...ScenarioSummary\n    __typename\n  }\n  rev2ScenarioResources {\n    type\n    value\n    __typename\n  }\n}\n\nfragment ScenarioSummary on Rev2ScenarioSummary {\n  id\n  icon_url\n  source_name\n  title\n  catchphrase\n  creator {\n    id\n    penname\n    image_icon_url\n    type\n    __typename\n  }\n  state\n  type\n  is_light\n  time\n  time_type\n  discussion_days\n  current_chapter\n  difficulty\n  current_member_count\n  max_member_count\n  action_type\n  can_use_ex_playing\n  can_use_ticket\n  can_support\n  max_reserver_count_by_player\n  join_conditions\n  reserve_category {\n    ...ScenarioReserveCategory\n    __typename\n  }\n  joining_type\n  join_cost\n  join_cost_type\n  my_priority\n  __typename\n}\n\nfragment ScenarioReserveCategory on Rev2ScenarioReserveCategory {\n  id\n  name\n  description\n  max_joinable\n  rp_penalty\n  penalty_start\n  __typename\n}",
    };

    // curlの -H に相当するヘッダー
    const headers = {
      "Content-Type": "application/json",
      // 念のため、ブラウザからのリクエストに見せかける
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    };
    const response = await axios.post(apiUrl, payload, {
      headers,
      timeout: 15000,
    });

    const fetchedScenarios = response.data.data.rev2OpeningList;

    if (!fetchedScenarios) {
      console.log("APIからシナリオデータを取得できませんでした。");
      return;
    }
    const fetchedIds = new Set(fetchedScenarios.map((s) => s.id));
    // 2. DBから「すべて」のシナリオを取得
    const dbScenarios = await Scenario.findAll(); // ここも変更なし
    const dbIds = new Set(dbScenarios.map(s => s.id));

    // 3. 差分を比較して「新規」と「終了」を特定
    const newScenarios = fetchedScenarios.filter(s => !dbIds.has(s.id));
    const closedScenarioIds = [...dbIds].filter(id => !fetchedIds.has(id));

    // 4. 通知とデータベース操作
    const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);

    // ■ 新規シナリオの処理
    if (newScenarios.length > 0) {
      console.log(`${newScenarios.length}件の新規シナリオを発見！`);

      const scenariosToCreate = newScenarios.map((s) => ({
        id: s.id,
        source_name: s.source_name || null, // ソース名がない場合はnull
        title: s.title,
        creator_penname: `${s.creator.penname}${s.creator.type}`,
        status: s.action_type,
      }));
      await Scenario.bulkCreate(scenariosToCreate);
     // ▼▼▼【重要】ここから、Discord通知用にフィルターをかける ▼▼▼
      const excludedTypes = ['DISCUSSION', 'OUT_OF_ACTION'];
      const scenariosToAnnounce = newScenarios.filter(s => 
        !excludedTypes.includes(s.action_type) || s.state === '事前公開中'//OUT_OF_ACTIONは事前公開中のものだけ通知
      );
       if (scenariosToAnnounce.length > 0) {
      // --- ここからがメッセージ分割機能付きの通知ロジック ---

      let descriptionText = ""; // 現在のメッセージのdescriptionを組み立てる変数
      const embedsToSend = []; // 送信するためのEmbedを格納する配列
      const charLimit = 4000; // 安全マージンを取った文字数制限

      const actionTypeMap = {
        RESERVABLE: "予約期間中",
        JOINABLE: "参加受付中",
        SUPPORTABLE: "サポート可",
        OUT_OF_ACTION: "事前公開中"
      };

      for (const s of scenariosToAnnounce) {
        // 1行の表示を組み立てる
        const statusText = actionTypeMap[s.action_type] || "不明";
        const sourceNameDisplay =
          s.source_name && s.source_name.trim() !== ""
            ? `<${s.source_name}> `
            : "";
        const maxMemberText =
          s.max_member_count === null ? "∞" : s.max_member_count;
       // s.time ("2025-07-30 22:15:00") から "22:15" の部分だけを抜き出す
        const timePart = s.time ? s.time.split(' ')[1].slice(0, 5) : '';

        // もし「予約抽選」で、かつ時間が「22:15(comfigで設定)」で"ない"場合だけ、特別な時間を表示する
        const specialTimeText = ((s.time_type === '予約抽選' || s.time_type === '予約開始') && timePart !== config.scenarioChecker.defaultReserveTime) 
                                ? `|**予約抽選: ${timePart}**` 
                                : '';
        const line = `${sourceNameDisplay}[${s.title}](https://rev2.reversion.jp/scenario/opening/${s.id})\n-# 📖${s.creator.penname}${s.creator.type}|${s.type}|${s.difficulty}|${s.current_member_count}/${maxMemberText}人|**${statusText}**${specialTimeText}`;

        // もし、今のdescriptionに次の行を追加すると文字数制限を超える場合
        if (
          descriptionText.length + line.length + 2 > charLimit &&
          descriptionText !== ""
        ) {
          // 今のdescriptionでEmbedを作成し、配列に追加
          embedsToSend.push(
            new EmbedBuilder().setColor("Green").setDescription(descriptionText)
          );
          // descriptionをリセットして、今の行から新しいメッセージを始める
          descriptionText = line;
        } else {
          // 文字数に余裕があれば、今のdescriptionに改行を加えて次の行を追加
          descriptionText += (descriptionText ? "\n-# \u200b\n" : "") + line;
        }
      }

      // ループが終わった後に残っている最後のdescriptionで、最後のEmbedを作成
      if (descriptionText !== "") {
        embedsToSend.push(
          new EmbedBuilder().setColor("Green").setDescription(descriptionText)
        );
      }

      // 全Embedをループして、タイトルとフッターを調整しながら送信
      for (let i = 0; i < embedsToSend.length; i++) {
        const embed = embedsToSend[i];

        // 最初のメッセージにだけメインタイトルをつける
        if (i === 0) {
          embed.setTitle("✨ 新規シナリオのお知らせ");
        } else {
          // 2通目以降は「(続き)」などをつける
          embed.setTitle(
            `✨ 新規シナリオのお知らせ (${i + 1}/${embedsToSend.length})`
          );
        }

        // 最後のメッセージにだけタイムスタンプと総括フッターをつける
        if (i === embedsToSend.length - 1) {
          embed.setTimestamp().setFooter({
            text: `合計 ${scenariosToAnnounce.length} 件の新しいシナリオが追加されました。`,
          });
        }

        // 組み立てたEmbedを送信
        await channel.send({ embeds: [embed] });
      }
    }
  }

    // ■ 終了シナリオの処理
    if (closedScenarioIds.length > 0) {
      console.log(`${closedScenarioIds.length}件の終了シナリオを発見！`);
      // 終了したシナリオの詳細をDBから取得
      const closedScenariosData = dbScenarios.filter((s) =>
        closedScenarioIds.includes(s.id)
      );
      // DBから一括で削除
      await Scenario.destroy({ where: { id: { [Op.in]: closedScenarioIds } } });

      const descriptionText = closedScenariosData
        .map(
          (s) =>
            `・${(s.source_name ? `<${s.source_name}> ` : '')}[${s.title}](https://rev2.reversion.jp/scenario/replay/${s.id}) (作:${s.creator_penname})`
        )
        .join("\n-# \u200b\n");

      const embed = new EmbedBuilder()
        .setTitle("🔚終了したシナリオ")
        .setDescription(descriptionText)
        .setColor("Grey") //目立たない灰色に変更'#2f3136'などもおすすめ
        .setTimestamp()
        .setFooter({
          text: `${closedScenariosData.length}件のシナリオが返却されたようです。`,
        });

      await channel.send({ embeds: [embed] });
    }

    // 新規も終了もなかった場合
    if (newScenarios.length === 0 && closedScenarioIds.length === 0) {
      console.log("シナリオの更新はありませんでした。");
    }
  } catch (error) {
    console.error("シナリオチェック中にエラーが発生しました:", error);
  }
}
