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
  const input = interaction.options.getString('minutes');
	await interaction.reply('${input}分封殺してやるにゃ…嘘にゃ、未実装にゃ');
}
