import { SlashCommandBuilder,  EmbedBuilder } from 'discord.js';
import fs from "fs";

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('このBOTの機能を説明します')

export async function execute(interaction) {
  const helptext = fs.readFileSync("../maps/help.txt", 'utf8');
  await interaction.reply({ 
      flags: [ 4096 ],
      embeds: [
                      new EmbedBuilder()
                      .setTitle("神谷マリアbotについて")
                      .setDescription(helptext)
                      .setColor("#B78CFE")
                  ]
    });
}