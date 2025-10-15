//config.mjs
import {
  achievements,
  hidden_achievements,
} from "./constants/achievements.mjs";
import {
  roulettePockets,
  rouletteBets,
} from "./constants/roulette-definitions.mjs";
// F5押した時はdevelopmentが入って本番は何も無いのでtrueが入る
const isProduction = process.env.NODE_ENV !== "development";
//トークンなど機密事項やタイムゾーンはdotenvで管理すること！
//import config from '../config.mjs'; などで読み込む
//-----------------------
//デバッグで置き換える用の変数置き場
//-----------------------
const debugConfig = {
  emoji: "<a:test:1414701983612403825>", //絵文字
  emoji_no: "1414701983612403825", //絵文字の番号指定
  channel: "1414702233219764315", // チャンネル
  role: "1414702350190252183", //ロール
  dice: [
    // 10面ダイス
    "1414701983612403825", //0
    "1414701983612403825", //1
    "1414701983612403825", //2
    "1414701983612403825", //3
    "1414701983612403825", //4
    "1414701983612403825", //5
    "1414701983612403825", //6
    "1414701983612403825", //7
    "1414701983612403825", //8
    "1414701983612403825", //9
  ],
};
// -----------------------
// 三項演算子で切り替えサンプル
// -----------------------
/*
// 絵文字
const emoji = isProduction ? prod_emoji : debug_emoji;
const emoji_no = isProduction ? prod_emoji_no : debug_emoji_no;

// ログチャンネル
const logChannel = isProduction ? prod_channel : debug_channel;

// モデレーターロール
const moderatorRole = isProduction ? prod_role : debug_role;
*/
// ----------------------
// 何時ものconfigはここから
// -----------------------
export default {
  isProduction, //debugフラグも渡しておく
  botid: process.env.APPLICATION_ID, //このbot自身のID
  administrator: process.env.OWNER_ID, //Bot管理者のID
  privatecategory: [
    //プライベートカテゴリのIDリスト
    "1128492964939833375", //クリエイターロール
    "1075366548329467964", //管理室
  ],
  logch: {
    //ログを取るチャンネル config.logch.xxx
    //個人鯖でとってるやつ
    login: "1260078780534231062", //botの起動
    error: "1260078895479263273", //エラー
    backup: "1346352277899837553", //DBファイルの時報（８時、２２時）と同時に自動バックアップ先
    command: "1260078833936367679", //コマンドの使用
    guildCreate: "1260078958460928061",
    guildDelete: "1260078958460928061",
    //実際の鯖あたりに置いてるやつは適宜定義する
    //管理コマンド使用ログ、管理室などを推奨
    admin: isProduction ? "1038840639460229202" : debugConfig.channel,
    //マリアがリプライされたログ
    reply_log: isProduction ? "1263336102622793861" : debugConfig.channel,
    //コインの配布などの告知ログ
    notification: isProduction ? "1038860494406160447" : debugConfig.channel,
  },
  timesignalch: isProduction ? "1025416223724404766" : debugConfig.channel, //8,22時報を流すチャンネル
  arenatimech: isProduction ? "1201103311428923452" : debugConfig.channel, //闘技大会時報チャンネル
  rev2ch: "1103362273004769350", //ロスアカのシナリオ一覧を流すチャンネル（デバッグでは動かない）
  moderator: isProduction ? "1038083096618209301" : debugConfig.role, //モデレーターのロールID
  forumNotification: {
    //フォーラムスレッドがたった時に通知するスレッド
    "1038863762079350834": "1025416223724404766",
    "1038863052390535398": "1025420692184903680",
    //'フォーラムチャンネルID': '通知チャンネルID',
    //どーせデバッグは引っかからないだけなので変えない
  },
  //ドミノ関連
  dominoch: isProduction ? "1288173544232194089" : debugConfig.channel, //ドミノ部屋、ドミノのログもここに出す
  reddice: isProduction
    ? [
        // サイコロのリアクション（赤）0から9まで
        "1287340670008430646", //0
        "1287340678531125248", //1
        "1287340686798225450", //2
        "1287340693588672543", //3
        "1287340701612245023", //4
        "1287340709090824294", //5
        "1287340716967858267", //6
        "1287340724131729508", //7
        "1287340732490977311", //8
        "1287340739381956638", //9
      ]
    : debugConfig.dice,
  bluedice: isProduction
    ? [
        // サイコロのリアクション（青）0から9まで
        "1287339237506813963", //0
        "1287339245895159832", //1
        "1287339259182972958", //2
        "1287339289880956948", //3
        "1287339301813878805", //4
        "1287339313184509992", //5
        "1287339322227294248", //6
        "1287339330536345642", //7
        "1287339338979348480", //8
        "1287339348609732661", //9
      ]
    : debugConfig.dice,
  dominoMessages: {
    1: (dpname) =>
      `${dpname}がドミノを崩しそうになりましたが、辛うじて1枚並べました。`,
    11: (dpname) => `${dpname}が11枚の特別なドミノを並べました！`,
    22: (dpname) =>
      `${dpname}が22枚のドミノを並べていたところ謎のメンダコ生命体が通り過ぎました。`,
    33: (dpname) =>
      `${dpname}が33枚のドミノを並べようとしましたが、既に並んでいました。`,
    44: (dpname) =>
      `${dpname}が44枚のドミノ以外の物を並べようとしたところ、ドミノになりました。`,
    55: (dpname) => `${dpname}が55枚のドミノを勢い良く並べました、ゴーゴー。`,
    66: (dpname) => `${dpname}が66枚のドミノをどこからか召喚しました。`,
    77: (dpname) => `${dpname}が77枚の幸運を引き寄せるドミノを並べました。`,
    79: (dpname) =>
      `${dpname}が79枚ドミノを並べました<:IL_nack:1293532891015548929>`,
    88: (dpname) =>
      `${dpname}が88枚のドミノを並べながらその木目調に目を回しました。`,
    99: (dpname) => `${dpname}が99枚もドミノを並べました！えらい！`,
    default: (dpname, randomNum) =>
      `${dpname}が${randomNum}枚ドミノを並べました。`,
  },
  domino10000Images: ["https://i.imgur.com/Y8Vf4SW.png"],
  // ▼▼▼ シナリオチェッカー用の設定を追記 ▼▼▼
  scenarioChecker: {
    defaultReserveTime: "22:15", // デフォルトの予約時間
    // シナリオチェックを実行するcronスケジュール
    // 日本時間の 0:45, 1:45, 4:45, 13:45, 19:45, 22:45, 23:45
    cronSchedule: "45 0,1,4,13,19,22,23 * * *",
    cronSchedule2: "10 8 * * *", //8:10
    cronSchedule3: "45 2,3,5,6,7,9,10,11,12,14,15,16,17,18,20 * * *",
    //難易度対応の絵文字（/シナリオでも使うしデバッグするなら変えとく？）
    difficultyEmojis: {
      CASUAL: "<:Casual:1403580899290775664>",
      NORMAL: "<:Normal:1403581195706433676>",
      HARD: "<:Hard:1403581355534717019>",
      VERYHARD: "<:VeryHard:1403581830661406862>",
      NIGHTMARE: "<:Nightmare:1403581930426859522>",
      DEFAULT: "📖", // デフォルトの絵文字
    },
  },
  //スタンプ機能の設定
  sticker: {
    // ユーザー一人あたりの、スタンプ登録上限数
    limitPerUser: 5,
    // スタンプのディレクトリサイズ上限
    directorySizeLimit: 300 * 1024 * 1024, // 300MB
    // スタンプ登録上限数を引き上げるVIPロール
    vipRoles: isProduction
      ? [
          "1038083096618209301", // モデレーターロールのID
          "1025453404362903622", // イラストレーターロールのID
        ]
      : [], //debugは空
    vipLimit: 50, // VIPの最大登録数
  },
  nyowacoin: isProduction
    ? "<:nyowacoin:1407422205624844288>"
    : debugConfig.emoji,
  casino: {
    //カジノ設定
    //通貨の定義
    currencies: {
      coin: {
        db_column: "coin", // Pointモデルでのカラム名
        displayName: "ニョワコイン",
        emoji: isProduction
          ? "<:nyowacoin:1407422205624844288>"
          : debugConfig.emoji,
      },
      // チップの定義を追加
      legacy_pizza: {
        db_column: "legacy_pizza", // Pointモデルでのカラム名
        displayName: "ニョボチップ",
        emoji: isProduction
          ? "<:nyobochip:1416912717725438013>"
          : debugConfig.emoji,
      },
      //念の為どんぐりとRPも定義しとく
      acorn: {
        db_column: "acorn",
        displayName: "あまやどんぐり",
        emoji: "🌰",
      },
      point: {
        db_column: "point",
        displayName: "RP",
        emoji: "💎",
      },
    },
    lines_display: {
      // isProduction ? [赤ダイス配列] : [デバッグ絵文字配列] のようにするのがおすすめです
      active: isProduction
        ? [
            // ベットされているライン (赤)
            "<:red_1:1287340678531125248>", // 1
            "<:red_2:1287340686798225450>", // 2
            "<:red_3:1287340693588672543>", // 3
            "<:red_4:1287340701612245023>", // 4
            "<:red_5:1287340709090824294>", // 5
          ]
        : [
            debugConfig.emoji,
            debugConfig.emoji,
            debugConfig.emoji,
            debugConfig.emoji,
            debugConfig.emoji,
          ],
      inactive: isProduction
        ? [
            // ベットされていないライン (青)
            "<:blue_1:1287339245895159832>", // 1
            "<:blue_2:1287339259182972958>", // 2
            "<:blue_3:1287339268615704576>", // 3 なんかマリアに２個登録されてたから後で直さなきゃな
            "<:blue_4:1287339301813878805>", // 4
            "<:blue_5:1287339313184509992>", // 5
          ]
        : [
            debugConfig.emoji,
            debugConfig.emoji,
            debugConfig.emoji,
            debugConfig.emoji,
            debugConfig.emoji,
          ],
      // ラインの順番もここで定義してしまうのが美しいです
      // lineDefinitionsの配列の順番と対応させます
      order: {
        line2: 1, // 上段
        line1: 0, // 中央
        line3: 2, // 下段
        line4: 3, // 右下がり ＼
        line5: 4, // 右上がり ／
      },
    },
    slot: {
      //スロット1号機（ハイリスク）
      displayname: "ニョワミヤスロットマシン(1号機)",
      gameName: "slots", //戦績に残すためのタグ
      playAchievementId: 38, // ロマン主義
      reachAchievementId: 43, // 手に汗握る？
      symbols: {
        //絵柄
        7: isProduction ? "<:nyowa7:1409958172545912904>" : debugConfig.emoji,
        watermelon: "🍉",
        grape: "🍇",
        lemon: "🍋",
        cherry: "🍒",
        rotate: isProduction
          ? "<a:nyowamiyarika_down:1265938514462380144>"
          : debugConfig.emoji, //回転中の絵柄
        reach: isProduction
          ? "<a:nyowamiyarika_rainbow:1265941562945441817>"
          : debugConfig.emoji, //リーチ告知時の絵文字もここに
      },
      reels: [
        [
          //1レーン　7:1 スイカ:1 ぶどう:2 レモン:3 チェリー:4
          "7",
          "watermelon",
          "grape",
          "grape",
          "lemon",
          "lemon",
          "lemon",
          "cherry",
          "cherry",
          "cherry",
          "cherry",
        ],
        [
          //2レーン　7:1 スイカ:1 ぶどう:2 レモン:3 チェリー:4
          "7",
          "watermelon",
          "grape",
          "grape",
          "lemon",
          "lemon",
          "lemon",
          "cherry",
          "cherry",
          "cherry",
          "cherry",
        ],
        [
          //3レーン　7:1 スイカ:2 ぶどう:2 レモン:3 チェリー:4
          "7",
          "watermelon",
          "watermelon",
          "grape",
          "grape",
          "lemon",
          "lemon",
          "lemon",
          "cherry",
          "cherry",
          "cherry",
          "cherry",
        ],
      ],
      payouts: [
        {
          id: "777",
          name: "777",
          payout: 500,
          pattern: ["7", "7", "7"],
          display: isProduction
            ? "<:nyowa7:1409958172545912904><:nyowa7:1409958172545912904><:nyowa7:1409958172545912904>"
            : "なでなでなで",
          achievementId: 41, // 500倍！！！
        },
        {
          id: "watermelon",
          name: "スイカ",
          payout: 100,
          pattern: ["watermelon", "watermelon", "watermelon"],
          display: "🍉🍉🍉",
          achievementId: 40, // 100倍！
        },
        {
          id: "grape",
          name: "ぶどう",
          payout: 20,
          pattern: ["grape", "grape", "grape"],
          display: "🍇🍇🍇",
        },
        {
          id: "lemon",
          name: "レモン",
          payout: 10,
          pattern: ["lemon", "lemon", "lemon"],
          display: "🍋🍋🍋",
        },
        {
          id: "cherry3",
          name: "チェリーx3",
          payout: 3,
          pattern: ["cherry", "cherry", "cherry"],
          display: "🍒🍒🍒",
        },
        {
          id: "cherry2",
          name: "チェリーx2",
          payout: 1,
          leftAlign: 2,
          symbol: "cherry",
          display: "🍒🍒",
        },
      ],
    },
    slot_lowrisk: {
      //スロット2号機（ローリスク）
      displayname: "ひめこスロットマシン(2号機)",
      gameName: "slots_easy", //戦績に残すためのタグ
      playAchievementId: 39, // 安全主義
      reachAchievementId: 43, // 手に汗握る？ (同じ実績IDを共有)
      symbols: {
        bell: isProduction
          ? "<:katakana_ko:1265165857445908542>"
          : debugConfig.emoji,
        bell2: isProduction
          ? "<:katakana_ro:1265166237399388242>"
          : debugConfig.emoji,
        lemon: "🍋",
        grape: "🍇",
        cherry: "🍒",
        rotate: isProduction
          ? "<a:himeko_down:1409986521058246737>"
          : debugConfig.emoji,
        reach: isProduction
          ? "<a:toruchan_kokoro2:1265162645330464898>"
          : debugConfig.emoji,
      },
      reels: [
        // R1 (11通り): コ1, レモン2, ぶどう3, チェリー5
        [
          "bell",
          "lemon",
          "lemon",
          "grape",
          "grape",
          "grape",
          "cherry",
          "cherry",
          "cherry",
          "cherry",
          "cherry",
        ],
        // R2 (11通り): コ1, レモン3, ぶどう3, チェリー4
        [
          "bell",
          "lemon",
          "lemon",
          "lemon",
          "grape",
          "grape",
          "grape",
          "cherry",
          "cherry",
          "cherry",
          "cherry",
        ],
        // R3 (12通り): ロ1, レモン3, ぶどう4, チェリー4
        [
          "bell2",
          "lemon",
          "lemon",
          "lemon",
          "grape",
          "grape",
          "grape",
          "grape",
          "cherry",
          "cherry",
          "cherry",
          "cherry",
        ],
      ],
      payouts: [
        {
          id: "bell3",
          name: "ココロー！",
          payout: 38,
          pattern: ["bell", "bell", "bell2"],
          display: isProduction
            ? "<:katakana_ko:1265165857445908542><:katakana_ko:1265165857445908542><:katakana_ro:1265166237399388242>"
            : "ココロー！！！",
          achievementId: 42, // ココローー！！
        },
        {
          id: "lemon3",
          name: "レモン",
          payout: 14,
          pattern: ["lemon", "lemon", "lemon"],
          display: "🍋🍋🍋",
        },
        {
          id: "grape3",
          name: "ぶどう",
          payout: 5,
          pattern: ["grape", "grape", "grape"],
          display: "🍇🍇🍇",
        },
        {
          id: "cherry3",
          name: "チェリーx3",
          payout: 3,
          pattern: ["cherry", "cherry", "cherry"],
          display: "🍒🍒🍒",
        },
        {
          id: "cherry2",
          name: "チェリーx2",
          payout: 2,
          leftAlign: 2,
          symbol: "cherry",
          display: "🍒🍒",
        },
        {
          id: "cherry1",
          name: "チェリーx1",
          payout: 1,
          leftAlign: 1,
          symbol: "cherry",
          display: "🍒",
        }, // 賭け金が戻ってくる役
      ],
    },
    //ブラックジャック
    blackjack: {
      gameName: "blackjack",
      displayName: "ブラックジャック",
      rules: {
        deck_count: 6,
        dealer_stands_on_soft_17: true,
        double_after_split: true,
        double_on_any_two: true, // "9-11のみ" or "10-11のみ" にしたければ false にして別途処理
        resplit_limit: 4, // 最大4ハンドまで
        resplit_aces: false,
        hit_split_aces: false,
        late_surrender: true,
        blackjack_payout: 1.5, // 3:2 payout (ボーナスなので賭け金の1.5倍)
        bonus_payout: 1.0, // 2連BJボーナス
      },
      betting: {
        min: 2,
        max: 100,
        increment: 2, // 2枚単位
      },
    },
    //ルーレット
    roulette: {
      gameName: "roulette",
      displayName: "ヨーロピアンルーレット",
      // constants/roulette-definitions.mjs
      pockets: roulettePockets,
      bets: rouletteBets,
    },
  },
  //ログインボーナス設定
  loginBonus: {
    legacy_pizza: {
      baseAmount: {
        //typo注意 amountのmは1文字
        min: 80, //前botは４時間ごとに40枚だったので２倍、下も同様
        max: 1000, //500x2
      },
      // サーバーブースターによるボーナス
      boosterBonus: {
        base: 500, // ブーストしている場合にもらえる基本ボーナス
        perServer: 500, // 1サーバーごとに追加されるボーナス
      },
      boosterRoleId: isProduction ? "1025744211552776214" : debugConfig.role, // (もう使ってないけど念の為残してるサーバーブースターロールID)
      // MEE6のレベル称号によるボーナス
      mee6LevelBonuses: isProduction
        ? {
            "1071455632114327663": 100, //Lv10
            "1071455554163191809": 200, //Lv20
            "1067982048444293190": 300, //Lv30
            "1071455668797706240": 400, //Lv40
            "1071455717082529946": 500, //Lv50
            "1079135754971791572": 600, //Lv60
            "1092503623528894494": 700, //Lv70
            "1092504786978492529": 800, //Lv80
            "1092505092827127828": 900, //Lv90
            "1092505190973845614": 1000, //Lv100+
          }
        : {}, //debugは空
    },
    nyowacoin: {
      baseAmount: 1, //基本は１枚
      bonus: {
        chance: 3, //1/3の確率でボーナス
        amount: {
          //追加量
          min: 1,
          max: 11, // 9 -> 11に増量、基本と合わせた期待値3枚
        },
      },
    },
  },
  // 発言によるピザトークン獲得のための設定
  chatBonus: {
    legacy_pizza: {
      // 1分に1回、この範囲でピザを獲得する (MEE6経験値と同じ乱数)
      amount: {
        min: 15,
        max: 25,
      },
    },
    booster_coin: {
      // 1ブーストあたりの基本報酬コイン、1から変える時はsupabaseの関数に引数として渡す用に要改変
      amount: 1,
      // 対象となるサーバーIDとブースターロールIDの対応表
      roles: {
        "1025416221757276242": "1025744211552776214", // 例: 本館サーバーID: 本館ブースターロールID
        "1123615363351986226": "1123712258044858370", // 別館
      },
    },
  },
  // 放置ゲーム設定
  idle: {
    infinity: "1.79769e308",
    factories: {
      //要の部分
      oven: {
        key: "pizzaOvenLevel",
        name: "ピザ窯",
        emoji: "🍕",
        baseCost: 100,
        multiplier: 1.08,
        effect: 1,
        type: "additive", //基本
      },
      cheese: {
        key: "cheeseFactoryLevel",
        name: "チーズ工場",
        emoji: "🧀",
        baseCost: 500,
        multiplier: 1.09,
        effect: 0.05,
        unlockPopulation: 0,
        type: "multiplicative", //乗数（下位）
      },
      tomato: {
        key: "tomatoFarmLevel",
        name: "トマト農場",
        emoji: "🍅",
        baseCost: 700, // 800 -> 700予定
        multiplier: 1.1,
        effect: 0.04,
        unlockPopulation: 100_0000,
        type: "multiplicative",
      },
      mushroom: {
        key: "mushroomFarmLevel",
        name: "マッシュルーム農場",
        emoji: "🍄",
        baseCost: 900, // 1000-> 900?
        multiplier: 1.105,
        effect: 0.03,
        unlockPopulation: 1000_0000,
        type: "multiplicative",
      },
      anchovy: {
        key: "anchovyFactoryLevel",
        name: "アンチョビ工場",
        successName: "アンチョビ工場(ニボシじゃないよ！)",
        emoji: "🐟",
        baseCost: 1100, // 1500->1100?
        multiplier: 1.11,
        effect: 0.02,
        unlockPopulation: 1_0000_0000,
        type: "multiplicative",
      },
      //メモ：アンチョビ以降の乗算施設は構想段階　まだカラム作ってないよ
      // keyは新しいカラム名と一致させる
      olive: {
        key: "oliveFarmLevel",
        name: "オリーブ農園",
        emoji: "🫒",
        baseCost: 1300,
        multiplier: 1.115,
        effect: 0.02, //こっから下げると#5が弱くなりすぎる　悩む
        unlockAchievementId: 73, //施設そのものとPP効果を解禁する（共通）
        type: "multiplicative2", //乗数施設（上位）#1や実績の効果が乗らない。未解禁時PPは乗らず、#5や工場試練のLvだけ精肉+^0.001は乗る
      },
      wheat: {
        key: "wheatFarmLevel",
        name: "小麦の品種改良",
        emoji: "🌾",
        baseCost: 1500,
        multiplier: 1.12,
        effect: 0.02,
        type: "multiplicative2",
        unlockAchievementId: 74,
      },
      pineapple: {
        key: "pineappleFarmLevel",
        name: "パイナップル農園",
        successName: "パイナップル農園(安全)",
        emoji: "🍍",
        baseCost: 1700,
        multiplier: 1.125,
        effect: 0.02,
        unlockAchievementId: 66,
        type: "multiplicative2",
      },
    },
    //ここからいつものアイツ
    meat: {
      emoji: "🍖",
      effect: 0.01, // 1レベルあたりの効果 (^1.01)
      type: "power", //指数施設。素は違う表にあるmee6レベルなのでカラムは無し
    },
    prestige: {
      emoji: "🍍",
      unlockPopulation: 1_0000_0000, // 人口1億で解禁
      spBaseDeduction: 7, // 初回SP計算時の基礎控除値
    },
    tp_skills: {
      skill5: {
        baseCost: 1,
        costMultiplier: 1.5,
        effect: 0.01, // 効果は計算式に直接組み込むので、ここでは説明だけ
        description: "5つの工場レベル効果をそれぞれの基礎レベルごとに+1%する",
      },
      skill6: {
        baseCost: 10,
        costMultiplier: 2,
        effectBase: 0.97, // 割引の基礎乗数
        softCapThreshold: 0.9, // 90%
        softCapDivisor: 2, // 超過分を割る数
        description: "工場強化コストを3%割引する",
      },
      skill7: {
        baseCost: 10,
        costMultiplier: 1.8,
        exponentPerLevel: 0.1, // スキルレベル1あたり、べき指数がこれだけ上昇する
        description: "ブーストが∞中累計消費チップに応じて強化される",
      },
      skill8: {
        baseCost: 40,
        costMultiplier: 3,
        effectMultiplier: 1.0, // TP獲得量をレベルごとに+100%
        description: "TP獲得量を+100%増加させる",
      },
    },
    ascension: {
      //アセンション
      basePopulation: "1e40", // Decimalで扱うため文字列にしておくのが安全
      populationMultiplier: 10, // 2回目以降は要求人口が10倍になる
      effect: 1.125, // 8つのfactoriesがそれぞれ 1.125^n 倍
    },
    infinityGenerators: [
      // 配列のインデックスが (ジェネレーター番号 - 1) に対応
      // なお#2効果によってそれは加速し、n個買えば初期個数n 効果は2^(n-1)となる
      {
        id: 1,
        name: "ピザ工場複製装置",
        description: "毎分、GPを生産する",
        baseCost: 1,
        costMultiplier: 10,
      },
      {
        id: 2,
        name: "ピザ工場複製装置Ⅱ",
        description: "毎分、ピザ工場複製装置を生産する",
        baseCost: 100,
        costMultiplier: 100,
      },
      {
        id: 3,
        name: "ピザ工場複製装置Ⅲ",
        description: "毎分、ピザ工場複製装置Ⅱを生産する",
        baseCost: 10000,
        costMultiplier: 1000,
      },
      {
        id: 4,
        name: "ピザ工場複製装置Ⅳ",
        description: "毎分、ピザ工場複製装置Ⅲを生産する",
        baseCost: 1e7,
        costMultiplier: 10000,
      },
      {
        id: 5,
        name: "ピザ工場複製装置Ⅴ",
        description: "毎分、ピザ工場複製装置Ⅳを生産する",
        baseCost: 1e11,
        costMultiplier: 1e5,
      },
      {
        id: 6,
        name: "ピザ工場複製装置Ⅵ",
        description: "毎分、ピザ工場複製装置Ⅴを生産する",
        baseCost: 1e16,
        costMultiplier: 1e6,
      },
      {
        id: 7,
        name: "ピザ工場複製装置Ⅶ",
        description: "毎分、ピザ工場複製装置Ⅵを生産する",
        baseCost: 1e23,
        costMultiplier: 1e7,
      },
      {
        id: 8,
        name: "ピザ工場複製装置Ⅷ",
        description: "毎分、ピザ工場複製装置Ⅶを生産する",
        baseCost: 1e31,
        costMultiplier: 1e8,
      },
    ],
    infinityUpgrades: {
      IU11: {
        name: "ゴーストチップ Lv1",
        cost: 0,
        description: "リセット時に最大5000チップを得てその範囲内で工場を自動強化する。余ったチップは消滅する",
      },
      IU12: {
        name: "自動調理器",
        cost: 1,
        description: "プレステージ時にTPを自動で割り振る。",
      },
      IU13: {
        name: "肉干しレンガ",
        cost: 1,
        description: "精肉工場の指数に+0.05ボーナス。",
      },
      IU14: {
        name: "業務用品の購入",
        cost: 1,
        description: "全チップ消費量が10%減少する。",
      },
      IU21: {
        name: "パインパワー",
        cost: 3,
        description: "PP獲得量が10%増加する。",
      }, // Tier2なのでコストは仮
    },
    //constants\achievements.mjsにお引越し
    achievements: achievements,
    hidden_achievements: hidden_achievements,
  },
  achievementNotification: {
    // 'public', 'dm', 'none' から選択
    mode: "public",
    // modeが 'public' の場合に通知を送るチャンネルID
    channelId: isProduction ? "1421521075337953321" : debugConfig.channel,
  },
  rssWatcher: {
    // 監視したいタスクを配列で管理
    tasks: [
      {
        name: "ロスアカラプ箱交換希望", // タスクの名前
        enabled: true, // このタスクを有効にするか
        rssUrl:
          "https://nitter.privacyredirect.com/search/rss?f=tweets&q=%23%E3%83%AD%E3%82%B9%E3%82%A2%E3%82%AB%E3%83%A9%E3%83%97%E7®%B1%E4%BA%A4%E6%8F%9B%E5%B8%8C%E6%9C%9B&e-nativeretweets=on",
        channelId: isProduction ? "1263577939396526091" : debugConfig.channel,
      },
    ],
    // チェックする頻度（Cron形式: これは10分ごと）
    cronSchedule: "*/10 * * * *",
    // ▼▼▼ セーフティネット設定を追加 ▼▼▼
    // 1回のチェックで処理する最大投稿数 (スパムや予期せぬ大量投稿からチャンネルを守る)
    maxPostsPerCheck: 15,
    // 1投稿ごとの送信間隔（ミリ秒）。APIレート制限を避ける
    postDelay: 1500, // 1.5秒
  },
  countingGame: {
    channelId: "1092415810175250493",
    allowConsecutivePosts: true, //連続投稿の許可
    // ▼▼▼ 報酬設定を新しい仕様に更新 ▼▼▼
    rewards: {
      coin: 5,
      nyobo_bank: {
        min: 80,
        max: 120,
      },
    },
    // 正解時に付けるリアクション
    successReaction: "1407422205624844288",
  },
};
