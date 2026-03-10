//config.mjs
import idleGameConfig from "./idle-game/game-settings.mjs";
import {
  roulettePockets,
  rouletteBets,
} from "./constants/roulette-definitions.mjs";
import { getSlotDefinitions } from "./constants/slot-definitions.mjs";
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
//分離した設定を動的に再構成する
const slotSettings = getSlotDefinitions(isProduction, debugConfig);
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
  rev2ch: isProduction ? "1103362273004769350" : debugConfig.channel, //ロスアカのシナリオ一覧を流すチャンネル（デバッグでは動かない）
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
  dominoTriggerRegex: /(どみの|ドミノ|ﾄﾞﾐﾉ|domino|ドミドミ|どみどみ)/i,
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
      リクエスト: "👍️",
      DEFAULT: "📖", // デフォルトの絵文字
    },
  },
  //スタンプ機能の設定
  sticker: {
    // ユーザー一人あたりの、スタンプ登録上限数
    limitPerUser: 50,
    // スタンプのディレクトリサイズ上限
    directorySizeLimit: 5 * 1024 * 1024 * 1024, // 5GB
    // スタンプ登録上限数を引き上げるVIPロール
    vipRoles: isProduction
      ? [
          "1038083096618209301", // モデレーターロールのID
          "1025453404362903622", // イラストレーターロールのID
        ]
      : [], //debugは空
    vipLimit: 255, // VIPの最大登録数
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
      nyobo_bank: {
        db_column: "nyobo_bank",
        displayName: "ニョボバンク(預金)",
        emoji: "🏦",
      },
    },
    //スロット関係ファイル読み込み
    ...slotSettings,
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
        //251016　5倍に
        min: 400, //前botは４時間ごとに40枚だったので２倍、下も同様
        max: 5000, //500x2
      },
      // サーバーブースターによるボーナス
      boosterBonus: {
        base: 2500, // ブーストしている場合にもらえる基本ボーナス
        perServer: 2500, // 1サーバーごとに追加されるボーナス
      },
      boosterRoleId: isProduction ? "1025744211552776214" : debugConfig.role, // (もう使ってないけど念の為残してるサーバーブースターロールID)
      //Mee6、1Lvごとに得られる数値
      bounsPerMee6Level: 50,
      // MEE6のレベル称号によるボーナス
      mee6LevelBonuses: isProduction
        ? {
            "1071455632114327663": 500, //Lv10
            "1071455554163191809": 1000, //Lv20
            "1067982048444293190": 1500, //Lv30
            "1071455668797706240": 2000, //Lv40
            "1071455717082529946": 2500, //Lv50
            "1079135754971791572": 3000, //Lv60
            "1092503623528894494": 3500, //Lv70
            "1092504786978492529": 4000, //Lv80
            "1092505092827127828": 4500, //Lv90
            "1092505190973845614": 5000, //Lv100+
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
      // 1分に1回、この範囲でピザを獲得する 75-125 =100
      amount: {
        min: 75,
        max: 125,
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
  //idle関連はidle-game\game-settings.mjsに
  //実績関連はconstants\achievements.mjsに
  idle: idleGameConfig,
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
        min: 360,
        max: 540,
      },
    },
    // 正解時に付けるリアクション
    successReaction: "1407422205624844288",
  },
};
