import { SlashCommandBuilder,  EmbedBuilder } from 'discord.js';


export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('このBOTの機能を説明します')

export async function execute(interaction) {
await interaction.reply({ 
    flags: [ 4096 ],
    embeds: [
                    new EmbedBuilder()
                    .setTitle("神谷マリアbotについて")
                    .setDescription("神谷マリアbotは云々カンヌン・・・悪いけど未実装にゃ")
                    .setColor("#B78CFE")
                ]
  });
}