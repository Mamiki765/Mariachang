import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { Op } from "sequelize";

import config from "../../config.mjs";
import { replyfromDM } from "../../components/buttons.mjs";
import { AdminMemo, Point, sequelize } from "../../models/database.mjs";
import { checkNewScenarios } from "../../tasks/scenario-checker.mjs";
import { checkAtelierCards } from "../../tasks/atelier-checker.mjs";

export const scope = "guild"; // 指定ギルドでのみ使用可
export const help = {
  //ヘルプは不要
  adminOnly: true,
};

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("管理用")
  // 管理者権限のみで実行可能
  .setDefaultMemberPermissions(
    PermissionsBitField.Flags.Administrator.toString()
  )
  //マリアで発言機能登録
  .addSubcommand((subcommand) =>
    subcommand
      .setName("chat_as_maria")
      .setNameLocalizations({ ja: "マリアで発言" })
      .setDescription(
        "管理人として発言します。実行すると入力フォームが開きます。"
      )
  )
  //マリアで発言機能登録ここまで
  //マリアからDM機能
  .addSubcommand((subcommand) =>
    subcommand
      .setName("dm_from_maria")
      .setNameLocalizations({ ja: "ダイレクトメール" })
      .setDescription(
        "管理人としてマリアからDMを送信します。実行すると入力フォームが開きます。"
      )
  )
  //マリアの発言編集機能
  .addSubcommand((subcommand) =>
    subcommand
      .setName("edit_maria_message")
      .setNameLocalizations({
        ja: "発言修正",
      })
      .setDescription("マリアの発言メッセージを編集します")
      .addStringOption((option) =>
        option
          .setName("messageurl")
          .setDescription("編集したいメッセージのURL")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("newmessage")
          .setNameLocalizations({
            ja: "新しい内容",
          })
          .setDescription(
            "新しいメッセージ内容(改行は\n、<br>、@@@などでもできます)"
          )
          .setRequired(true)
      )
      .addAttachmentOption((option) =>
        option
          .setName("newimage")
          .setNameLocalizations({
            ja: "画像",
          })
          .setDescription("新しい画像を添付")
      )
  )
  //管理メモ
  .addSubcommand((subcommand) =>
    subcommand
      .setName("memo_add")
      .setNameLocalizations({
        ja: "メモを残す",
      })
      .setDescription("指定ユーザーにメモを追加")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("メモを追加するユーザー")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("content")
          .setNameLocalizations({
            ja: "内容",
          })
          .setDescription("メモの内容")
          .setRequired(true)
      )
  )
  //メモ閲覧
  .addSubcommand((subcommand) =>
    subcommand
      .setName("memo_list")
      .setNameLocalizations({
        ja: "メモを見る",
      })
      .setDescription("指定ユーザーのメモ一覧を表示")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("メモを確認するユーザー")
          .setRequired(true)
      )
  )
  //メモ削除（非表示）
  .addSubcommand((subcommand) =>
    subcommand
      .setName("memo_remove")
      .setNameLocalizations({
        ja: "メモを削除",
      })
      .setDescription("指定メモを削除")
      .addIntegerOption((option) =>
        option
          .setName("memo_id")
          .setDescription("削除するメモのID")
          .setRequired(true)
      )
  )
  //タイムアウト
  .addSubcommand((subcommand) =>
    subcommand
      .setName("timeout")
      .setNameLocalizations({
        ja: "タイムアウト",
      })
      .setDescription("対象をタイムアウトさせます")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("タイムアウトさせるユーザー")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("minutes")
          .setDescription(
            "タイムアウトする時間を分単位で入力してください、最大28日(40320分)"
          )
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320)
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("理由").setRequired(false)
      )
  )
  // シナリオの手動チェック
  .addSubcommand((subcommand) =>
    subcommand
      .setName("scenario_check")
      .setNameLocalizations({
        ja: "シナリオ手動チェック",
      })
      .setDescription("シナリオの新規・終了チェックを強制的に実行します。")
  )
  .addBooleanOption((option) =>
    option
      .setName("force_resync")
      .setNameLocalizations({ ja: "強制再同期" })
      .setDescription(
        "DBをクリアし全シナリオを再通知/アトリエの時間制限を無視 (デバッグ用)"
      )
      .setRequired(false)
  )
  //通貨配布
  .addSubcommand((subcommand) =>
    subcommand
      .setName("distribute_currency")
      .setNameLocalizations({ ja: "通貨配布" })
      .setDescription("指定した通貨をユーザーに配布します。")
      .addStringOption((option) =>
        option
          .setName("currency_type")
          .setNameLocalizations({ ja: "種類" })
          .setDescription("配布する通貨の種類を選択してください。")
          .setRequired(true)
          .addChoices(
            { name: "ニョワコイン", value: "coin" },
            { name: "RP", value: "point" },
            { name: "あまやどんぐり", value: "acorn" },
            { name: "ニョボチップ", value: "legacy_pizza" },
            { name: "ニョボバンク", value: "nyobo_bank" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setNameLocalizations({ ja: "配布枚数" })
          .setDescription("配布する枚数を入力してください。")
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setNameLocalizations({ ja: "理由" })
          .setDescription(
            "配布の理由を記述してください。通知やログに残ります。"
          )
          .setRequired(true)
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setNameLocalizations({ ja: "対象ユーザー" })
          .setDescription("配布するユーザーを一人指定します。")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("all")
          .setNameLocalizations({ ja: "全員に配布" })
          .setDescription(
            "サーバーのメンバー全員に配布します。(user指定がある場合、そちらを優先)"
          )
          .setRequired(false)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const serverId = interaction.guild ? interaction.guild.id : "DM";
  // ==========================================================
  // ▼▼▼ マリアで発言 (Modal版) ▼▼▼
  // ==========================================================
  if (subcommand == "chat_as_maria") {
    // 1. Modal構築
    const modal = new ModalBuilder()
      .setTitle("マリアとして発言")
      .setCustomId(`chat_as_maria_modal_${interaction.id}`) // IDを一意にする
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("送信先チャンネル (任意)")
          .setDescription("指定しない場合は、このチャンネルに送信されます。")
          .setChannelSelectMenuComponent(
            new ChannelSelectMenuBuilder()
              .setCustomId("target_channel")
              .setPlaceholder("チャンネルを選択 (任意)")
              .setChannelTypes([
                ChannelType.GuildText, // 0
                ChannelType.GuildAnnouncement, // 5
                ChannelType.AnnouncementThread, // 10
                ChannelType.PublicThread, // 11
                ChannelType.PrivateThread, // 12
              ])
              .setRequired(false)
              .setMinValues(0) // 任意なので0個でもOK
              .setMaxValues(1)
          )
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("発言内容")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("message_content")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("発言内容を入力してください。改行も使えます。")
              .setRequired(true)
          )
      );

    // 2. Modal表示
    await interaction.showModal(modal);

    // 3. 送信待ち受け
    try {
      const submitted = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === modal.data.custom_id,
        time: 600_000, // 10分待機
      });

      // 4. 処理開始
      await submitted.deferReply({ flags: 64 }); // Ephemeral

      // 入力値の取得 (ChannelSelectMenuの戻り値はCollection)
      const selectedChannels =
        submitted.fields.getSelectedChannels("target_channel");
      const contentRaw = submitted.fields.getTextInputValue("message_content");

      // チャンネル決定: 選択されていればそれ、なければ実行したチャンネル
      const targetChannel = selectedChannels?.first() || interaction.channel;

      const content = contentRaw
        .replace(/@@@/g, "\n")
        .replace(/<br>/g, "\n")
        .replace(/\\n/g, "\n");

      // 送信処理
      await targetChannel.send({ content: content });

      // ログ出力
      await interaction.client.channels.cache.get(config.logch.admin).send({
        embeds: [
          new EmbedBuilder()
            .setTitle("管理者発言ログ(チャンネル)")
            .setColor("#FFD700")
            .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp()
            .addFields(
              {
                name: "送信者",
                value: `${interaction.member.displayName}(ID:${interaction.user.id})`,
              },
              {
                name: "送信チャンネル",
                value: `#${targetChannel.name} (<#${targetChannel.id}>)`,
              }
            ),
        ],
      });

      await submitted.editReply({
        content: `✅ メッセージを送信しました。\n送信先: <#${targetChannel.id}>\n送信内容\`\`\`\n${content}\n\`\`\``,
      });
    } catch (error) {
      // タイムアウト等は静かに終了
      if (error.code !== "InteractionCollectorError") {
        console.error("マリア発言エラー:", error);
        // 応答可能ならエラー通知
      }
    }
    // ==========================================================
    // ▼▼▼ DM送信 (頂いたコードをベースにしたModal版) ▼▼▼
    // ==========================================================
  } else if (subcommand == "dm_from_maria") {
    // 1. Modal構築
    const modal = new ModalBuilder()
      .setTitle("DM送信フォーム")
      .setCustomId(`dm_modal_${interaction.id}`)

      // 送信先 (User Select)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("送信先ユーザー")
          .setUserSelectMenuComponent(
            new UserSelectMenuBuilder()
              .setCustomId("target_user_select")
              .setPlaceholder("DMを送る相手を選んでください")
              .setMinValues(1)
              .setMaxValues(1)
          )
      )
      // 返信設定 (String Select)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("返信設定")
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId("reply_setting_select")
              .setPlaceholder("返信を許可しますか？")
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel("相手が返信可")
                  .setValue("enable_reply")
                  .setDefault(true),
                new StringSelectMenuOptionBuilder()
                  .setLabel("相手が返信不可")
                  .setValue("disable_reply")
              )
          )
      )
      // メッセージ内容 (Text Input)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("メッセージ内容")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("dm_content")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("送信する内容を入力してください")
              .setRequired(true)
          )
      );

    // 2. Modal表示
    await interaction.showModal(modal);

    // 3. 送信待ち受け
    try {
      const submitted = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === modal.data.custom_id,
        time: 600_000, // 10分
      });

      await submitted.deferReply({ flags: 64 });

      // 4. 入力データの取得
      const targetUserCollection =
        submitted.fields.getSelectedUsers("target_user_select");
      const targetUser = targetUserCollection.first(); // Userオブジェクトが取れます

      const replySetting = submitted.fields.getStringSelectValues(
        "reply_setting_select"
      )[0];
      const replyable = replySetting === "enable_reply";

      const contentRaw = submitted.fields.getTextInputValue("dm_content");
      const content = contentRaw
        .replace(/@@@/g, "\n")
        .replace(/<br>/g, "\n")
        .replace(/\\n/g, "\n");

      // 5. 送信処理
      const replybutton = replyable ? [replyfromDM] : null;

      const embed = new EmbedBuilder()
        .setTitle(`管理人室からのメッセージ`)
        .setDescription(content)
        .setTimestamp()
        .setColor("#FFD700")
        .setFooter({
          text: "このダイレクトメールへの書き込みには返信できません、ご了承ください",
        });

      try {
        await targetUser.send({
          content: `【重要】このメッセージの下の埋め込みが見えない場合「埋め込みとリンクのプレビュー」の設定をONにしてください。`,
          embeds: [embed],
          components: replybutton,
        });

        // ログ送信
        await interaction.client.channels.cache.get(config.logch.admin).send({
          embeds: [
            new EmbedBuilder()
              .setTitle("管理者発言ログ(DM)")
              .setColor("#FFD700")
              .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
              .setThumbnail(
                interaction.user.displayAvatarURL({ dynamic: true })
              )
              .setTimestamp()
              .addFields(
                {
                  name: "送信者",
                  value: `${interaction.member.displayName}(ID:${interaction.user.id})`,
                },
                {
                  name: "送信相手",
                  value: `@${targetUser.username} (<@${targetUser.id}>)`,
                },
                {
                  name: "返信可否",
                  value: replyable ? "許可" : "不可",
                }
              ),
          ],
        });

        await submitted.editReply({
          content: `✅ ${targetUser.username} にDMを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``,
        });
      } catch (sendError) {
        console.error("DM送信失敗:", sendError);
        await submitted.editReply({
          content: `❌ DMの送信に失敗しました。\n相手がDMをブロックしているか、サーバー設定でDMを許可していない可能性があります。\nエラー: ${sendError.message}`,
        });
      }
    } catch (error) {
      // タイムアウトなどのエラー処理
      if (error.code !== "InteractionCollectorError") {
        console.error("DM Modalエラー:", error);
      }
    }
  } else if (subcommand == "edit_maria_message") {
    const messageUrl = interaction.options.getString("messageurl");
    let newMessage = interaction.options.getString("newmessage");
    const newImage = interaction.options.getAttachment("newimage");
    // 改行文字を置き換え
    newMessage = newMessage
      .replace(/@@@/g, "\n")
      .replace(/<br>/g, "\n")
      .replace(/\\n/g, "\n");
    // メッセージIDとチャンネルIDをURLから取得
    const urlParts = messageUrl.match(/\/channels\/\d+\/(\d+)\/(\d+)/);
    if (!urlParts) {
      return interaction.reply({
        content: "無効なメッセージURLです。",
        flags: 64, //ephemeral
      });
    }

    const channelId = urlParts[1];
    const messageId = urlParts[2];

    try {
      const channel = await interaction.client.channels.fetch(channelId);
      const message = await channel.messages.fetch(messageId);

      // メッセージがBotの発言か確認
      if (message.author.id !== interaction.client.user.id) {
        return interaction.reply({
          content: "これはBotのメッセージではありません。",
          flags: 64, //ephemeral
        });
      }

      // メッセージの編集処理
      const editOptions = { content: newMessage };
      if (newImage) {
        editOptions.files = [newImage];
      }

      await message.edit(editOptions);
      await interaction.reply({
        content: "メッセージが正常に編集されました。",
        flags: 64, //ephemeral
      });
    } catch (error) {
      console.error("メッセージの編集に失敗しました:", error);
      await interaction.reply({
        content: "メッセージの編集に失敗しました。",
        flags: 64, //ephemeral
      });
    }
    //メモ機能、まずは登録
  } else if (subcommand === "memo_add") {
    const user = interaction.options.getUser("user");
    const content = interaction.options.getString("content");

    await AdminMemo.create({
      guildId: serverId, // 修正: serverIdをguildIdフィールドに渡す
      userId: user.id,
      content: content,
      authorId: interaction.user.id,
    });
    await interaction.reply({
      content: `✅ メモを追加しました: ${content}`,
      flags: 64, //ephemeral
    });
    //メモを保存したログを出力

    // メモ登録時にログを送信
    await interaction.client.channels.cache.get(config.logch.admin).send({
      embeds: [
        new EmbedBuilder()
          .setTitle("新しい管理者メモ登録")
          .setColor("#FFD700")
          .setDescription(`メモ内容\`\`\`\n${content}\n\`\`\``)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .addFields(
            {
              name: "登録者",
              value: `${interaction.user.username} (ID:${interaction.user.id})`,
            },
            {
              name: "対象ユーザー",
              value: `${user.username} (ID:${user.id})`,
            },
            {
              name: "サーバーID",
              value: serverId,
            }
          ),
      ],
    });
    //メモ機能、開示
  } else if (subcommand === "memo_list") {
    const user = interaction.options.getUser("user");
    const memos = await AdminMemo.findAll({
      where: { guildId: serverId, userId: user.id, isVisible: true },
    });

    if (memos.length === 0) {
      return interaction.reply({
        content: "❌ メモが見つかりません。",
        flags: 64, //ephemeral
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${user.username} のメモ一覧`)
      .setColor("#FFD700")
      .setDescription(
        (
          await Promise.all(
            memos.map(async (memo) => {
              let author = memo.authorId; // 見つからない場合に備えてIDを入力
              try {
                const userObj = await interaction.guild.members.fetch(
                  memo.authorId
                );
                author = userObj ? userObj.user.username : memo.authorId; // Fallback to authorId if the user is not found
              } catch (error) {
                // ユーザーが見つからない場合IDはそのまま
              }

              return (
                `**ID:** ${memo.id} - ${memo.content}\n` +
                `-# **作者:** ${author} | **作成日時:** ${memo.createdAt.toLocaleString(
                  "ja-JP"
                )}`
              );
            })
          )
        ).join("\n") // Promise.allの結果をjoinで結合
      );

    await interaction.reply({ embeds: [embed], flags: 64 });
    //メモ機能、削除（非表示）
  } else if (subcommand === "memo_remove") {
    const memoId = interaction.options.getInteger("memo_id");
    const memo = await AdminMemo.findOne({
      where: { id: memoId, guildId: serverId },
    });

    if (!memo) {
      return interaction.reply({
        content: "❌ 指定されたメモが見つかりません。",
        flags: 64, //ephemeral
      });
    }
    // メモのisVisibleをfalseにして非表示にする
    memo.isVisible = false;
    await memo.save();

    await interaction.reply({
      content: `✅ メモ (ID: ${memoId}) を非表示にしました。`,
      flags: 64, //ephemeral
    });
  } else if (subcommand == "timeout") {
    //タイムアウト
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "理由未記入";
    const nerunonya = interaction.options.getInteger("minutes");
    const days = Math.floor(nerunonya / 1440); // 日を計算
    const hours = Math.floor((nerunonya % 1440) / 60); // 時間を計算
    const minutes = nerunonya % 60; // 残りの分を計算
    //タイムアウト開始
    try {
      const sleaptime = 60 * 1000 * nerunonya;
      const timestamp = Math.floor(Date.now() / 1000);
      const waketimestamp = Math.floor((Date.now() + sleaptime) / 1000);
      const member = interaction.guild.members.cache.get(user.id);
      if (!member)
        return interaction.reply({
          content: "対象メンバーが見つかりません。",
          flags: 64, //ephemeral
        });

      await member.timeout(sleaptime, reason);
      await interaction.reply({
        flags: 64, //ephemeral
        embeds: [
          new EmbedBuilder()
            .setTitle("タイムアウト")
            .setDescription(
              `${member.displayName}を${nerunonya}分間タイムアウトしました`
            )
            .setColor("#FF0000")
            .addFields(
              {
                name: "開始時刻",
                value: `<t:${timestamp}:f>`,
              },
              {
                name: "終了時刻",
                value: `<t:${waketimestamp}:f>`,
                inline: true,
              }
            ),
        ],
      });
      await interaction.client.channels.cache.get(config.logch.admin).send({
        embeds: [
          new EmbedBuilder()
            .setTitle("タイムアウトログ")
            .setColor("#FFD700")
            .setDescription(
              `対象\`\`\`\n${user.username} (ID:${user.id})\n\`\`\`\n時間\`\`\`\n${nerunonya}分(${days}日${hours}時間${minutes}分)\n\`\`\`\n理由\`\`\`\n${reason} \n\`\`\``
            )
            .setThumbnail(
              interaction.user.displayAvatarURL({
                dynamic: true,
              })
            )
            .setTimestamp()
            .addFields({
              name: "送信者",
              value: `${interaction.member.displayName}(ID:${interaction.user.id})`,
            }),
        ],
      });
    } catch (error) {
      interaction.reply({
        flags: 64, //ephemeral
        content: `このユーザーにはタイムアウトできません（Botのロール順などを確認してください）`,
      });
    }
  } else if (subcommand === "scenario_check") {
    // シナリオの手動チェックを実行する処理
    // 処理に時間がかかることをユーザーに伝える
    await interaction.reply({
      content:
        "シナリオ・エクカの手動チェックを開始します。新規・終了があればロスアカチャンネルに投稿されます...",
      flags: 64, //ephemeral
    });

    //オプションの値を取得し、関数に渡します ▼▼▼
    // オプションが指定されていなければ false になります
    const forceResync = interaction.options.getBoolean("force_resync") || false;

    // 別のファイルからインポートしたチェック関数を呼び出す
    // clientオブジェクトを渡すのを忘れずに！
    try {
      await checkNewScenarios(interaction.client, forceResync);
      await checkAtelierCards(interaction.client, forceResync); // エクストラカードのチェックも同時に実行
      // 成功したことを伝える
      await interaction.followUp({
        content: `✅ 手動チェックが完了しました。(強制再同期: ${forceResync ? "有効" : "無効"})`,
        flags: 64, //ephemeral
      });
    } catch (error) {
      console.error("手動エクカ・シナリオチェック中にエラー:", error);
      // 失敗したことを伝える
      await interaction.followUp({
        content:
          "❌ 手動チェック中にエラーが発生しました。詳細はコンソールログを確認してください。",
        flags: 64, //ephemeral
      });
    }
  } else if (subcommand === "distribute_currency") {
    const currencyType = interaction.options.getString("currency_type");
    const amount = interaction.options.getInteger("amount");
    const reason = interaction.options.getString("reason");
    const targetUser = interaction.options.getUser("user");
    const distributeToAll = interaction.options.getBoolean("all") || false;

    if (!targetUser && !distributeToAll) {
      return interaction.reply({
        content: "配布対象を `user` または `all` で指定してください。",
        flags: 64,
      });
    }

    const currencyInfo = config.casino.currencies[currencyType];
    if (!currencyInfo) {
      console.error(`不明な通貨タイプ: ${currencyType}`);
      return interaction.reply({
        content: "内部エラー: 通貨情報が見つかりません。",
        flags: 64,
      });
    }

    // 処理が長引く可能性があるので、応答を保留
    await interaction.deferReply({ flags: 64 });

    const transaction = await sequelize.transaction();

    try {
      // --- 単体ユーザーへの配布 ---
      if (targetUser) {
        const fieldsToUpdate = {};
        fieldsToUpdate[currencyType] = amount;
        if (currencyType === "point" || currencyType === "acorn") {
          fieldsToUpdate[`total${currencyType}`] = amount;
        }

        // ユーザーが存在しない場合も考慮し、findOrCreateを使用
        const [userPoint, created] = await Point.findOrCreate({
          where: { userId: targetUser.id },
          defaults: { userId: targetUser.id },
          transaction: transaction,
        });

        // incrementを使用して値を追加
        await userPoint.increment(fieldsToUpdate, { transaction: transaction });

        // DM通知
        try {
          await targetUser.send(
            `**${interaction.guild.name}**からのお知らせ\n管理者より、アイテムが配布されました。\n\n` +
              `**理由:** ${reason}\n` +
              `**アイテム:** ${currencyInfo.displayName} ×${amount}`
          );
        } catch (dmError) {
          await interaction.client.channels.cache
            .get(config.logch.notification)
            .send(
              `<@${targetUser.id}> さんへのDM送信に失敗したため、こちらへ通知します。\n` +
                `**配布内容:** ${reason}により、${currencyInfo.displayName}を${amount}個配布しました。`
            );
        }

        // ログ記録
        const logEmbed = new EmbedBuilder()
          .setTitle("通貨配布ログ (個別)")
          .setColor("#00FF00")
          .setDescription(`**理由:** ${reason}`)
          .addFields(
            {
              name: "実行者",
              value: `${interaction.user.tag} (${interaction.user.id})`,
            },
            {
              name: "対象者",
              value: `${targetUser.tag} (${targetUser.id})`,
            },
            { name: "通貨", value: currencyInfo.displayName, inline: true },
            { name: "枚数", value: `${amount}枚`, inline: true }
          )
          .setTimestamp();
        await interaction.client.channels.cache
          .get(config.logch.admin)
          .send({ embeds: [logEmbed] });

        await transaction.commit();
        await interaction.editReply({
          content: `${targetUser.username} に ${currencyInfo.displayName} を ${amount} 枚配布しました。`,
        });

        // --- 全員への配布 ---
      } else if (distributeToAll) {
        let members;
        try {
          // ★★★ 変更点: members.fetch() を try-catch で囲む ★★★
          members = await interaction.guild.members.fetch();
        } catch (fetchError) {
          console.error("メンバーの取得に失敗:", fetchError);
          await transaction.rollback();
          return interaction.editReply({
            content:
              "メンバーリストの取得に失敗しました。Discord APIのレートリミットに達した可能性があります。しばらく待ってから再度お試しください。",
          });
        }
        const userIds = members
          .filter((m) => !m.user.bot)
          .map((m) => m.user.id);

        if (userIds.length === 0) {
          await transaction.rollback();
          return interaction.editReply({
            content: "配布対象のユーザーが見つかりませんでした。",
          });
        }

        const fieldsToUpdate = {
          [currencyType]: sequelize.literal(`"${currencyType}" + ${amount}`),
        };
        if (currencyType === "point" || currencyType === "acorn") {
          const totalField = `total${currencyType}`;
          fieldsToUpdate[totalField] = sequelize.literal(
            `"${totalField}" + ${amount}`
          );
        }

        // データベースに存在するユーザーに対してのみ一括で更新
        await Point.update(fieldsToUpdate, {
          where: { userId: { [Op.in]: userIds } },
          transaction,
        });

        // ログ記録
        const logEmbed = new EmbedBuilder()
          .setTitle("通貨配布ログ (全員)")
          .setColor("#00FF00")
          .setDescription(`**理由:** ${reason}`)
          .addFields(
            {
              name: "実行者",
              value: `${interaction.user.tag} (${interaction.user.id})`,
            },
            {
              name: "対象者",
              value: `サーバーメンバー全員 (${userIds.length}人)`,
            },
            { name: "通貨", value: currencyInfo.displayName, inline: true },
            { name: "枚数", value: `${amount}枚`, inline: true }
          )
          .setTimestamp();
        await interaction.client.channels.cache
          .get(config.logch.admin)
          .send({ embeds: [logEmbed] });

        // チャンネルへの一括通知
        const notificationChannel = interaction.client.channels.cache.get(
          config.logch.notification
        );
        if (notificationChannel) {
          await notificationChannel.send(
            `**サーバーメンバー全員へのお知らせ**\n\n` +
              `管理者より、アイテムが配布されました。\n` +
              `**理由:** ${reason}\n` +
              `**アイテム:** ${currencyInfo.displayName} ×${amount}`
          );
        }

        await transaction.commit();
        await interaction.editReply({
          content: `メンバー全員 (${userIds.length}人) に ${currencyInfo.displayName} を ${amount} 枚配布しました。`,
        });
      }
    } catch (error) {
      // 念のため、トランザクションがまだアクティブな場合はロールバック
      if (!transaction.finished) {
        // ① トランザクションが完了済みかチェック
        await transaction.rollback();
      }
      console.error("通貨配布処理中にエラー:", error);
      // editReplyが既に使われている可能性を考慮し、followUpでエラー通知
      await interaction
        .followUp({
          // ② エラー報告に followUp を使用
          content:
            "処理中にエラーが発生しました。データベースの操作に失敗した可能性があります。",
          ephemeral: true,
        })
        .catch(() => {});
    }
  }
}
