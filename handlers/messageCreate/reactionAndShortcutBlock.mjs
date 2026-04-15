import { EmbedBuilder } from "discord.js";
import fs from "fs";
import { ndnDice } from "../../commands/utils/dice.mjs";
import {
  getCharacterSummary,
  getCharacterSummaryCompact,
  getCharacterBasicInfo,
  getCharacterBudgetInfo,
  getCharacterNextInfo,
} from "../../utils/characterApi.mjs";
import { unlockHiddenAchievements } from "../../utils/achievements.mjs";
import config from "../../config.mjs";
import { createCharacterNotationHelpButton } from "../../components/buttons.mjs";

// ロスアカ短縮形
const rev2urlPatterns = {
  ils: "https://rev2.reversion.jp/illust/detail/ils",
  snd: "https://rev2.reversion.jp/sound/detail/snd",
  sce: "https://rev2.reversion.jp/scenario/opening/sce",
  nvl: "https://rev2.reversion.jp/scenario/ss/detail/nvl",
  not: "https://rev2.reversion.jp/note/not",
  com: "https://rev2.reversion.jp/community/detail/com",
};

/**
 * messageCreate のリアクション～各種ショートカット応答をまとめた処理。
 * 仕様追加時はまずこのファイルを確認してください。
 */
/**
 * リアクションやショートカット応答を処理する。
 * true を返した場合、呼び出し元は messageCreate の後続処理を中断する。
 */
