import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";

export const data = new SlashCommandBuilder()
  .setName("gacha")
  .setNameLocalizations({
    ja: "ガチャ",
  })
  .setDescription("擬似的なガチャを引けます。")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ppp")
      .setDescription("闇市を11回引きます")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("laplace")
      .setNameLocalizations({
        ja: "ラプラスの箱",
      })
      .setDescription("ラプラスの箱を11個開けます")
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  //PPP闇市（試作品）
  if (subcommand == "ppp") {
    // RL1 AF10 HQ30 R220 N724
    const arr = [
      "# ★レリック　虹色に光り輝くにぼし",
      "## ☆アーティファクト　極上にぼし",
      "### ハイクオリティ　にぼしラーメン",
      "レギュラー　にぼしフレーク",
      "ノービス　にぼし",
      "カースド　にぼし（使用済み）",
      "# ★レリック　ゲーミングオーラﾆｮﾜﾐﾔ",
      "## ☆アーティファクト　ﾆｮﾜﾐﾔﾘｶ（画像加工前）",
      "### ハイクオリティ　全速前進ﾆｮﾜﾐﾔ",
      "レギュラー　震えているﾆｮﾜﾐﾔ",
      "ノービス　ﾆｮﾜﾐﾔﾘｶ",
      "カースド　まだ本腰入れて探してはないが鍵がない気がするﾆｮﾜﾐﾔ",
      "ノービス 乙女のぱんつ",
      "ノービス 宝石",
      "レギュラー　ゆづさや",
    ];
    const weight = [
      1, 10, 30, 210, 704, 15, 1, 10, 30, 210, 724, 15, 10, 10, 20,
    ];
    let result = "";

    let totalWeight = 0;
    for (let i = 0; i < weight.length; i++) {
      totalWeight += weight[i];
    }
    for (let j = 1; j < 12; j++) {
      let random = Math.floor(Math.random() * totalWeight);
      //result += random + "  ";
      for (let i = 0; i < weight.length; i++) {
        if (random < weight[i]) {
          result += arr[i] + "\n";
          break;
        } else {
          random -= weight[i];
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xefdcaa)
      .setAuthor({
        name: interaction.member.displayName,
        iconURL: interaction.member.displayAvatarURL(),
      })
      .setTitle(`にぼしガチャ11連の結果にゃ！`)
      .setDescription(result)
      .setFooter({
        text: "（PPP闇市仕様）",
      });

    await interaction.reply({
      flags: [4096], //silent
      embeds: [embed],
    });

    //ロスアカラプ箱（ガチャver2)
  } else if (subcommand == "laplace") {
    // C15　N725 R22０　HQ3０ AF10　 1000倍して悪い順に
    const arr = ["__C  ", "N  ", "R  ", "### HQ ", "## AF "];
    const arrlate = ["__", "", "", "", ""];
    //240727追加　各レアリティごとのファイルを読み込む
    const map0 = fs.readFileSync("./gacha/cursed.txt", "utf8");
    const map1 = fs.readFileSync("./gacha/novice.txt", "utf8");
    const map2 = fs.readFileSync("./gacha/regular.txt", "utf8");
    const map3 = fs.readFileSync("./gacha/HighQuality.txt", "utf8");
    const map4 = fs.readFileSync("./gacha/Artifact.txt", "utf8");
    const maps = [];
    maps[0] = map0.split(/\n/);
    maps[1] = map1.split(/\n/);
    maps[2] = map2.split(/\n/);
    maps[3] = map3.split(/\n/);
    maps[4] = map4.split(/\n/);
    //ここまで
    const weight = [15, 725, 220, 30, 10];
    let result = "";
    //確率を足して
    let totalWeight = 0;
    for (let i = 0; i < weight.length; i++) {
      totalWeight += weight[i];
    }
    //11連する
    for (let j = 1; j < 12; j++) {
      let random = Math.floor(Math.random() * totalWeight);
      //result += random + "  ";　　//乱数確認用
      for (let i = 0; i < weight.length; i++) {
        if (random < weight[i]) {
          //レアリティ決定
          result +=
            arr[i] +
            maps[i][Math.floor(Math.random() * maps[i].length)] +
            arrlate[i] +
            "\n"; //結果を付け足して次に
          break;
        } else {
          random -= weight[i];
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xefdcaa)
      .setAuthor({
        name: interaction.member.displayName,
        iconURL: interaction.member.displayAvatarURL(),
      })
      .setTitle(`ひめこガチャ11連の結果にゃ！`)
      .setDescription(result)
      .setFooter({
        text: "アイテム案は随時募集中にゃ！（ロスアカラプラス仕様）",
      });

    await interaction.reply({
      flags: [4096], //silent
      embeds: [embed],
    });
  }
}
