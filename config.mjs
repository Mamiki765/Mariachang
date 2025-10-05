//config.mjs
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
      // 各ポケットの番号と色を定義
      pockets: {
        0: "green",
        1: "red",
        2: "black",
        3: "red",
        4: "black",
        5: "red",
        6: "black",
        7: "red",
        8: "black",
        9: "red",
        10: "black",
        11: "black",
        12: "red",
        13: "black",
        14: "red",
        15: "black",
        16: "red",
        17: "black",
        18: "red",
        19: "black",
        20: "black",
        21: "red",
        22: "black",
        23: "red",
        24: "black",
        25: "red",
        26: "black",
        27: "red",
        28: "red",
        29: "black",
        30: "red",
        31: "black",
        32: "red",
        33: "black",
        34: "red",
        35: "black",
        36: "red",
      },
      // ベットの種類を定義
      // payoutは、賭け金を除いた純粋な勝ち分（例: 10枚賭けてストレートアップが当たると、10 + (10 * 35) = 360枚戻る）
      bets: {
        // --- アウトサイドベット ---
        red: { name: "赤 (Red)", type: "color", value: "red", payout: 1 },
        black: { name: "黒 (Black)", type: "color", value: "black", payout: 1 },
        odd: { name: "奇数 (Odd)", type: "even_odd", value: "odd", payout: 1 },
        even: {
          name: "偶数 (Even)",
          type: "even_odd",
          value: "even",
          payout: 1,
        },
        low: {
          name: "ロー (1-18)",
          type: "range",
          value: { min: 1, max: 18 },
          payout: 1,
        },
        high: {
          name: "ハイ (19-36)",
          type: "range",
          value: { min: 19, max: 36 },
          payout: 1,
        },
        dozen1: {
          name: "1st 12 (1-12)",
          type: "range",
          value: { min: 1, max: 12 },
          payout: 2,
        },
        dozen2: {
          name: "2nd 12 (13-24)",
          type: "range",
          value: { min: 13, max: 24 },
          payout: 2,
        },
        dozen3: {
          name: "3rd 12 (25-36)",
          type: "range",
          value: { min: 25, max: 36 },
          payout: 2,
        },
        column1: {
          name: "上段 (1,4,7...)",
          type: "column",
          value: 1,
          payout: 2,
        },
        column2: {
          name: "中段 (2,5,8...)",
          type: "column",
          value: 2,
          payout: 2,
        },
        column3: {
          name: "下段 (3,6,9...)",
          type: "column",
          value: 0,
          payout: 2,
        }, // 3の倍数
        // --- インサイドベット ---
        straight_0: { name: "0", type: "number", value: 0, payout: 35 },
        straight_1: { name: "1", type: "number", value: 1, payout: 35 },
        straight_2: { name: "2", type: "number", value: 2, payout: 35 },
        straight_3: { name: "3", type: "number", value: 3, payout: 35 },
        straight_4: { name: "4", type: "number", value: 4, payout: 35 },
        straight_5: { name: "5", type: "number", value: 5, payout: 35 },
        straight_6: { name: "6", type: "number", value: 6, payout: 35 },
        straight_7: { name: "7", type: "number", value: 7, payout: 35 },
        straight_8: { name: "8", type: "number", value: 8, payout: 35 },
        straight_9: { name: "9", type: "number", value: 9, payout: 35 },
        straight_10: { name: "10", type: "number", value: 10, payout: 35 },
        straight_11: { name: "11", type: "number", value: 11, payout: 35 },
        straight_12: { name: "12", type: "number", value: 12, payout: 35 },
        straight_13: { name: "13", type: "number", value: 13, payout: 35 },
        straight_14: { name: "14", type: "number", value: 14, payout: 35 },
        straight_15: { name: "15", type: "number", value: 15, payout: 35 },
        straight_16: { name: "16", type: "number", value: 16, payout: 35 },
        straight_17: { name: "17", type: "number", value: 17, payout: 35 },
        straight_18: { name: "18", type: "number", value: 18, payout: 35 },
        straight_19: { name: "19", type: "number", value: 19, payout: 35 },
        straight_20: { name: "20", type: "number", value: 20, payout: 35 },
        straight_21: { name: "21", type: "number", value: 21, payout: 35 },
        straight_22: { name: "22", type: "number", value: 22, payout: 35 },
        straight_23: { name: "23", type: "number", value: 23, payout: 35 },
        straight_24: { name: "24", type: "number", value: 24, payout: 35 },
        straight_25: { name: "25", type: "number", value: 25, payout: 35 },
        straight_26: { name: "26", type: "number", value: 26, payout: 35 },
        straight_27: { name: "27", type: "number", value: 27, payout: 35 },
        straight_28: { name: "28", type: "number", value: 28, payout: 35 },
        straight_29: { name: "29", type: "number", value: 29, payout: 35 },
        straight_30: { name: "30", type: "number", value: 30, payout: 35 },
        straight_31: { name: "31", type: "number", value: 31, payout: 35 },
        straight_32: { name: "32", type: "number", value: 32, payout: 35 },
        straight_33: { name: "33", type: "number", value: 33, payout: 35 },
        straight_34: { name: "34", type: "number", value: 34, payout: 35 },
        straight_35: { name: "35", type: "number", value: 35, payout: 35 },
        straight_36: { name: "36", type: "number", value: 36, payout: 35 },
      },
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
    // ここを変える時はSQLも変えるように！詳細はidle.mjs
    oven: {
      emoji: "🍕",
      baseCost: 100, // 基本コスト
      multiplier: 1.08, // レベルで加算される乗数 (気軽に変えると大変！)
      effect: 1, // 1レベルあたりの効果 (+1人/分)
    },
    cheese: {
      emoji: "🧀",
      baseCost: 500,
      multiplier: 1.15,
      effect: 0.05, // 1レベルあたりの効果 (+5%)
    },
    tomato: {
      emoji: "🍅",
      baseCost: 800,
      multiplier: 1.12,
      effect: 0.03, // 1レベルあたりの効果 (+3%)
      unlockPopulation: 100_0000, // 人口100万で解禁
    },
    mushroom: {
      emoji: "🍄",
      baseCost: 1000, // 初期コスト
      multiplier: 1.115, // コスト成長率
      effect: 0.025, // 1レベルあたりの効果 (+2.5%)
      unlockPopulation: 1000_0000, // 人口1000万で解禁
    },
    anchovy: {
      emoji: "🐟",
      baseCost: 1500, // 初期コスト
      multiplier: 1.11, // コスト成長率
      effect: 0.02, // 1レベルあたりの効果 (+2%)
      unlockPopulation: 1_0000_0000, // 人口1億で解禁
    },
    meat: {
      emoji: "🍖",
      effect: 0.01, // 1レベルあたりの効果 (^1.01)
    },
    prestige: {
      emoji: "🍍",
      unlockPopulation: 1_0000_0000, // 人口1億で解禁
      spBaseDeduction: 7, // 初回SP計算時の基礎控除値
    },
    //実績　utils\achievements.mjs
    // 実績一覧は unlockAchievements(client, userId, ID) で解除可能です。
    // 複数解除する場合はスプレッド構文でまとめて渡せます。
    // 例: unlockAchievements(client, userId, ...[0,1,2])
    achievements: [
      {
        id: 0,
        name: "ようこそピザ工場へ！",
        description: "初めてピザ工場を訪れ、自分の工場を設立した。",
        effect: "取得した実績数に応じ、全ての施設を強化。", // 実績そのものが1つにつきoven~anchovy+1% meat+0.01効果なので実績0で出る様に見せる
        reward: {},
      },
      {
        id: 1,
        name: "ピザ窯に火をつける",
        description: "ピザ窯(oven)を強化",
        reward: {},
      },
      {
        id: 2,
        name: "ニョワミヤはチーズが大好き",
        description: "チーズ工場(cheese)を強化",
        reward: {},
      },
      {
        id: 3,
        name: "100匹ニョワミヤ",
        description: "ニョワミヤの数が100に到達",
        reward: {},
      },
      {
        id: 4,
        name: "ニョワミヤ監督官",
        description: "ニョボシを雇用し、ログインブーストを延長する",
        reward: {},
      },
      {
        id: 5,
        name: "ニョワミヤはどんどん増える",
        description: "ニョワミヤの数が1万に到達",
        reward: {},
      },
      {
        id: 6,
        name: "新しい工場",
        description: "ニョワミヤの数が100万に到達",
        effect: "トマト農場を解禁",
        reward: {},
      },
      {
        id: 7,
        name: "ピザといえば…",
        description: "トマト農場を強化し、トマトソースを作る",
        reward: {},
      },
      {
        id: 8,
        name: "プレステージまでの長い道のり",
        description: "ニョワミヤの数が1000万に到達",
        effect: "マッシュルーム農場を解禁",
        reward: {},
      },
      {
        id: 9,
        name: "香り高いキノコ",
        description: "マッシュルーム農場を強化し、ピザをもっと美味しくする",
        reward: {},
      },
      {
        id: 10,
        name: "Let's Prestige!",
        description: "ニョワミヤの数が1億に到達",
        effect: "プレステージとアンチョビ工場を解禁",
        reward: {},
      },
      {
        id: 11,
        name: "パイナップルパワー",
        description: "プレステージを実行した",
        effect: "PP/SP/自動強化が解禁、全工場の人口制限削除",
        reward: {},
      },
      {
        id: 12,
        name: "本当に美味しいの？",
        description: "アンチョビ工場を強化した",
        reward: {},
      },
      {
        id: 13,
        name: "嗚呼麗しきインフレよ",
        description: "#1スキルを取得した",
        reward: {},
      },
      {
        id: 14,
        name: "便利な時代になりました",
        description: "適当強化を使用してみた",
        reward: {},
      },
      {
        id: 15,
        name: "間違えた？それとも金策？",
        description: "スキルリセットを使用する",
        reward: {},
      },
      {
        id: 16,
        name: "『光輝状態の対象は#1~#3スキルの効果量が+X%される。』",
        description: "#4スキルを取得する",
        reward: {},
      },
      {
        id: 17,
        name: "ニョボチップがニョワコインに両替できない理由",
        description: "#3スキルを取得する",
        reward: {},
      },
      {
        id: 18,
        name: "走れニョワミヤ",
        description: "#2スキルを取得する",
        reward: {},
      },
      {
        id: 19,
        name: "100億までいっちゃう？それとも…",
        description: "ニョワミヤの人口が10億に到達する",
        reward: {},
      },
      {
        id: 20,
        name: "これでLV2スキルが取れる",
        description: "ニョワミヤの人口が100億に到達する",
        reward: {},
      },
      {
        id: 21,
        name: "もうニョワミヤは止まらない",
        description: "ニョワミヤの人口が100兆に到達する",
        reward: {},
      },
      {
        id: 22,
        name: "あーあ、壊れちゃった。",
        description: "ニョワミヤの人口が9007兆1992億5474万0991に到達する",
        effect: "ニョワミヤ人口を指数表記に切り替えます",
        reward: {},
      },
      {
        id: 23,
        name: "なんか落ちてる…",
        description: "初めてあまやどんぐりを手に入れた。",
        effect: "100ニョワコインで売却可能",
        reward: {},
      },
      {
        id: 24,
        name: "拾えるものは拾っとこう",
        description: "累計で10個のあまやどんぐりを手に入れた。",
        reward: {},
      },
      {
        id: 25,
        name: "あまやどんぐりチケットの切り所",
        description: "累計で30個のあまやどんぐりを手に入れた。",
        reward: {},
      },
      {
        id: 26,
        name: "あまやどんぐり収集家",
        description: "累計で50個のあまやどんぐりを手に入れた。",
        reward: {},
      },
      {
        id: 27,
        name: "雨宿りに忠誠を誓う",
        description: "累計で100個のあまやどんぐりを手に入れた。",
        reward: {},
      },
      {
        id: 28,
        name: "全部取れるの？これ",
        description: "実績画面を見てみた",
        reward: {},
      },
      {
        id: 29,
        name: "ドミノ",
        description: "ドミノを1回並べた",
        reward: {},
      },
      {
        id: 30,
        name: "ドミノドミノドミノ",
        description: "ドミノを100回並べた",
        goal: 100,
        reward: {},
      },
      {
        id: 31,
        name: "ドミノドミノドミノドミノドミノドミノ",
        description: "ドミノを1000回並べた",
        goal: 1000,
        reward: {},
      },
      {
        id: 32,
        name: "ガッシャーン！",
        description: "あなたはドミノを崩しました！",
        reward: {},
      },
      {
        id: 33,
        name: "仮面舞踏会",
        description: "初めてロールプレイ機能を使い、1RPを入手した",
        reward: {},
        effect: "そのトークンは20コインで売却できる",
      },
      {
        id: 34,
        name: "そろそろ使い方にも慣れてきた？",
        description: "ロールプレイ機能で20RPを入手した",
        reward: {},
      },
      {
        id: 35,
        name: "キャラも表情もコロコロ変わる",
        description: "ロールプレイ機能で100RPを入手した",
        reward: {},
      },
      {
        id: 36,
        name: "そろそろ自分を見失ってきた…",
        description: "ロールプレイ機能で250RPを入手した",
        reward: {},
      },
      {
        id: 37,
        name: "ロールプレイ大好き！",
        description: "ロールプレイ機能で500RPを入手した",
        reward: {},
      },
      {
        id: 38,
        name: "ロマン主義",
        description: "スロット1号機を回してみた",
        reward: {},
      },
      {
        id: 39,
        name: "安全主義",
        description: "スロット2号機を回してみた",
        reward: {},
      },
      {
        id: 40,
        name: "100倍！",
        description: "スロット1号機で、スイカを当てた",
        reward: {},
      },
      {
        id: 41,
        name: "500倍！！！",
        description: "スロット1号機で、ニョワセブンを当てた",
        reward: {},
      },
      {
        id: 42,
        name: "ココローー！！",
        description: "スロット2号機で、ココロを揃えた（？）",
        reward: {},
      },
      {
        id: 43,
        name: "手に汗握る？",
        description: "スロットで、リーチ演出を見た",
        reward: {},
      },
      {
        id: 44,
        name: "なんと無茶な！",
        description: "スロットで、20枚5ライン賭けをした",
        reward: {},
      },
      {
        id: 45,
        name: "コイーン",
        description: "両替を使う",
        reward: {},
      },
      {
        id: 46,
        name: "ご所望はピザ工場ですかにゃ？",
        description: "両替で、ぴったり1RP分をニョボチップにする", //(20コイン)
        reward: {},
      },
      {
        id: 47,
        name: "21!",
        description: "ブラックジャックを決める",
        reward: {},
      },
      {
        id: 48,
        name: "42!!!",
        description: "ブラックジャックを2連続で決めてボーナスを手に入れる",
        reward: {},
      },
      {
        id: 49,
        name: "いただきですにゃー♪",
        description: "ルーレットで玉が０に入ってしまった",
        reward: {},
      },
      {
        id: 50,
        name: "★あなたは神谷マリアを遊び尽くした",
        description: "【プラチナトロフィー】1~50番のうち、累積どんぐり数以外の実績を集める。",
        effect: "それは放置ゲームにおいて、ブースト倍率を1.5倍に強化する。",
        reward: {},
      },
      // 今後、ここに実績をどんどん追加していきます
      // { id: 1, name: "次の実績", description: "実績の説明", effect: "実績の特殊能力説明（あれば）",goal:999(回数が必要なprogress形式、あれば), reward: {(特殊能力があれば XX:YYみたいに指定できるように)} },
    ],
    //隠し実績の情報（ネタバレ注意！）
    hidden_achievements: [
      {
        id: 0,
        name: "好奇心は猫を殺す",
        hint: "あなたはマリアのゴミ箱の中身を見た…底が見えなければもう1分後に",
        description: "隠し実績の一覧を開いた。",
      },
      {
        id: 1,
        name: "ありがとうにゃ",
        hint: "怪盗もお恵みを受ける時代かもしれません、あるいは作者が卑しいだけか。",
        description: "/カンパする(/kampa)を使用してカンパリンクを出す。",
      },
      {
        id: 2,
        name: "６３４２５１",
        hint: "マリアに会いましょう",
        description: "神谷マリアのステシを表示する", //p3x001254
      },
      {
        id: 3,
        name: "監査ログが汚れちゃいます！",
        hint: "やる気あるんですか？",
        description: "1分間タイムアウトされる",
      },
      {
        id: 4,
        name: "無茶しやがって…",
        hint: "そこまでやれとはいってないです…",
        description: "720分間タイムアウトされる",
      },
      {
        id: 5,
        name: "無意味な増資",
        hint: "0には何を掛けても0です",
        description: "ピザ窯Lvが0の時に、それ以外に投資する",
      },
      {
        id: 6,
        name: "逆さま",
        hint: "a>m>t>c>o",
        description:
          "上位の施設のレベルが全ての下位よりも高くなりました\n薄れゆく達成感（本家）",
      },
      {
        id: 7,
        name: "79",
        hint: ":_nackchan:",
        description:
          "当botの10面ダイスの絵文字は楠木なっく様に頂きました。ありがとうございます。", //ドミノで79を出す
      },
      {
        id: 8,
        name: "潜伏ドミノ師",
        hint: "ドミノはマリアの前ならどこでも並べられる、そう、マリアの前なら…",
        description: "マリアのダイレクトメールでドミノを並べる",
      },
      {
        id: 9,
        name: "J-A-C-K-P-O-T",
        hint: "キミは最凶のギャンブラー",
        description: "スロットで10000コイン以上の当選金を獲得する",
      },
      {
        id: 10,
        name: "そこに山があるから",
        hint: "まさか、この実績を一つ一つ取っているわけではないと思うが、-# もしそうならばそれは実績コンプの呪いにかかっており、一生解けぬ。",
        description: "i1～10を全て取得した状態で、実績画面を開く。", //ピザ窯ブースト1.1倍
      },
      // ... 他の隠し実績 ...
    ],
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
};
