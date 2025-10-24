// commands/slashs/idle.mjs
import Decimal from "break_infinity.js";
import { SlashCommandBuilder } from "discord.js";
import { Point, IdleGame, sequelize } from "../../models/database.mjs";
import config from "../../config.mjs"; // config.jsにゲーム設定を追加する
import { unlockAchievements } from "../../utils/achievements.mjs";

//idlegameイベント群
import {
  handleFacilityUpgrade,
  handlePrestige,
  handleSkillReset,
  handleNyoboshiHire,
  handleAutoAllocate,
  handleSkillUpgrade,
  handleInfinity,
  handleAscension,
  handleGeneratorPurchase,
  handleSettings,
  handleInfinityUpgradePurchase,
  handleGhostChipUpgrade,
  handleStartChallenge,
  handleAbortChallenge,
} from "../../idle-game/handlers.mjs";
//idlegame関数群
import { getSingleUserUIData } from "../../idle-game/idle-game-calculator.mjs";

import {
  generateProfileEmbed,
  executeRankingCommand,
  buildFactoryView,
  buildSkillView,
  buildInfinityView,
  buildInfinityUpgradesView,
  buildChallengeView,
} from "../../idle-game/ui-builder.mjs";

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
        { name: "自分の工場を見せる", value: "view" },
        { name: "表示しない", value: "none" } // あるいは、ephemeral: trueを外した簡易的な自分の工場を見せるオプション
      )
  )
  .addStringOption((option) =>
    option
      .setName("view")
      .setNameLocalizations({ ja: "開始画面" })
      .setDescription(
        "最初に表示する画面を選択します。（スマホでボタンが欠ける時用）"
      )
      .setRequired(false)
      .addChoices(
        { name: "工場画面 (デフォルト)", value: "factory" },
        { name: "スキル画面", value: "skill" },
        { name: "ジェネレーター", value: "infinity" },
        { name: "アップグレード", value: "infinity_upgrades" },
        { name: "チャレンジ", value: "challenges" }
      )
  );

// --- 2. execute 関数のすぐ上に、UIデータ準備役を追加 ---

