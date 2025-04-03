import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { selftimeout_check } from "../../components/buttons.mjs";

export const data = new SlashCommandBuilder()
  .setName("suyasuya")
.setNameLocalizations({
            ja: "セルフタイムアウト",
          })
  .setDescription(
    "【⚠️注意】発言・VC参加をできない状態にします。依存対策にどうぞ。"
  )
  .addIntegerOption((option) =>
    option
      .setName("minutes")
      .setDescription(
        "タイムアウトする時間を分単位で入力してください（１-720）"
      )
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(720)
  );

export async function execute(interaction) {
  const nerunonya = interaction.options.getInteger("minutes");
const hours = Math.floor(nerunonya / 60); // 時間を計算
const minutes = nerunonya % 60; // 残りの分を計算
  await interaction.reply({
    flags: [4096],
    ephemeral: true,
    content: `**本当に${nerunonya}分(${hours}時間${minutes}分)タイムアウトしますか？**\n__**発言、リアクション、ボイスチャットへの参加などができなくなります！**__解除は基本的に受け付けていません！`,
    components: selftimeout_check(nerunonya),
  });
}

export async function timeout_confirm(interaction, minutes) {
  try {
    const sleaptime = 60 * 1000 * minutes;
    const timestamp = Math.floor(Date.now() / 1000);
    const waketimestamp = Math.floor((Date.now() + sleaptime) / 1000);
    await interaction.member.timeout(
      sleaptime,
      "/suyasuyaによるセルフタイムアウト"
    );
    await interaction.channel.send({
      flags: [4096], //silent
      embeds: [
        new EmbedBuilder()
          .setTitle("セルフタイムアウト")
          .setDescription(
            `${interaction.member.displayName}を${minutes}分間封殺するにゃ！`
          )
          .setColor("#FF0000")
          .setFooter({
            text: "精々作業なり睡眠なりするにゃ！",
          })
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
    await interaction.update({
      content: `${minutes}分のタイムアウトを行いました`,
      components: [],
    });
  } catch (error) {
    interaction.channel.send({
      flags: [4096],
      content: `エラーが発生しましたにゃ。流石にマリアより上の役職はタイムアウトできないにゃ…`,
    });
  }
}

export async function timeout_cancel(interaction) {
  await interaction.update({
    content: `タイムアウトをキャンセルしました`,
    components: [],
  });
}
