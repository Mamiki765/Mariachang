import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('このbotが生きてるかチェックできるにゃ');

export async function execute(interaction){
	await interaction.reply('ぽんにゃ！');
}
