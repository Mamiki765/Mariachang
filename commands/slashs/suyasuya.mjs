import {
  SlashCommandBuilder,
  EmbedBuilder
} from "discord.js";


export const data = new SlashCommandBuilder()
  .setName('suyasuya')
  .setDescription('【⚠️注意】発言・VC参加をできない状態にします。依存対策にどうぞ。')
  .addStringOption(option =>
    option
    .setName('minutes')
    .setDescription('タイムアウトする時間を分単位で入力してください（１-720）')
    .setRequired(true)
  );

export async function execute(interaction) {
  const nerunonya = interaction.options.getString('minutes');
  if (nerunonya < 1) {
    return await interaction.reply({
      flags: [4096], //silent
      content: '常識的な数字を入力してくださいにゃ。',
      ephemeral: true
    });
  }
  if (nerunonya > 720) {
    return await interaction.reply({
      flags: [4096], //silent
      content: '永遠に寝るつもりにゃ？',
      ephemeral: true
    });
  }
  try {
    const sleaptime = 60 * 1000 * nerunonya;
    const timestamp = Math.floor(Date.now() / 1000);
    const waketimestamp = Math.floor((Date.now() + sleaptime) / 1000);
    await interaction.member.timeout(sleaptime, "/suyasuyaによるセルフタイムアウト");
    await interaction.reply({
      flags: [4096], //silent
      embeds: [
        new EmbedBuilder()
        .setTitle("セルフタイムアウト")
        .setDescription(`${interaction.member.displayName}を${nerunonya}分間封殺するにゃ！`)
        .setColor("#FF0000")
        .setFooter({
          text: "精々作業なり睡眠なりするにゃ！"
        })
        .addFields({
          name: "開始時刻",
          value: `<t:${timestamp}:f>`
        }, {
          name: "終了時刻",
          value: `<t:${waketimestamp}:f>`,
          inline: true
        })
      ]
    });
  } catch (error) {
    interaction.reply({
      flags: [4096],
      content: `エラーが発生しましたにゃ。流石にマリアより上の役職はタイムアウトできないにゃ…`
    });
  }
}