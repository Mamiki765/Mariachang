import { SlashCommandBuilder,  EmbedBuilder } from 'discord.js';
import { DominoHistory } from '../../models/roleplay.mjs'; 

export const data = new SlashCommandBuilder()
  .setName('domino')
  .setDescription('ドミノ、それは己を振り返る事')

export async function execute(interaction) {
      const history = await DominoHistory.findOne();

      if (!history) {
        await interaction.reply('履歴が見つかりません。');
        return;
      }

      let response = `★直近10回のドミノゲームの履歴★\n 最高記録：${history.highestRecord} 崩した人:${history.highestRecordHolder} 虚無崩しの回数:${history.zeroCount}回\n`;

      history.players.slice(-10).forEach((player, index) => {
        response += `-# 第${index + 1}回:${history.totals[index]}枚 ${player}人 崩した人:${history.losers[index]}\n`;
      });

      await interaction.reply(response);
}