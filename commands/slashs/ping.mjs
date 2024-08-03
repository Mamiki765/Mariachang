import { SlashCommandBuilder,  EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('このbotが生きてるかチェックします');

export async function execute(interaction){
  const apiPing = Date.now() - interaction.createdTimestamp
	await interaction.reply({ 
  //  content: `<@${interaction.member.user.id}>`,
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
                ]
  });
  const replyMessage = await interaction.fetchReply()//リプライされたのを確認する必要がある
  await replyMessage.react('1269022817429753918'); 
}
