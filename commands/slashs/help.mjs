import { SlashCommandBuilder,  EmbedBuilder } from 'discord.js';


export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('このBOTの機能を説明します')