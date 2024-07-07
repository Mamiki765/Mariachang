import { ndnDice } from "../commands/utils/dice.mjs"

export default async(message) => {
  if (message.content.match(/ぽてと|ポテト|じゃがいも|ジャガイモ|🥔|🍟/)) {
    await message.react("🥔");
  }
//ニョワミヤでニョワミヤが出てくる
  if (message.content.match(/^(ニョワミヤ|ﾆｮﾜﾐﾔ|ニョワミヤリカ|ﾆｮﾜﾐﾔﾘｶ)$/)) {
    await message.reply({
      flags: [ 4096 ],//@silentになる
      content: "https://cdn.discordapp.com/attachments/1025416223724404766/1110586574598570094/image.png?ex=668c0259&is=668ab0d9&hm=fa9f6ffa7cb5a3641a7334129abe2a2a1af83e90bb6a06a983cf27e6bbca3bf4&"
  });
  }
//ここからステシ変換
  //ロスアカ
    if (message.content.match(/^r2[pn][0-9][0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content : "https://rev2.reversion.jp/character/detail/" + message.content         
      });
  }
  //PPP
    if (message.content.match(/^p3[pnxy][0-9][0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content: "https://rev1.reversion.jp/character/detail/" + message.content
    });
  }
  //第六
    if (message.content.match(/^f[0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content: "https://tw6.jp/character/status/" + message.content});
    }
  //チェンパラ
    if (message.content.match(/^g[0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content: "https://tw7.t-walker.jp/character/status/" + message.content});
    }
  //ケルブレ
    if (message.content.match(/^e[0-9n][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content: "http://tw5.jp/character/status/" + message.content});
    }
  //サイハ
  　 if (message.content.match(/^d[0-9n][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content:"http://tw4.jp/character/status/" + message.content
    });
    }
//ステシ変換ここまで
  
//　　if (message.content === "\?にゃん" || "\?にゃーん" || "\?にゃ～ん"){   
  if (message.content.match(/^(!にゃん|!にゃーん|にゃ～ん|にゃあん)$/)) {
    await message.reply({flags: [ 4096 ], content: "にゃ～ん"});
  }

//  if (message.content.match(/^タイムアウトして$/)) {
//    await message.reply("６０秒封殺にゃ");
//    await message.member.timeout(60 * 1000, "「タイムアウトして」により");
//  }
  
  if (message.content.match(/^!\d+d\d+$/)) {
   let command = message.content.slice(1); // 先頭の1文字目から最後までを取得
   await message.reply({
     flags: [ 4096 ],//silent
     content: ndnDice(command)});
  }
};
