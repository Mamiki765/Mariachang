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
/**
 * 具材メモ　(基本*乗算)^指数 *ブースト
 * 基本施設：ピザ窯
 * 乗算１：チーズ工場
 * 乗算２：トマト農場（トマトソース）100万
 * 乗算３：マッシュルーム 1000万
 * 乗算４：アンチョビ 1億
 * 指数施設：精肉工場（サラミ）
 * ブースト：お手伝い（２４時間ブースト）
 * 予定１：プレステージでパイナップルが指数や乗数に追加
 * プレステージ力　log₁₀(人口)とかか？
 * 予定２：実績などでバジルソースが指数や乗数に追加
 */
export const help = {
  category: "slash",
  description:
    "放置ゲームを始めます。ニョボチップを消費してピザ窯を強化しニョワミヤを増やしましょう！",
  notes:
    "チップの獲得量が少し増えますが見返りとか元を取るとかは考えないでください。",
};
export const data = new SlashCommandBuilder()
  .setName("idle")
  .setNameLocalizations({ ja: "放置ゲーム" })
  .setDescription("あなたの放置ゲームの現在の状況を確認します。")
  .addStringOption((option) =>
    option
      .setName("ranking")
      .setNameLocalizations({ ja: "ランキング表示" })
      .setDescription("ランキングなどを表示できます")
      .setRequired(false)
      .addChoices(
        { name: "ランキング表示（公開）", value: "public" },
        { name: "ランキング表示（非公開）", value: "private" },
        { name: "表示しない", value: "none" } // あるいは、ephemeral: trueを外した簡易的な自分の工場を見せるオプション
      )
  );

// --- 共通化: コスト計算関数 ---

/**
 * 施設のアップグレードコストを計算する
 * @param {string} type - 'oven', 'cheese' などの施設名
 * @param {number} level - 現在の施設レベル
 * @returns {number} 次のレベルへのアップグレードコスト
 */
function calculateFacilityCost(type, level) {
  const facility = config.idle[type];
  if (!facility) return Infinity; // 念のため
  return Math.floor(facility.baseCost * Math.pow(facility.multiplier, level));
}

/**
 * 全ての施設のコストを計算し、オブジェクトとして返す
 * @param {object} idleGame - IdleGameモデルのインスタンス
 * @returns {object} 各施設のコストが格納されたオブジェクト
 */
function calculateAllCosts(idleGame) {
  return {
    oven: calculateFacilityCost("oven", idleGame.pizzaOvenLevel),
    cheese: calculateFacilityCost("cheese", idleGame.cheeseFactoryLevel),
    tomato: calculateFacilityCost("tomato", idleGame.tomatoFarmLevel),
    mushroom: calculateFacilityCost("mushroom", idleGame.mushroomFarmLevel),
    anchovy: calculateFacilityCost("anchovy", idleGame.anchovyFactoryLevel),
  };
}