export async function handleReactionAndShortcutBlock(message) {
const rev2detailMatch = message.content.match(/^(r2[pn][0-9]{6})!(\d+)?$/);
const rev2detailCompactWithEquipmentMatch = message.content.match(
  /^(r2[pn][0-9]{6})\?\?(\d+)?$/
);
const rev2detailCompactMatch = message.content.match(
  /^(r2[pn][0-9]{6})\?(\d+)?$/
);
const rev2nextInfoMatch = message.content.match(/^(r2[pn][0-9]{6})n(\d+)?$/);
const rev2urlmatch = message.content.match(
  /^(ils|snd|sce|nvl|not|com)(\d{8})$/
);
const ccmatch = message.content.match(/^!(cc|choice)(x?)(\d*)\s+/);

//リアクション
if (message.content.match(/ぽてと|ポテト|じゃがいも|ジャガイモ|🥔|🍟/)) {
  await message.react("🥔");
}
if (message.content.match(/にょわ|ニョワ|ﾆｮﾜ|nyowa/)) {
  await message.react("1264010111970574408");
}
if (
  message.content.match(
    /にょぼし(?!ふゆ)|ニョボシ(?!フユ)|ﾆｮﾎﾞｼ(?!ﾌﾕ)|nyobosi(?!fuyu)/
  )
) {
  await message.react("1293141862634229811");
}
if (message.content.match(/にょぼしふゆ|ニョボシフユ|ﾆｮﾎﾞｼﾌﾕ|nyobosifuyu/)) {
  await message.react("1396542940096237658");
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
  const nyowa = fs.readFileSync("./gacha/nyowamiyarika.txt", "utf8");
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
  const toru = fs.readFileSync("./gacha/toruchan.txt", "utf8");
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
    content: "https://rev2.reversion.jp/character/detail/r2p005734",
  });
} else if (message.content.match(/^(てんこ)$/)) {
  await message.reply({
    flags: [4096], //@silentになる
    content:
      "https://cdn.discordapp.com/attachments/1261485824378142760/1272199248297070632/megamoji_4.gif?ex=66ba1b61&is=66b8c9e1&hm=981808c1aa6e48d88ec48712ca268fc5b772fba5440454f144075267e84e7edf&",
  });
} else if (message.content.match(/^(紫崎 天子|紫崎天子|しざきてんし)$/)) {
  await message.reply({
    flags: [4096], //@silentになる
    content:
      "https://rev2.reversion.jp/character/detail/r2p001137",
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
} else if (message.content.match(/^(地図)$/)) {
  await message.channel.send({
    flags: [4096], //@silentになる
    content:
      `https://cdn.discordapp.com/attachments/1094295984600793190/1458437600388972638/IMG_9466.png?ex=69663adc&is=6964e95c&hm=846b110453f4fed0629606dbae5f6401d75f0b6d7c2b59b35c48218b48e2ceed&
       https://cdn.discordapp.com/attachments/1094295984600793190/1458437601005539429/image1.jpg?ex=69663adc&is=6964e95c&hm=b228d7dddc7ade0eab7be3d90bacc0f4d17c25295d7f7ca49881d0f15e868471&`,
  });
}

//画像いたずら系ここまで

//ここからステシ変換
//ロスアカ詳細
else if (rev2detailMatch) {
  const characterId = rev2detailMatch[1]; // IDはグループ1
  // rev2detailMatch[2] には数字の文字列（例: "30"）か、undefined が入る
  const targetLevel = rev2detailMatch[2]
    ? parseInt(rev2detailMatch[2], 10)
    : null;
  await message.channel.sendTyping();
  const replyMessage = await getCharacterSummary(characterId, targetLevel);
  await message.reply({
    content: replyMessage,
    allowedMentions: { repliedUser: false },
  });
  //コンパクト（装備付き）
} else if (rev2detailCompactWithEquipmentMatch) {
  const characterId = rev2detailCompactWithEquipmentMatch[1];
  const targetLevel = rev2detailCompactWithEquipmentMatch[2]
    ? parseInt(rev2detailCompactWithEquipmentMatch[2], 10)
    : null;
  await message.channel.sendTyping();
  // ★★★ getCharacterSummaryCompact に targetLevel を渡す ★★★
  const replyMessage = await getCharacterSummaryCompact(
    characterId,
    true,
    targetLevel
  );
  await message.reply({
    content: replyMessage,
    allowedMentions: { repliedUser: false },
  });
}
// コンパクト表示
else if (rev2detailCompactMatch) {
  // else if の順序に注意
  const characterId = rev2detailCompactMatch[1];
  const targetLevel = rev2detailCompactMatch[2]
    ? parseInt(rev2detailCompactMatch[2], 10)
    : null;
  await message.channel.sendTyping();
  // ★★★ getCharacterSummaryCompact に targetLevel を渡す ★★★
  const replyMessage = await getCharacterSummaryCompact(
    characterId,
    false,
    targetLevel
  );
  await message.reply({
    content: replyMessage,
    allowedMentions: { repliedUser: false },
  });
}
// 予算計算 (例: r2p000001予算 または r2p000001$30)
else if (message.content.match(/^r2[pn][0-9]{6}(?:\$|予算)(\d+)?$/)) {
  const match = message.content.match(/^r2[pn][0-9]{6}(?:\$|予算)(\d+)?$/);
  const characterId = message.content.substring(0, 9); // 先頭の r2p000001 部分を取得
  const targetLevel = match[1] ? parseInt(match[1], 10) : null;
  
  await message.channel.sendTyping();
  const replyMessage = await getCharacterBudgetInfo(characterId, targetLevel);
  
  await message.reply({
    flags: [4096], //@silent
    content: replyMessage,
  });
}
// ネクスト・アセンション表示
else if (rev2nextInfoMatch) {
  const characterId = rev2nextInfoMatch[1];
  const targetLevel = rev2nextInfoMatch[2]
    ? parseInt(rev2nextInfoMatch[2], 10)
    : null;

  await message.channel.sendTyping();
  const replyMessage = await getCharacterNextInfo(characterId, targetLevel);

  await message.reply({
    content: replyMessage,
    allowedMentions: { repliedUser: false },
  });
}
//ロスアカ (URL + 簡易情報)
else if (message.content.match(/^r2[pn][0-9]{6}$/)) {
  const characterId = message.content;

  // API叩くのでタイピング状態にする
  await message.channel.sendTyping();

  // 新しく作った関数を呼び出して結果を受け取る
  const replyMessage = await getCharacterBasicInfo(characterId);

  await message.reply({
    flags: [4096], //@silent
    content: replyMessage,
    components: [createCharacterNotationHelpButton()],
  });
}
//PPP
else if (message.content.match(/^p3[pnxy][0-9][0-9][0-9][0-9][0-9][0-9]$/)) {
  await message.reply({
    flags: [4096], //@silent
    content: "https://rev1.reversion.jp/character/detail/" + message.content,
  });
  if (message.content === "p3x001254") {
    // 実績ID: i2
    await unlockHiddenAchievements(message.client, message.author.id, 2);
  }
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
//私が知ります！
else if (message.content.match(/私が知ります！/)) {
  await message.reply({
    flags: [4096],
    content: "それは、わくわく taşıy",
  });
} else if (message.content.match(/^(めも|メモ|pbwlove|pbwlovememo)$/i)) {
  await message.reply({
    flags: [4096],
    content: "https://pbwlove.com",
  });
} else if (message.content.match(/^それは、わくわく taşıy$/)) {
  await message.reply({
    flags: [4096],
    content: "ん!!!（しらけました）",
  });
} else if (message.content.match(/^!work$/)) {
  await message.reply({
    flags: [4096],
    content:
      "コインが欲しいんですにゃ？\n/ログボを受け取る /loginbonusでボタンを出すか8時と22時に雑談でマリアが出すボタンを押してくださいにゃ",
  });
} else if (message.content.match(/^!crime$/)) {
  await message.reply({
    flags: [4096],
    content: "銀行を襲うのは怪盗マリアの仕事にゃ。",
  });
} else if (message.content.match(/^!slut$/)) {
  await message.reply({
    flags: [4096],
    content: "こんな所で脱いでんじゃねえにゃ",
  });
} else if (message.content.match(/^!rob$/)) {
  await message.reply({
    flags: [4096],
    content: "人様のコイン取ろうとするんじゃねえにゃ",
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
    content: `### うみみゃあ！\n### ${Math.floor(Math.random() * 6) + 1}、${Math.floor(Math.random() * 6) + 1
      }、${Math.floor(Math.random() * 6) + 1}`,
  });
} else if (message.content.match(/^(チンチ口リン)$/)) {
  await message.reply({
    flags: [4096], //silent
    content: `### うみみゃあ！(シゴロ賽)\n### ${Math.floor(Math.random() * 3) + 4
      }、${Math.floor(Math.random() * 3) + 4}、${Math.floor(Math.random() * 3) + 4
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
    // 旧実装では messageCreate 本体から return していたため、呼び出し元にも中断を伝える
    return true;
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
return false;
}
