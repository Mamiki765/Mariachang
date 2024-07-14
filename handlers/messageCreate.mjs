import { ndnDice } from "../commands/utils/dice.mjs"

export default async(message) => {
  if (message.content.match(/ぽてと|ポテト|じゃがいも|ジャガイモ|🥔|🍟/)) {
    await message.react("🥔");
  }
//ニョワミヤでニョワミヤが出てくる等
  //ニョワミヤ
  if (message.content.match(/^(ニョワミヤ|ﾆｮﾜﾐﾔ|ニョワミヤリカ|ﾆｮﾜﾐﾔﾘｶ)$/)) {
    //ニョワミヤ画像集
    const nyowamiya =[
      "https://cdn.discordapp.com/attachments/1261485824378142760/1261485856309645433/image.png?ex=669321c1&is=6691d041&hm=d66360bb898b93ca5cfb1d25e88fe7fd973723d7ee9de0a8ccf63a0789cb6892&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261486872870518784/IMG_5649.png?ex=669322b3&is=6691d133&hm=1e0780eb1e40e5032833bf1d8ba0db2b6491a5fefd2ddf200042fedcea2117c8&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261488516198568016/image.png?ex=6693243b&is=6691d2bb&hm=1d4a93a936f14e0694d112c707a9079a764108deb1ac9ef704c5ec8dbeb60d33&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261489905796907119/IMG_5445.png?ex=66932586&is=6691d406&hm=e70733ef25ef2403ddf2dd9e22b8d081d93b70a3ad96d5e239abd48c6a7131de&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261600905535688746/toruchan14.gif?ex=66938ce7&is=66923b67&hm=4b9b9a46e6c39790321f1c80a35974f5c72cff9d14213f9a4d0c53359606bd64&"
    ];
    //ニョワミヤ画像からランダムで排出（いるかこの機能？）
   await message.reply({
    flags: [ 4096 ],//@silentになる
    content: nyowamiya[Math.floor(Math.random() * nyowamiya.length)]
  });
  }
  //トールちゃん
  if (message.content.match(/^(トール＝チャン|トール=チャン|トール＝ちゃん|トール=ちゃん)$/)) {
    //トールチャン画像集
    const toruchan =[
      "https://cdn.discordapp.com/attachments/1261485824378142760/1261589766349258754/image.png?ex=66938287&is=66923107&hm=4d51f1d59f8ee9ed94415e369f852822ef83c94695446b95c373054241f19512&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261590010105298944/image.png?ex=669382c1&is=66923141&hm=745d160c25dabdbb2deb086dde9afe5d0803d0792376756efeab99025201fe99&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261590443305603104/image.png?ex=66938328&is=669231a8&hm=399f2fd3d536fb1dfeab8baec708fa8ca4c0f632f947cefce60abadc48987ef3&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261488516198568016/image.png?ex=6693243b&is=6691d2bb&hm=1d4a93a936f14e0694d112c707a9079a764108deb1ac9ef704c5ec8dbeb60d33&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261600826175131698/toruchan15.gif?ex=66938cd4&is=66923b54&hm=8ba6656b1284670750104a28844c1d42a8e6dbed7bb73c88d1bf858eeb3cd915&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261600905535688746/toruchan14.gif?ex=66938ce7&is=66923b67&hm=4b9b9a46e6c39790321f1c80a35974f5c72cff9d14213f9a4d0c53359606bd64&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261601020111487047/toruchan13.gif?ex=66938d02&is=66923b82&hm=6070be605f87c301d52e468baf716ee01bb9fe2a8361e9946fcec4a94c9ccb3c&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261601144996761600/toruchan12.gif?ex=66938d20&is=66923ba0&hm=738f447e1d9bb9f8ea1e76172e30d06d7b5e2a007ea6a53c27b10246a48453e7&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261601217507889233/toruchan11.gif?ex=66938d31&is=66923bb1&hm=b731408abac90d5ca273bfc0a6f30c5e195e9de2b786ffeb16fa2ff1eb08c33a&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261601272059134043/toruchan10.gif?ex=66938d3e&is=66923bbe&hm=8adc5bd1e133b6bba0d346649ee8d69eeb5f29f8e3fc7767f339ee2cb0560ac1&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261601319370887178/toruchan09.png?ex=66938d49&is=66923bc9&hm=b243c24eae63f29e27d1d82b5ac6d20a0cfbd83d2b4581c5835c591d9097b006&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261601377227116574/toruchan08.png?ex=66938d57&is=66923bd7&hm=8f868a54753c1c9bdb6cd2a184d2aa50415e080d1c996e09693de01bdee1f531&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261601438061035593/toruchan07.png?ex=66938d66&is=66923be6&hm=fae6984ff7eaf66d3a3cea26c2e17b1e810632319df8fd0fe4c33fb968f64dc1&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261601484068622376/toruchan06.png?ex=66938d71&is=66923bf1&hm=4557921994f9111851e3a51e153bf6fbc9d8ce4188bb1dc84237cdc562d6d84a&"
      ,"https://cdn.discordapp.com/attachments/1261485824378142760/1261601572861902920/toruchan05.png?ex=66938d86&is=66923c06&hm=4edf88910d4465e28d3f7106c9f6c7924c738713e6e6c7377c0f4d4d03e2169c&"
      ,"https://media.discordapp.net/attachments/1261485824378142760/1261733236854489179/04e2d3bf0a8ddf8f.png?ex=66940825&is=6692b6a5&hm=8d55f49f74919b64e67000cc88edd9783c4080aa2a54d104192c826a37644567&"
    ];
   await message.reply({
    flags: [ 4096 ],//@silentになる
    content: toruchan[Math.floor(Math.random() * toruchan.length)]
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


  if (message.content.match(/^(今何時？|いまなんじ？|今日何日？|きょう何日？|ほったいも)$/)) {
    const date = new Date();
    const nanjimonth = date.getMonth()+1;
    const masiroyear = date.getFullYear()+28;
    const nanjidate = date.getFullYear() +"年" + nanjimonth +"月" +date.getDate() + "日" + date.getHours() +"時"+date.getMinutes() +"分"+date.getSeconds()+"秒";
    await message.reply(`${nanjidate}ですにゃ。\nマシロ市は${masiroyear}年ですにゃ。`);
//    await message.member.timeout(60 * 1000, "「タイムアウトして」により");
  }

//ダイスロール
  if (message.content.match(/^!\d+d\d+$/)) {
   let command = message.content.slice(1); // 先頭の1文字目から最後までを取得
   await message.reply({
     flags: [ 4096 ],//silent
     content: ndnDice(command)});
  }

};