export async function execute(interaction) {
  const rankingChoice = interaction.options.getString("ranking");
  if (rankingChoice === "public" || rankingChoice === "private") {
    const isPrivate = rankingChoice === "private";
    await executeRankingCommand(interaction, isPrivate);
  } else {
    //工場
    const initialReply = await interaction.reply({
      content: "Now loading...ニョワミヤを数えています...",
      flags: 64,
    });

    const userId = interaction.user.id;
    const [point, createdPoint] = await Point.findOrCreate({
      where: { userId },
    });
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
      //プレステージボーナス
      const pp = idleGame.prestigePower || 0; //未定義で0
      // 最新のDBオブジェクトから値を読み出す
      const ovenEffect = idleGame.pizzaOvenLevel + pp;
      const cheeseEffect =
        1 + config.idle.cheese.effect * (idleGame.cheeseFactoryLevel + pp);
      const meatEffect = 1 + config.idle.meat.effect * (meatFactoryLevel + pp);
      const tomatoEffect =
        1 + config.idle.tomato.effect * (idleGame.tomatoFarmLevel + pp);
      const mushroomEffect =
        1 + config.idle.mushroom.effect * (idleGame.mushroomFarmLevel + pp);
      const anchovyEffect =
        1 + config.idle.anchovy.effect * (idleGame.anchovyFactoryLevel + pp);
      //バフも乗るように
      const productionPerMinute =
        Math.pow(
          ovenEffect *
            cheeseEffect *
            tomatoEffect *
            mushroomEffect *
            anchovyEffect,
          meatEffect
        ) * idleGame.buffMultiplier;
      let pizzaBonusPercentage = 0;
      if (idleGame.population >= 1) {
        pizzaBonusPercentage = Math.log10(idleGame.population) + 1 + pp; //チップボーナスにもPP
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
      let hours = null;
      if (idleGame.buffExpiresAt && idleGame.buffExpiresAt > new Date()) {
        const ms = idleGame.buffExpiresAt - new Date();
        hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        buffField = `**${idleGame.buffMultiplier}倍** 残り **${hours}時間${minutes}分**`;
      }

      // EmbedのDescriptionをプレステージ回数に応じて変更する
      let descriptionText;
      if (idleGame.prestigeCount > 0) {
        descriptionText = `現在のニョワミヤ人口: **${formatNumberJapanese(
          Math.floor(idleGame.population)
        )} 匹**
最高人口: ${formatNumberJapanese(
          Math.floor(idleGame.highestPopulation)
        )} 匹 PP: **${pp.toFixed(2)}** SP: **${idleGame.skillPoints.toFixed(2)}**
全工場Lv、獲得ニョボチップ%: **+${pp.toFixed(3)}**`;
      } else {
        descriptionText = `現在のニョワミヤ人口: **${formatNumberJapanese(
          Math.floor(idleGame.population)
        )} 匹**`;
      }

      //コストを表示するために計算する
      const costs = calculateAllCosts(idleGame);

      const embed = new EmbedBuilder()
        .setTitle("ピザ工場ステータス")
        .setColor(isFinal ? "Grey" : "Gold")
        .setDescription(descriptionText)
        .addFields(
          {
            name: `${config.idle.oven.emoji}ピザ窯`,
            value: `Lv. ${idleGame.pizzaOvenLevel} (${ovenEffect.toFixed(0)}) Next.${costs.oven.toLocaleString()}chip`,
            inline: true,
          },
          {
            name: `${config.idle.cheese.emoji}チーズ工場`,
            value: `Lv. ${idleGame.cheeseFactoryLevel} (${cheeseEffect.toFixed(
              2
            )}) Next.${costs.cheese.toLocaleString()}chip`,
            inline: true,
          },
          {
            name: `${config.idle.tomato.emoji}トマト農場`,
            value:
              idleGame.prestigeCount > 0 ||
              idleGame.population >= config.idle.tomato.unlockPopulation
                ? `Lv. ${idleGame.tomatoFarmLevel} (${tomatoEffect.toFixed(2)}) Next.${costs.tomato.toLocaleString()}chip`
                : `(要:人口${formatNumberJapanese(config.idle.tomato.unlockPopulation)})`, //未解禁なら出さない
            inline: true,
          },
          {
            name: `${config.idle.mushroom.emoji}マッシュルーム農場`,
            value:
              idleGame.prestigeCount > 0 ||
              idleGame.population >= config.idle.mushroom.unlockPopulation
                ? `Lv. ${idleGame.mushroomFarmLevel} (${mushroomEffect.toFixed(3)}) Next.${costs.mushroom.toLocaleString()}chip`
                : `(要:人口${formatNumberJapanese(config.idle.mushroom.unlockPopulation)})`,
            inline: true,
          },
          {
            name: `${config.idle.anchovy.emoji}アンチョビ工場`,
            value:
              idleGame.prestigeCount > 0 ||
              idleGame.population >= config.idle.anchovy.unlockPopulation
                ? `Lv. ${idleGame.anchovyFactoryLevel} (${anchovyEffect.toFixed(2)}) Next.${costs.anchovy.toLocaleString()}chip`
                : `(要:人口${formatNumberJapanese(config.idle.anchovy.unlockPopulation)})`,
            inline: true,
          },
          {
            name: `${config.idle.meat.emoji}精肉工場 (Mee6)`,
            value: `Lv. ${meatFactoryLevel} (${meatEffect.toFixed(2)})`,
            inline: true,
          },
          {
            name: "<:nyobosi:1293141862634229811>ブースト",
            value: buffField ? buffField : "ブースト切れ", //ここを見てる時点で24時間あるはずだが念のため
            inline: true,
          },
          {
            name: "計算式",
            value: `(${ovenEffect.toFixed(1)} × ${cheeseEffect.toFixed(
              2
            )} × ${tomatoEffect.toFixed(2)} × ${mushroomEffect.toFixed(3)} × ${anchovyEffect.toFixed(2)}) ^ ${meatEffect.toFixed(2)} × ${idleGame.buffMultiplier.toFixed(1)}`,
          },
          {
            name: "毎分の増加予測",
            value: `${productionString} 匹/分`,
          },
          {
            name: "人口ボーナス(チップ獲得量)",
            value: `${config.casino.currencies.legacy_pizza.emoji}+${pizzaBonusPercentage.toFixed(3)} %`,
          }
        )
        .setFooter({
          text: `現在の所持チップ: ${Math.floor(
            point.legacy_pizza
          ).toLocaleString()}枚 | 10分ごと、あるいは再度/idleで更新されます。`,
        });

      return embed;
    };

    // generateButtons関数：こちらも、最新のDBオブジェクトからコストを計算するようにする
    const generateButtons = (isDisabled = false) => {
      // ボタンを描画するたびに、コストを再計算する
      const costs = calculateAllCosts(idleGame);

      //ブースト延長
      //ブーストの残り時間を計算 (ミリ秒で)
      const now = new Date();
      const remainingMs = idleGame.buffExpiresAt
        ? idleGame.buffExpiresAt.getTime() - now.getTime()
        : 0;
      const remainingHours = remainingMs / (1000 * 60 * 60);
      // 残り時間に応じて、ニョボシの雇用コストを決定（1回目500,2回目1000)
      let nyoboshiCost = 0;
      let nyoboshiemoji = "1293141862634229811";
      if (remainingHours > 0 && remainingHours < 24) {
        nyoboshiCost = 500;
      } else if (remainingHours >= 24 && remainingHours < 48) {
        nyoboshiCost = 1000;
        nyoboshiemoji = "1396542940096237658";
      } else if (remainingHours >= 48) {
        nyoboshiCost = 999999; //そもそもすぐ下を見ればわかるがこの時は押せないわけで無言の圧もとい絵文字用
        nyoboshiemoji = "1414076963592736910";
      }
      // ボタンを無効化する条件を決定
      const isNyoboshiDisabled =
        isDisabled || // 全体的な無効化フラグ
        remainingHours >= 48 || // 残り48時間以上
        point.legacy_pizza < nyoboshiCost || // チップが足りない
        nyoboshiCost === 0; // コストが0 (バフが切れているなど)

      const facilityRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`idle_upgrade_oven`)
          .setEmoji(config.idle.oven.emoji)
          .setLabel(`+${config.idle.oven.effect}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(isDisabled || point.legacy_pizza < costs.oven),
        new ButtonBuilder()
          .setCustomId(`idle_upgrade_cheese`)
          .setEmoji(config.idle.cheese.emoji)
          .setLabel(`+${config.idle.cheese.effect}`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(isDisabled || point.legacy_pizza < costs.cheese)
      );
      // ★ 人口が条件を満たしていたらトマトボタンを追加(以下3つともプレステージ後は無条件)
      if (
        idleGame.prestigeCount > 0 ||
        idleGame.population >= config.idle.tomato.unlockPopulation
      ) {
        facilityRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`idle_upgrade_tomato`)
            .setEmoji(config.idle.tomato.emoji)
            .setLabel(`+${config.idle.tomato.effect}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(isDisabled || point.legacy_pizza < costs.tomato)
        );
      }
      // 人口が条件を満たしていたらマッシュルームボタンを追加
      if (
        idleGame.prestigeCount > 0 ||
        idleGame.population >= config.idle.mushroom.unlockPopulation
      ) {
        facilityRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`idle_upgrade_mushroom`)
            .setEmoji(config.idle.mushroom.emoji)
            .setLabel(`+${config.idle.mushroom.effect}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(isDisabled || point.legacy_pizza < costs.mushroom)
        );
      }
      // 人口が条件を満たしていたらアンチョビボタンを追加
      if (
        idleGame.prestigeCount > 0 ||
        idleGame.population >= config.idle.anchovy.unlockPopulation
      ) {
        facilityRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`idle_upgrade_anchovy`)
            .setEmoji(config.idle.anchovy.emoji)
            .setLabel(`+${config.idle.anchovy.effect}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(isDisabled || point.legacy_pizza < costs.anchovy)
        );
      }
      //ブーストボタンを後から追加
      const boostRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("idle_extend_buff")
          .setLabel(
            nyoboshiCost >= 999999
              ? "ニョボシは忙しそうだ…"
              : `ニョボシを雇う (+24h) (${nyoboshiCost.toLocaleString()}枚)`
          )
          .setStyle(ButtonStyle.Success)
          .setEmoji(nyoboshiemoji)
          .setDisabled(isNyoboshiDisabled)
      );

      // 250923 プレステージボタンの表示ロジック
      if (idleGame.population >= config.idle.prestige.unlockPopulation) {
        // 1. 現在の人口から、プレステージした場合に得られる新しいPPを計算
        const newPrestigePower = Math.log10(idleGame.population);

        // 2. ボタンを無効化する条件を決定
        //    - グローバルな無効化フラグ(isDisabled)が立っている
        //    - または、現在の人口が過去の最高人口を超えていない（PPが減るのを防ぐため）
        const isPrestigeDisabled =
          isDisabled || idleGame.population <= idleGame.highestPopulation;

        // 3. プレステージ回数に応じてボタンのラベルを動的に生成
        let prestigeButtonLabel;
        if (idleGame.prestigeCount === 0) {
          // 初回プレステージの場合
          prestigeButtonLabel = `プレステージ Power: ${newPrestigePower.toFixed(3)}`;
        } else {
          // 2回目以降の場合、PPとSPの「増加量」も表示してあげる
          const powerGain = newPrestigePower - idleGame.prestigePower;
          prestigeButtonLabel = `Prestige Power: ${newPrestigePower.toFixed(2)} (${powerGain > 0 ? '+' : ''}${powerGain.toFixed(2)})`;
        }

        // 4. ボタンを生成して、boostRowに追加
        boostRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`idle_prestige`) // customIdを有効化
            .setEmoji(config.idle.prestige.emoji)
            .setLabel(prestigeButtonLabel) // 動的に生成したラベルを設定
            .setStyle(ButtonStyle.Danger)
            .setDisabled(isPrestigeDisabled) // 動的に決定した有効/無効状態を設定
        );
      }
      //遊び方のボタン
        boostRow.addComponents(
          new ButtonBuilder()
            .setCustomId("idle_info")
            .setLabel("遊び方")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("💡")
            .setDisabled(isDisabled)
        );
      

      return [facilityRow, boostRow];
    };

    //もう一度時間を計算
    const remainingMs = idleGame.buffExpiresAt
      ? idleGame.buffExpiresAt.getTime() - now.getTime()
      : 0;
    const remainingHours = remainingMs / (1000 * 60 * 60);
    //24時間あるかないかで変わる
    let content =
      "⏫ ピザ窯を覗いてから **24時間** はニョワミヤの流入量が **2倍** になります！";
    if (remainingHours > 24) {
      content =
        "ニョボシが働いている(残り24時間以上)時はブーストは延長されません。";
    }

    // 最初のメッセージを送信
    await interaction.editReply({
      content: content,
      embeds: [generateEmbed()],
      components: generateButtons(),
    });

    const filter = (i) =>
      i.user.id === userId && i.customId.startsWith("idle_");
    const collector = initialReply.createMessageComponentCollector({
      filter,
      time: 60_000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "idle_prestige") {
        // プレステージ処理は特別なので、ここで処理して、下の施設強化ロジックには進ませない
        await handlePrestige(i, collector); // プレステージ処理関数を呼び出す
        return; // handlePrestigeが終わったら、このcollectイベントの処理は終了
//遊び方
      } else if (i.customId === "idle_info") {
        await i.deferUpdate();//一旦考え中を入れる
        const spExplanation = `### ピザ工場の遊び方
放置ゲーム「ピザ工場」はピザ工場を強化し、チーズピザが好きな雨宿りの珍生物「ニョワミヤ」を集めるゲーム(？)です。
このゲームを進めるのに必要なものはゲーム内では稼げません。
雨宿りで発言することで手に入る通貨「ニョボチップ」を使います。
ニョボチップは毎日のログボでも手に入る他、上位通貨であるニョワコインを消費しても入手できます。
ピザ工場を強化すると、計算式に基づき10分に1度ニョワミヤ達が集まってきます。
初めはピザ窯とチーズ工場だけですが、人口が増えるとトマト農場、マッシュルーム農場、アンチョビ工場などの施設が増えて少しずつ早くなっていきます。
また、発言によりMee6(ルカ)の「お得意様レベル」を上げると精肉（サラミ）工場の指数が若干増えて、更に加速します。
更に工場を最後に見てから24時間は人口増加が2倍になります（ニョボシを働かせることで72時間まで延長ができます）
人口が増えるとちょっぴりニョボチップの入手量が増えます。めざせ1億匹！
### プレステージ
1億匹に到達すると、パイナップル農場を稼働できます。（プレステージ）
プレステージすると人口と工場のLvは0になりますが、到達した最高人口に応じたPPとSPを得ることができます。
- PP:プレステージパワー、工場のLVとニョボチップ獲得%が増える他、一定値貯まると色々解禁される。
  - PP8:3施設の人口制限解除。
  - PP9:「施設適当強化」と「スキル」の解禁（未実装）
- SP:スキルポイント。消費する事で強力なスキルが習得できる。
(PPとSPスキルはまだまだ未実装です。)
`;
        await i.followUp({
          content: spExplanation,
          flags: 64, // 本人にだけ見えるメッセージ
        });
        return; // 解説を表示したら、このcollectイベントの処理は終了
      }

      await i.deferUpdate();

      // ★★★ コレクター内では、必ずDBから最新のデータを再取得する ★★★
      const latestPoint = await Point.findOne({ where: { userId } });
      const latestIdleGame = await IdleGame.findOne({ where: { userId } });

      let facility, cost, facilityName;

      if (i.customId === "idle_upgrade_oven") {
        facility = "oven";
        cost = calculateFacilityCost("oven", latestIdleGame.pizzaOvenLevel);
        facilityName = "ピザ窯";
      } else if (i.customId === "idle_upgrade_cheese") {
        facility = "cheese";
        cost = calculateFacilityCost(
          "cheese",
          latestIdleGame.cheeseFactoryLevel
        );
        facilityName = "チーズ工場";
      } else if (i.customId === "idle_upgrade_tomato") {
        facility = "tomato";
        cost = calculateFacilityCost("tomato", latestIdleGame.tomatoFarmLevel);
        facilityName = "トマト農場";
      } else if (i.customId === "idle_upgrade_mushroom") {
        facility = "mushroom";
        cost = calculateFacilityCost(
          "mushroom",
          latestIdleGame.mushroomFarmLevel
        );
        facilityName = "マッシュルーム農場";
      } else if (i.customId === "idle_upgrade_anchovy") {
        facility = "anchovy";
        cost = calculateFacilityCost(
          "anchovy",
          latestIdleGame.anchovyFactoryLevel
        );
        facilityName = "アンチョビ工場(ニボシじゃないよ！)";
      } else if (i.customId === "idle_extend_buff") {
        //extend_buff
        facility = "nyobosi";
        const now = new Date();
        const remainingMs = latestIdleGame.buffExpiresAt
          ? latestIdleGame.buffExpiresAt.getTime() - now.getTime()
          : 0;
        const remainingHours = remainingMs / (1000 * 60 * 60);

        if (remainingHours > 0 && remainingHours < 24) {
          cost = 500;
        } else if (remainingHours >= 24 && remainingHours < 48) {
          cost = 1000;
        } else {
          cost = 1e300; // 絶対通らない
        }
        facilityName = "ニョボシ";
      }

      if (latestPoint.legacy_pizza < cost) {
        await i.followUp({
          content: `チップが足りません！ (必要: ${cost.toLocaleString()} / 所持: ${Math.floor(latestPoint.legacy_pizza).toLocaleString()})`,
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
          } else if (facility === "cheese") {
            //elseから念の為cheeseが必要な様に変更
            await latestIdleGame.increment("cheeseFactoryLevel", {
              by: 1,
              transaction: t,
            });
          } else if (facility === "tomato") {
            await latestIdleGame.increment("tomatoFarmLevel", {
              by: 1,
              transaction: t,
            });
          } else if (facility === "mushroom") {
            await latestIdleGame.increment("mushroomFarmLevel", {
              by: 1,
              transaction: t,
            });
          } else if (facility === "anchovy") {
            await latestIdleGame.increment("anchovyFactoryLevel", {
              by: 1,
              transaction: t,
            });
          } else if (facility === "nyobosi") {
            const now = new Date();
            const currentBuff =
              latestIdleGame.buffExpiresAt && latestIdleGame.buffExpiresAt > now
                ? latestIdleGame.buffExpiresAt
                : now;
            latestIdleGame.buffExpiresAt = new Date(
              currentBuff.getTime() + 24 * 60 * 60 * 1000
            );
            await latestIdleGame.save({ transaction: t });
          }
        });

        // ★★★ 成功したら、DBから更新された最新の値を、関数のスコープ内にあるオリジナルのDBオブジェクトに再代入する ★★★
        point.legacy_pizza = latestPoint.legacy_pizza;
        idleGame.pizzaOvenLevel = latestIdleGame.pizzaOvenLevel;
        idleGame.cheeseFactoryLevel = latestIdleGame.cheeseFactoryLevel;
        idleGame.tomatoFarmLevel = latestIdleGame.tomatoFarmLevel;
        idleGame.mushroomFarmLevel = latestIdleGame.mushroomFarmLevel;
        idleGame.anchovyFactoryLevel = latestIdleGame.anchovyFactoryLevel;
        idleGame.buffExpiresAt = latestIdleGame.buffExpiresAt;
        idleGame.buffMultiplier = latestIdleGame.buffMultiplier;

        // そして、更新されたオブジェクトを使って、メッセージを再描画する
        await interaction.editReply({
          embeds: [generateEmbed()],
          components: generateButtons(),
        });

        const successMsg =
          facility === "nyobosi"
            ? `✅ **ニョボシ** を雇い、ブーストを24時間延長しました！`
            : `✅ **${facilityName}** の強化に成功しました！`;

        await i.followUp({
          content: successMsg,
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
        components: generateButtons(true),
      });
    });
  }
}

