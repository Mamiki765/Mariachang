import { SlashCommandBuilder,  EmbedBuilder } from 'discord.js';
import { DominoHistory ,CurrentDomino} from '../../models/roleplay.mjs'; 
import config from '../../config.mjs'; 

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
      let response = `現在のドミノ:第${currentDomino.attemptNumber}回 ${currentDomino.totalPlayers}人 ${currentDomino.totalCount}枚\n-# 最高記録：${history.highestRecord} 崩した人:${history.highestRecordHolder}\n-# 総ドミノ:${sumd}枚　総人数:${sump}人　虚無崩し:${history.zeroCount}回\n★直近5回のドミノゲームの履歴★\n`;
  
history.players.slice(-5).forEach((player, index) => {
  const actualIndex = history.players.length - 5 + index; // 正しいインデックスを計算
  response += `-# 第${actualIndex + 1}回:${history.totals[actualIndex]}枚 ${player}人 崩した人:${history.losers[actualIndex]}\n`;
});
  
      response += "君も「ドミノ」と発言してレッツドミノ！1d100代わりにもどうぞ";

      await interaction.reply(response);
}

//メッセージ、クライアント
export async function dominoeffect(message,client,id,username,dpname){
    const randomNum = Math.floor(Math.random() * 100);
    // 十の桁と一の桁を取得
    const tens = Math.floor(randomNum / 10); // 十の桁
    const ones = randomNum % 10; // 一の桁
    // サイコロのリアクションを取得
    const redResult = config.reddice[tens]; 
    const blueResult = config.bluedice[ones];
    await message.react(redResult);
    await message.react(blueResult);
    //ログ送信チャンネルを選択
    const dominochannel = client.channels.cache.get(config.dominoch);
    
    const currentDomino = await CurrentDomino.findOne();
    if (!currentDomino) {
      await CurrentDomino.create({ attemptNumber: 1, totalCount: 0, totalPlayers: 0 });
    }
    if (randomNum === 0) {//ガシャーン！
      await message.react("💥");
            await dominochannel.send({flags: [ 4096 ],content:`# 100　<@${id}>は${currentDomino.totalPlayers}人が並べた${currentDomino.totalCount}枚のドミノを崩してしまいました！\n${currentDomino.attemptNumber}回目の開催は終わり、${username}の名が刻まれました。`});

            const history = await DominoHistory.findOne();
            //保存
            if (!history) {
               await DominoHistory.create({ highestRecord:0,highestRecordHolder: null,zeroCount: 0, players:[],totals:[],losers:[]});
            }
                if(currentDomino.totalCount === 0){
                  await history.increment('zeroCount');
                  await dominochannel.send({flags: [ 4096 ],content:`【特別賞】0枚で終わった回数：${history.zeroCount}回目`});
                }
              // 最高記録の更新
                 if (currentDomino.totalCount > history.highestRecord) {
                    await history.update({
                        highestRecord: currentDomino.totalCount,
                        highestRecordHolder: username,
                    });
                    await dominochannel.send({flags: [ 4096 ],content:`【特別賞】新記録：${currentDomino.totalCount}枚`});
                }
              //保存
                await history.update({
                    players: [...history.players, currentDomino.totalPlayers],
                    totals: [...history.totals, currentDomino.totalCount],
                    losers: [...history.losers, username]
                });

            await CurrentDomino.update({ attemptNumber: currentDomino.attemptNumber + 1 , totalCount: 0,  totalPlayers: 0 }, { where: {} });
            const replyMessage = await message.reply({flags: [4096],content: `# ガッシャーン！`
});
            setTimeout(() => {
              replyMessage.delete();
              }, 5000);
        }else {//セーフ
          const  dpplayer = String(currentDomino.totalPlayers + 1).padStart(4, '0');
            await dominochannel.send({flags: [ 4096 ],content:`Take${dpplayer}:${dpname}が${randomNum}枚ドミノを並べました。現在:${currentDomino.totalCount + randomNum}枚`});
            await CurrentDomino.update({ totalCount: currentDomino.totalCount + randomNum, totalPlayers: currentDomino.totalPlayers + 1 }, { where: {} });
          //5秒後に消える奴
            const replyMessage = await message.reply({flags: [4096],content: `ドミドミ…Take${currentDomino.totalPlayers + 1}:${currentDomino.totalCount + randomNum}枚`
});
            setTimeout(() => {
              replyMessage.delete();
              }, 5000);
        }
  }