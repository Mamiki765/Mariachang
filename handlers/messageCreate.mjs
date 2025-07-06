import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import fs from "fs";

import config from "../config.mjs";
import { ndnDice } from "../commands/utils/dice.mjs";
import { dominoeffect } from "../commands/utils/domino.mjs";
import {
  createEmbed,
  getImagesFromMessage,
  sendMessage,
} from "../utils/messageutil.mjs";
import { deletebuttonunique } from "../components/buttons.mjs";

//ロスアカのアトリエURL検知用
//250706 スケッチブックにも対応
const rev2AtelierurlPattern =
  /https:\/\/rev2\.reversion\.jp\/(?:illust\/detail\/ils(\d+)|illust\/sketchbook\/illust\/(\d+))/g;
//その他ロスアカ短縮形検知
// パターンと対応するURLのテンプレート
const rev2urlPatterns = {
  ils: "https://rev2.reversion.jp/illust/detail/ils",
  snd: "https://rev2.reversion.jp/sound/detail/snd",
  sce: "https://rev2.reversion.jp/scenario/opening/sce",
  nvl: "https://rev2.reversion.jp/scenario/ss/detail/nvl",
  not: "https://rev2.reversion.jp/note/not",
  com: "https://rev2.reversion.jp/community/detail/com",
};