/**
 * 人口ランキングを表示し、ページめくり機能を担当する関数
 * @param {import("discord.js").CommandInteraction} interaction - 元のインタラクション
 * @param {boolean} isPrivate - この表示を非公開(ephemeral)にするか (デフォルト: public)
 */
async function executeRankingCommand(interaction, isPrivate) {
  await interaction.reply({
    content: "ランキングを集計しています...",
    ephemeral: isPrivate,
  });

  const allIdleGames = await IdleGame.findAll({
    order: [["population", "DESC"]],
    limit: 100, // サーバー負荷を考慮し、最大100位までとする
  });

  if (allIdleGames.length === 0) {
    await interaction.editReply({
      content: "まだ誰もニョワミヤを集めていません。",
    });
    return;
  }

  const itemsPerPage = 10;
  const totalPages = Math.ceil(allIdleGames.length / itemsPerPage);
  let currentPage = 0;

  const generateEmbed = async (page) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = allIdleGames.slice(start, end);

    const rankingFields = await Promise.all(
      currentItems.map(async (game, index) => {
        const rank = start + index + 1;
        let displayName;

        // ★ 改善ポイント1：退会ユーザーの表示を親切に ★
        try {
          const member =
            interaction.guild.members.cache.get(game.userId) ||
            (await interaction.guild.members.fetch(game.userId));
          displayName = member.displayName;
        } catch (e) {
          displayName = "(退会したユーザー)";
        }

        const population = formatNumberJapanese(Math.floor(game.population));
        return {
          name: `**${rank}位**`,
          value: `${displayName}\n└ ${population} 匹`,
          inline: false,
        };
      })
    );

    // 自分の順位を探す
    const myIndex = allIdleGames.findIndex(
      (game) => game.userId === interaction.user.id
    );
    let myRankText = "あなたはまだピザ工場を持っていません。";
    if (myIndex !== -1) {
      const myRank = myIndex + 1;
      const myPopulation = formatNumberJapanese(
        Math.floor(allIdleGames[myIndex].population)
      );
      myRankText = `**${myRank}位** └ ${myPopulation} 匹`;
    }

    return new EmbedBuilder()
      .setTitle("👑 ニョワミヤ人口ランキング 👑")
      .setColor("Gold")
      .setFields(rankingFields)
      .setFooter({ text: `ページ ${page + 1} / ${totalPages}` })
      .addFields({ name: "📌 あなたの順位", value: myRankText });
  };

  const generateButtons = (page) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev_page")
        .setLabel("◀ 前へ")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("next_page")
        .setLabel("次へ ▶")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === totalPages - 1)
    );
  };

  const replyMessage = await interaction.editReply({
    content: "",
    embeds: [await generateEmbed(currentPage)],
    components: [generateButtons(currentPage)],
  });

  const filter = (i) => i.user.id === interaction.user.id;
  const collector = replyMessage.createMessageComponentCollector({
    filter,
    time: 120_000,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();
    if (i.customId === "next_page") currentPage++;
    else if (i.customId === "prev_page") currentPage--;

    await interaction.editReply({
      embeds: [await generateEmbed(currentPage)],
      components: [generateButtons(currentPage)],
    });
  });

  collector.on("end", async () => {
    // ★ 改善ポイント2：コレクター終了時のエラー対策 ★
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        generateButtons(currentPage).components.map((c) => c.setDisabled(true))
      );
      await interaction.editReply({ components: [disabledRow] });
    } catch (error) {
      // メッセージが削除済みの場合などのエラーを無視する
      console.warn(
        "ランキング表示の終了処理中にエラーが発生しました:",
        error.message
      );
    }
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
  //プレステージパワーを代入
  const pp = idleGame.prestigePower || 0;

  // --- 既存のオフライン計算ロジックを、ほぼそのまま持ってくる ---
  const mee6Level = await Mee6Level.findOne({ where: { userId } });
  const meatFactoryLevel = (mee6Level ? mee6Level.level : 0) + pp; //ppはこっちで足す
  const now = new Date();

  const lastUpdate = idleGame.lastUpdatedAt || now;
  const elapsedSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;

  const ovenEffect = idleGame.pizzaOvenLevel + pp; //基礎
  const cheeseEffect =
    1 + config.idle.cheese.effect * (idleGame.cheeseFactoryLevel + pp); //乗算1
  const tomatoEffect =
    1 + config.idle.tomato.effect * (idleGame.tomatoFarmLevel + pp); //乗算2
  const mushroomEffect =
    1 + config.idle.mushroom.effect * (idleGame.mushroomFarmLevel + pp); //乗数3
  const anchovyEffect =
    1 + config.idle.anchovy.effect * (idleGame.anchovyFactoryLevel + pp); //乗数4
  const meatEffect = 1 + config.idle.meat.effect * meatFactoryLevel; //指数(PP効果は上で計算済み)
  let currentBuffMultiplier = 1.0; // ブースト
  if (idleGame.buffExpiresAt && new Date(idleGame.buffExpiresAt) > now) {
    currentBuffMultiplier = idleGame.buffMultiplier;
  }
  // ((基礎*乗算)^指数)*ブースト
  // 250912乗算にトマト追加
  // 250921乗数にアンチョビとキノコ追加
  const productionPerMinute =
    Math.pow(
      ovenEffect * cheeseEffect * tomatoEffect * mushroomEffect * anchovyEffect,
      meatEffect
    ) * currentBuffMultiplier;

  if (elapsedSeconds > 0) {
    const addedPopulation = (productionPerMinute / 60) * elapsedSeconds;
    idleGame.population += addedPopulation;
  }

  // 人口ボーナスを計算
  // log10(人口) + 1 をパーセンテージとして返す 1桁で1% 2桁で2% 3桁で3% ...
  let pizzaBonusPercentage = 0;
  if (idleGame.population >= 1) {
    // プレステージ後は最低でもPP分のボーナスが保証される
    pizzaBonusPercentage = Math.log10(idleGame.population) + 1 + pp;
  } else if (pp > 0) {
    // 人口が1未満でもPPボーナスは有効
    pizzaBonusPercentage = 1 + pp;
  }
  // 計算した最新のボーナス値をDBに保存する
  // これにより、他の機能（ピザ配りなど）が常に最新のボーナス値を参照できる
  idleGame.pizzaBonusPercentage = pizzaBonusPercentage;
  idleGame.lastUpdatedAt = now;
  await idleGame.save();

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
    currentBuffMultiplier,
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

