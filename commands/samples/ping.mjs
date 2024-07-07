import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('サーバーが生きてるかチェックできるにゃ');

export async function execute(interaction){
	await interaction.reply('ぽんにゃ！');
}
