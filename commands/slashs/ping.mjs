// commands/slashs/ping.mjs

import {
  SlashCommandBuilder,
  EmbedBuilder,
  version as djsVersion, // discord.jsのバージョンを取得するために追加
} from "discord.js";
import os from "os";
import process from "process"; // processをインポート
import { deletebuttonanyone } from "../../components/buttons.mjs";

// 稼働時間を読みやすい形式に変換する関数
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}日${h}時間${m}分${s}秒`;
}

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Botのレイテンシと詳細なステータス情報を表示します。");

export async function execute(interaction) {
  // まずは「計算中...」の返信をephemeral(本人にだけ見える)で送る
  // fetchReply: true で、後から編集するためにメッセージオブジェクトを取得
  const sent = await interaction.reply({
    content: "🏓 Pinging...",
    fetchReply: true,
    flags: [4096], 
  });

  // Botがメッセージを受け取ってから返信するまでの時間 (より正確なPing)
  const latency = sent.createdTimestamp - interaction.createdTimestamp;

  // メモリ使用量 (Botプロセス自身)
  const memoryUsedMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
  
  // CPU使用率の計算
  const startUsage = process.cpuUsage();
  const startTime = process.hrtime.bigint();

  // 100ミリ秒待って、CPU使用率を計算
  setTimeout(async () => {
    const endUsage = process.cpuUsage(startUsage);
    const endTime = process.hrtime.bigint();
    
    const elapsedTime = Number(endTime - startTime) / 1e6;
    const elapsedCpuTime = (endUsage.user + endUsage.system) / 1000;
    
    const cpuCores = os.cpus().length;
    const cpuPercentage = ((elapsedCpuTime / elapsedTime) * 100 / cpuCores).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor("#2f3136") 
      .setTitle(":ping_pong: Pongにゃ!") 
      .addFields(
        { name: ":zap: 応答速度", value: `\`${latency}ms\``, inline: true },
        { name: ":satellite: APIレイテンシ", value: `\`${interaction.client.ws.ping}ms\``, inline: true },
        { name: " ", value: " ", inline: false}, // 見やすいように区切り線代わりの空白
        { name: ":hourglass: 稼働時間", value: `\`${formatUptime(process.uptime())}\``, inline: false },
        { name: ":floppy_disk: メモリ使用量", value: `\`${memoryUsedMb} MB\``, inline: true },
        { name: ":computer: CPU 使用率", value: `\`${cpuPercentage} %\``, inline: true },
        { name: " ", value: " ", inline: false}, // 見やすいように区切り線代わりの空白
        { name: "Node.js", value: `\`${process.version}\``, inline: true },
        { name: "Discord.js", value: `\`v${djsVersion}\``, inline: true },
        { name: "OS", value: `\`${os.platform()}\``, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Powered by ${cpuCores} CPUコア` });

    // 最初に送ったメッセージを、完成したEmbedで編集する
    await interaction.editReply({
      content: null,
      embeds: [embed],
      components: [deletebuttonanyone], 
    });

  }, 200); // 200ms待つ (CPU計算のため少し長めに)
}