export async function execute(interaction) {
  const rankingChoice = interaction.options.getString("ranking");
  if (rankingChoice === "public" || rankingChoice === "private") {
    const isPrivate = rankingChoice === "private";
    await executeRankingCommand(interaction, isPrivate);
  } else if (rankingChoice === "view") {
    //プロフ
    await interaction.reply({
      content: "プロフィールを生成しています...",
      ephemeral: true,
    });

    // 1. uiDataを呼び出す
    const uiData = await getSingleUserUIData(interaction.user.id);
    if (!uiData) {
      await interaction.editReply({
        content: "エラー：工場のデータが見つかりませんでした。",
      });
      return;
    }

    // 2. 新しいプロフィール用Embedを生成
    const profileEmbed = generateProfileEmbed(uiData, interaction.user);

    // 3. ephemeral（自分だけに見える）ではない、通常のメッセージとして返信する
    await interaction.followUp({ embeds: [profileEmbed] });
    // ephemeralなメッセージを消す
    await interaction.deleteReply();
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

    // 新規ユーザーのためにデータがなければ作る
    await IdleGame.findOrCreate({ where: { userId } });

    // ★新しいUIデータ準備役を呼び出す！
    // これで idleGame, mee6Level, userAchievement が一度に手に入ります
    const uiData = await getSingleUserUIData(userId);
    if (!uiData) {
      // ... (エラー処理: 初回ユーザーなど)
      await interaction.editReply({
        content: "エラーにより、工場のデータを取得できませんでした。",
      });
      return;
    }

    // IC6などのインフィニティチャレンジ失敗判定と自動中止処理
    if (uiData.uiContext?.challengeFailed) {
      const failureMessage =
        `**⚔️ インフィニティチャレンジ失敗…**\n` +
        `----------------------------------------\n` +
        uiData.uiContext.messages.join("\n") +
        `\n----------------------------------------\n` +
        `縛りは解除されました。この周回ではチャレンジを再開できません。`;

      try {
        await sequelize.transaction(async (t) => {
          const idleGameInstance = await IdleGame.findOne({
            where: { userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          if (
            idleGameInstance &&
            idleGameInstance.challenges?.activeChallenge === "IC6"
          ) {
            const currentChallenges = idleGameInstance.challenges;
            delete currentChallenges.activeChallenge;
            delete currentChallenges.IC6; // IC6関連データも削除
            idleGameInstance.challenges = currentChallenges;
            idleGameInstance.changed("challenges", true);
            await idleGameInstance.save({ transaction: t });
          }
        });

        await interaction.editReply({
          content: failureMessage,
          embeds: [],
          components: [],
        });
        return; // これ以降の処理を中断
      } catch (error) {
        console.error("IC6 Auto-Abort Error:", error);
        await interaction.editReply({
          content: "チャレンジの自動中止処理中にエラーが発生しました。",
          embeds: [],
          components: [],
        });
        return;
      }
    }

    uiData.point = point;
    // 取得したデータを分かりやすい変数に展開
    const { userAchievement } = uiData;
    let { idleGame } = uiData; // ← これらはcollectorで再代入するので let

    // ★★★ これが最重要！計算用のDecimalオブジェクトをここで作る ★★★
    let population_d = new Decimal(idleGame.population); // ← let に変更
    let highestPopulation_d = new Decimal(idleGame.highestPopulation); // ← let に変更

    //--------------
    //人口系実績など、起動時に取れるもの
    //--------------
    const populationChecks = [
      { id: 0, condition: true }, // 「ようこそ」は常にチェック
      { id: 3, condition: population_d.gte(100) },
      { id: 5, condition: population_d.gte(10000) },
      { id: 6, condition: population_d.gte(1000000) },
      { id: 8, condition: population_d.gte(10000000) },
      { id: 10, condition: population_d.gte(100000000) },
      { id: 19, condition: population_d.gte(1e9) }, // 10億
      { id: 20, condition: population_d.gte(1e10) }, // 100億
      { id: 73, condition: (idleGame.prestigePower || 0) >= 12 }, //PP12(1兆)
      { id: 21, condition: population_d.gte(1e14) }, // 100兆
      { id: 22, condition: population_d.gte(9007199254740991) }, // Number.MAX_SAFE_INTEGER
      {
        id: 51,
        condition: population_d.gte("1e16") || highestPopulation_d.gte("1e16"),
      },
      { id: 52, condition: idleGame.skillLevel8 >= 1 }, //s8実績もここに
      { id: 56, condition: population_d.gte(6.692e30) }, //infinity^0.10
      { id: 61, condition: population_d.gte(4.482e61) }, //infinity^0.20
      { id: 70, condition: population_d.gte(2.9613e92) }, //infinity^0.30
      { id: 71, condition: population_d.gte(1.3407e154) }, //infinity^0.50
      { id: 90, condition: population_d.gte("1e400") },
      //ニョボチップ消費量(infinity内)、BIGINTなんで扱いには注意
      {
        id: 57,
        condition: BigInt(idleGame.chipsSpentThisInfinity || "0") >= 100000,
      },
      {
        id: 58,
        condition: BigInt(idleGame.chipsSpentThisInfinity || "0") >= 1000000,
      },
      {
        id: 59,
        condition: BigInt(idleGame.chipsSpentThisInfinity || "0") >= 10000000,
      },
      // ニョボチップ総消費量(Eternity)
      {
        id: 87,
        condition: BigInt(idleGame.chipsSpentThisEternity || "0") >= 100000000n, // 1億
      },
      {
        id: 88,
        condition:
          BigInt(idleGame.chipsSpentThisEternity || "0") >= 1000000000n, // 10億
      },
      {
        id: 89,
        condition:
          BigInt(idleGame.chipsSpentThisEternity || "0") >= 2147483647n, // 21億4748万3647
      },
      //チップ倍率
      { id: 67, condition: idleGame.pizzaBonusPercentage >= 518 },
      { id: 68, condition: idleGame.pizzaBonusPercentage >= 815 },
      { id: 69, condition: idleGame.pizzaBonusPercentage >= 1254 },
      // 将来ここに人口実績を追加する (例: { id: 4, condition: idleGame.population >= 10000 })
    ];
    const idsToCheck = populationChecks
      .filter((p) => p.condition)
      .map((p) => p.id);
    await unlockAchievements(interaction.client, userId, ...idsToCheck);
    //人口系実績ここまで

    // 実績#78のチェック処理
    // configに定義されている全ての工場のレベルをチェック
    const allFactoriesLevelOne = Object.values(config.idle.factories).every(
      (factoryConfig) => {
        const levelKey = factoryConfig.key;
        const currentLevel = idleGame[levelKey] || 0;
        return currentLevel >= 1;
      }
    );
    // 全ての工場がLv1以上なら、実績#78の解除を試みる
    if (allFactoriesLevelOne) {
      await unlockAchievements(interaction.client, userId, 78);
    }

    // #64 忍耐の試練の「判定」をここで行う
    // userAchievementからではなく、最新のidleGameオブジェクトからchallengesを取得
    const challenges = idleGame.challenges || {};
    const trial64 = challenges.trial64 || {};

    if (trial64.lastPrestigeTime && !trial64.isCleared) {
      const elapsed = idleGame.infinityTime - trial64.lastPrestigeTime;
      const SECONDS_7D = 7 * 24 * 60 * 60;

      if (elapsed >= SECONDS_7D) {
        // isClearedフラグを立ててDBを更新する
        const idleGameInstance = await IdleGame.findOne({ where: { userId } });
        const currentChallenges = idleGameInstance.challenges || {};
        currentChallenges.trial64.isCleared = true;
        idleGameInstance.challenges = currentChallenges;

        // Sequelize v6以降では、JSONBフィールドの変更を明示する必要がある場合があります
        idleGameInstance.changed("challenges", true);

        await idleGameInstance.save();
        await unlockAchievements(interaction.client, userId, 64);

        // 後続の処理で使うidleGameオブジェクトにも変更を反映しておく
        idleGame.challenges.trial64.isCleared = true;
      }
    }

    // ★★★ ピザ窯覗きバフ処理 ★★★
    const now = new Date();
    let needsSave = false; // DBに保存する必要があるかを記録するフラグ

    // --- ステップ1：倍率の決定 ---
    // まず、現在の状態に基づいた「あるべき倍率」を計算する
    let correctMultiplier = 2.0;
    if (idleGame.prestigeCount === 0 && idleGame.population <= 1000000) {
      correctMultiplier = 4.0;
    } else if (idleGame.prestigeCount === 0) {
      correctMultiplier = 3.0;
    }
    // ▼▼▼ #7の効果を計算して乗算する ▼▼▼
    const skill7Level = idleGame.skillLevel7 || 0;
    const spentChips = BigInt(idleGame.chipsSpentThisInfinity || "0");
    const spentEternityChips = BigInt(idleGame.chipsSpentThisEternity || "0");
    const completedChallenges = new Set(
      idleGame.challenges?.completedChallenges || []
    );

    // スキル#7のボーナスを計算
    let skill7Bonus = 0; // スキルレベルが0ならボーナスも0
    if (skill7Level > 0 && (spentChips > 0 || spentEternityChips > 0)) {
      const settings = config.idle.tp_skills.skill7;
      let spentChipsNum;
      if (completedChallenges.has("IC1")) {
        spentChipsNum =
          Number(spentChips.toString()) + Number(spentEternityChips.toString());
      } else {
        spentChipsNum = Number(spentChips.toString());
      }
      // べき指数を計算 (例: 0.1 * Lv8 = 0.8)
      const exponent = skill7Level * settings.exponentPerLevel;
      // (消費チップ ^ べき指数) を計算
      skill7Bonus = Math.pow(spentChipsNum, exponent);
    }
    correctMultiplier *= 1 + skill7Bonus;

    //実績コンプ系で倍率強化
    // --- まず、実績の解除状況をSetとして準備 ---
    const unlockedSet = new Set(userAchievement.achievements?.unlocked || []);
    const hiddenUnlockedSet = new Set(
      userAchievement.achievements?.hidden_unlocked || []
    );
    // 実績50「あなたは神谷マリアを遊び尽くした」の効果
    if (unlockedSet.has(50)) {
      correctMultiplier *= 1.5;
    }
    // 隠し実績10「そこに山があるから」の効果
    if (hiddenUnlockedSet.has(10)) {
      correctMultiplier *= 1.1;
    }
    //IC1中なら、倍率を「下げて」上書きする
    const isActiveIC1 = idleGame.challenges?.activeChallenge === "IC1";
    if (isActiveIC1) {
      const spentChipsNum = Number(spentChips.toString());
      // 2/消費チップで上書き。消費チップが0の場合は0除算を避ける
      correctMultiplier = spentChipsNum > 0 ? 2 / spentChipsNum : 2;
    }

    // もし、DBに保存されている倍率と「あるべき倍率」が違ったら、更新する
    if (idleGame.buffMultiplier !== correctMultiplier) {
      idleGame.buffMultiplier = correctMultiplier;
      needsSave = true; // 変更があったので保存フラグを立てる
    }

    // --- ステップ2：時間の決定 ---
    // バフが切れているか、残り24時間を切っているか
    if (
      !idleGame.buffExpiresAt ||
      idleGame.buffExpiresAt < now ||
      idleGame.buffExpiresAt - now < 24 * 60 * 60 * 1000
    ) {
      // 新しい有効期限を設定する
      const newExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // もし、DBに保存されている有効期限と違ったら、更新する
      // (初回付与や時間リセットの場合、必ずこの条件に合致する)
      if (idleGame.buffExpiresAt?.getTime() !== newExpiresAt.getTime()) {
        idleGame.buffExpiresAt = newExpiresAt;
        needsSave = true; // 変更があったので保存フラグを立てる
      }
    }
    // (残り24時間以上の場合は、何もしない)

    // --- ステップ3：保存の実行 ---
    // もし、倍率か時間のどちらかに変更があった場合のみ、DBに保存する
    if (needsSave) {
      // .save() はrawでは使えないので、.update() に変更する ▼▼▼
      await IdleGame.update(
        {
          buffMultiplier: idleGame.buffMultiplier,
          buffExpiresAt: idleGame.buffExpiresAt,
        },
        { where: { userId } }
      );
    }

    // --- ★★★ ここからが修正箇所 ★★★ ---

    // --- 1. 表示する画面を決定する ---
    let currentView = "factory"; // 'factory' または 'skill'
    // ユーザーが選択した "開始画面" オプションを取得します
    const viewChoice = interaction.options.getString("view");

    // もしユーザーが「スキル画面」を選択した場合
    if (viewChoice === "skill") {
      if (idleGame.prestigePower >= 8) {
        currentView = "skill"; // 条件を満たせばスキル画面に設定
      } else {
        await interaction.followUp({
          content:
            "⚠️ スキル画面はプレステージパワー(PP)が8以上で解放されます。代わりに工場画面を表示します。",
          ephemeral: true,
        });
        // currentViewは'factory'のまま
      }
    } else if (viewChoice === "infinity") {
      if (idleGame.infinityCount > 0) {
        currentView = "infinity";
      } else {
        await interaction.followUp({
          content:
            "⚠️ ジェネレーター画面はインフィニティ後に解放されます。代わりに工場画面を表示します。",
          ephemeral: true,
        });
      }
    } else if (viewChoice === "infinity_upgrades") {
      if (idleGame.infinityCount > 0) {
        currentView = "infinity_upgrades";
      } else {
        await interaction.followUp({
          content:
            "⚠️ アップグレード画面はインフィニティ後に解放されます。代わりに工場画面を表示します。",
          ephemeral: true,
        });
      }
    } else if (viewChoice === "challenges") {
      if (idleGame.ipUpgrades?.upgrades?.includes("IU22")) {
        currentView = "challenges";
      } else {
        await interaction.followUp({
          content:
            "⚠️ チャレンジはIU22「無限の試練」購入後に解放されます。代わりに工場画面を表示します。",
          ephemeral: true,
        });
      }
    }

    // --- 2. 決定した画面を描画する ---
    let replyOptions = {}; // このオブジェクトにembedsやcomponentsを設定する

    switch (currentView) {
      case "skill":
        replyOptions = buildSkillView(uiData);
        break;

      case "infinity":
        replyOptions = buildInfinityView(uiData);
        break;

      case "infinity_upgrades":
        replyOptions = buildInfinityUpgradesView(uiData);
        break;

      case "challenges":
        replyOptions = buildChallengeView(uiData);
        break;

      case "factory":
      default:
        replyOptions = buildFactoryView(uiData); // ← これだけ！
        break;
    }

    // --- 3. 組み立てたオプションでメッセージを送信/編集 ---
    await interaction.editReply(replyOptions);

    // --- 4. コレクターのセットアップ ---
    const filter = (i) =>
      i.user.id === userId && i.customId.startsWith("idle_");
    const collector = initialReply.createMessageComponentCollector({
      filter,
      time: 120_000, //1分->2分に延長
    });

    collector.on("collect", async (i) => {
      collector.resetTimer(); // 操作があるたびにタイマーをリセット
      //modalなどdefer前にやるやつ
      if (i.customId === "idle_show_settings") {
        await handleSettings(i);
        // handleSettingsはモーダルの表示と処理を自己完結で行うため、
        // この後のUI更新は不要。returnしてコレクターの処理を抜ける。
        return;
      }
      await i.deferUpdate();
      let success = false; // 処理が成功したかを記録するフラグ
      let viewChanged = false; // ★画面切り替えかどうかのフラグ

      // ★★★ どのボタンが押されても、まず最新のDB情報を取得する ★★★
      const latestIdleGame = await IdleGame.findOne({ where: { userId } });
      if (!latestIdleGame) return; // 万が一データがなかったら終了

      // --- 画面切り替えの処理
      if (i.customId === "idle_show_skills") {
        currentView = "skill";
        viewChanged = true;
      } else if (i.customId === "idle_show_factory") {
        currentView = "factory";
        viewChanged = true;
      } else if (i.customId === "idle_show_infinity") {
        currentView = "infinity";
        viewChanged = true;
      } else if (i.customId === "idle_show_iu_upgrades") {
        currentView = "infinity_upgrades";
        viewChanged = true;
      } else if (i.customId === "idle_show_challenges") {
        currentView = "challenges";
        viewChanged = true;
      }

      // --- 3. スキル強化の処理 ---
      if (i.customId === "idle_info") {
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
  - PP8:3施設の人口制限解除。「施設適当強化」「スキル」解禁
  - PP12: オリーブ農園解除。コレ以降も2つ乗算施設が隠されています。
  - PP16:TP解禁、最高人口未満のプレステージ解禁
- SP:スキルポイント。消費する事で強力なスキルが習得できる。
- TP:超越スキルポイント。プレステージ時の人口に応じて獲得。
より詳しいガイドはこちら　-> https://discord.com/channels/1025416221757276242/1425904625692704858
`;
        await i.followUp({
          content: spExplanation,
          flags: 64, // 本人にだけ見えるメッセージ
        });
        return; // 解説を表示したら、このcollectイベントの処理は終了
      }

      if (i.customId.startsWith("idle_upgrade_skill_")) {
        //スキル習得
        const skillNum = parseInt(i.customId.split("_").pop(), 10);
        success = await handleSkillUpgrade(i, skillNum);
      } else if (i.customId.startsWith("idle_upgrade_")) {
        //1施設購入
        // "idle_upgrade_oven" から "oven" の部分を抽出しhandlerへ
        const facility = i.customId.substring("idle_upgrade_".length);
        success = await handleFacilityUpgrade(i, facility);
      } else if (i.customId === "idle_extend_buff") {
        //ブースト延長
        success = await handleNyoboshiHire(i);
      } else if (i.customId === "idle_auto_allocate") {
        //適当に購入
        success = await handleAutoAllocate(i);
      } else if (i.customId === "idle_prestige") {
        // ここで処理して、下の施設強化ロジックには進ませない
        success = await handlePrestige(i, collector);
        if (!success) return; // handlePrestigeが終わったら、このcollectイベントの処理は終了
      } else if (i.customId === "idle_skill_reset") {
        // スキルリセット
        success = await handleSkillReset(i, collector);
        if (!success) return;
      } else if (i.customId === "idle_infinity") {
        await handleInfinity(i, collector);
        return;
      } else if (i.customId === "idle_ascension") {
        success = await handleAscension(i);
      } else if (i.customId.startsWith("idle_generator_buy_")) {
        const generatorId = parseInt(i.customId.split("_").pop(), 10);
        success = await handleGeneratorPurchase(i, generatorId);
      } else if (i.customId.startsWith("idle_iu_purchase_")) {
        const upgradeId = i.customId.substring("idle_iu_purchase_".length);
        success = await handleInfinityUpgradePurchase(i, upgradeId);
      } else if (i.customId === "idle_iu_upgrade_ghostchip") {
        success = await handleGhostChipUpgrade(i);
      } else if (i.customId.startsWith("idle_start_challenge_")) {
        // インフィニティチャレンジ
        const challengeId = i.customId.substring(
          "idle_start_challenge_".length
        );
        success = await handleStartChallenge(i, collector, challengeId);
        // handleStartChallengeは内部でcollectorを止めるので、
        // 戻り値に関わらずここで処理を終了するのが安全です。
        if (!success) return;
      } else if (i.customId === "idle_abort_challenge") {
        //ICキャンセル
        success = await handleAbortChallenge(i);
      }

      // --- 3. 処理が成功した場合にのみ、UIを更新する ---
      if (success || viewChanged) {
        // ▼▼▼ ここが「成功後の共通処理」の場所 ▼▼▼

        // DB更新が成功したので、もう一度UIデータを"全て"取得し直す！
        const newUiData = await getSingleUserUIData(userId);

        // Point情報も取得して、newUiDataに統合する
        const newPoint = await Point.findOne({ where: { userId } });

        // 万が一データ取得に失敗した場合のエラーハンドリング
        if (!newUiData || !newPoint) {
          console.error("Failed to fetch new UI data after action.");
          await i.followUp({
            content: "データの更新表示に失敗しました。",
            ephemeral: true,
          });
          return;
        }
        newUiData.point = newPoint; // 取得したpointオブジェクトをuiDataに追加
        // ★★★★★★★★★★★★★★★★★★★★★★★★

        // 最新のデータでEmbedとボタンを再描描画する
        // currentView の値に応じて描画する内容を決定
        let replyOptions = {};
        switch (currentView) {
          case "skill":
            replyOptions = buildSkillView(newUiData);
            break;
          case "infinity":
            replyOptions = buildInfinityView(newUiData);
            break;
          case "infinity_upgrades":
            replyOptions = buildInfinityUpgradesView(newUiData);
            break;
          case "challenges":
            replyOptions = buildChallengeView(newUiData);
            break;
          case "factory":
          default:
            replyOptions = buildFactoryView(newUiData);
            break;
        }

        await interaction.editReply(replyOptions);
      }
      // ▲▲▲ UI更新処理は、このifブロックの中だけになる ▲▲▲
    });

    collector.on("end", async (collected) => {
      // asyncを追加
      try {
        await interaction.editReply(buildFactoryView(uiData, true));
      } catch (error) {
        // 編集に失敗した場合 (メッセージ削除済みなど) はエラーをコンソールに警告として表示し、
        // ボットはクラッシュさせずに安全に終了させる。
        console.warn(
          `Idle game collector 'end' event failed to edit reply: ${error.message}`
        );
      }
    });
  }
}
