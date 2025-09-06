// commands/utils/idle.mjs
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  Point,
  IdleGame,
  Mee6Level,
  sequelize,
} from "../../models/database.mjs";
import config from "../../config.mjs"; // config.jsにゲーム設定を追加する

export const help = {
  category: "slash",
  description:
    "放置ゲームを始めます。レガシーピザを消費してピザ窯を強化しニョワミヤを増やしましょう！",
  notes:
    "ピザの獲得量が少し増えますが見返りとか元を取るとかは考えないでください。",
};
export const data = new SlashCommandBuilder()
  .setName("idle")
  .setNameLocalizations({ ja: "放置ゲーム" })
  .setDescription("あなたの放置ゲームの現在の状況を確認します。");

export async function execute(interaction) {
  const initialReply = await interaction.reply({
    content: "Now loading...ニョワミヤを数えています...",
    ephemeral: true,
  });

  const userId = interaction.user.id;
  const [point, createdPoint] = await Point.findOrCreate({ where: { userId } });
  const [idleGame, createdIdle] = await IdleGame.findOrCreate({
    where: { userId },
  });
  //オフライン計算
  await updateUserIdleGame(userId);
  // ★★★ ピザ窯覗きバフ処理 ★★★
  const now = new Date();
  if (!idleGame.buffExpiresAt || idleGame.buffExpiresAt < now) {
    // バフなし or 切れていた場合 → 新しく24hバフ付与
    idleGame.buffMultiplier = 2.0;
    idleGame.buffExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await idleGame.save();
  } else {
    // バフ中 → 残りが24h未満ならリセット
    const remaining = idleGame.buffExpiresAt - now;
    if (remaining < 24 * 60 * 60 * 1000) {
      idleGame.buffExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await idleGame.save();
    }
  }
  //Mee6レベル取得
  const mee6Level = await Mee6Level.findOne({ where: { userId } });
  const meatFactoryLevel = mee6Level ? mee6Level.level : 0;

  // --- ★★★ ここからが修正箇所 ★★★ ---

  // generateEmbed関数：この関数が呼ばれるたびに、最新のDBオブジェクトから値を読み出すようにする
  const generateEmbed = (isFinal = false) => {
    // 最新のDBオブジェクトから値を読み出す
    const ovenEffect = idleGame.pizzaOvenLevel;
    const cheeseEffect =
      1 + config.idle.cheese.effect * idleGame.cheeseFactoryLevel;
    const meatEffect = 1 + config.idle.meat.effect * meatFactoryLevel;
    //バフも乗るように
    const productionPerMinute =
      Math.pow(ovenEffect * cheeseEffect, meatEffect) * idleGame.buffMultiplier;
    let pizzaBonusPercentage = 0;
    if (idleGame.population >= 1) {
      pizzaBonusPercentage = Math.log10(idleGame.population) + 1;
    }

    let productionString;
    if (productionPerMinute >= 100) {
      // 100以上の場合は、小数点を切り捨ててカンマ区切りにする
      productionString = Math.floor(productionPerMinute).toLocaleString();
    } else {
      // 100未満の場合は、小数点以下2桁で表示する
      productionString = productionPerMinute.toFixed(2);
    }

    // ★ バフ残り時間計算
    let buffField = null;
    if (idleGame.buffExpiresAt && idleGame.buffExpiresAt > new Date()) {
      const ms = idleGame.buffExpiresAt - new Date();
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      buffField = {
        name: "監督ボーナス",
        value: `**${idleGame.buffMultiplier}倍** 残り **${hours}時間${minutes}分**`,
      };
    }

    const embed = new EmbedBuilder()
      .setTitle("ニョワ集めステータス")
      .setColor(isFinal ? "Grey" : "Gold")
      .setDescription(
        `現在のニョワミヤ人口: **${Math.floor(
          idleGame.population
        ).toLocaleString()} 匹**`
      )
      .addFields(
        {
          name: "ピザ窯",
          value: `Lv. ${idleGame.pizzaOvenLevel}`,
          inline: true,
        },
        {
          name: "チーズ工場",
          value: `Lv. ${idleGame.cheeseFactoryLevel}`,
          inline: true,
        },
        {
          name: "精肉工場 (Mee6)",
          value: `Lv. ${meatFactoryLevel}`,
          inline: true,
        },
        {
          name: "計算式",
          value: `(${ovenEffect.toFixed(0)} × ${cheeseEffect.toFixed(
            2
          )}) ^ ${meatEffect.toFixed(2)} × ${idleGame.buffMultiplier.toFixed(1)}`,
        },
        {
          name: "毎分の増加予測",
          value: `${productionString} 匹/分`,
        },
        {
          name: "人口ボーナス(ピザ獲得量)",
          value: `+${pizzaBonusPercentage.toFixed(3)} %`,
        }
      )
      .setFooter({
        text: `現在の所持ピザ: ${Math.floor(
          point.legacy_pizza
        ).toLocaleString()}枚 | 10分ごと、あるいは再度/idleで更新されます。`,
      });

    if (buffField) embed.addFields(buffField);

    return embed;
  };

  // generateButtons関数：こちらも、最新のDBオブジェクトからコストを計算するようにする
  const generateButtons = (isDisabled = false) => {
    // ボタンを描画するたびに、コストを再計算する
    const ovenCost = Math.floor(
      config.idle.oven.baseCost *
        Math.pow(config.idle.oven.multiplier, idleGame.pizzaOvenLevel)
    );
    const cheeseCost = Math.floor(
      config.idle.cheese.baseCost *
        Math.pow(config.idle.cheese.multiplier, idleGame.cheeseFactoryLevel)
    );

    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`upgrade_oven`)
        .setLabel(`ピザ窯強化(+1) (${ovenCost.toLocaleString()}ピザ)`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isDisabled || point.legacy_pizza < ovenCost),
      new ButtonBuilder()
        .setCustomId(`upgrade_cheese`)
        .setLabel(
          `チーズ工場強化(+${config.idle.cheese.effect * 100}%) (${cheeseCost.toLocaleString()}ピザ)`
        )
        .setStyle(ButtonStyle.Success)
        .setDisabled(isDisabled || point.legacy_pizza < cheeseCost)
    );
  };

  // 最初のメッセージを送信
  await interaction.editReply({
    content:
      "⏫ ピザ窯を覗いてから **24時間** はニョワミヤの流入量が **2倍** になります！",
    embeds: [generateEmbed()],
    components: [generateButtons()],
  });

  const filter = (i) => i.user.id === userId;
  const collector = initialReply.createMessageComponentCollector({
    filter,
    time: 60_000,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();

    // ★★★ コレクター内では、必ずDBから最新のデータを再取得する ★★★
    const latestPoint = await Point.findOne({ where: { userId } });
    const latestIdleGame = await IdleGame.findOne({ where: { userId } });

    let facility, cost, facilityName;

    if (i.customId === "upgrade_oven") {
      facility = "oven";
      cost = Math.floor(
        config.idle.oven.baseCost *
          Math.pow(config.idle.oven.multiplier, latestIdleGame.pizzaOvenLevel)
      );
      facilityName = "ピザ窯";
    } else {
      // upgrade_cheese
      facility = "cheese";
      cost = Math.floor(
        config.idle.cheese.baseCost *
          Math.pow(
            config.idle.cheese.multiplier,
            latestIdleGame.cheeseFactoryLevel
          )
      );
      facilityName = "チーズ工場";
    }

    if (latestPoint.legacy_pizza < cost) {
      await i.followUp({
        content: `ピザが足りません！ (必要: ${cost.toLocaleString()} / 所持: ${Math.floor(latestPoint.legacy_pizza).toLocaleString()})`,
        ephemeral: true,
      });
      return; // この場合はコレクターを止めず、続けて操作できるようにする
    }

    try {
      await sequelize.transaction(async (t) => {
        // DB更新は、必ず再取得した最新のオブジェクトに対して行う
        await latestPoint.decrement("legacy_pizza", {
          by: cost,
          transaction: t,
        });
        if (facility === "oven") {
          await latestIdleGame.increment("pizzaOvenLevel", {
            by: 1,
            transaction: t,
          });
        } else {
          await latestIdleGame.increment("cheeseFactoryLevel", {
            by: 1,
            transaction: t,
          });
        }
      });

      // ★★★ 成功したら、DBから更新された最新の値を、関数のスコープ内にあるオリジナルのDBオブジェクトに再代入する ★★★
      point.legacy_pizza = latestPoint.legacy_pizza;
      idleGame.pizzaOvenLevel = latestIdleGame.pizzaOvenLevel;
      idleGame.cheeseFactoryLevel = latestIdleGame.cheeseFactoryLevel;

      // そして、更新されたオブジェクトを使って、メッセージを再描画する
      await interaction.editReply({
        embeds: [generateEmbed()],
        components: [generateButtons()],
      });

      await i.followUp({
        content: `✅ **${facilityName}** の強化に成功しました！`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("IdleGame Collector Upgrade Error:", error);
      await i.followUp({
        content: "❌ アップグレード中にエラーが発生しました。",
        ephemeral: true,
      });
    }
  });

  collector.on("end", (collected) => {
    interaction.editReply({
      embeds: [generateEmbed(true)],
      components: [generateButtons(true)],
    });
  });
}

/**
 *  * ==========================================================================================
 * ★★★ 将来の自分へ: 計算式に関する超重要メモ ★★★
 *
 * この updateUserIdleGame 関数内の人口計算ロジックは、
 * SupabaseのSQL関数 `update_all_idle_games_and_bonuses` 内でも、
 * 全く同じ計算式でSQLとして再現されています。
 *
 * (SQL関数は、tasks/pizza-distributor.mjsから10分毎に呼び出され、
 * 全ユーザーの人口を一括で更新するために使われています)
 *
 * そのため、将来ここで計算式を変更する場合 (例: 施設の補正数値をconfigで変える、新しい施設を追加する) は、
 * 必ずSupabaseにある `update_all_idle_games_and_bonuses` 関数も
 * 同じロジックになるよう修正してください！
 *
 * ==========================================================================================
 *
 * 特定ユーザーの放置ゲームデータを更新し、最新の人口を返す関数
 * @param {string} userId - DiscordのユーザーID
 * @returns {Promise<object|null>} 成功した場合は { population, pizzaBonusPercentage }、データがなければ null
 */
export async function updateUserIdleGame(userId) {
  // IdleGameテーブルにユーザーデータがあるか確認
  const idleGame = await IdleGame.findOne({ where: { userId } });
  // データがなければ、何もせず null を返す
  if (!idleGame) {
    return null;
  }

  // --- 既存のオフライン計算ロジックを、ほぼそのまま持ってくる ---
  const mee6Level = await Mee6Level.findOne({ where: { userId } });
  const meatFactoryLevel = mee6Level ? mee6Level.level : 0;
  const now = new Date();

  const lastUpdate = idleGame.lastUpdatedAt || now;
  const elapsedSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;

  const ovenEffect = idleGame.pizzaOvenLevel; //基礎
  const cheeseEffect = 
    1 + config.idle.cheese.effect * idleGame.cheeseFactoryLevel;//乗算
  const meatEffect = 1 + config.idle.meat.effect * meatFactoryLevel;//指数
  let currentBuffMultiplier = 1.0; // ブースト
  if (idleGame.buffExpiresAt && new Date(idleGame.buffExpiresAt) > now) {
    currentBuffMultiplier = idleGame.buffMultiplier;
  }
  // ((基礎*乗算)^指数)*ブースト
  const productionPerMinute = Math.pow(ovenEffect * cheeseEffect, meatEffect) * currentBuffMultiplier;

  if (elapsedSeconds > 0) {
    const addedPopulation = (productionPerMinute / 60) * elapsedSeconds;
    idleGame.population += addedPopulation;
    idleGame.lastUpdatedAt = now;
    await idleGame.save();
  }

  // 人口ボーナスを計算
  // log10(人口) + 1 をパーセンテージとして返す 1桁で1% 2桁で2% 3桁で3% ...
  let pizzaBonusPercentage = 0;
  if (idleGame.population >= 1) {
    pizzaBonusPercentage = Math.log10(idleGame.population) + 1;
  }

 // バフ残り時間（ms → 時間・分に変換）を計算
let buffRemaining = null;
if (idleGame.buffExpiresAt && new Date(idleGame.buffExpiresAt) > now) {
  const ms = idleGame.buffExpiresAt - now;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  buffRemaining = { hours, minutes };
}

  // 最新の人口と、計算したボーナスをオブジェクトとして返す
  return {
    population: idleGame.population,
    pizzaBonusPercentage: pizzaBonusPercentage,
    buffRemaining,
  };
}

//--------------------------
//ピザボーナスのいろいろ
//--------------------------
/**
 * ユーザーIDから、現在のピザボーナス倍率を取得する関数 (例: 8.2% -> 1.082)
 * @param {string} userId - DiscordのユーザーID
 * @returns {Promise<number>} ボーナス倍率。ボーナスがない場合は 1.0
 */
export async function getPizzaBonusMultiplier(userId) {
  const idleGame = await IdleGame.findOne({ where: { userId } });
  if (!idleGame || idleGame.pizzaBonusPercentage <= 0) {
    return 1.0; // ボーナスなし
  }
  return 1 + idleGame.pizzaBonusPercentage / 100.0;
}

/**
 * ★★★ 万能ピザボーナス適用関数（リファクタリング版）★★★
 * 与えられたベース量にボーナスを適用し、「整数」で返す。
 */
export async function applyPizzaBonus(userId, baseAmount) {
  // 1. 新しい関数で倍率を取得
  const multiplier = await getPizzaBonusMultiplier(userId);
  // 2. 計算して、切り捨てて返す
  return Math.floor(baseAmount * multiplier);
}

//人口とかの丸め
/**
 * 大きな数を見やすく整形
 * 0〜99,999 → そのまま
 * 10万~9,999,999 →　●●.●●万
 * 1000万〜9999億 → ●億●万
 * 1兆以上 → 指数表記
 */
export function formatNumberReadable(n) {
  if (n <= 99999) {
    return n.toString();
   } else if (n < 1000_0000) { // 1000万未満
    const man = n / 10000;
    return `${man.toFixed(2)}万`;
  } else if (n < 1_0000_0000_0000) { // 1兆未満
    const oku = Math.floor(n / 100000000);
    const man = Math.floor((n % 100000000) / 10000);
    return `${oku > 0 ? oku + "億" : ""}${man > 0 ? man + "万" : ""}`;
  } else {
    return n.toExponential(2); // 小数点2桁の指数表記
  }
}