export default async (message) => {
  //定義系
  //ロスアカ短縮形
  const rev2urlmatch = message.content.match(
    /^(ils|snd|sce|nvl|not|com)(\d{8})$/
  );
  //ccやchoiceでのテスト
  const ccmatch = message.content.match(/^!(cc|choice)(x?)(\d*)\s+/);
  // ここから反応
  //リアクション
  if (message.content.match(/ぽてと|ポテト|じゃがいも|ジャガイモ|🥔|🍟/)) {
    await message.react("🥔");
  }
  if (message.content.match(/にょわ|ニョワ|ﾆｮﾜ|nyowa/)) {
    await message.react("1264010111970574408");
  }
  if (message.content.match(/にょぼし|ニョボシ|ﾆｮﾎﾞｼ|nyobosi/)) {
    await message.react("1293141862634229811");
  }
  if (message.content.match(/ミョミョミョワァァーン|ﾐｮﾐｮﾐｮﾜｧｧｰﾝ/)) {
    await message.react("1264883879794315407");
  } else if (message.content.match(/ミョミョミョ|ﾐｮﾐｮﾐｮ/)) {
    await message.reply({
      flags: [4096], //@silentになる
      content: "ちょっと違うかニャ…",
    });
  }
  if (message.content.match(/(^(こころ|ココロ|心)…*$|ココロ…|ココロー！)/)) {
    if (Math.floor(Math.random() * 100) < 1) {
      //0-99 1%で大当たり　ココロー！
      await message.react("1265162645330464898");
      await message.react("1265165857445908542");
      await message.react("1265165940824215583");
      await message.react("1265166237399388242");
      await message.react("1265166293464518666");
      await message.react("‼️");
    } else {
      const toruchan = [
        "1264756212994674739",
        "1265162812758687754",
        "1265163072016879636",
        "1265163139637317673",
        "1265163377538236476",
      ];
      await message.react(
        toruchan[Math.floor(Math.random() * toruchan.length)]
      );
    }
  }
  //リアクションここまで
  //ニョワミヤでニョワミヤが出てくる等画像いたずら系
  //ニョワミヤ（いるかこの機能？）
  else if (
    message.content.match(/^(ニョワミヤ|ﾆｮﾜﾐﾔ|ニョワミヤリカ|ﾆｮﾜﾐﾔﾘｶ)$/)
  ) {
    //ニョワミヤ画像集をロード
    const nyowa = fs.readFileSync("./database/nyowamiyarika.txt", "utf8");
    const nyowamiya = nyowa.split(/\n/);
    //ランダムで排出
    await message.reply({
      flags: [4096], //@silentになる
      content: nyowamiya[Math.floor(Math.random() * nyowamiya.length)],
    });
  }
  //トールちゃん
  else if (
    message.content.match(
      /^(トール|とーる|ﾄｰﾙ|姫子|ひめこ|ヒメコ|ﾋﾒｺ)[=＝](ちゃん|チャン|ﾁｬﾝ)$/
    )
  ) {
    //トールチャン画像集
    const toru = fs.readFileSync("./database/toruchan.txt", "utf8");
    const toruchan = toru.split(/\n/);
    await message.reply({
      flags: [4096], //@silentになる
      content: toruchan[Math.floor(Math.random() * toruchan.length)],
    });
  } else if (message.content.match(/^(ゆづさや)$/)) {
    await message.reply({
      flags: [4096], //@silentになる
      content:
        "https://media.discordapp.net/attachments/1025416223724404766/1122185542252105738/megamoji.gif?ex=668cad7a&is=668b5bfa&hm=5c970ab0422c8731d0471ab1d65663b76ae6fd8fb47192481bdbbdadcd792675&",
    });
  } else if (message.content.match(/^(ゆゔさや|ゆヴさや|ゆずさや)$/)) {
    await message.reply({
      flags: [4096], //@silentになる
      content:
        "https://media.discordapp.net/attachments/1040261246538223637/1175700688219672587/megamoji_4.gif?ex=668ce817&is=668b9697&hm=e26e24e90dc3bd6606255aaefd4f7ad91118f1d8cc5a6be8f48013b7ca2fa58a&",
    });
  } else if (message.content.match(/^(結月 沙耶|結月沙耶|ゆづきさや)$/)) {
    await message.reply({
      flags: [4096], //@silentになる
      content: "https://rev1.reversion.jp/character/detail/p3p009126",
    });
  } else if (message.content.match(/^(てんこ)$/)) {
    await message.reply({
      flags: [4096], //@silentになる
      content:
        "https://cdn.discordapp.com/attachments/1261485824378142760/1272199248297070632/megamoji_4.gif?ex=66ba1b61&is=66b8c9e1&hm=981808c1aa6e48d88ec48712ca268fc5b772fba5440454f144075267e84e7edf&",
    });
  } else if (message.content.match(/^(ゆ.さや)$/)) {
    await message.reply({
      flags: [4096], //@silentになる
      content:
        "https://cdn.discordapp.com/attachments/1261485824378142760/1263261822757109770/IMG_2395.gif?ex=669997c0&is=66984640&hm=a12e30f8b9d71ffc61ab35cfa095a8b7f7a08d04988f7b33f06437b13e6ee324&",
    });
  } else if (message.content.match(/^(オールノービス|白一色)$/)) {
    await message.channel.send({
      flags: [4096], //@silentになる
      content:
        "これはそう、全て終わり\nオールノービス **2.9%**\nオールノービスorカースド **3.64%**(AFまで実装時)",
    });
  }

  //画像いたずら系ここまで

  //ここからステシ変換
  //ロスアカ
  else if (message.content.match(/^r2[pn][0-9][0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [4096], //@silent
      content: "https://rev2.reversion.jp/character/detail/" + message.content,
    });
  }
  //PPP
  else if (message.content.match(/^p3[pnxy][0-9][0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [4096], //@silent
      content: "https://rev1.reversion.jp/character/detail/" + message.content,
    });
  }
  //第六
  else if (message.content.match(/^f[0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [4096], //@silent
      content: "https://tw6.jp/character/status/" + message.content,
    });
  }
  //チェンパラ
  else if (message.content.match(/^g[0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [4096], //@silent
      content: "https://tw7.t-walker.jp/character/status/" + message.content,
    });
  }
  //エデン
  else if (message.content.match(/^h[0-9][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [4096], //@silent
      content: "https://tw8.t-walker.jp/character/status/" + message.content,
    });
  }
  //ケルブレ
  else if (message.content.match(/^e[0-9n][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [4096], //@silent
      content: "http://tw5.jp/character/status/" + message.content,
    });
  }
  //サイハ
  else if (message.content.match(/^d[0-9n][0-9][0-9][0-9][0-9]$/)) {
    await message.reply({
      flags: [4096], //@silent
      content: "http://tw4.jp/character/status/" + message.content,
    });
  }
  //ステシ変換ここまで
  //ロスアカ短縮形処理
  else if (rev2urlmatch) {
    const [fullMatch, prefix, digits] = rev2urlmatch; // 例: fullMatch="ils12345678", prefix="ils", digits="12345678"
    if (rev2urlPatterns[prefix]) {
      const replyUrl = `${rev2urlPatterns[prefix]}${digits}`;
      message.reply({
        flags: [4096],
        content: `${replyUrl}`,
      });
    }
  }
  //　　if (message.content === "\?にゃん" || "\?にゃーん" || "\?にゃ～ん"){
  if (message.content.match(/^(!にゃん|!にゃーん|にゃ～ん|にゃあん)$/)) {
    await message.reply({
      flags: [4096],
      content: "にゃ～ん",
    });
  }

  //ほったいも
  else if (
    message.content.match(
      /^((今|いま)(何時|なんじ)？*|(今日|きょう)(何日|なんにち)？*|ほったいも？*)$/
    )
  ) {
    const date = new Date();
    const nanjimonth = date.getMonth() + 1;
    const masiroyear = date.getFullYear() + 28;
    const nanjidate =
      date.getFullYear() +
      "年" +
      nanjimonth +
      "月" +
      date.getDate() +
      "日" +
      date.getHours() +
      "時" +
      date.getMinutes() +
      "分" +
      date.getSeconds() +
      "秒";
    await message.reply(
      `${nanjidate}ですにゃ。\nマシロ市は${masiroyear}年ですにゃ。`
    );
  }

  //ダイスロール
  else if (message.content.match(/^!(\d+)d(\d+)([+-]\d+)?$/)) {
    let command = message.content.slice(1); // 先頭の1文字目から最後までを取得
    const resultEmbed = ndnDice(command);
    await message.reply({
      flags: [4096], //silent
      embeds: [resultEmbed],
    });
  }
  //ダイスロール
  else if (message.content.match(/^(ねこど|ひとど)$/)) {
    let command = "1d100";
    const resultEmbed = ndnDice(command);
    await message.reply({
      flags: [4096], //silent
      embeds: [resultEmbed],
    });
  } else if (message.content.match(/^(!settai)$/)) {
    //接待ダイス
    const embed = new EmbedBuilder()
      .setColor(0x0000ff)
      .setTitle("1d100(接待ダイス)")
      .setDescription(
        `-->${Math.floor(Math.random() * 5) + 1}**(クリティカル！)**`
      );
    await message.reply({
      flags: [4096], //silent
      embeds: [embed],
    });
  } else if (message.content.match(/^(!gyakutai)$/)) {
    //虐待ダイス
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("1d100(虐待ダイス)")
      .setDescription(
        `-->${Math.floor(Math.random() * 5) + 96}**(ファンブル！)**`
      );
    await message.reply({
      flags: [4096], //silent
      embeds: [embed],
    });
  } else if (message.content.match(/^(チンチロリン)$/)) {
    await message.reply({
      flags: [4096], //silent
      content: `### うみみゃあ！\n### ${Math.floor(Math.random() * 6) + 1}、${
        Math.floor(Math.random() * 6) + 1
      }、${Math.floor(Math.random() * 6) + 1}`,
    });
  } else if (message.content.match(/^(チンチ口リン)$/)) {
    await message.reply({
      flags: [4096], //silent
      content: `### うみみゃあ！(シゴロ賽)\n### ${
        Math.floor(Math.random() * 3) + 4
      }、${Math.floor(Math.random() * 3) + 4}、${
        Math.floor(Math.random() * 3) + 4
      }`,
    });
  } else if (ccmatch) {
    // 抽選コマンド処理 cc choice
    const baseCommand = ccmatch[1]; // cc or choice
    const allowDuplicates = ccmatch[2] === "x"; // x がついてるか
    let count = ccmatch[3] ? parseInt(ccmatch[3], 10) : 1; // 数字がある場合は取得、なければ1

    const args = message.content.slice(ccmatch[0].length).trim().split(/\s+/); // 選択肢を取得

    if (args.length === 0) {
      let command = "1d100";
      const resultEmbed = ndnDice(command);
      await message.reply({
        flags: [4096], //silent
        embeds: [resultEmbed],
      });
    }
    if (!allowDuplicates && count > args.length) {
      message.reply("選択肢より多くは選べません！");
      return;
    }

    let results = [];
    if (allowDuplicates) {
      for (let i = 0; i < count; i++) {
        results.push(args[Math.floor(Math.random() * args.length)]);
      }
    } else {
      let shuffled = [...args].sort(() => Math.random() - 0.5);
      results = shuffled.slice(0, count);
    }

    message.reply({
      flags: [4096],
      content: `抽選結果: ${results.join(", ")}`,
    });
  }

  //ロスアカアトリエURL＋250706スケッチブックURLが貼られた時、画像を取得する機能
  if (message.content.match(rev2AtelierurlPattern)) {
    const matches = [...message.content.matchAll(rev2AtelierurlPattern)]; // 全てのマッチを取得

    if (matches.length > 0) {
      try {
        // 削除ボタンを作成しておく（message.author.idを使用）
        const component = deletebuttonunique(message.author.id);

        // メッセージを再取得
        const fetchMessage = async () => {
          const fetchedMessage = await message.channel.messages.fetch(
            message.id
          );

          // サムネイルURLを格納する配列
          let thumbnails = [];

          // URLごとに処理する
          const fetchThumbnailForMatch = async (match) => {
            // URLが一致するEmbedを探す
            const embed = fetchedMessage.embeds.find(
              (embed) => embed.url === match[0]
            );

            // 一致するEmbedがあれば、サムネイルURLを配列に追加
            if (embed && embed.thumbnail && embed.thumbnail.url) {
              // ここに除外処理を追加　250706ロスアカデフォサムネ
              if (embed.thumbnail.url !== "https://rev2.reversion.jp/og.webp") {
                // 除外条件を追加
                if (!thumbnails.includes(embed.thumbnail.url)) {
                  thumbnails.push(embed.thumbnail.url);
                }
              } else {
                console.log(
                  `デフォルトのサムネイルURL ${embed.thumbnail.url} は除外されました。`
                );
              }
            } else {
              console.log(
                `URL ${match[0]} に一致するEmbedが見つかりませんでした`
              );

              // 10秒後に再試行
              await new Promise((resolve) => {
                setTimeout(async () => {
                  try {
                    const retryFetchedMessage =
                      await message.channel.messages.fetch(message.id);
                    const retryEmbed = retryFetchedMessage.embeds.find(
                      (embed) => embed.url === match[0]
                    );

                    // リトライ結果を確認
                    if (
                      retryEmbed &&
                      retryEmbed.thumbnail &&
                      retryEmbed.thumbnail.url
                    ) {
                      // リトライ時にも除外処理を追加
                      if (
                        retryEmbed.thumbnail.url !==
                        "https://rev2.reversion.jp/og.webp"
                      ) {
                        // 除外条件を追加
                        if (!thumbnails.includes(retryEmbed.thumbnail.url)) {
                          thumbnails.push(retryEmbed.thumbnail.url);
                        }
                      } else {
                        console.log(
                          `リトライでもデフォルトのサムネイルURL ${retryEmbed.thumbnail.url} は除外されました。`
                        );
                      }
                    } else {
                      console.log(
                        `リトライでもURL ${match[0]} に一致するEmbedが見つかりませんでした`
                      );
                    }
                    resolve(); // リトライ後に処理を進める
                  } catch (retryError) {
                    console.error(
                      "リトライ時のメッセージの再取得に失敗しました:",
                      retryError
                    );
                    resolve(); // エラー時も処理を進める
                  }
                }, 10000); // 10000ミリ秒 = 10秒
              });
            }
          };

          // すべてのマッチに対して非同期でサムネイルを取得
          await Promise.all(matches.map(fetchThumbnailForMatch));

          // サムネイルURLがあれば、それを1つのメッセージにまとめて送信
          if (thumbnails.length > 0) {
            const messageContent = thumbnails.join("\n"); // サムネイルURLを改行で区切って結合
            message.channel.send({
              flags: [4096],
              content: messageContent,
              components: [component],
            });
          }
        };

        await fetchMessage(); // 初回のfetchを呼び出し
      } catch (error) {
        console.error("メッセージの再取得に失敗しました:", error);
      }
    }
  }

  //ドミノを並べる処理
  if (
    message.content.match(/(どみの|ドミノ|ﾄﾞﾐﾉ|domino|ドミドミ|どみどみ)/i) ||
    message.channel.id === config.dominoch ||
    message.channel.id === "1364908910032719934" //別館ドミノ
  ) {
    let dpname = null;
    if (!message.member) {
      dpname = message.author.displayName;
    } else {
      dpname = message.member.displayName;
    }
    await dominoeffect(
      message,
      message.client,
      message.author.id,
      message.author.username,
      dpname
    );
  }
  /*
  ここから大きな処理２つめ
  X、メッセージリンクを検知して処理する。
  両方あったらXを優先する。
  まずはX、ついでにNsfwならpixivも
  */
  if (
    message.content.match(
      /https?:\/\/(twitter\.com|x\.com)\/[^/]+\/status\/\d+\/?(\?.*)?|https?:\/\/www\.pixiv\.net\/artworks\/\d+/
    )
  ) {
    if (!message.guild) {
      return;
    } //dmなら無視
    let updatedMessage = message.content
      .replace(/https:\/\/twitter\.com/g, "https://fxtwitter.com")
      .replace(/https:\/\/x\.com/g, "https://fixvx.com");
    //nsfwチャンネルならpixivも
    if (message.channel.nsfw || message.channel.parent?.nsfw) {
      updatedMessage = updatedMessage.replace(
        /https?:\/\/www\.pixiv\.net\/artworks\//g,
        "https://www.phixiv.net/artworks/"
      );
    }
    const fileUrls = message.attachments.map((attachment) => attachment.url);
    await sendMessage(message, updatedMessage, fileUrls, null, 4096);
    await message.delete(); //元メッセージは消す
  }
  //メッセージから内容チラ見せ
  else if (
    message.content.match(
      /https?:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/
    )
  ) {
    if (!message.guild) {
      return;
    } //dmなら無視
    //メッセージのURLを確認する正規表現
    const MESSAGE_URL_REGEX =
      /https?:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;

    const matches = MESSAGE_URL_REGEX.exec(message.content);
    if (matches) {
      const [fullMatch, guildId, channelId, messageId] = matches;
      if (guildId !== message.guild.id) {
        return;
      } //現在のギルドと異なるURLは無視
      try {
        const channel = await message.guild.channels.fetch(channelId);
        const fetchedMessage = await channel.messages.fetch(messageId);
        //    await console.log(channel);
        //await console.log(fetchedMessage);
        if (!fetchedMessage) {
          return;
        } //無を取得したらエラーになるはずだが念の為
        //以下、プレビューを表示しない様にする処理、ただし同じチャンネル内であれば通す
        // プレビューを表示しない様にする処理
        //プライベートスレッド(type12)ではないか
        if (
          channel.isThread() &&
          channel.type === 12 &&
          message.channel.id !== channel.id
        )
          return;
        //NSFW→健全を避ける
        if (
          (channel.parent?.nsfw || channel.nsfw) &&
          !(message.channel.parent?.nsfw || message.channel.nsfw)
        )
          return;

        //プライベートなカテゴリは他のチャンネルに転載禁止。クリエイターや管理人室など
        if (
          config.privatecategory.includes(channel.parentId) &&
          message.channel.id !== channel.id
        )
          return;

        // メッセージから画像URLを取得
        const images = await getImagesFromMessage(fetchedMessage);
        const files = fetchedMessage.attachments
          .map((attachment) => attachment.url)
          .join("\n");
        let sendmessage = files
          ? fetchedMessage.content + `\n` + files
          : fetchedMessage.content;

        //スタンプのときは
        if (fetchedMessage.stickers && fetchedMessage.stickers.size > 0) {
          const firstSticker = fetchedMessage.stickers.first();
          sendmessage += "スタンプ：" + firstSticker.name;
          images.unshift(firstSticker.url);
        }
        // Embedを作成
        const embeds = [];
        const channelname = `#${channel.name}`;
        const embed = createEmbed(
          fullMatch,
          "引用元へ",
          sendmessage,
          fetchedMessage.author,
          images[0],
          fetchedMessage.createdAt,
          "#0099ff",
          channelname
        );
        embeds.push(embed);

        if (images.length > 1) {
          for (let i = 1; i < images.length; i++) {
            const imageEmbed = createEmbed(
              fullMatch,
              null,
              null,
              {
                displayName: null,
                displayAvatarURL: () => null,
              },
              images[i],
              fetchedMessage.createdAt,
              "#0099ff",
              null
            );
            embeds.push(imageEmbed);
          }
        }
        //引用元にembedがあれば1個目だけ取得(画像やtenorは無視))
        if (
          fetchedMessage.embeds[0] &&
          fetchedMessage.embeds[0].data.type !== "image" &&
          fetchedMessage.embeds[0].data.type !== "gifv"
        ) {
          embeds.push(fetchedMessage.embeds[0]);
          console.log(fetchedMessage.embeds[0]);
        }
        // 返信があれば同じ様に
        if (fetchedMessage.reference) {
          const refMessage = await channel.messages.fetch(
            fetchedMessage.reference.messageId
          );
          if (refMessage) {
            //URLは返信先に
            const refMatch = `https://discord.com/channels/${guildId}/${channelId}/${fetchedMessage.reference.messageId}`;
            const refImages = await getImagesFromMessage(refMessage);
            let refSendMessage = refMessage.attachments
              .map((attachment) => attachment.url)
              .join("\n")
              ? refMessage.content +
                `\n` +
                refMessage.attachments
                  .map((attachment) => attachment.url)
                  .join("\n")
              : refMessage.content;
            if (refMessage.stickers && refMessage.stickers.size > 0) {
              const refFirstSticker = refMessage.stickers.first();
              refSendMessage += "スタンプ：" + refFirstSticker.name;
              refImages.unshift(refFirstSticker.url);
            }
            const refEmbed = createEmbed(
              refMatch,
              "引用元の返信先",
              refSendMessage,
              refMessage.author,
              refImages[0],
              refMessage.createdAt,
              "#B78CFE",
              null
            );
            embeds.push(refEmbed);

            if (refImages.length > 1) {
              for (let i = 1; i < refImages.length; i++) {
                const refImageEmbed = createEmbed(
                  refMatch,
                  null,
                  null,
                  {
                    displayName: null,
                    displayAvatarURL: () => null,
                  },
                  refImages[i],
                  refMessage.createdAt,
                  "#B78CFE",
                  null
                );
                embeds.push(refImageEmbed);
              }
            }
            if (
              refMessage.embeds[0] &&
              refMessage.embeds[0].data.type !== "image" &&
              refMessage.embeds[0].data.type !== "gifv"
            ) {
              embeds.push(refMessage.embeds[0]);
            }
          }
        }
        //返信部分ここまで

        // 返信するメッセージを作成
        const fileUrls = message.attachments.map(
          (attachment) => attachment.url
        );
        let newmessage = message.content;
        const regex = new RegExp(fullMatch, "i");
        newmessage = newmessage.replace(regex, `**（変換済み)**`);
        if (newmessage == `**（変換済み)**`) newmessage = ""; //URLだけなら消す
        //メッセージを送信する
        await sendMessage(message, newmessage, fileUrls, embeds, 4096);
        await message.delete(); // 元メッセージは消す
      } catch (error) {
        console.error("Error fetching message:", error);
        message.reply({
          content: "メッセージを取得できませんでした。",
          ephemeral: true,
        });
      }
    }
  }
  //デバッグ用 データベース手動バックアップ
  /*
  else if (
    message.content === process.env.backup_command &&
    message.author.id === config.administrator
  ) {
    try {
      await message.reply({
        content: "SQLite3データベースのバックアップを取得しました。",
        files: [".data/roleplaydb.sqlite3"],
        ephemeral: true, // 管理者のみに表示
      });
    } catch (error) {
      console.error("バックアップの送信に失敗しました:", error);
      await message.reply({
        content: "バックアップの送信に失敗しました。",
        ephemeral: true,
      });
    }
  }
  */
};

/*
メッセージ処理ここまで、以下サブルーチン
*/
