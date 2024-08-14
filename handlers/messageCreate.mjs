import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import fs from "fs";

import { ndnDice } from "../commands/utils/dice.mjs"
import {getWebhookInChannel , getWebhook} from "../models/webhook.mjs"

  //削除ボタン（なにかとつかう）
    const deletebutton = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
             .setEmoji('🗑️')
             .setLabel("削除")
             .setStyle(ButtonStyle.Danger)
             .setCustomId("delete")
                    )

export default async(message) => {

  //リアクション
  if (message.content.match(/ぽてと|ポテト|じゃがいも|ジャガイモ|🥔|🍟/)) {
    await message.react("🥔");
  }
  if (message.content.match(/にょわ|ニョワ|ﾆｮﾜ|nyowa/)) {
    await message.react('1264010111970574408');
  }
  if (message.content.match(/ミョミョミョワァァーン|ﾐｮﾐｮﾐｮﾜｧｧｰﾝ/)) {
    await message.react('1264883879794315407');
  }  else if (message.content.match(/ミョミョミョ|ﾐｮﾐｮﾐｮ/)) {
    await message.reply({
      flags: [ 4096 ],//@silentになる
      content: "ちょっと違うかニャ…"
      });
  }
  if (message.content.match(/(^(こころ|ココロ|心)…*$|ココロ…|ココロー！)/)) {
    if(Math.floor(Math.random() * 100) < 1){ //0-99 1%で大当たり　ココロー！
      await message.react('1265162645330464898'); await message.react('1265165857445908542');
      await message.react('1265165940824215583'); await message.react('1265166237399388242');
      await message.react('1265166293464518666'); await message.react("‼️");
    }else{
      const toruchan =['1264756212994674739','1265162812758687754'
                       ,'1265163072016879636','1265163139637317673'
                       ,'1265163377538236476'];
      await message.react(toruchan[Math.floor(Math.random() * toruchan.length)]);
    }
  }
  //リアクションここまで
//ニョワミヤでニョワミヤが出てくる等画像いたずら系
  //ニョワミヤ（いるかこの機能？）
  else if (message.content.match(/^(ニョワミヤ|ﾆｮﾜﾐﾔ|ニョワミヤリカ|ﾆｮﾜﾐﾔﾘｶ)$/)) {
    //ニョワミヤ画像集をロード
    const nyowa = fs.readFileSync("./database/nyowamiyarika.txt", 'utf8');
    const nyowamiya = nyowa.split(/\n/);
    //ランダムで排出
     await message.reply({
      flags: [ 4096 ],//@silentになる
      content: nyowamiya[Math.floor(Math.random() * nyowamiya.length)]
      });
  }
  //トールちゃん
  else if (message.content.match(/^(トール|とーる|ﾄｰﾙ|姫子|ひめこ|ヒメコ|ﾋﾒｺ)[=＝](ちゃん|チャン|ﾁｬﾝ)$/)) {
    //トールチャン画像集
    const toru = fs.readFileSync("./database/toruchan.txt", 'utf8');
    const toruchan = toru.split(/\n/);
     await message.reply({
      flags: [ 4096 ],//@silentになる
      content: toruchan[Math.floor(Math.random() * toruchan.length)]
      });
  }  
  else if (message.content.match(/^(ゆづさや)$/)) {
   await message.reply({
      flags: [ 4096 ],//@silentになる
      content: "https://media.discordapp.net/attachments/1025416223724404766/1122185542252105738/megamoji.gif?ex=668cad7a&is=668b5bfa&hm=5c970ab0422c8731d0471ab1d65663b76ae6fd8fb47192481bdbbdadcd792675&"
  });
  }
  else if (message.content.match(/^(ゆゔさや|ゆヴさや|ゆずさや)$/)) {
    await message.reply({
     flags: [ 4096 ],//@silentになる
      content: "https://media.discordapp.net/attachments/1040261246538223637/1175700688219672587/megamoji_4.gif?ex=668ce817&is=668b9697&hm=e26e24e90dc3bd6606255aaefd4f7ad91118f1d8cc5a6be8f48013b7ca2fa58a&"
  });
  } 
  else if (message.content.match(/^(結月 沙耶|結月沙耶|ゆづきさや)$/)) {
    await message.reply({
     flags: [ 4096 ],//@silentになる
      content: "https://rev1.reversion.jp/character/detail/p3p009126"
  });
  } 
  else if (message.content.match(/^(てんこ)$/)) {
   await message.reply({
      flags: [ 4096 ],//@silentになる
      content: "https://cdn.discordapp.com/attachments/1261485824378142760/1272199248297070632/megamoji_4.gif?ex=66ba1b61&is=66b8c9e1&hm=981808c1aa6e48d88ec48712ca268fc5b772fba5440454f144075267e84e7edf&"
  });
  }
  else if (message.content.match(/^(ゆ.さや)$/)) {
    await message.reply({
     flags: [ 4096 ],//@silentになる
      content: "https://cdn.discordapp.com/attachments/1261485824378142760/1263261822757109770/IMG_2395.gif?ex=669997c0&is=66984640&hm=a12e30f8b9d71ffc61ab35cfa095a8b7f7a08d04988f7b33f06437b13e6ee324&"
  });
  } 

//画像いたずら系ここまで
  

//ここからステシ変換
  //ロスアカ
    else if (message.content.match(/^r2[pn][0-9][0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content : "https://rev2.reversion.jp/character/detail/" + message.content
      });
  }
  //PPP
    else if (message.content.match(/^p3[pnxy][0-9][0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content: "https://rev1.reversion.jp/character/detail/" + message.content
    });
  }
  //第六
    else if (message.content.match(/^f[0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content: "https://tw6.jp/character/status/" + message.content
      });
    }
  //チェンパラ
    else if (message.content.match(/^g[0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content: "https://tw7.t-walker.jp/character/status/" + message.content
      });
    }
  //ケルブレ
    else if (message.content.match(/^e[0-9n][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [ 4096 ],//@silent
      content: "http://tw5.jp/character/status/" + message.content
      });
    }
  //サイハ
  　 else if (message.content.match(/^d[0-9n][0-9][0-9][0-9][0-9]$/)) {
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

//ほったいも
  else if (message.content.match(/^((今|いま)(何時|なんじ)？*|(今日|きょう)(何日|なんにち)？*|ほったいも？*)$/)) {
    const date = new Date();
    const nanjimonth = date.getMonth()+1;
    const masiroyear = date.getFullYear()+28;
    const nanjidate = date.getFullYear() +"年" + nanjimonth +"月" +date.getDate() + "日" + date.getHours() +"時"+date.getMinutes() +"分"+date.getSeconds()+"秒";
    await message.reply(`${nanjidate}ですにゃ。\nマシロ市は${masiroyear}年ですにゃ。`);
  }

//ダイスロール
  else if (message.content.match(/^!(\d+)d(\d+)([+-]\d+)?$/)) {
   let command = message.content.slice(1); // 先頭の1文字目から最後までを取得
   await message.reply({
     flags: [ 4096 ],//silent
     content: ndnDice(command)});
  }
  //ダイスロール
  else if (message.content.match(/^(ねこど|ひとど)$/)) {
   let command = "1d100"; 
   await message.reply({
     flags: [ 4096 ],//silent
     content: ndnDice(command)});
  }
  //X、メッセージリンクを処理
  //両方あったらXを優先
    if (message.content.match(/https:\/\/(twitter\.com|x\.com)\/[^/]+\/status\/\d+\/?(\?.*)?/)) {
    const updatedMessage = message.content
        .replace(/https:\/\/twitter\.com/g, 'https://fxtwitter.com')
        .replace(/https:\/\/x\.com/g, 'https://fixupx.com');
    const fileUrls = message.attachments.map(attachment => attachment.url);
    await sendMessage(message ,updatedMessage, fileUrls , null, 4096 )
    await message.delete();//元メッセージは消す
    }
  //メッセージから内容チラ見せ
  else if (message.content.match(/https?:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/)) {
    if (!message.guild) {return;}//dmなら無視
        //メッセージのURLを確認する正規表現
    const MESSAGE_URL_REGEX = /https?:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
 
    const matches = MESSAGE_URL_REGEX.exec(message.content);
    if (matches) {
    const [fullMatch, guildId, channelId, messageId] = matches;
    if(guildId !== message.guild.id) {return;}//現在のギルドと異なるURLは無視
    try{
      const channel = await message.guild.channels.fetch(channelId);
      const fetchedMessage = await channel.messages.fetch(messageId);
      //    await console.log(channel);
      //await console.log(fetchedMessage);
      if(!fetchedMessage){return;}//無を取得したらエラーになるはずだが念の為
      //以下、プレビューを表示しない様にする処理、ただし同じチャンネル内であれば通す
      // プレビューを表示しない様にする処理
      //プライベートスレッド(type12)ではないか
      if (channel.isThread() && channel.type === 12 && message.channel.id !== channel.id) return;
      //NSFW→健全を避ける(カテゴリ無しのチャンネルが有るときはparentの存在を先にifで探ること)
      if ((channel.parent.nsfw || channel.nsfw) && !(message.channel.parent.nsfw || message.channel.nsfw)) return;
      //クリエイターチャンネルや管理人室は他のチャンネルに転載禁止
      if ((channel.parentId === `1128492964939833375` || channel.parentId === `1075366548329467964`) && message.channel.id !== channel.id) return;
      
      // メッセージから画像URLを取得
      const images = await getImagesFromMessage(fetchedMessage);
      const files = fetchedMessage.attachments.map(attachment => attachment.url).join('\n');
      let sendmessage = files ? fetchedMessage.content + `\n` + files : fetchedMessage.content;
      
      //スタンプのときは
      if (fetchedMessage.stickers && fetchedMessage.stickers.size > 0) {
        const firstSticker = fetchedMessage.stickers.first();
        sendmessage += "スタンプ：" + firstSticker.name;
        images.unshift(firstSticker.url);
      }
      // Embedを作成
      const embeds = [];
      const embed = createEmbed(fullMatch, '引用元へ', sendmessage, fetchedMessage.author, images[0], fetchedMessage.createdAt, '#0099ff','神谷マリアの提供でお送りしますにゃ！');
      embeds.push(embed);

      if (images.length > 1) {
        for (let i = 1; i < images.length; i++) {
          const imageEmbed = createEmbed(fullMatch, null, null, { displayName: null, displayAvatarURL: () =>null }, images[i], fetchedMessage.createdAt, '#0099ff',null);
          embeds.push(imageEmbed);
        }
      }
      // 返信があれば同じ様に
      if (fetchedMessage.reference) {
        const refMessage = await channel.messages.fetch(fetchedMessage.reference.messageId);
        if (refMessage) {
          //URLは返信先に
          const refMatch = `https://discord.com/channels/${guildId}/${channelId}/${fetchedMessage.reference.messageId}`;
          const refImages = await getImagesFromMessage(refMessage);
          let refSendMessage = refMessage.attachments.map(attachment => attachment.url).join('\n') ? refMessage.content + `\n` + refMessage.attachments.map(attachment => attachment.url).join('\n') : refMessage.content;
          if (refMessage.stickers && refMessage.stickers.size > 0) {
            const refFirstSticker = refMessage.stickers.first();
            refSendMessage += "スタンプ：" + refFirstSticker.name;
            refImages.unshift(refFirstSticker.url);
          }
          const refEmbed = createEmbed(refMatch, '引用元の返信先', refSendMessage, refMessage.author, refImages[0], refMessage.createdAt, '#B78CFE',null);
          embeds.push(refEmbed);

          if (refImages.length > 1) {
            for (let i = 1; i < refImages.length; i++) {
              const refImageEmbed = createEmbed(refMatch, null, null, { displayName: null, displayAvatarURL: () => null }, refImages[i], refMessage.createdAt, '#B78CFE',null);
              embeds.push(refImageEmbed);
            }
          }
        }
      }
//返信部分ここまで

      // 返信するメッセージを作成
      const fileUrls = message.attachments.map(attachment => attachment.url);
      let newmessage = message.content;
      const regex = new RegExp(fullMatch, 'i');
      newmessage = newmessage.replace(regex, `**（変換済み)**`);
      if(newmessage == `**（変換済み)**`) newmessage = "";//URLだけなら消す
//メッセージを送信する
      await sendMessage(message ,newmessage, fileUrls , embeds, 4096 )
      await message.delete(); // 元メッセージは消す
    } catch (error) {
            console.error('Error fetching message:', error);
            message.reply({content: 'メッセージを取得できませんでした。', ephemeral : true});
        }
    }
  }


};

// Embedを作成する関数(引用用)
export function createEmbed(url, title, description, author, imageUrl, timestamp, color,footertxt) {
  return new EmbedBuilder()
    .setURL(url)
    .setTitle(title)
    .setDescription(description || '(botのメッセージです)')
    .setAuthor({
      name: author.displayName,
      iconURL: author.displayAvatarURL(),
    })
    .setImage(imageUrl)
    .setTimestamp(timestamp)
    .setColor(color)
    .setFooter({text: footertxt})

;}

// メッセージから画像URLを取得する関数（引用用）
export async function getImagesFromMessage(message) {
  const imageUrlRegex = /https:\/\/[^\s]+?\.(png|jpg|jpeg|gif|webp)(?:\?[^\s]*)?/gi;
  // 添付ファイルを並べ、画像ファイルを取得
  const fileUrls = message.attachments.map(attachment => attachment.url);
  let images = fileUrls.filter(url => url.match(/\.(png|jpg|jpeg|gif|webp)(?:\?[^\s]*)?$/i));

  // メッセージ内の全ての画像URLを取得
  const imgMatches = message.content.matchAll(imageUrlRegex);
  const imageUrls = [...imgMatches].map(match => match[0]);
  
  // `images` 配列の末尾に `imageUrls` 配列を追加する
  images = [...images, ...imageUrls];

  // 画像が5個以上の場合は先頭4つだけを残す
  if (images.length > 5) images = images.slice(0, 4);

  return images;
}

//メッセージ送信系
export async function sendMessage(message , newmessage, fileUrls ,embeds, flag) {
   //本人に見せかけてメッセージを送信するスクリプト
   //メッセージ発信者の名前とアバターURL
   const nickname = message.member.displayName;
   const avatarURL = message.author.displayAvatarURL({dynamic : true});
   //Webhookの取得（なければ作成する）
  let webhook = null;
  let Threadid = null;
  //スレッドであるかチェックし、スレッドならチャンネルのwebhookを用いてスレッドに投稿する形を取る
  if(!message.channel.isThread()){
    webhook = await getWebhookInChannel(message.channel);
  }else{
    webhook = await getWebhookInChannel(message.channel.parent);
    Threadid = message.channel.id
  }
   //メッセージ送信（今回は受け取ったものをそのまま送信）
   //usernameとavatarURLをメッセージ発信者のものに指定するのがミソ
   //元メッセージの返信があるかチェック
   let replyToMessage = null;
   if(message.reference){
   replyToMessage = message.reference.messageId ? await message.channel.messages.fetch(message.reference.messageId) : null;
   }
//返信ならwebhookを用いず
  if (replyToMessage) {
    await replyToMessage.reply({
      content: `<@${message.author.id}>:\n${newmessage}`,
      files: fileUrls,
      embeds: embeds,
      flags: [4096],
      threadId:Threadid ,
      components: [deletebutton]
       });
    }else{
//元メッセージが返信でない場合
  try{
   webhook.send({
    content: `<@${message.author.id}>:\n${newmessage}`,
    files: fileUrls,
    embeds: embeds,
    flags: [flag],
    components: [deletebutton],
     username : nickname,
     threadId:Threadid ,
     avatarURL : avatarURL,
   });
  }catch(e){
   message.channel.send({
    content: `<@${message.author.id}>:\n${newmessage}`,
    files: fileUrls,
    embeds: embeds,
    flags: [flag],
    components: [deletebutton]
      });
    console.error('Error fetching message:', e);
  }
 }
}
