import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setNameLocalizations({
    ja: "ヘルプ",
  })
  .setDescription("このBOTの機能を説明します");

export async function execute(interaction) {
  const helpData = {
    rp: {
      title: "ロールプレイ関連コマンド",
      description: "ロールプレイに関するコマンドの一覧です。",
      commands: [
        {
          name: "/ロールプレイ キャラ登録",
          description: "キャラクターを作成します。",
          usage: "セーブデータを変えることで5キャラまで登録出来ます。",
        },
        {
          name: "/ロールプレイ 発言",
          description: "登録したキャラで発言ができます。",
          usage:
            "アイコンを再登録して切り替える事もできます。",
        },
        {
          name: "/ロールプレイ セーブデータ確認",
          description: "登録したキャラを確認できます。",
          usage:
            "各キャラのリンクをクリックするとアイコンが継続使用可能か確認できます。\n表示されない時は再度アップロードしてください",
        },
      ],
    },
    slash1: {
      title: "スラッシュコマンド系コマンド（真面目）",
      description: "/を入れることで使用できるコマンドの一覧です",
      commands: [
        {
          name: "/セルフタイムアウト",
          description:
            "依存防止機能。発言やリアクションを禁じて作業や睡眠に集中するなどご自由にどうぞ",
          usage:
            "1~720分(12時間)まで指定できます。**__解除はしないので使用は自己責任で__**",
        },
        {
          name: "/ドミノ履歴",
          description: "ドミノを崩したログを見返せます。",
          usage: "何も入れなければ統計、-1を入れたら最近10回を表示します。",
        },
        {
          name: "/ダイス",
          description: "ダイスを振れます。補正値(+10など)もかけれます",
          usage: "最大100個、面数は2,147,483,647までです。",
        },
      ],
    },
    slash2: {
      title: "スラッシュコマンド系コマンド（ネタ・その他）",
      description:
        "/を入れることで使用できるコマンドの一覧です\nこちらは他愛のない方",
      commands: [
        {
          name: "/ガチャ",
          description: "ガチャのシミュレーターができます。",
          usage:
            "アイテム名は適当です。PPP(闇市）とロスアカ（ラプ箱）verがあります。",
        },
        {
          name: "/じゃんけん",
          description: "マリアとじゃんけんができます。",
          usage: "このBOTの大本にあった機能なので残してるだけの奴！",
        },
        {
          name: "/exchange(為替)",
          description: "為替レートを見れます",
          usage: "米ドル、ユーロ、英ポンド、豪ドル、NZドル、カナダドル、スイスフラン、トルコリラ、南アフリカランド、メキシコペソなど",
        },
        {
          name: "/ヘルプ",
          description: "botの使い方などを知れます。",
          usage: "今使ってますね。",
        },
        {
          name: "/カンパする",
          description: "あまみやりかにbot代のカンパが出来ます。",
          usage:
            "雨宿りの機能維持には毎年30ドルほど必要です。\n-# したいっていわれたからおいてるけどしなくていいからね…？お金は自分のしたいことに使おうね…？",
        },
        {
          name: "/ping",
          description: "ぽんにゃ！",
          usage: "botが生きているかチェックする簡易機能",
        },
      ],
    },
    chat1: {
      title: "チャット系コマンド(真面目)",
      description: "直接発言欄に書き込むことなどで反応する機能です。",
      commands: [
        {
          name: "ステータスシート変換",
          description:
            "キャラクターIDのみ入力すると該当のステータスシートへのリンクに変換します",
          usage: "Rev1-2 TW4-8に対応",
        },
        {
          name: "「自由雑談」新スレ通知",
          description:
            "「自由雑談」に建てられたスレを「雑談」チャンネルでお知らせします",
          usage: "地下自由雑談も地下雑談で通知が出ます。\n通知してほしくない時は「非通知」とスレ立ての本文のどこかに入れてください。",
        },
        {
          name: "ロスアカ新依頼チェッカー",
          description:
            "ロスアカの新しい依頼があると「LostArcadia」チャンネルでお知らせします",
          usage: "毎日1時半から3時間毎にチェックします。リプレイ返却もお知らせします。",
        },
        {
          name: "見せびらかし機能（仮）",
          description:
            "ロスアカのアトリエのURLを貼ると画像を取得し貼り付けます",
          usage: "してほしくない時は下記ilsの方をご利用ください",
        },
        {
          name: "(ロスアカ)短縮リンク変換",
          description:
            "ils00026932　など3文字＋IDで表記できる物を貼ると変換して貼り付けます",
          usage: "ils,snd,sce,nvl,not,comに対応",
        },        
        {
          name: "ダイスロール",
          description:
            "半角!のあとにダイス面や修正値を入れるとダイスを振れます",
          usage:
            "例 !1d100 !2d20+10\n余談：「ねこど」「ひとど」~~「ドミノ」~~といれると1d100が振れます。",
        },
        {
          name: "チョイス機能",
          description:
            "!choice や !cc のあとにいくつか要素を並べると要素をランダムに取り出します",
          usage:
            "「!choice りんご もも みかん」 3つのどれかをランダムに返す\n「!choice2 りんご もも みかん」みたいにchoiceの直後に数字をつけるとその数だけ取り出す(重複なし)「!choicex2 りんご もも みかん」みたいにchoicexにすると重複ありになる(数字必須)\n「!cc !cc2 !ccx2」などchoiceはccでも可",
        },
        {
          name: "各リンク変換",
          description:
            "DiscordのメッセージやX(旧Twitter)などのリンクを見やすい形式に自動で変換します。",
          usage:
            "右クリや発言長押しなどから取れるDiscordの発言リンクを貼ればリンク先の発言を（返信先含め）引用として表示できます。\nツイッターはfxtwitterというサムネ表示を改善するリンクに変換します。\n地下(NSFWチャンネル)ならPixivも変換します",
        },        
        {
          name: "時間教えて",
          description:
            "今何時？　ほったいも　今日何日？ など書き込めばマリアが教えてくれます。28年後の年も教えます",
          usage:
            "/^((今|いま)(何時|なんじ)？*|(今日|きょう)(何日|なんにち)？*|ほったいも？*)$/",
        },          
      ],
    },
    chat2: {
      title: "チャット系コマンド(おふざけ)",
      description: "直接発言欄に書き込むことで反応する機能です。",
      commands: [
        {
          name: "ドミノ機能",
          description: "ドミノ、どみどみ、などを入力すると1d100枚のドミノを並べます。ただし100を出してしまうと…",
          usage: "出目はリアクションで出ます。ドミノ雑談チャンネルの場合はどのメッセージでもドミノを並べます",
        },
        {
          name: "色々変なリアクションや発言",
          description: "ニョワ、ニョボシ、ぽてと、ココロ…、ミョミョミョワァァーンなどでリアクションが付きます",
          usage: "「ニョワミヤ」「トール＝チャン」（何故か）「ゆづさや」でも画像が出ます。だからどうした",
        },
        {
          name: "チンチロリン",
          description: "チンチロリンといれると3d6のダイスを振ります。",
          usage: "イカサマもできるコマンドがあるらしいです。ヒント：一見チンチロリンに見えますが…",
        },

      ],
    },
    contexts: {
      title: "コンテキストメニュー（右クリック）系コマンド",
      description:
        "発言を(PC)右クリック→アプリ(スマホ)長押し→アプリで使用できる機能です。",
      commands: [
        {
          name: "DMにメッセージをコピー",
          description:
            "マリアからダイレクトメール形式でメッセージのコピーを送信します。",
          usage:
            "メモ代わりや気に入った発言の記録などにどうぞ。要：サーバーメンバーからのDMを受け取る",
        },
        {
          name: "ピン留めの登録/解除",
          description:
            "誰でもピン留めができます。すでにピン留めがされていたら解除します。",
          usage: "上限(1チャンネル最大50)に引っかかったらエラーが出ます。",
        },
        {
          name: "メッセージを削除（スレ主限定）",
          description: "スレッドを立てた人に限り、他人の発言を削除できます。",
          usage:
            "個室などで困った発言を削除するなどにお使いください。乱用厳禁。\nプライベートスレッドでは使用不可。",
        },
        {
          name: "このメッセージを報告する",
          description: "ルールに反している発言などをモデレーターに報告します。",
          usage:
            "使用されないに越した事はないですが万一の時は躊躇せず押してください。状況を加味し管理人が協議します。\n悪戯や個人的な不快感での通報はご遠慮ください。",
        },
      ],
    },
  };

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("help_category")
    .setPlaceholder("カテゴリを選択してください")
    .addOptions(
      Object.keys(helpData).map((category) => ({
        label: helpData[category].title,
        value: category,
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const initialEmbed = new EmbedBuilder()
    .setTitle("神谷マリアbot ヘルプ")
    .setDescription("コマンドのカテゴリを選択してください。")
    .setColor("#B78CFE")
    .setFooter({
      text: "無駄に時間かかったから褒めてくれると嬉しいな…",
    });

  const reply = await interaction.reply({
    embeds: [initialEmbed],
    components: [row],
    flags: 64,//ephemeral
  });

  const collector = reply.createMessageComponentCollector({
    filter: (i) =>
      i.customId === "help_category" && i.user.id === interaction.user.id,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    const category = i.values[0];
    const categoryData = helpData[category];

    const embed = new EmbedBuilder()
      .setTitle(categoryData.title)
      .setDescription(categoryData.description)
      .setColor("#B78CFE")
      .addFields(
        categoryData.commands.map((command) => ({
          name: command.name,
          value: `${command.description}\n備考：${command.usage}`,
        }))
      )
      .setFooter({
        text: "改善案・ご意見等ありましたら遠慮なくあまみやりかまで",
      });

    await i.update({ embeds: [embed], components: [] });
  });

  collector.on("end", async (collected, reason) => {
    if (reason === "time") {
      await interaction.editReply({ components: [] });
    }
  });
}

/*
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setNameLocalizations({
    ja: "ヘルプ_工事中",
  })
  .setDescription("このBOTの機能を説明します");

export async function execute(interaction) {
  const helptext = fs.readFileSync("./gacha/help.txt", "utf8");
  await interaction.reply({
    flags: [4096,64], //silent,ephemeral
    embeds: [
      new EmbedBuilder()
        .setTitle("神谷マリアbotについて")
        .setDescription(helptext)
        .setColor("#B78CFE")
        .setFooter({
          text: "無駄に時間かかったから褒めてくれると嬉しいな…",
        }),
    ],
   
  });
}
*/
