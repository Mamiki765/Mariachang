import { ndnDice } from "../commands/utils/dice.mjs"

export default async(message) => {
  if (message.content.match(/ぽてと|ポテト|じゃがいも|ジャガイモ|🥔|🍟/)) {
    await message.react("🥔");
  }
  
  if (message.content.match(/^!（にゃん|にゃーん|にゃ～ん）$/)) {
    await message.reply("にゃ～ん");
  }

  if (message.content.match(/タイムアウトして/)) {
    await message.reply("６０秒封殺にゃ");
    await message.member.timeout(60 * 1000, "メッセージを送ってきたから");
  }
  
  if (message.content.match(/^!\d+d\d+$/)) {
   let command = message.content.slice(1); // 先頭の1文字目から最後までを取得
   await message.reply(ndnDice(command));
  }
};
