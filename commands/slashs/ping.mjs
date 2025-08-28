// commands/slashs/ping.mjs

import {
  SlashCommandBuilder,
  EmbedBuilder,
  version as djsVersion,
  MessageFlags, // MessageFlagsをインポート
} from "discord.js";
import os from "os";
import process from "process";
import { deletebuttonanyone } from "../../components/buttons.mjs";

export const help = {
  category: "slash",
  description: "ぽんにゃ！",
  notes:
    "Botの生存状態を簡易的に確認します、ついでにレイテンシと詳細なステータス情報を表示します。",
};

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
  // ★ 「通知を抑制」して返信する
  // 1. まずは普通に返信する
  await interaction.reply({
    content: "🏓 Pinging...",
    flags: MessageFlags.SuppressNotifications,
  });

  // 2. その後、送信した返信内容をあらためて取得する
  const sent = await interaction.fetchReply();

  const latency = sent.createdTimestamp - interaction.createdTimestamp;

  const processMemoryUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(
    2
  );
  const totalMemory = os.totalmem() / 1024 / 1024;
  const freeMemory = os.freemem() / 1024 / 1024;
  const containerMemoryUsed = (totalMemory - freeMemory).toFixed(2);
  const containerMemoryPercentage = (
    (containerMemoryUsed / totalMemory) *
    100
  ).toFixed(2);

  const startUsage = process.cpuUsage();
  const startTime = process.hrtime.bigint();

  setTimeout(async () => {
    const endUsage = process.cpuUsage(startUsage);
    const endTime = process.hrtime.bigint();

    const elapsedTime = Number(endTime - startTime) / 1e6;
    const elapsedCpuTime = (endUsage.user + endUsage.system) / 1000;

    const cpuCores = os.cpus().length;
    const cpuPercentage = (
      ((elapsedCpuTime / elapsedTime) * 100) /
      cpuCores
    ).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle(":ping_pong: Pongにゃ!")
      .addFields(
        { name: ":zap: 応答速度", value: `\`${latency}ms\``, inline: true },
        {
          name: ":satellite: APIレイテンシ",
          value: `\`${interaction.client.ws.ping}ms\``,
          inline: true,
        },
        {
          name: ":hourglass: 稼働時間",
          value: `\`${formatUptime(process.uptime())}\``,
          inline: false,
        },
        {
          name: ":level_slider: コンテナ使用量",
          value: `\`${containerMemoryUsed} / ${totalMemory.toFixed(0)} MB (${containerMemoryPercentage}%)\``,
          inline: false,
        },
        {
          name: ":floppy_disk: プロセス使用量",
          value: `\`${processMemoryUsed} MB\``,
          inline: true,
        },
        {
          name: ":computer: CPU 使用率",
          value: `\`${cpuPercentage} %\``,
          inline: true,
        },
        { name: "Node.js", value: `\`${process.version}\``, inline: true },
        { name: "Discord.js", value: `\`v${djsVersion}\``, inline: true },
        { name: "OS", value: `\`${os.platform()}\``, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Powered by ${cpuCores} CPUコア` });

    // editReplyは元のflags設定を引き継ぐので、ここでflagsを再指定する必要はない
    await interaction.editReply({
      content: null,
      embeds: [embed],
      components: [deletebuttonanyone],
    });
  }, 200);
}
