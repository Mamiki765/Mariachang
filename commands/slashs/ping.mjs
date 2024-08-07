import { SlashCommandBuilder,  EmbedBuilder , ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('このbotが生きてるかチェックします');

export async function execute(interaction){
  const apiPing = Date.now() - interaction.createdTimestamp
	await interaction.reply({ 
    flags: [ 4096 ],
    embeds: [
                    new EmbedBuilder()
                    .setTitle(":ping_pong:Pongにゃ!")
                    .setDescription("Ping値を表示します。")
                    .addFields(
                        {
                            name: ":electric_plug:WebSocket Ping",
                            value: "`" + interaction.client.ws.ping + "ms`"
                        },
                        {
                            name: ":yarn:API Endpoint Ping",
                            value: "`" + apiPing + "ms`"
                        }
                    )
                    .setColor("#2f3136")
                    .setTimestamp()
                ],
                components: [//コマンド削除ボタン
                    new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                        .setLabel("🗑️削除")
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId("delete")
                    )
                ]
  });
}
