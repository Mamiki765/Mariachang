import { SlashCommandBuilder,  EmbedBuilder } from 'discord.js';
import { DominoHistory ,CurrentDomino} from '../../models/roleplay.mjs'; 
import config from '../../config.mjs'; 

export const data = new SlashCommandBuilder()
  .setName('domino')
  .setDescription('ドミノを崩した人の履歴を見れます')
  .addIntegerOption(option =>
    option
      .setName('index')
      .setDescription('指定回数から10回分の履歴を閲覧できます（空白で最新５回）')
      .setMinValue(1)
  );

export async function execute(interaction) {
      const indexOption = interaction.options.getInteger('index') || null;
      const history = await DominoHistory.findOne();
        if (!history) {
          await interaction.reply('履歴が見つかりません。');
          return;
        }
      let response = null;
      if(!indexOption){
      //index指定がない時、統計データ＋最近５回
        const currentDomino = await CurrentDomino.findOne();
         if (!currentDomino) {
        await CurrentDomino.create({ attemptNumber: 1, totalCount: 0, totalPlayers: 0 });
      }
        //ドミノの枚数と並べた回数の合計
        const sumd = history.totals.reduce((accumulator, current) => accumulator + current, 0) + currentDomino.totalCount;
        const sump = history.players.reduce((accumulator, current) => accumulator + current, 0) + currentDomino.totalPlayers;
        //コンマを入れる
        const formattedsumd = new Intl.NumberFormat('ja-JP').format(sumd);
        const formattedsump = new Intl.NumberFormat('ja-JP').format(sump);
        //出力
        response = `現在のドミノ:第${currentDomino.attemptNumber}回 ${currentDomino.totalPlayers}人 ${currentDomino.totalCount}枚\n-# 最高記録：${history.highestRecord}枚 崩した人:${escapeDiscordText(history.highestRecordHolder)}\n-# 総ドミノ:${formattedsumd}枚　総人数:${formattedsump}人　虚無崩し(0枚):${history.zeroCount}回\n★直近5回のドミノゲームの履歴★\n`;
        history.players.slice(-5).forEach((player, index) => {
        const actualIndex = history.players.length - 5 + index; // 正しいインデックスを計算
        response += `-# 第${actualIndex + 1}回:${history.totals[actualIndex]}枚 ${player}人 崩した人:${history.losers[actualIndex]}\n`;
      });
/*
期間限定崩した人ランキング
*/       
        // 崩した人の回数をカウント
        const loserCount = {};
        history.losers.forEach(loser => {
        if (loserCount[loser]) {
          loserCount[loser]++;
          } else {
          loserCount[loser] = 1;
        }
        });
        // 上位5位を取得
        const sortedLosers = Object.entries(loserCount)
          .sort((a, b) => b[1] - a[1]) // 回数で降順ソート
          .slice(0, 5); // 上位5位を取得
        // 上位5位をレスポンスに追加
        response += "★崩した人上位5位★\n";
        sortedLosers.forEach(([player, count], index) => {
        response += `-# ${index + 1}位: ${escapeDiscordText(player)} (${count}回)\n`;
        }); 
        
//        response += "君も「ドミノ」と発言してレッツドミノ！1d100代わりにもどうぞ";
      }else{//指定あるとき
      // 指定したインデックスから10個取得
        const startIndex = indexOption - 1;
        const endIndex = Math.min(startIndex + 10, history.players.length); // 最大インデックスを超えないように
        response = `★第${indexOption}回から10回分のドミノゲームの履歴★\n`;
        for (let i = startIndex; i < endIndex; i++) {
          response += `-# 第${i + 1}回:${history.totals[i]}枚 ${history.players[i]}人 崩した人:${escapeDiscordText(history.losers[i])}\n`;
        }
      }

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
            await dominochannel.send({flags: [ 4096 ],content:`# 100　<@${id}>は${currentDomino.totalPlayers}人が並べた${currentDomino.totalCount}枚のドミノを崩してしまいました！\n${currentDomino.attemptNumber}回目の開催は終わり、${escapeDiscordText(username)}の名が刻まれました。`});

            const history = await DominoHistory.findOne();
            //保存
            if (!history) {
               await DominoHistory.create({ highestRecord:0,highestRecordHolder: null,zeroCount: 0, players:[],totals:[],losers:[]});
            }
                if(currentDomino.totalCount === 0){
                  await history.increment('zeroCount');
                  await dominochannel.send({flags: [ 4096 ],content:`# __★★【特別賞】0枚で終わった回数：${history.zeroCount}回目__`});
                }
              // 最高記録の更新
                 if (currentDomino.totalCount > history.highestRecord) {
                    await history.update({
                        highestRecord: currentDomino.totalCount,
                        highestRecordHolder: username,
                    });
                    await dominochannel.send({flags: [ 4096 ],content:`# __★★【新記録】${currentDomino.totalCount}枚★★__`});
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
          if(message.channel.id !== config.dominoch){
            const replyMessage = await message.reply({flags: [4096],content: `ドミドミ…Take${currentDomino.totalPlayers + 1}:${currentDomino.totalCount + randomNum}枚`
});
            setTimeout(() => {
              replyMessage.delete();
              }, 5000);
          }
        }
  }

// エスケープ処理のサブルーチン（例 hoge_fuga_がhogefuga(fugaが斜体)にならないように
function escapeDiscordText(text) {
  return text.replace(/([_*`])/g, '\\$1'); // 特殊文字をエスケープ
}
