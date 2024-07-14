import { SlashCommandBuilder ,  EmbedBuilder} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("gacha")
  .setDescription("闇市を引くにゃ！(11連対応！)");

export async function execute(interaction) {
  const arr = ["# ★レリック　虹のにぼし", "## ☆アーティファクト　金のにぼし", "### ハイクオリティ　銀のにぼし", "レギュラー　銅のにぼし", "ノービス　にぼし", "カースド　にぼし（賞味期限切れ）","# ★レリック　ゲーミングオーラﾆｮﾜﾐﾔ", "## ☆アーティファクト　ﾆｮﾜﾐﾔﾘｶ（画像加工前）", "### ハイクオリティ　全速前進ﾆｮﾜﾐﾔ", "レギュラー　震えているﾆｮﾜﾐﾔ", "ノービス　ﾆｮﾜﾐﾔﾘｶ", "カースド　まだ本腰入れて探してはないが鍵がない気がするﾆｮﾜﾐﾔ", "ノービス 乙女のぱんつ", "ノービス 宝石"];
  const weight = [1, 10, 30, 220, 704, 15, 1, 10, 30, 220, 724, 15, 10, 10];
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

  await interaction.reply({
    flags: [ 4096 ],//silent
    content: `結果\n${result} `});
}
