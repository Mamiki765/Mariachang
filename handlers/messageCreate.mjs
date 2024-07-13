import { ndnDice } from "../commands/utils/dice.mjs"

export default async(message) => {
  if (message.content.match(/ぽてと|ポテト|じゃがいも|ジャガイモ|🥔|🍟/)) {
    await message.react("🥔");
  }
//ニョワミヤでニョワミヤが出てくる等
  if (message.content.match(/^(ニョワミヤ|ﾆｮﾜﾐﾔ|ニョワミヤリカ|ﾆｮﾜﾐﾔﾘｶ)$/)) {
    //ニョワミヤ画像集
    const nyowamiya =[
      "0 https://cdn.discordapp.com/attachments/1261485824378142760/1261485856309645433/image.png?ex=669321c1&is=6691d041&hm=d66360bb898b93ca5cfb1d25e88fe7fd973723d7ee9de0a8ccf63a0789cb6892&"
      ,"1 https://cdn.discordapp.com/attachments/1261485824378142760/1261486872870518784/IMG_5649.png?ex=669322b3&is=6691d133&hm=1e0780eb1e40e5032833bf1d8ba0db2b6491a5fefd2ddf200042fedcea2117c8&"
      ,"2　ハズレ（テスト用）"
    ];
    //ニョワミヤ画像からランダムで排出（いるかこの機能？）
   await message.reply({
    flags: [ 4096 ],//@silentになる
    content: nyowamiya[Math.floor(Math.random() * nyowamiya.length)]
  });
  }
  if (message.content.match(/^(ゆづさや)$/)) {
   await message.reply({
      flags: [ 4096 ],//@silentになる
      content: "https://media.discordapp.net/attachments/1025416223724404766/1122185542252105738/megamoji.gif?ex=668cad7a&is=668b5bfa&hm=5c970ab0422c8731d0471ab1d65663b76ae6fd8fb47192481bdbbdadcd792675&"
  });
  }
  if (message.content.match(/^(ゆゔさや|ゆヴさや|ゆずさや)$/)) {
    await message.reply({
     flags: [ 4096 ],//@silentになる
      content: "https://media.discordapp.net/attachments/1040261246538223637/1175700688219672587/megamoji_4.gif?ex=668ce817&is=668b9697&hm=e26e24e90dc3bd6606255aaefd4f7ad91118f1d8cc5a6be8f48013b7ca2fa58a&"
  });
  } 
//画像いたずら系ここまで
  

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
//ダイスロール
  if (message.content.match(/^!\d+d\d+$/)) {
   let command = message.content.slice(1); // 先頭の1文字目から最後までを取得
   await message.reply({
     flags: [ 4096 ],//silent
     content: ndnDice(command)});
  }

};
