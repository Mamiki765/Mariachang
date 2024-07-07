import { ndnDice } from "../commands/utils/dice.mjs"

export default async(message) => {
  if (message.content.match(/ぽてと|ポテト|じゃがいも|ジャガイモ|🥔|🍟/)) {
    await message.react("🥔");
  }
  
  if (message.content.match(/にゃん|にゃーん|にゃ～ん/)) {
    await message.reply("にゃ～ん", silent=True);
  }
  
  if (message.content.match(/^\d+d\d+$/)) {
    await message.reply('@silent ' + ndnDice(message.content));
  }
};
