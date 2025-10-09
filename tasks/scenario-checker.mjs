// tasks/scenario-checker.mjs
// ES Modules形式のインポート
import axios from "axios";
import { EmbedBuilder } from "discord.js";
import config from "../config.mjs";
// 250809【変更点】Sequelizeの代わりに、新しいSupabaseクライアントをインポート
import { getSupabaseClient } from "../utils/supabaseClient.mjs";

// 通知を送るチャンネルIDを環境変数から取得
const ANNOUNCE_CHANNEL_ID = config.rev2ch; // ここはconfig.mjsから取得するように変更

// export をつけて関数を定義
export async function checkNewScenarios(client) {
  // ★★★ 関数内で、クライアントを取得する ★★★
  const supabase = getSupabaseClient();
  // ★★★【Gemini pro2.5より未来のあなたへ：重要な補足コメント】★★★
  // この関数では、プロジェクトの他の部分で使われているSequelize（ORM）ではなく、
  // Supabaseの公式SDKを直接使用しています。
  //
  // 【理由】
  // この処理の目的は、100件近いシナリオの「新規・更新・削除」を、
  // Supabaseの無料枠の制限（レートリミット等）に抵触せず、効率的に行うことです。
  //
  // Supabase SDKが提供する `upsert()` メソッドは、
  // 「新規作成」と「更新」を、たった1回のAPIコールで、しかも複数件まとめて
  // 実行できる、このタスクに最適な機能です。
  //
  // この「一括処理」のために、ここでは特別にSDKを呼び出しています。
  //
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
        "query OpeningList($input: Rev2ScenarioSearchInput!) {\n  rev2OpeningList(input: $input) {\n    ...ScenarioSummary\n    __typename\n  }\n  rev2ScenarioResources {\n    type\n    value\n    __typename\n  }\n}\n\nfragment ScenarioSummary on Rev2ScenarioSummary {\n  id\n  icon_url\n  source_name\n  title\n  catchphrase\n  creator {\n    id\n    penname\n    image_icon_url\n    type\n    __typename\n  }\n  state\n  type\n  is_light\n  time\n  time_type\n  discussion_days\n  current_chapter\n  difficulty\n  current_member_count\n  rally_member_count\n  max_member_count\n  action_type\n  can_use_ex_playing\n  can_use_ticket\n  can_support\n  max_reserver_count_by_player\n  join_conditions\n  reserve_category {\n    ...ScenarioReserveCategory\n    __typename\n  }\n  joining_type\n  join_cost\n  join_cost_type\n  my_priority\n  rally_playing_start\n  rally_playing_end\n  __typename\n}\n\nfragment ScenarioReserveCategory on Rev2ScenarioReserveCategory {\n  id\n  name\n  description\n  max_joinable\n  rp_penalty\n  penalty_start\n  __typename\n}",
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
    //今のカンストと経験値も取得
    const scenarioResources = response.data.data.rev2ScenarioResources;

    if (!fetchedScenarios) {
      console.log("APIからシナリオデータを取得できませんでした。");
      return;
    }
    const fetchedIds = new Set(fetchedScenarios.map((s) => s.id));

    // 2. ★★★【変更点】DBからSupabase SDKを使って全シナリオを取得
    const { data: dbScenarios, error: fetchError } = await supabase
      .from("scenarios")
      .select("*");
    if (fetchError) throw fetchError;

    const dbScenarioMap = new Map(dbScenarios.map((s) => [s.id, s]));
    const dbIds = new Set(dbScenarios.map((s) => s.id));

    // 3. 差分を比較し、「新規」「更新」「終了」を特定
    const scenariosToUpsert = [];
    const newScenariosForNotification = []; // 通知用の新規シナリオリスト
    const updatedChapterScenariosForNotification = []; // ラリープレイング期間通知用
    const replayReturnedScenariosForNotification = []; // リプレイ返却通知用

    for (const fetched of fetchedScenarios) {
      const existing = dbScenarioMap.get(fetched.id);

      const newData = {
        id: fetched.id,
        title: fetched.title,
        source_name: fetched.source_name || null,
        creator_penname: `${fetched.creator.penname}${fetched.creator.type}`,
        status: fetched.action_type,
        // ★★★ ここから3行を追加 ★★★
        difficulty: fetched.difficulty,
        current_members: fetched.current_member_count,
        rally_member_count: fetched.rally_member_count,
        // max_member_countはnullのことがあるので、適宜参照時に処理をする
        max_members: fetched.max_member_count,
        // ここに他の保存したいデータを追加　database.mjsのモデルに合わせてください
        state: fetched.state,
        type: fetched.type,
        time: fetched.time,
        time_type: fetched.time_type,
        catchphrase: fetched.catchphrase || null,
        join_conditions: fetched.join_conditions || null,
        rally_playing_start: fetched.rally_playing_start || null,
        rally_playing_end: fetched.rally_playing_end || null,
      };

      if (!existing) {
        // 新規の場合
        scenariosToUpsert.push(newData);
        newScenariosForNotification.push(fetched); // 通知用リストにも追加
        continue;
      }

      //ラリー章の場合
      // プレイング日時が変化したら「章更新」とみなし、通知リストに入れる
      let hasChapterUpdate = false;
      if (fetched.type === "ラリー") {
        const existingStartDate = existing.rally_playing_start
          ? new Date(existing.rally_playing_start)
          : null;
        const newStartDate = parseUtcDate(newData.rally_playing_start);

        const existingEndDate = existing.rally_playing_end
          ? new Date(existing.rally_playing_end)
          : null;
        const newEndDate = parseUtcDate(newData.rally_playing_end);

        const startTimeChanged =
          (!existingStartDate && newStartDate) ||
          (existingStartDate && !newStartDate) ||
          (existingStartDate &&
            newStartDate &&
            existingStartDate.getTime() !== newStartDate.getTime());

        const endTimeChanged =
          (!existingEndDate && newEndDate) ||
          (existingEndDate && !newEndDate) ||
          (existingEndDate &&
            newEndDate &&
            existingEndDate.getTime() !== newEndDate.getTime());

        if (startTimeChanged || endTimeChanged) {
          hasChapterUpdate = true;
        }
      }

      if (hasChapterUpdate) {
        updatedChapterScenariosForNotification.push(fetched); // 章更新通知リストに追加
      }

      //ラリー返却
      let hasReplayReturned = false;
      if (fetched.type === "ラリー") {
        // DBに記録されている数と、APIから取得した新しい数を比較
        const oldCount = existing.rally_member_count || 0;
        const newCount = newData.rally_member_count || 0;

        // 返却済人数が増えていたら「返却あり」と判断
        if (newCount > oldCount) {
          hasReplayReturned = true;
        }
      }

      if (hasReplayReturned) {
        replayReturnedScenariosForNotification.push(fetched); // リプレイ返却通知リストに追加
      }

      if (
        // 更新の場合
        existing.title !== newData.title ||
        existing.creator_penname !== newData.creator_penname ||
        existing.status !== newData.status ||
        existing.current_members !== newData.current_members ||
        existing.difficulty !== newData.difficulty ||
        existing.max_members !== newData.max_members ||
        existing.state !== newData.state ||
        existing.type !== newData.type ||
        existing.time !== newData.time ||
        existing.time_type !== newData.time_type ||
        existing.catchphrase !== newData.catchphrase ||
        JSON.stringify(existing.join_conditions || []) !==
          JSON.stringify(newData.join_conditions || []) ||
        hasChapterUpdate || //↓２つ
        //existing.rally_playing_start !== newData.rally_playing_start ||
        //existing.rally_playing_end !== newData.rally_playing_end ||
        existing.rally_member_count !== newData.rally_member_count
      ) {
        scenariosToUpsert.push(newData);
      }
    }

    const closedScenarioIds = [...dbIds].filter((id) => !fetchedIds.has(id));
    //250922カンストや現在の基本経験値を取る
    const configRecordsToUpsert = [];
    if (scenarioResources && scenarioResources.length > 0) {
      // APIから取得した type と DBに保存する key, description のマッピング
      const keyMap = {
        最大レベル: {
          key: "rev2_max_level",
          description: "ロスアカの最大キャラクターレベル",
        },
        クレジット基礎値: {
          key: "rev2_base_credit",
          description: "ロスアカのシナリオ開始時クレジット基礎値",
        },
        経験値基礎値: {
          key: "rev2_base_exp",
          description: "ロスアカのシナリオ開始時経験値基礎値",
        },
      };

      for (const resource of scenarioResources) {
        // マッピングに存在するリソースタイプのみ処理
        if (keyMap[resource.type]) {
          const configKey = keyMap[resource.type].key;
          const configDesc = keyMap[resource.type].description;

          // value文字列から数値部分を正規表現で抽出
          const match = resource.value.match(/\d+/);
          let parsedValue = null;
          if (match) {
            parsedValue = parseInt(match[0], 10); // 抽出した文字列を整数に変換
          }

          // 数値が正常にパースできた場合のみ upsert リストに追加
          if (parsedValue !== null) {
            configRecordsToUpsert.push({
              key: configKey,
              value: parsedValue, // JSONBに数値として保存される
              description: configDesc,
            });
          }
        }
      }
    }

    //カンスト関連ここまで
    // 4. 通知とDB操作
    const channel = await client.channels.fetch(config.rev2ch);

    // ■■■ DB操作セクション ■■■
    // データベースへの書き込みは、通知の前にすべて済ませてしまうのが安全です。
    // 通知に必要なデータ（終了シナリオの詳細など）は、この段階で確保しておきます。

    // ① 新規・更新シナリオをDBに一括反映
    if (scenariosToUpsert.length > 0) {
      console.log(
        `${scenariosToUpsert.length}件の新規・更新シナリオをDBに反映します。`
      );
      const { error: upsertError } = await supabase
        .from("scenarios")
        .upsert(scenariosToUpsert);
      if (upsertError) throw upsertError;
    }

    // ★★★ 経験値・カンストのリソース周りも追加します ★★★
    if (configRecordsToUpsert.length > 0) {
      console.log(
        `${configRecordsToUpsert.length}件のコンフィグ情報をDBに反映します。`
      );
      const { error: configUpsertError } = await supabase
        .from("app_config")
        .upsert(configRecordsToUpsert);
      if (configUpsertError) {
        console.error("コンフィグ情報の更新に失敗しました:", configUpsertError);
      } else {
        console.log("コンフィグ情報を正常に更新しました。");
      }
    }
    // ★★★ ここまでが該当箇所です ★★★

    // ② 終了シナリオのデータを確保し、DBから一括削除
    let closedScenariosData = []; // 通知で使うための変数を、ifの外で定義
    if (closedScenarioIds.length > 0) {
      console.log(
        `${closedScenarioIds.length}件の終了シナリオをDBから削除します。`
      );

      // 【重要】通知で使うために、削除する前にデータを取得しておく
      closedScenariosData = dbScenarios.filter((s) =>
        closedScenarioIds.includes(s.id)
      );

      // DBから一括で削除
      const { error: deleteError } = await supabase
        .from("scenarios")
        .delete()
        .in("id", closedScenarioIds);
      if (deleteError) throw deleteError;
    }

    // ■■■ 通知処理セクション ■■■
    // ユーザー体験を考慮し、「新規」→「終了」の順番で通知します。

    const formatDateTime = (isoString) => {
      if (!isoString) return "未設定";
      const date = new Date(isoString);
      // 例: 2025/09/24 10:30
      return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    };

    // ① 新規シナリオの通知
    if (newScenariosForNotification.length > 0) {
      console.log(
        `${newScenariosForNotification.length}件の新規シナリオを発見！`
      );

      //  250809(newScenarios の代わりに newScenariosForNotification を使うようにだけ注意してください)

      const excludedTypes = ["DISCUSSION", "OUT_OF_ACTION"];
      const scenariosToAnnounce = newScenariosForNotification.filter(
        (s) =>
          !excludedTypes.includes(s.action_type) || s.state === "事前公開中"
      );

      if (scenariosToAnnounce.length > 0) {
        const actionTypeMap = {
          RESERVABLE: "予約期間中",
          JOINABLE: "参加受付中",
          SUPPORTABLE: "サポート可",
          OUT_OF_ACTION: "事前公開中",
        };

        // 【新戦略】レイドと一般シナリオを分離する
        //レイドEX も増えたので後で増やさないとなあ分岐（レイドと一括で）
        const raidTypes = ["レイド", "レイドEX"]; // レイド系タイプを配列で管理
        const raidScenarios = scenariosToAnnounce.filter((s) =>
          raidTypes.includes(s.type)
        );
        const normalScenarios = scenariosToAnnounce.filter(
          (s) => !raidTypes.includes(s.type)
        );

        // ■■■ レイド専用通知 ■■■
        if (raidScenarios.length > 0) {
          console.log(
            `${raidScenarios.length}件のレイドシナリオを発見！個別に通知します。`
          );

          // レイドシナリオの通知（見た目は通常とほぼ同じ、でも箱は別）
          let descriptionText = "";
          const embedsToSend = [];
          const charLimit = 4000;

          for (const s of raidScenarios) {
            const difficultyEmoji =
              config.scenarioChecker.difficultyEmojis[s.difficulty] ||
              config.scenarioChecker.difficultyEmojis.DEFAULT;
            const statusText = actionTypeMap[s.action_type] || "不明";
            const sourceNameDisplay =
              s.source_name && s.source_name.trim() !== ""
                ? `<${s.source_name}> `
                : "";
            const maxMemberText =
              s.max_member_count === null ? "∞" : s.max_member_count;
            const timePart = s.time ? s.time.split(" ")[1].slice(0, 5) : "";
            const specialTimeText = `|**${s.time_type}: ${timePart}**`; //レイドは時間を必ず表示
            //レイドは特別に帯書きを入れる
            let catchphraseText = "";
            if (s.catchphrase) {
              catchphraseText = `-# > *${s.catchphrase.replace(/\n/g, " ")}*\n`;
            }
            let joinConditionsText = "";
            if (s.join_conditions && s.join_conditions.length > 0) {
              joinConditionsText = `-# > **参加条件:** ${s.join_conditions.join(" / ")}\n`;
            }
            const titleLine = `${difficultyEmoji}${sourceNameDisplay}[${s.title}](https://rev2.reversion.jp/scenario/opening/${s.id})\n`;
            const infoLine = `-# 📖${s.creator.penname}${s.creator.type}|${s.type}|${s.difficulty}|${s.current_member_count}/${maxMemberText}人|**${statusText}**${specialTimeText}`;
            const line = titleLine + joinConditionsText + infoLine;

            if (
              descriptionText.length + line.length + 2 > charLimit &&
              descriptionText !== ""
            ) {
              embedsToSend.push(
                new EmbedBuilder().setDescription(descriptionText)
              ); // 色は後で設定
              descriptionText = line;
            } else {
              descriptionText +=
                (descriptionText ? "\n-# \u200b\n" : "") + line;
            }
          }

          if (descriptionText !== "") {
            embedsToSend.push(
              new EmbedBuilder().setDescription(descriptionText)
            );
          }

          for (let i = 0; i < embedsToSend.length; i++) {
            const embed = embedsToSend[i];
            embed
              .setColor("Red") // 決戦の色
              .setTitle(
                `🚨レイドシナリオのお知らせ(${i + 1}/${embedsToSend.length})`
              );
            if (i === embedsToSend.length - 1) {
              embed.setTimestamp().setFooter({
                text: `${raidScenarios.length}件のレイドシナリオが公示されました。`,
              });
            }
            const raidRoleId = "1137548892779597874";
            await channel.send({
              content: `<@&${raidRoleId}>`, // contentにメンション
              embeds: [embed],
              allowedMentions: {
                roles: [raidRoleId], // 特別にrev2ロールIDへのメンションを許可する
              },
            }); //250814 QRK（急にレイドが来たので）生IDでrev2ロール指定
            // たとえ10人が出したとてレイドだけで4000文字超えることはないでしょう。
            // あとでconfig.mjsにロスアカロール追加してね！
          }
        }

        // ■■■ 一般シナリオの通知（従来通り） ■■■
        if (normalScenarios.length > 0) {
          let descriptionText = "";
          const embedsToSend = [];
          const charLimit = 4000;

          for (const s of normalScenarios) {
            const difficultyEmoji =
              config.scenarioChecker.difficultyEmojis[s.difficulty] ||
              config.scenarioChecker.difficultyEmojis.DEFAULT;
            const statusText = actionTypeMap[s.action_type] || "不明";
            const sourceNameDisplay =
              s.source_name && s.source_name.trim() !== ""
                ? `<${s.source_name}> `
                : "";
            let memberText;
            let playingPeriodText = ""; // プレイング期間用の変数

            if (s.type === "ラリー") {
              // ラリーの場合: 現在参加中 / 既返却済
              memberText = `${s.current_member_count}/${s.rally_member_count}人`;
              // プレイング期間を整形して追加
              playingPeriodText = `-# > **プレイング期間:** ${formatDateTime(s.rally_playing_start)} ～ ${formatDateTime(s.rally_playing_end)}\n`;
            } else {
              // それ以外の場合: 現在 / 最大
              const maxMemberText =
                s.max_member_count === null ? "∞" : s.max_member_count;
              memberText = `${s.current_member_count}/${maxMemberText}人`;
            }
            const timePart = s.time ? s.time.split(" ")[1].slice(0, 5) : "";
            const specialTimeText =
              (s.time_type === "予約抽選" || s.time_type === "予約開始") &&
              timePart !== config.scenarioChecker.defaultReserveTime
                ? `|**予約抽選: ${timePart}**`
                : "";
            let joinConditionsText = "";
            if (s.join_conditions && s.join_conditions.length > 0) {
              joinConditionsText = `-# > **参加条件:** ${s.join_conditions.join(" / ")}\n`;
            }
            const titleLine = `${difficultyEmoji}${sourceNameDisplay}[${s.title}](https://rev2.reversion.jp/scenario/opening/${s.id})\n`;
            const infoLine = `-# 📖${s.creator.penname}${s.creator.type}|${s.type}|${s.difficulty}|${memberText}|**${statusText}**${specialTimeText}`;
            const line =
              titleLine + joinConditionsText + playingPeriodText + infoLine;

            if (
              descriptionText.length + line.length + 2 > charLimit &&
              descriptionText !== ""
            ) {
              embedsToSend.push(
                new EmbedBuilder()
                  .setColor("Green")
                  .setDescription(descriptionText)
              );
              descriptionText = line;
            } else {
              descriptionText +=
                (descriptionText ? "\n-# \u200b\n" : "") + line;
            }
          }

          if (descriptionText !== "") {
            embedsToSend.push(
              new EmbedBuilder()
                .setColor("Green")
                .setDescription(descriptionText)
            );
          }

          for (let i = 0; i < embedsToSend.length; i++) {
            const embed = embedsToSend[i];
            embed.setTitle(
              `✨新規シナリオのお知らせ(${i + 1}/${embedsToSend.length})`
            );
            if (i === embedsToSend.length - 1) {
              embed.setTimestamp().setFooter({
                text: `${normalScenarios.length}件の新しいシナリオが追加されました。帯書きは /ロスアカシナリオ一覧 で確認できます。`,
              });
            }
            await channel.send({ embeds: [embed] });
          }
        }
      }
      // ▲▲▲ 新規シナリオ通知ロジックここまで ▲▲▲
    }
    //  ラリー章更新シナリオの通知
    if (updatedChapterScenariosForNotification.length > 0) {
      console.log(
        `${updatedChapterScenariosForNotification.length}件のラリーシナリオで章の更新を発見！`
      );
      // channelの取得はDB操作後に移動済みなのでここでは不要

      let descriptionText = "";
      const embedsToSend = [];
      const charLimit = 4000;

      for (const s of updatedChapterScenariosForNotification) {
        const difficultyEmoji =
          config.scenarioChecker.difficultyEmojis[s.difficulty] ||
          config.scenarioChecker.difficultyEmojis.DEFAULT;

        const titleLine = `${difficultyEmoji}${s.source_name ? `<${s.source_name}> ` : ""}[${s.title}](https://rev2.reversion.jp/scenario/opening/${s.id})\n`;
        const chapterInfoLine = `-# > **ラリーのプレイング期間が更新されました！**\n`;
        const playingPeriodLine = `-# > ${formatDateTime(s.rally_playing_start)} ～ ${formatDateTime(s.rally_playing_end)}\n`;
        const authorLine = `-# 📖${s.creator.penname}${s.creator.type}`;

        // 1件分のテキストを組み立て
        const line =
          titleLine + chapterInfoLine + playingPeriodLine + authorLine;

        // 文字数チェック
        if (
          descriptionText.length + line.length + 2 > charLimit &&
          descriptionText !== ""
        ) {
          embedsToSend.push(
            new EmbedBuilder().setColor("Blue").setDescription(descriptionText)
          );
          descriptionText = line; // 新しいEmbedの最初の行にする
        } else {
          // 既存のテキストに追記（区切り線を入れる）
          descriptionText += (descriptionText ? "\n-# \u200b\n" : "") + line;
        }
      }

      // ループ後に残ったテキストを最後のEmbedとして追加
      if (descriptionText !== "") {
        embedsToSend.push(
          new EmbedBuilder().setColor("Blue").setDescription(descriptionText)
        );
      }

      // 組み立てたEmbedを送信
      for (let i = 0; i < embedsToSend.length; i++) {
        const embed = embedsToSend[i];
        embed.setTitle(
          `🔄ラリーシナリオのプレイング期間更新 (${i + 1}/${embedsToSend.length})`
        );
        if (i === embedsToSend.length - 1) {
          embed.setTimestamp().setFooter({
            text: `${updatedChapterScenariosForNotification.length}件のラリーシナリオの章が更新されました。`,
          });
        }
        // 必要ならロールへのメンションを追加
        // const rallyRoleId = "1137548892779597874";
        await channel.send({ embeds: [embed] });
      }
    }
    //  リプレイ返却シナリオの通知
    if (replayReturnedScenariosForNotification.length > 0) {
      console.log(
        `${replayReturnedScenariosForNotification.length}件のラリーシナリオでリプレイ返却を発見！`
      );

      let descriptionText = "";
      const embedsToSend = [];
      const charLimit = 4000;

      for (const s of replayReturnedScenariosForNotification) {
        const difficultyEmoji =
          config.scenarioChecker.difficultyEmojis[s.difficulty] ||
          config.scenarioChecker.difficultyEmojis.DEFAULT;

        const titleLine = `${difficultyEmoji}${s.source_name ? `<${s.source_name}> ` : ""}[${s.title}](https://rev2.reversion.jp/scenario/opening/${s.id})\n`;
        const replayInfoLine = `-# > **リプレイが返却されました！**\n`;
        const memberStatusLine = `-# > **参加状況:** ${s.current_member_count}人参加中 / ${s.rally_member_count}人返却済\n`;
        const authorLine = `-# 📖${s.creator.penname}${s.creator.type}`;

        const line = titleLine + replayInfoLine + memberStatusLine + authorLine;

        if (
          descriptionText.length + line.length + 2 > charLimit &&
          descriptionText !== ""
        ) {
          embedsToSend.push(
            new EmbedBuilder()
              .setColor("Purple")
              .setDescription(descriptionText)
          );
          descriptionText = line;
        } else {
          descriptionText += (descriptionText ? "\n-# \u200b\n" : "") + line;
        }
      }

      if (descriptionText !== "") {
        embedsToSend.push(
          new EmbedBuilder().setColor("Purple").setDescription(descriptionText)
        );
      }

      for (let i = 0; i < embedsToSend.length; i++) {
        const embed = embedsToSend[i];
        embed.setTitle(
          `📢ラリーシナリオのリプレイ返却 (${i + 1}/${embedsToSend.length})`
        );
        if (i === embedsToSend.length - 1) {
          embed.setTimestamp().setFooter({
            text: `${replayReturnedScenariosForNotification.length}件のラリーシナリオでリプレイが返却されました。`,
          });
        }
        await channel.send({ embeds: [embed] });
      }
    }

    // ② 終了シナリオの通知
    if (closedScenarioIds.length > 0) {
      let descriptionText = "";
      const embedsToSend = [];
      const charLimit = 4000;
      for (const s of closedScenariosData) {
        const difficultyEmoji =
          config.scenarioChecker.difficultyEmojis[s.difficulty] ||
          config.scenarioChecker.difficultyEmojis.DEFAULT;
        const line = `${difficultyEmoji}${s.source_name ? `<${s.source_name}> ` : ""}[${s.title}](https://rev2.reversion.jp/scenario/replay/${s.id}) (作:${s.creator_penname})`;

        if (
          descriptionText.length + line.length + 2 > charLimit &&
          descriptionText !== ""
        ) {
          embedsToSend.push(
            new EmbedBuilder().setColor("Grey").setDescription(descriptionText)
          );
          descriptionText = line;
        } else {
          descriptionText += (descriptionText ? "\n-# \u200b\n" : "") + line;
        }
      }

      if (descriptionText !== "") {
        embedsToSend.push(
          new EmbedBuilder().setColor("Grey").setDescription(descriptionText)
        );
      }

      for (let i = 0; i < embedsToSend.length; i++) {
        const embed = embedsToSend[i];
        embed
          .setTitle(`🔚終了したシナリオ(${i + 1}/${embedsToSend.length})`)
          .setColor("Grey");
        if (i === embedsToSend.length - 1) {
          embed.setTimestamp().setFooter({
            text: `${closedScenariosData.length}件のシナリオが返却されたようです。`,
          });
        }
        await channel.send({ embeds: [embed] });
      }
      // ▲▲▲ 終了シナリオ通知ロジックここまで ▲▲▲
    }

    // ■ 変更がなかった場合のログ ■
    if (
      scenariosToUpsert.length === 0 &&
      closedScenarioIds.length === 0 &&
      configRecordsToUpsert.length === 0
    ) {
      // configRecordsToUpsert のチェックも追加
      console.log("シナリオまたはリソース状況の更新はありませんでした。");
    }
    await supabase.from("task_logs").upsert({
      task_name: "scenario-checker",
      last_successful_run: new Date().toISOString(),
    });

    console.log("シナリオチェックを正常に完了しました。");
  } catch (error) {
    console.error("シナリオチェック中にエラーが発生しました:", error);
  }
}

// ヘルパー関数
function parseUtcDate(str) {
  return str ? new Date(str + "Z") : null;
}
