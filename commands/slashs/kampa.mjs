import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('kampa')
  .setDescription('15円からできるカンパです。');

export async function execute(interaction) {
  await interaction.reply({
    flags: [4096],
    ephemeral: true,
    embeds: [
      new EmbedBuilder()
      .setTitle("お願い")
      .setDescription("もしマリアの事を気に入ってくれたらにゃけど…\n（botの制作者にカンパします、しても何も良いことはありません)")
      .setColor("#2f3136")
      .setTimestamp()
      .setFooter({
        text: "…けど、ちょっと生きてて良かったかなって、思います。"
      })
    ],
    components: [
      new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
        .setLabel("しょうがないにゃあ")
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.kampa)
      )
    ]
  });
}