import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
} from "discord.js";

import config from "../../config.mjs";
import { replyfromDM } from "../../components/buttons.mjs";
import { AdminMemo } from "../../models/roleplay.mjs";

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
      .setDescription(
        "管理人として発言します。画像などは別の場所に貼り付けてリンクをコピーしてください。"
      )
      .addStringOption((option) =>
        option
          .setName("message")
          .setDescription("発言内容を記述(改行は\n、<br>、@@@などでもできます)")
          .setRequired(true)
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription(
            "送信先チャンネルを指定してください(指定が無ければ現在のチャンネルに送信します)"
          )
          .addChannelTypes(
            0, // テキストチャンネル
            5, // ニュースチャンネル
            10, // ニューススレッド
            11, //公開スレッド
            12 //プライベートスレッド
          )
      )
  )
  //マリアで発言機能登録ここまで
  //マリアからDM機能
  .addSubcommand((subcommand) =>
    subcommand
      .setName("dm_from_maria")
      .setDescription("管理人としてマリアからDMを送信します。")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("DMを送信する相手を指定してください。")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("message")
          .setDescription("発言内容を記述(改行は\n、<br>、@@@などでもできます)")
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option
          .setName("reply")
          .setDescription("このDMに対する返信を許可するか(デフォルトはTrue)")
      )
  )
  //マリアの発言編集機能
  .addSubcommand((subcommand) =>
    subcommand
      .setName("edit_maria_message")
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
          .setDescription("新しいメッセージ内容")
          .setRequired(true)
      )
      .addAttachmentOption((option) =>
        option.setName("newimage").setDescription("新しい画像を添付")
      )
  )
  //管理メモ
  .addSubcommand((subcommand) =>
    subcommand
      .setName("memo_add")
      .setDescription("指定ユーザーにメモを追加")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("メモを追加するユーザー")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("content").setDescription("メモの内容").setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("memo_list")
      .setDescription("指定ユーザーのメモ一覧を表示")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("メモを確認するユーザー")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("memo_remove")
      .setDescription("指定メモを削除")
      .addIntegerOption((option) =>
        option
          .setName("memo_id")
          .setDescription("削除するメモのID")
          .setRequired(true)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const serverId = interaction.guild ? interaction.guild.id : "DM";
  //chat as maria
  if (subcommand == "chat_as_maria") {
    let content = interaction.options.getString("message");
    const targetChannel =
      interaction.options.getChannel("channel") || interaction.channel;
    // 改行文字を置き換え
    content = content
      .replace(/@@@/g, "\n")
      .replace(/<br>/g, "\n")
      .replace(/\\n/g, "\n");
    try {
      // メッセージを指定されたチャンネルに送信
      await targetChannel.send({
        content: content,
      });
      await interaction.client.channels.cache.get(config.logch.admin).send({
        embeds: [
          new EmbedBuilder()
            .setTitle("管理者発言ログ(チャンネル)")
            .setColor("#FFD700")
            .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
            .setThumbnail(
              interaction.user.displayAvatarURL({
                dynamic: true,
              })
            )
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
      await interaction.reply({
        ephemeral: true,
        content: `メッセージを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``,
      });
    } catch (e) {
      console.error("メッセージ送信に失敗しました:", e);
      await interaction.reply({
        ephemeral: true,
        content: `メッセージの送信に失敗しました: ${e.message}`,
      });
    }
  } else if (subcommand == "dm_from_maria") {
    let content = interaction.options.getString("message");
    const targetUser = interaction.options.getUser("user");
    let replyable = interaction.options.getBoolean("reply");
    replyable = replyable === null ? true : replyable;
    const replybutton = replyable ? [replyfromDM] : null;
    // 改行文字を置き換え
    content = content
      .replace(/@@@/g, "\n")
      .replace(/<br>/g, "\n")
      .replace(/\\n/g, "\n");
    try {
      const embed = new EmbedBuilder()
        .setTitle(`管理人室からのメッセージ`)
        .setDescription(content)
        .setTimestamp()
        .setColor("#FFD700")
        .setFooter({
          text: "このダイレクトメールへの書き込みには返信できません、ご了承ください",
        });
      // メッセージを指定されたチャンネルに送信
      await targetUser.send({
        content: `【重要】このメッセージの下の埋め込みが見えない場合「埋め込みとリンクのプレビュー」の設定をONにしてください。`,
        embeds: [embed],
        components: replybutton,
      });
      await interaction.client.channels.cache.get(config.logch.admin).send({
        embeds: [
          new EmbedBuilder()
            .setTitle("管理者発言ログ(DM)")
            .setColor("#FFD700")
            .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
            .setThumbnail(
              interaction.user.displayAvatarURL({
                dynamic: true,
              })
            )
            .setTimestamp()
            .addFields(
              {
                name: "送信者",
                value: `${interaction.member.displayName}(ID:${interaction.user.id})`,
              },
              {
                name: "送信相手",
                value: `\@${targetUser.username} (<@${targetUser.id}>)`,
              },
              {
                name: "返信可否",
                value: `${replyable}`,
              }
            ),
        ],
      });
      await interaction.reply({
        ephemeral: true,
        content: `${targetUser.username}にメッセージを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``,
      });
    } catch (e) {
      console.error("メッセージ送信に失敗しました:", e);
      await interaction.reply({
        ephemeral: true,
        content: `メッセージの送信に失敗しました: ${e.message}`,
      });
    }
  } else if (subcommand == "edit_maria_message") {
    const messageUrl = interaction.options.getString("messageurl");
    const newMessage = interaction.options.getString("newmessage");
    const newImage = interaction.options.getAttachment("newimage");

    // メッセージIDとチャンネルIDをURLから取得
    const urlParts = messageUrl.match(/\/channels\/\d+\/(\d+)\/(\d+)/);
    if (!urlParts) {
      return interaction.reply({
        content: "無効なメッセージURLです。",
        ephemeral: true,
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
          ephemeral: true,
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
        ephemeral: true,
      });
    } catch (error) {
      console.error("メッセージの編集に失敗しました:", error);
      await interaction.reply({
        content: "メッセージの編集に失敗しました。",
        ephemeral: true,
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
      ephemeral: true,
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
        ephemeral: true,
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

    await interaction.reply({ embeds: [embed], ephemeral: true });
    //メモ機能、削除（非表示）
  } else if (subcommand === "memo_remove") {
    const memoId = interaction.options.getInteger("memo_id");
    const memo = await AdminMemo.findOne({
      where: { id: memoId, guildId: serverId },
    });

    if (!memo) {
      return interaction.reply({
        content: "❌ 指定されたメモが見つかりません。",
        ephemeral: true,
      });
    }
    // メモのisVisibleをfalseにして非表示にする
    memo.isVisible = false;
    await memo.save();

    await interaction.reply({
      content: `✅ メモ (ID: ${memoId}) を非表示にしました。`,
      ephemeral: true,
    });
  }
}
