// scenario.mjs (API直通・最終完成版)

import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
} from "discord.js";
import axios from "axios";

export const data = new SlashCommandBuilder()
  .setName("scenario")
  // 管理者権限のみで実行可能
  .setDefaultMemberPermissions(
    PermissionsBitField.Flags.Administrator.toString()
  )
  .setNameLocalizations({
    ja: "シナリオ",
  })
  .setDescription("Lost Arcadiaのシナリオ一覧を取得します。");

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    // curlコマンドから特定したAPIのURL
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

    // axiosでPOSTリクエストを送信
    const response = await axios.post(apiUrl, payload, {
      headers,
      timeout: 15000,
    });

    // 取得したデータからシナリオのリスト部分を取り出す
    const scenarios = response.data.data.rev2OpeningList;

    if (!scenarios || scenarios.length === 0) {
      await interaction.editReply({
        content: "シナリオ情報が見つかりませんでした。",
      });
      return;
    }
    // 1. フィルター：参加できないシナリオを除外する
    const excludedTypes = ['DISCUSSION', 'OUT_OF_ACTION'];
    const displayableScenarios = scenarios.filter(s => !excludedTypes.includes(s.action_type));

    // もし表示できるシナリオが一つもなかった場合のメッセージ
    if (displayableScenarios.length === 0) {
      await interaction.editReply({ content: "現在参加・予約可能なシナリオはありません。" });
      return;
    }

    // 2. 変換：action_typeを日本語に変換するための「対応表」オブジェクト
    const actionTypeMap = {
      'RESERVABLE': '予約期間中',
      'JOINABLE': '参加受付中',
      'SUPPORTABLE': 'サポート可',
      // フィルターで除外されるものも、念のため入れておくと将来的に安全です
      'DISCUSSION': '相談期間中',
      'OUT_OF_ACTION': '結果待ち・完了'
    };

    // descriptionに入れるための文字列を生成
    const scenarioLines = [];

    // 3. ループと表示文字列の組み立て
    // フィルター後の `displayableScenarios` 配列を使う
    for (const s of displayableScenarios.slice(0, 25)) { 
      
      // 変換処理：対応表を使って日本語に変換。もし対応表になければ「不明」とする
      const statusText = actionTypeMap[s.action_type] || '不明';

      const sourceNameDisplay = (s.source_name && s.source_name.trim() !== '') ? `<${s.source_name}> ` : '';
      
      // 変換後の `statusText` を表示に含める
      const line = `**${statusText}** | ${sourceNameDisplay}[${s.title}](https://rev2.reversion.jp/scenario/opening/${s.id}) 📖 ${s.creator.penname}`;
      scenarioLines.push(line);
    }
    
    const descriptionText = scenarioLines.join('\n');

    if (descriptionText.length > 4096) {
        descriptionText = descriptionText.substring(0, 4090) + "\n...";
    }

    const embed = new EmbedBuilder()
      .setTitle("Lost Arcadia シナリオ一覧")
      .setDescription(descriptionText)
      .setColor("#5865F2")
      .setTimestamp()
      .setFooter({ text: `現在 ${displayableScenarios.length} 件が募集中です。` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(
      "シナリオ取得中にエラーが発生しました:",
      error.response ? error.response.data : error.message
    );
    await interaction.editReply({
      content:
        "シナリオの取得中にエラーが発生しました。詳細はログを確認してください。",
      ephemeral: true,
    });
  }
}
