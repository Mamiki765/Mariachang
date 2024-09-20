import { SlashCommandBuilder,  EmbedBuilder } from 'discord.js';
import { DominoHistory ,CurrentDomino} from '../../models/roleplay.mjs'; 

export const data = new SlashCommandBuilder()
  .setName('domino')
  .setDescription('ドミノを崩した人の履歴を見れます')

export async function execute(interaction) {
      const history = await DominoHistory.findOne();
      if (!history) {
        await interaction.reply('履歴が見つかりません。');
        return;
      }
      const currentDomino = await CurrentDomino.findOne();
       if (!currentDomino) {
      await CurrentDomino.create({ attemptNumber: 1, totalCount: 0, totalPlayers: 0 });
    }
      const sumd = history.totals.reduce((accumulator, current) => accumulator + current, 0) + currentDomino.totalCount;
      const sump = history.players.reduce((accumulator, current) => accumulator + current, 0) + currentDomino.totalPlayers;
//のドミノを崩してしまいました！\n
      let response = `現在のドミノ:第${currentDomino.attemptNumber}回 ${currentDomino.totalPlayers}人 ${currentDomino.totalCount}枚\n-# 最高記録：${history.highestRecord} 崩した人:${history.highestRecordHolder}\n-# 総ドミノ:${sumd}枚　総人数:${sump}人　虚無崩し:${history.zeroCount}回\n★直近10回のドミノゲームの履歴★\n`;
  
history.players.slice(-10).forEach((player, index) => {
  const actualIndex = history.players.length - 10 + index; // 正しいインデックスを計算
  response += `-# 第${actualIndex + 1}回:${history.totals[actualIndex]}枚 ${player}人 崩した人:${history.losers[actualIndex]}\n`;
});
  
      response += "君も「ドミノ」と発言してレッツドミノ！1d100代わりにもどうぞ";

      await interaction.reply(response);
}