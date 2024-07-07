import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('suyasuya')
  .setDescription('（未実装）【！注意！】発言ができなくなります！（自粛用にどうぞ）')
  .addStringOption(option =>
    option
      .setName('minutes')
      .setDescription('タイムアウトする時間を分単位で入力してください（１-７２０）')
      .setRequired(true)
  );

export async function execute(interaction){
  const nerunonya = interaction.options.getString('minutes');
  if (nerunonya < 1) {
        return await interaction.reply({
            content: '常識的な数字を入力してください。',
            ephemeral: true
        });
    }
  if (nerunonya > 720) {
        return await interaction.reply({
            content: '永遠に寝るつもりにゃ？',
            ephemeral: true
        });
    }
	await interaction.reply('${nerunonya}分封殺してやるにゃ…嘘にゃ、未実装にゃ');
  await interaction.member.timeout(60 * 1000 * nerunonya, "メッセージを送ってきたから");
}
