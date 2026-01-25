// handlers\messageReactionAdd.mjs
import { EmbedBuilder } from "discord.js";
import { safeDelete } from "../utils/messageutil.mjs";

// 260125ひまわり配布用のMapを定義してエクスポート
// Key: userId, Value: { guildId: string | null }
// メッセージ作成時と違い、memberオブジェクトそのものではなく
// 必要な情報(今回は判定に使うguildId)だけを持つ軽量なオブジェクトにします
export const activeUsersForSunflower = new Map();

export default async (reaction, user) => {
  //ひまわり
  // Botは無視
  if (!user.bot) {
    // 既存のエントリがなければセット（1分間における最初の1回だけ記録されればOK）
    if (!activeUsersForSunflower.has(user.id)) {
      activeUsersForSunflower.set(user.id, {
        guildId: reaction.message.guildId, // DMならnullになります
      });
    }
  }
  //削除リアクション（旧式)
  if (
    reaction.emoji.id === "1267692767489036390" ||
    reaction.emoji.id === "1269022817429753918"
  ) {
    //削除を押されたら
    let message = reaction.message;
    //まずmessage.contentがあるかみる
    if (!message.content) {
      message = await reaction.message.fetch(); //なければ取得
    }
    if (message.mentions.users.has(user.id)) {
      await safeDelete(message);
    }
  }
  //そうだね
  else if (reaction.emoji.id === "1237471008500224020") {
    if (!reaction.count) {
      //キャッシュされてなければ取得
      await reaction.fetch();
    }
    const soudane = reaction.count;
    //    if(reaction.message.author.bot){return;}
    if (reaction.message.reactions.cache.get("1236923430490734672")?.count) {
      return;
    }
    if (soudane === 7) {
      if (
        reaction.message.channel.nsfw ||
        reaction.message.channel.parent.nsfw
      ) {
        await reaction.message.reply(
          `そうだねが7以上に達したため<#1098172139414233108>にコピーされます。`
        );
      } else {
        await reaction.message.reply(
          `そうだねが7以上に達したため<#1098159960942202941>にコピーされます。`
        );
      }
      await reaction.message.react("1236923430490734672");
    }
  }
  //hda(普通のと、2回目の方も)
  else if (
    reaction.emoji.id === "1057293963813453914" ||
    reaction.emoji.id === "1233328018437443614"
  ) {
    if (!reaction.count) {
      //キャッシュされてなければ取得
      await reaction.fetch();
    }
    if (
      !reaction.message.channel.nsfw &&
      !reaction.message.channel.parent.nsfw
    ) {
      return;
    }
    const hda = reaction.count;
    if (reaction.message.reactions.cache.get("1236923430490734672")?.count) {
      return;
    }
    if (hda === 7) {
      await reaction.message.reply(
        `えっちだが7以上に達したため<#1098172139414233108>にコピーされます。`
      );
      await reaction.message.react("1236923430490734672");
    }
  }
  //ニョワミヤ
  else if (
    reaction.emoji.id === "1209909578716942406" ||
    reaction.emoji.id === "1123947460121870366" ||
    reaction.emoji.id === "1264010111970574408"
  ) {
    if (!reaction.count) {
      //キャッシュされてなければ取得
      await reaction.fetch();
    }
    if (reaction.message.author.bot) {
      return;
    }
    const nyowamiya = reaction.count;
    if (reaction.message.reactions.cache.get("1303004918961016872")?.count) {
      return;
    }
    if (nyowamiya === 7) {
      await reaction.message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setURL(reaction.message.url)
            .setTitle(
              "ニョワミヤ、またの名をニョワミヤ<:nyowamiyarika:1264010111970574408>"
            )
            .setDescription(reaction.message.content)
            .setColor("#B78CFE")
            .setAuthor({
              name: reaction.message.author.displayName,
              iconURL: reaction.message.author.displayAvatarURL(),
            })
            .setTimestamp(reaction.message.createdAt),
        ],
      });
      await reaction.message.react("1303004918961016872");
    }
  }
};