//人口とかの丸め　ログボとか短くするよう
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
  } else if (n < 1000_0000) {
    // 1000万未満
    const man = n / 10000;
    return `${man.toFixed(2)}万`;
  } else if (n < 1_0000_0000_0000) {
    // 1兆未満
    const oku = Math.floor(n / 100000000);
    const man = Math.floor((n % 100000000) / 10000);
    return `${oku > 0 ? oku + "億" : ""}${man > 0 ? man + "万" : ""}`;
  } else {
    return n.toExponential(2); // 小数点2桁の指数表記
  }
}

/**
 * 巨大な数値を、日本の単位（兆、億、万）を使った最も自然な文字列に整形します。
 * 人間が日常的に読み書きする形式を再現します。
 * @param {number} n - フォーマットしたい数値。
 * @returns {string} フォーマットされた文字列。
 * @example
 * formatNumberJapanese(1234567890123); // "1兆2345億6789万123"
 * formatNumberJapanese(100010001);     // "1億1万1"
 * formatNumberJapanese(100000023);     // "1億23"
 * formatNumberJapanese(12345);         // "1万2345"
 * formatNumberJapanese(123);           // "123"
 */
function formatNumberJapanese(n) {
  // 基本的なチェック
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return String(n);
  }
  if (n > Number.MAX_SAFE_INTEGER) {
    return n.toExponential(2);
  }

  const num = Math.floor(n);
  if (num === 0) {
    return "0";
  }

  // 単位の定義
  const units = [
    { value: 1_0000_0000_0000, name: "兆" },
    { value: 1_0000_0000, name: "億" },
    { value: 1_0000, name: "万" },
  ];

  let result = "";
  let tempNum = num;

  // 大きい単位から処理していく
  for (const unit of units) {
    if (tempNum >= unit.value) {
      const part = Math.floor(tempNum / unit.value);
      result += part + unit.name; // 例: "1兆" や "2345億" を追加
      tempNum %= unit.value; // 残りの数値を更新
    }
  }

  // 1万未満の最後の端数を追加
  if (tempNum > 0) {
    result += tempNum;
  }

  // 万が一、入力が0などでresultが空だった場合（最初のifで弾かれるが念のため）
  return result || String(num);
}

