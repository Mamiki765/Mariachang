import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("suyasuya")
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

  try {
    const sleaptime = 60 * 1000 * nerunonya;
    const timestamp = Math.floor(Date.now() / 1000);
    const waketimestamp = Math.floor((Date.now() + sleaptime) / 1000);
    await interaction.member.timeout(
      sleaptime,
      "/suyasuyaによるセルフタイムアウト"
    );
    await interaction.reply({
      flags: [4096], //silent
      embeds: [
        new EmbedBuilder()
          .setTitle("セルフタイムアウト")
          .setDescription(
            `${interaction.member.displayName}を${nerunonya}分間封殺するにゃ！`
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
  } catch (error) {
    interaction.reply({
      flags: [4096],
      content: `エラーが発生しましたにゃ。流石にマリアより上の役職はタイムアウトできないにゃ…`,
    });
  }
}
