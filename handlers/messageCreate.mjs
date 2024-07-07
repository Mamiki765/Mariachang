import { ndnDice } from "../commands/utils/dice.mjs"

export default async(message) => {
  if (message.content.match(/ぽてと|ポテト|じゃがいも|ジャガイモ|🥔|🍟/)) {
    await message.react("🥔");
  }

  if (message.content.match(/^(ニョワミヤ|ﾆｮﾜﾐﾔ|ニョワミヤリカ|ﾆｮﾜﾐﾔﾘｶ)$/)) {
    await message.reply("https://cdn.discordapp.com/attachments/1025416223724404766/1110586574598570094/image.png?ex=668c0259&is=668ab0d9&hm=fa9f6ffa7cb5a3641a7334129abe2a2a1af83e90bb6a06a983cf27e6bbca3bf4&");
  }

    if (message.content.match(/r2p\d{6}/)) {
    await message.reply("https://rev2.reversion.jp/character/detail/" + message.content);
  }
  
//　　if (message.content === "\?にゃん" || "\?にゃーん" || "\?にゃ～ん"){   
//    await message.reply("にゃ～ん");
//  }

  if (message.content.match(/タイムアウトして/)) {
    await message.reply("６０秒封殺にゃ");
    await message.member.timeout(60 * 1000, "メッセージを送ってきたから");
  }
  
  if (message.content.match(/^!\d+d\d+$/)) {
   let command = message.content.slice(1); // 先頭の1文字目から最後までを取得
   await message.reply(ndnDice(command));
  }
};