/**
 * プレステージの確認と実行を担当する関数
 * @param {import("discord.js").ButtonInteraction} interaction - プレステージボタンのインタラクション
 * @param {import("discord.js").InteractionCollector} collector - 親のコレクター
 */
async function handlePrestige(interaction, collector) {
  // 1. まず、現在のコレクターを止めて、ボタン操作を一旦リセットする
  collector.stop();

  // 2. 確認用のメッセージとボタンを作成
  const confirmationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prestige_confirm_yes")
      .setLabel("はい、リセットします")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🍍"),
    new ButtonBuilder()
      .setCustomId("prestige_confirm_no")
      .setLabel("いいえ、やめておきます")
      .setStyle(ButtonStyle.Danger)
  );

  const confirmationMessage = await interaction.reply({
    content:
      "# ⚠️パイナップル警報！ \n### **本当にプレステージを実行しますか？**\n精肉工場以外の工場レベルと人口がリセットされます。この操作は取り消せません！",
    components: [confirmationRow],
    flags: 64, // 本人にだけ見える確認
    fetchReply: true, // 送信したメッセージオブジェクトを取得するため
  });

  try {
    // 3. ユーザーの応答を待つ (60秒)
    //    .awaitMessageComponent() は、ボタンが押されるまでここで処理を「待機」します
    const confirmationInteraction =
      await confirmationMessage.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000,
      });

    // 4. 押されたボタンに応じて処理を分岐
    if (confirmationInteraction.customId === "prestige_confirm_no") {
      // 「いいえ」が押された場合
      await confirmationInteraction.update({
        content: "プレステージをキャンセルしました。工場は無事です！",
        components: [], // ボタンを消す
      });
      return; // 処理を終了
    }

    // --- 「はい」が押された場合の処理 ---
    await confirmationInteraction.deferUpdate(); // 「考え中...」の状態にする

    let currentPopulation;

    // 5. トランザクションを使って、安全にデータベースを更新
    await sequelize.transaction(async (t) => {
      // ★★★ 最新のDBデータをトランザクション内で再取得！★★★
      const latestIdleGame = await IdleGame.findOne({
        where: { userId: interaction.user.id },
        transaction: t,
        lock: t.LOCK.UPDATE, // 他の処理から同時に書き込まれないようにロックする
      });

      // 念のため、再度プレステージ条件をチェック
      if (latestIdleGame.population <= latestIdleGame.highestPopulation) {
        throw new Error(
          "プレステージの条件を満たしていません（現在の人口が最高人口を超えている必要があります）。"
        );
      }

      // 6. 新しいPPとSPを計算
      currentPopulation = latestIdleGame.population;
      const newPrestigePower = Math.log10(currentPopulation);
      let newSkillPoints = latestIdleGame.skillPoints;

      if (latestIdleGame.prestigeCount === 0) {
        // 初回
        const deduction = config.idle.prestige.spBaseDeduction; // ← configから値を取得
        newSkillPoints =
          newPrestigePower - deduction > 0 ? newPrestigePower - deduction : 0; //マイナスを防ぐ
      } else {
        // 2回目以降
        const powerGain = newPrestigePower - latestIdleGame.prestigePower;
        newSkillPoints += powerGain;
      }

      // 7. データベースの値を更新
      await latestIdleGame.update(
        {
          population: 0,
          pizzaOvenLevel: 0,
          cheeseFactoryLevel: 0,
          tomatoFarmLevel: 0,
          mushroomFarmLevel: 0,
          anchovyFactoryLevel: 0,
          prestigeCount: latestIdleGame.prestigeCount + 1,
          prestigePower: newPrestigePower,
          skillPoints: newSkillPoints,
          highestPopulation: currentPopulation, // 今回の人口を最高記録として保存
          lastUpdatedAt: new Date(), // リセットした日時を記録
        },
        { transaction: t }
      );
    });

    // 8. 成功メッセージを送信
    await confirmationInteraction.editReply({
      content: `●プレステージ
# なんと言うことでしょう！あなたはパイナップル工場を稼働してしまいました！
凄まじい地響きと共に${formatNumberJapanese(currentPopulation)}匹のニョワミヤ達が押し寄せてきます！
彼女（？）たちは怒っているのでしょうか……いえ、違います！ 逆です！ 彼女たちはパイナップルの乗ったピザが大好きなのでした！
狂った様にパイナップルピザを求めたニョワミヤ達によって、今までのピザ工場は藻屑のように吹き飛ばされてしまいました……
-# そしてなぜか次の工場は強化されました。`,
      components: [], // ボタンを消す
    });
  } catch (error) {
    // タイムアウト、またはDB更新エラーが起きた場合
    if (error.message.includes("ransaction")) {
      // DBエラーの場合
      console.error("Prestige DB Error:", error);
      await interaction.editReply({
        content: "❌ データベースエラーにより、プレステージに失敗しました。",
        components: [],
      });
    } else {
      // タイムアウトの場合
      await interaction.editReply({
        content: "タイムアウトしました。プレステージはキャンセルされました。",
        components: [],
      });
    }
  }
}
