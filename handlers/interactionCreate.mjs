import { EmbedBuilder } from "discord.js";
import handleButtonInteraction from "../interactions/buttonHandlers.mjs";
import handleModalInteraction from "../interactions/modalHandlers.mjs";
import config from "../config.mjs";

export default async (interaction) => {
  //ログとり
  const comname = interaction.commandName
    ? interaction.commandName
    : interaction.customId;
  const user = interaction.member ? interaction.member : interaction.user; //DMならuser
  const log = new EmbedBuilder()
    .setTitle("コマンド実行ログ")
    .setDescription(`${user.displayName} がコマンドを実行しました。`)
    .setTimestamp()
    .setThumbnail(
      interaction.user.displayAvatarURL({
        dynamic: true,
      })
    )
    .addFields(
      {
        name: "コマンド",
        value: "```\n" + interaction.toString() + " (" + comname + ")\n```",
      },
      {
        name: "実行ユーザー",
        value:
          "```\n" + `${interaction.user.tag}(${interaction.user.id})` + "\n```",
        inline: true,
      }
    );
  interaction.client.channels.cache.get(config.logch.command).send({
    embeds: [log],
  });
  //ログ取りここまで
  //ボタン
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
    return;
  }
  //モーダル
  else if (interaction.isModalSubmit()) {
    await handleModalInteraction(interaction);
    return;
  }
  // オートコンプリート
  else if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) {
      console.error(
        `「${interaction.commandName}」コマンドに、オートコンプリート処理が見つかりません。`
      );
      return;
    }
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`オートコンプリート処理中にエラーが発生しました:`, error);
    }
    return; // オートコンプリートの処理はここで終わり
  }
  // オートコンプリートここまで

  //  スラッシュメニュー、コンテキストメニュー（右クリック）であるか確認。
  else if (
    !interaction.isChatInputCommand() &&
    !interaction.isMessageContextMenuCommand()
  )
    return;
  const command = interaction.client.commands.get(interaction.commandName);

  //console.log(interaction);//debug
  if (!command) {
    console.error(
      `「${interaction.commandName}」コマンドは見つかりませんでした。`
    );
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "コマンド実行中にエラーが発生しました。",
        flags: 64, //ephemeral
      });
    } else {
      await interaction.reply({
        content: "コマンド実行中にエラーが発生しました。",
        flags: 64, //ephemeral
      });
    }
  }
};
