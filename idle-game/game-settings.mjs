//idle-game\game-settings.mjs
//この中身はconfig.mjsでimportしてconfig.idleとしてexportされ吐き出される
import {
  achievements,
  hidden_achievements,
} from "../constants/achievements.mjs";

// config.mjsから持ってきた巨大な idle オブジェクトをここに貼り付ける
//    そして、それをデフォルトエクスポートする
export default {
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
      effect: 0.09,
      unlockPopulation: 0,
      type: "multiplicative", //乗数（下位）
    },
    tomato: {
      key: "tomatoFarmLevel",
      name: "トマト農場",
      emoji: "🍅",
      baseCost: 700, // 800 -> 700予定
      multiplier: 1.1,
      effect: 0.08,
      unlockPopulation: 100_0000,
      type: "multiplicative",
    },
    mushroom: {
      key: "mushroomFarmLevel",
      name: "マッシュルーム農場",
      emoji: "🍄",
      baseCost: 900, // 1000-> 900?
      multiplier: 1.105,
      effect: 0.07,
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
      effect: 0.06,
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
      effect: 0.05, //こっから下げると#5が弱くなりすぎる　悩む
      unlockAchievementId: 73, //施設そのものとPP効果を解禁する（共通）
      type: "multiplicative2", //乗数施設（上位）#1や実績の効果が乗らない。未解禁時PPは乗らず、#5や工場試練のLvだけ精肉+^0.001は乗る
    },
    wheat: {
      key: "wheatFarmLevel",
      name: "小麦の品種改良",
      emoji: "🌾",
      baseCost: 1500,
      multiplier: 1.12,
      effect: 0.04,
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
      effect: 0.03,
      unlockAchievementId: 66,
      type: "multiplicative2",
    },
  },
  //ここからいつものアイツ
  meat: {
    //指数施設（サラミ）
    emoji: "🍖",
    effect: 0.01, // 1レベルあたりの効果 (^1.01)
    type: "power", //指数施設。素は違う表にあるmee6レベルなのでカラムは無し
    //infinity前の要素(PP、実績、Mee6)のソフトキャップ
    softCapsBeforeInfinity: [
      { base: 10, power: 0.5 },
      { base: 12, power: 0.33 },
    ],
    iu13bonus: 0.05,
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
      descriptionIc1: "ブーストがΣ中累計消費チップに応じて強化される",
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
    // ▼▼▼ このように tiers 配列で全体を囲む ▼▼▼
    tiers: [
      {
        // Tier 1
        id: 1,
        upgrades: {
          IU11: {
            name: "ゴーストチップ",
            cost: 0,
            description:
              "プレステージの度にIU11のレベルに応じた幻のチップを得る。それは得た範囲で工場を自動強化し、残りは消滅する",
            text: "PS時工場自動強化",
          },
          IU12: {
            name: "自動調理器",
            cost: 1,
            description: "プレステージ時にTPを自動で割り振る。",
            text: "TP自動配分",
          },
          IU13: {
            name: "肉干しレンガ",
            cost: 1,
            description: "精肉工場の指数に+0.05を加算する。(ソフトキャップ後)",
            text: "指数+0.05",
          },
          IU14: {
            name: "業務用品の購入",
            cost: 1,
            description: "工場とアセンションが10%割引",
            discount: 0.1,
            text: "工場/Asc 10%OFF",
          },
        },
      },
      {
        // Tier 2
        id: 2,
        upgrades: {
          IU21: {
            name: "パインパワー",
            cost: 3,
            description: "PP獲得量が10%増加する。",
            bonus: 0.1, // 10%
            text: "PP+10%",
          },
          IU22: {
            name: "無限の試練",
            cost: 2,
            description: "インフィニティ・チャレンジが解禁される。",
            text: "IC解禁",
          },
          IU23: {
            name: "より良い広告",
            cost: 3,
            description: "アセンション倍率+0.025",
            bonus: 0.025,
            text: "Asc x+0.025",
          },
          IU24: {
            name: "惑星間高速道路",
            cost: 10,
            description: "全ての工場が∞に応じて僅かに強化される",
            bonus: 0.2, //0.2倍
            text: "8工場×1+(∞/5)",
          },
          // 将来ここに IU22, IU23 などを追加していく
        },
      },
      {
        // Tier 3
        id: 3,
        upgrades: {
          IU31: {
            name: "小型発電機",
            cost: 16,
            description: "ジェネレーター1号機の出力が5倍強化",
            bonus: 5, // x5
            text: "G1Power x5",
          },
          IU32: {
            name: "中型発電機",
            cost: 128,
            description: "ジェネレーター2号機の出力が3倍強化",
            bonus: 3, // x3
            text: "G2Power x3",
          },
          IU33: {
            name: "IP還元装置",
            cost: 444,
            description: "所持IPに応じてG1が強化される", //max(log10(IP)*4/3,1.5)
            text: "所持IPでG1強化",
          },
          IU34: {
            name: "IP循環装置",
            cost: 512,
            description: "所持IPに応じてG2が強化される", //max(log10(IP)*4/5,1.2)
            text: "所持IPでG2強化",
          },
        },
      },
      {
        // Tier 4
        id: 4,
        upgrades: {
          IU41: {
            name: "古びた発電機",
            cost: 1024,
            description:
              "インフィニティ回数に応じて、ジェネレーター2号機が微量に強化",
            text: "∞に応じてG2微強化", // max(√(∞/10)倍,1)
          },
          IU42: {
            name: "ジェネレーターの最適化",
            cost: 1024,
            description:
              "GPによる全工場へのブースト効果の指数を0.5から0.75に引き上げる。",
            bonus: 0.25, // 指数の増加量
            text: "GP指数^0.5→^0.75",
          },
          IU43: {
            name: "節税政策",
            cost: 1024,
            description: "ニョボチップの獲得量が1.2倍になる。",
            bonus: 0.2,
            text: "チップx1.2",
          },
        },
      },
      {
        // Tier 5
        id: 5,
        upgrades: {
          IU51: {
            name: "IPメガキャノン",
            cost: 2048,
            description: "IC9の最短クリア時間に応じてIPが大幅に増加する",
            text: "IC9時間→IP乗算",
            max: 15,
            min: 1.5, //IC9未クリアなら1
            baseTime: 60,
          },
          IU52: {
            name: "魔剣グラム",
            cost: 2048,
            description: "IC9の最短クリア時間に応じてG1が強化される",
            text: "IC9時間→G1強化",
            max: 25.18,
            min: 2.5,
            baseTime: 60,
          },
          IU53: {
            name: "神槍グングニル",
            cost: 2048,
            description: "IC9の最短クリア時間に応じてG2が強化される",
            text: "IC9時間→G2強化",
            max: 18.15,
            min: 2,
            baseTime: 60,
          },
        },
      },
      {
        // Tier 6
        id: 6,
        upgrades: {
          IU61: {
            name: "大型発電機",
            cost: 100_0000,
            description: "ジェネレーター1号機の出力が10倍強化",
            bonus: 10, // x10
            text: "G1Power x10",
          },
          IU62: {
            name: "並行宇宙観測装置",
            cost: 2_000_000,
            description:
              "エタニティ中でのチップ消費量に応じて獲得∞が増加する。",
            text: "∞獲得数: log10(Σ消費©+1)+1倍",
          },
        },
      },
      {
        // Tier 7
        id: 7,
        upgrades: {
          IU71: {
            name: "無限循環装置",
            cost: 1e11,
            description: "ジェネレーター3号機の出力が(2号機の購入数+1)倍",
            bonus: 10, // x10
            text: "G3Power x(G2数+1)",
          },
          IU72: {
            name: "エントロピー縮小機関",
            cost: 1e11,
            description: "ジェネレーター4号機の出力が(3号機の購入数+1)倍",
            text: "G4Power x(G3数+1)",
          },
          IU74: {
            name: "歪んだ歯車",
            cost: 1e12,
            description:
              "GPによる全工場へのブースト効果の指数を0.75から0.9に引き上げる。",
            bonus: 0.15, // 指数の増加量
            text: "GP指数^0.75→^0.9",
          },
        },
      },
      // Tier 3, 4 ... と将来追加できる
    ],
  },
  ghostChip: {
    // 予算計算式: budgetPerLevel * Lv
    budgetPerLevel: 5000,
    levelCap: 200,
    // コスト計算式: min(budgetPerLevel * (base + level * perLevel), budgetPerLevel * cap)
    cost: {
      baseMultiplier: 100, // スタート時の倍率
      levelMultiplier: 100, // 1レベルごとに加算される倍率
      capMultiplier: 1000, // 上限の倍率
    },
  },
  infinityChallenges: [
    //IC1~8は自由、9は1~8クリアで出現、2以降は未実装
    {
      id: "IC1",
      name: "ニョボシの夏休み",
      description: "#7は機能せず、ブーストは(2/∞中の消費チップ)倍となる",
      bonus: "エタニティ中の消費チップが#7効果に乗ります",
    }, //使用チップだけニョワミヤの増加が減る
    {
      id: "IC2",
      name: "腹が減って死にそうだ！",
      description: "ゲーム内で12時間以内にインフィニティ",
      bonus: "#2効果が、少しだけオリーブ・小麦・パイナップルを強化する",
    }, //実質#2使用禁止
    {
      id: "IC3",
      name: "割高なサイドメニュー",
      description: "TPの獲得量が大きく減る",
      bonus: "TPが少しだけ増える",
    }, //^2.5 -> 2.0 /2.7
    {
      id: "IC4",
      name: "ベジタリアンピザ",
      description: "Mee6Lvの恩恵を受けれなくなる",
      bonus: "指数+0.10(SC後)",
      rewardValue: 0.1,
    },
    {
      id: "IC5",
      name: "パッシブ光輝は禁止！禁止です！",
      description: "スキル#4を取得できない",
      bonus: "スキル#4が20％強化される",
    },
    {
      id: "IC6",
      name: "ライバル現る！？",
      description:
        "1分以内にニョワミヤを出し、その後ライバルに抜かれる事なく逃げ切れ！",
      bonus: "インフィニティ後、#1~#4がIPの桁数に応じたLvで始まる",
    }, //現実時間60秒ごとに0 -> 1 -> e1 -> e2…となるピザ屋に負けたらIC中断
    {
      id: "IC7",
      name: "貧乏くじは引きたくない",
      description: "アセンションがニョワ1匹から使えるが…",
      bonus: "アセンション倍率 + 0.025",
    }, //  e40 * e1^n　-> 1 * e10^n
    {
      id: "IC8",
      name: "アドブロッカー",
      description: "アセンションができない",
      bonus: "アセンション倍率1.2倍",
    }, //元は1.125 -> IC7,8合わせて1.38 IC8、9はゲキムズなのでバチあたらん
    {
      id: "IC9",
      name: "原点回帰",
      description: "オリーブ、小麦、パイナップルの効果が1になる",
      bonus: "IP2倍",
    }, //こいつの実装は最後
  ],
  //constants\achievements.mjsにお引越し
  achievements: achievements,
  hidden_achievements: hidden_achievements,
};
