import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nyan')
  .setDescription('にゃーんとはにゃーんである');

export async function execute(interaction){
	await interaction.reply('にゃ～ん');
}
