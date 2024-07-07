import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nyan')
  .setDescription('Botが返事してくれるよ');

export async function execute(interaction){
	await interaction.reply('にゃ～ん');
}
