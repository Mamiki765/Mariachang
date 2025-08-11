import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("メッセージを削除 (スレ主限定)")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: "このコマンドはサーバー内でのみ使用できます。",
      flags: 64,
    });
  }

  const targetMessage = await interaction.channel.messages.fetch(
    interaction.targetId
  );
  const thread = interaction.channel;

  // ここを修正
  if (
    !thread.isThread() ||
    (thread.parent?.isForum && !thread.parent.isForum())
  ) {
    return interaction.reply({
      content: "このコマンドはフォーラムスレッド内でのみ使用できます。",
      flags: 64, //ephemeral
    });
  }

  // プライベートスレッドで、ボットが参加していない場合はエラーを返す
  if (thread.type === ChannelType.PrivateThread) {
    return interaction.reply({
      content: "プライベートスレッド内のメッセージは削除できません。",
      flags: 64,
    });
  }

  try {
    // スレッドの作成者を取得
    const threadCreatorId = await thread
      .fetchStarterMessage()
      .then((message) => message.author.id);

    // コマンド実行者がスレッドの作成者であるか確認
    if (interaction.user.id !== threadCreatorId) {
      return interaction.reply({
        content: "この操作を実行できるのはスレッドの作成者のみです。",
        flags: 64, //ephemeral
      });
    }

    // 確認メッセージとボタンを送信
    const confirmButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("delete_confirm")
        .setLabel("削除する")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("delete_cancel")
        .setLabel("キャンセル")
        .setStyle(ButtonStyle.Secondary)
    );

    // 1. まずは普通に返信する
    await interaction.reply({
      content: "本当にこのメッセージを削除しますか？",
      components: [confirmButtons],
      flags: 64, //ephemeral
    });

    // 2. その後、送信した返信内容をあらためて取得する
    const confirmMessage = await interaction.fetchReply();

    // ボタンのインタラクションを待つ
    const buttonCollector = confirmMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 15000, // 15秒待つ
    });

    buttonCollector.on("collect", async (i) => {
      if (i.customId === "delete_confirm") {
        try {
          // メッセージを削除
          await targetMessage.delete();
          await i.update({
            content: `メッセージ ID: ${interaction.targetId} を削除しました。`,
            components: [],
          });
        } catch (error) {
          console.error("メッセージ削除中にエラーが発生しました:", error);
          await i.update({
            content: "メッセージの削除に失敗しました。",
            components: [],
          });
        }
      } else if (i.customId === "delete_cancel") {
        await i.update({
          content: "メッセージの削除をキャンセルしました。",
          components: [],
        });
      }
    });

    buttonCollector.on("end", (collected) => {
      if (collected.size === 0) {
        interaction.editReply({
          content: "メッセージの削除がタイムアウトしました。",
          components: [],
        });
      }
    });
  } catch (error) {
    console.error("メッセージ削除処理中にエラーが発生しました:", error);
    await interaction.reply({
      content: "メッセージの削除処理中にエラーが発生しました。",
      flags: 64,
    });
  }
}
