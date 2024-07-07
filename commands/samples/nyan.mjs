import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nyan')
  .setDescription('');

export async function execute(interaction){
	await interaction.reply('ぽんにゃ！');
}
