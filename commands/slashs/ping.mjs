import { SlashCommandBuilder,  EmbedBuilder , ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
const os = require('os');
import { deletebuttonanyone } from "../../components/buttons.mjs"

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('このbotが生きてるかチェックします');

export async function execute(interaction){
//ping確認
  const apiPing = Date.now() - interaction.createdTimestamp
//メモリ、CPU状態の読み込み
  const memoryUsage = process.memoryUsage();
  const cpuUsage = os.cpus().map(cpu => ({
      model: cpu.model,
      speed: cpu.speed,
      times: cpu.times
  }));
	await interaction.reply({ 
    flags: [ 4096 ],
//    content: `<@${interaction.user.id}>`,
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
                        },
                      {
                    name: 'Memory Usage',
                    value: `RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB\n` +
                           `Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB\n` +
                           `Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB\n` +
                           `External: ${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
                    inline: false
                },
                {
                    name: 'CPU Usage',
                    value: cpuUsage.map(cpu => 
                        `Model: ${cpu.model}\n` +
                        `Speed: ${cpu.speed} MHz\n` +
                        `User Time: ${cpu.times.user} ms\n` +
                        `System Time: ${cpu.times.sys} ms\n` +
                        `Idle Time: ${cpu.times.idle} ms`
                    ).join('\n\n'),
                    inline: false
                }
                    )
                    .setColor("#2f3136")
                    .setTimestamp()
                ],
                components: [deletebuttonanyone]
  });
}
