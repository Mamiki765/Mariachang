import { SlashCommandBuilder ,  EmbedBuilder} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("gacha")
  .setDescription("ガチャシミュです")
  .addSubcommand((subcommand) =>
    subcommand.setName("ppp").setDescription("闇市を11回引きます")
  )

.addSubcommand((subcommand) =>
    subcommand.setName("laplace").setDescription("ラプラスの箱を11回開けます")
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  //PPP闇市形式
  if (subcommand == "ppp") {
  // RL1 AF10 HQ30 R220 N724 
  const arr = ["# ★レリック　虹色に光り輝くにぼし", "## ☆アーティファクト　極上にぼし", "### ハイクオリティ　にぼしラーメン", "レギュラー　にぼしフレーク", "ノービス　にぼし", "カースド　にぼし（使用済み）","# ★レリック　ゲーミングオーラﾆｮﾜﾐﾔ", "## ☆アーティファクト　ﾆｮﾜﾐﾔﾘｶ（画像加工前）", "### ハイクオリティ　全速前進ﾆｮﾜﾐﾔ", "レギュラー　震えているﾆｮﾜﾐﾔ", "ノービス　ﾆｮﾜﾐﾔﾘｶ", "カースド　まだ本腰入れて探してはないが鍵がない気がするﾆｮﾜﾐﾔ", "ノービス 乙女のぱんつ", "ノービス 宝石","レギュラー　ゆづさや"];
  const weight = [1, 10, 30, 210, 704, 15, 1, 10, 30, 210, 724, 15, 10, 10,20];
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
      .setColor(0xEFDCAA)
      .setAuthor({ name: interaction.member.displayName, iconURL: interaction.member.displayAvatarURL()})
      .setTitle(`にぼしガチャ11連の結果にゃ！`)
      .setDescription(result)
      .setFooter({text: "（PPP闇市仕様）"})
  
  await interaction.reply({
    flags: [ 4096 ],//silent
    embeds: [embed]
    });
  }else if(subcommand == "laplace"){
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
      if (random < weight[i]) {　　//レアリティ決定
        result += arr[i] + maps[i][Math.floor(Math.random() * maps[i].length)] + "\n";　//結果を付け足して次に
        break;
      } else {
        random -= weight[i];
      }
    }
  }  
  
    const embed = new EmbedBuilder()
      .setColor(0xEFDCAA)
      .setAuthor({ name: interaction.member.displayName, iconURL: interaction.member.displayAvatarURL()})
      .setTitle(`ひめこガチャ11連の結果にゃ！`)
      .setDescription(result)
      .setFooter({text: "アイテム案は随時募集中にゃ！（ロスアカラプラス仕様）"})
  
  await interaction.reply({
    flags: [ 4096 ],//silent
    embeds: [embed]
    });
 }
}
