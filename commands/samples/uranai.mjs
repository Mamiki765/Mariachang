import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('uranai')
  .setDescription('ラッキーカラーを占うよ～');

export async function execute(interaction){
  const arr = ["赤色", "青色", "緑色", "黄色", "水色"]
  const random = Math.floor( Math.random() * arr.length);
  const color = arr[random];

	await interaction.reply(`ラッキーカラーは${color}だよ～`);
}
