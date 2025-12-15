// constants/slot-definitions.mjs

/**
 * スロットの設定を取得する関数
 * @param {boolean} isProduction - 本番環境かどうか
 * @param {object} debugConfig - デバッグ用の設定オブジェクト
 */
export const getSlotDefinitions = (isProduction, debugConfig) => {
  return {
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
  };
};
