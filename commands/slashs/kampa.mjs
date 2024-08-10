import { SlashCommandBuilder,  EmbedBuilder , ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('kampa')
  .setDescription('もしよろしければご支援頂ければ幸いです。。。');

export async function execute(interaction){
	await interaction.reply({ 
    flags: [ 4096 ],
    content: `<@${interaction.user.id}>`,
    ephemeral: true,
    embeds: [
                    new EmbedBuilder()
                    .setTitle("")
                    .setDescription("もしこのBOTが気に入ってくれたらにゃけど…")
                    .setColor("#2f3136")
                    .setTimestamp()
                ],
                components: [
                    new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                        .setLabel("しょうがないにゃあ")
                        .setStyle(ButtonStyle.Link)
                        .setURL("https://kampa.me/t/vsf")
                    )
                ]
  });
}