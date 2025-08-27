//config.mjs
//トークンなど機密事項やタイムゾーンはdotenvで管理すること！
//import config from '../config.mjs'; などで読み込む
export default {
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
    //実際の鯖あたりに置いてるやつ
    command: "1260078833936367679", //コマンドの使用
    admin: "1263336102622793861", //管理コマンド使用ログ、管理室などを推奨
    guildCreate: "1260078958460928061",
    guildDelete: "1260078958460928061",
  },
  timesignalch: "1025416223724404766", //8,22時報を流すチャンネル
  arenatimech: "1201103311428923452", //闘技大会時報チャンネル
  rev2ch: "1103362273004769350", //ロスアカのシナリオ一覧を流すチャンネル
  moderator: "1038083096618209301", //モデレーターのロールID
  forumNotification: {
    //フォーラムスレッドがたった時に通知するスレッド
    "1038863762079350834": "1025416223724404766",
    "1038863052390535398": "1025420692184903680",
    //'フォーラムチャンネルID': '通知チャンネルID',
  },
  //ドミノ関連
  dominoch: "1288173544232194089", //ドミノ部屋、ドミノのログもここに出す
  reddice: [
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
  ],
  bluedice: [
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
  ],
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
    //難易度対応の絵文字
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
    vipRoles: [
      "1038083096618209301", // モデレーターロールのID
      "1025453404362903622", // イラストレーターロールのID
    ],
    vipLimit: 50, // VIPの最大登録数
  },
  nyowacoin: "<:nyowacoin:1407422205624844288>",
  casino: {
    //カジノ設定
    slot: {
      //スロット1号機（ハイリスク）
      displayname: "ニョワミヤスロットマシン(1号機)",
      gameName: "slots", //戦績に残すためのタグ
      symbols: {
        //絵柄
        7: "<:nyowa7:1409958172545912904>",
        watermelon: "🍉",
        grape: "🍇",
        lemon: "🍋",
        cherry: "🍒",
        rotate: "<a:nyowamiyarika_down:1265938514462380144>", //回転中の絵柄
        reach: "<a:nyowamiyarika_rainbow:1265941562945441817>", //リーチ告知時の絵文字もここに
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
          display:
            "<:nyowa7:1409958172545912904><:nyowa7:1409958172545912904><:nyowa7:1409958172545912904>",
        },
        {
          id: "watermelon",
          name: "スイカ",
          payout: 100,
          pattern: ["watermelon", "watermelon", "watermelon"],
          display: "🍉🍉🍉",
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
      symbols: {
        bell: "<:katakana_ko:1265165857445908542>",
        bell2: "<:katakana_ro:1265166237399388242>",
        lemon: "🍋",
        grape: "🍇",
        cherry: "🍒",
        rotate: "<a:himeko_down:1409986521058246737>",
        reach: "<a:toruchan_kokoro2:1265162645330464898>",
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
          display:
            "<:katakana_ko:1265165857445908542><:katakana_ko:1265165857445908542><:katakana_ro:1265166237399388242>",
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
        max: 40,
        increment: 2, // 2枚単位
      },
    },
  },
};
