//constants\achievements.mjs
//実績　utils\achievements.mjs
// 実績一覧は unlockAchievements(client, userId, ID) で解除可能です。
// 複数解除する場合はスプレッド構文でまとめて渡せます。
// 例: unlockAchievements(client, userId, ...[0,1,2])
export const achievements = [
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
    description:
      "【プラチナトロフィー】1~50番のうち、累積どんぐり数以外の実績を集める。",
    effect: "それは放置ゲームにおいて、ブースト倍率を1.5倍に強化する。",
    reward: {},
  },
  {
    id: 51,
    name: "サイドメニューの力",
    description: "ニョワミヤの数が1京(1e16)に到達",
    effect:
      "人口1京(1e16)以上、プレステージでTPを獲得。最高人口未満でのプレステージが可能になる。", //PP≧16(最高人口1e16)or現在人口1京
    reward: {},
  },
  {
    id: 52,
    name: "雨宿り天ぷらチケット好評発売中！食え！",
    description: "TPスキル#8を取得する",
    reward: {},
  },
  {
    id: 53,
    name: "誰が為に崩すのか",
    description: "ドミノを15回崩した後に統計画面を開く",
    reward: {},
  },
  {
    id: 54,
    name: "賽の河原はここに在り",
    description: "ドミノを20回崩した後に統計画面を開く",
    reward: {},
  },
  {
    id: 55,
    name: "ドミノクイーン",
    description: "ドミノを25回崩した後に統計画面を開く(チャレンジ)",
    reward: {},
  },
  {
    id: 56,
    name: "無限への一合目",
    description: "ニョワミヤの数が6.692e+30に到達(infinityの10%)",
    reward: {},
  },
  {
    id: 57,
    name: "ニョボチップが溶けていく",
    description: "インフィニティ中に消費されたニョボチップが10万を超える",
    reward: {},
  },
  {
    id: 58,
    name: "一杯喋って一杯溶かす",
    description: "インフィニティ中に消費されたニョボチップが100万を超える",
    reward: {},
  },
  {
    id: 59,
    name: "ニョボシ・ブラックホール",
    description:
      "インフィニティ中に消費されたニョボチップが1000万を超える(チャレンジ)",
    reward: {},
  },
  {
    id: 60,
    name: "よろしい、ならばシベリア送りだ",
    description: "countingで100回数字を数える",
    goal: 100,
    reward: {},
  },
  {
    id: 61,
    name: "無限への二合目",
    description: "ニョワミヤの数が4.482e+61に到達(infinityの20%)(チャレンジ)",
    effect: "無駄かもしれないが、ニョワミヤ達はあなたを尊敬するだろう",
    reward: {},
  },
  {
    id: 62,
    name: "虚無の試練",
    description: "全ての工場がLv0で1e+24を目指す",
    effect: "工場の試練1/4",
    reward: {},
  },
  {
    id: 63,
    name: "散財の試練",
    description: "1,000,000ニョボチップを一気に消し飛ばす",
    effect: "工場の試練2/4",
    reward: {},
  },
  {
    id: 64,
    name: "忍耐の試練",
    description:
      "最後にプレステージか工場リセットをしてから1週間が経過する…本当に1週間待たないとダメなの？", //#2を使えばいいんだけどね(小声)
    effect: "工場の試練3/4",
    reward: {},
  },
  {
    id: 65,
    name: "充足の試練",
    description: "#1スキルを使用せず、e27を達成する",
    effect: "工場の試練4/4",
    reward: {},
  },
  {
    id: 66,
    name: "工場の試練",
    description: "インフィニティ前の4つの試練を制覇してから実績を見る",
    effect:
      "精肉以外の工場Lv10につき指数+0.01、パイナップル農場とそのPP効果を解禁", //1につき0.001
    reward: {
      type: "exponentBonusPerFactoryLevel",
      value: 0.001,
      targetFactories: [
        "oven",
        "cheese",
        "tomato",
        "mushroom",
        "anchovy",
        "olive",
        "wheat",
        "pineapple",
      ],
    },
  },
  {
    id: 67,
    name: "ニョワミヤ数", //5月18日=リカ・サキュバスの誕生日
    description: "ニョボチップの入手量が+518%を達成する",
    effect: "",
    reward: {},
  },
  {
    id: 68,
    name: "ニョボシ数", //8月15日=二星亜希の誕生日、どっちもうちの子。
    description: "ニョボチップの入手量が+815%を達成する",
    effect: "",
    reward: {},
  },
  {
    id: 69,
    name: "この数字に何の意味があんのよ？", //p3p001254=リカ・サキュバスのID
    description: "ニョボチップの入手量が+1254%を達成する",
    effect: "+1%の実績は残念ながらない。", //r2p000001 = 二星亜希のID
    reward: {},
  },
  {
    id: 70,
    name: "無限への三合目",
    description: "ニョワミヤの数が2.9613e+92に到達(infinityの30%)",
    effect: "もう縛るものはなにもない、君もニョワミヤも",
    reward: {},
  },
  {
    id: 71,
    name: "あと半分",
    description: "ニョワミヤの数が1.3407e+154に到達(infinityの50%)",
    effect: "終わりへの折り返し地点",
    reward: {},
  }, //未実装といいつつ処理は追加済みだけど
  {
    id: 72,
    name: "ＴＨＥ　ＥＮＤ　？",
    description: "ピザ工場の終わりを見る", //infinityに到達し、エンディングを見る。
    effect: "ニョボチップ入手量+5000%", //ここに来たら実際5500~8000くらいなのでリセットされるの考えるとご褒美としてはこんなもの
    reward: {},
  },
  //ここ順番滅茶苦茶だし実績表示機能の番号は配列の並び順で出すようにしてもいいかも
  {
    id: 73,
    name: "超越に至る道",
    description: "PPが12に到達する", //1兆でプレステージ
    effect: "オリーブ農園とそのPP効果を解禁",
    reward: {},
  },
  {
    id: 74,
    name: "原点への回帰",
    description:
      "人口1e+16以上かつピザ窯のLvが80に達した状態でプレステージする",
    effect: "小麦の品種改良とそのPP効果を解禁",
    reward: {},
  },
  {
    id: 75,
    name: "カロリーは旨い",
    description: "オリーブ農園を強化する",
    reward: {},
  },
  {
    id: 76,
    name: "ピザ用です。パスタにしてはいけません",
    description: "小麦の新種改良を行い、生地をより美味しくする",
    reward: {},
  },
  {
    id: 77,
    name: "帰ってきたパイナップル",
    description: "ニョワミヤが殺到しない、無臭のパイナップル農園を整備する", //プレステージネタ
    reward: {},
  },
  {
    //ここから未実装
    id: 78,
    name: "今こそ目覚めの時",
    description: "8つの工場を全てLv1にする",
    effect: "アセンションを解禁",
    reward: {},
  },
  {
    id: 79,
    name: "あるものはニョワミヤでも使う",
    description: "アセンションを行う",
    reward: {},
  },
  {
    id: 80,
    name: "ニョワミヤがニョワミヤを呼ぶ",
    description: "アセンションを10回行う",
    reward: {},
  },
  {
    id: 81,
    name: "ニョワミヤ永久機関",
    description: "アセンションを50回行う",
    reward: {},
  },
  {
    id: 82,
    name: "放置は革命だ", //Revolution idleのパクリなので。いやあっちのRevoは回転の意味だけど
    description: "はじめてジェネレーターを購入する",
    reward: {},
  },
  {
    id: 83,
    name: "再び果てへ",
    description: "2回目のインフィニティに到達する",
    reward: {},
  },
  {
    id: 84,
    name: "それはもはや目標ではない",
    description: "5回目のインフィニティに到達する",
    effect: "IPx2",
    reward: {},
  },
  {
    id: 85,
    name: "ダブル・ジェネレーター",
    description: "2個目のジェネレーターⅠを購入する",
    reward: {},
  },
  {
    id: 86,
    name: "アンチマター・ディメンジョンズ",
    description: "（未実装）2つ目のジェネレーターⅡを購入する",
    effect: "ブレイクインフィニティを解禁…ホントはもっと後だけど",
    reward: {},
  },

  // 今後、ここに実績をどんどん追加していきます
  // { id: 1, name: "次の実績", description: "実績の説明", effect: "実績の特殊能力説明（あれば）",goal:999(回数が必要なprogress形式、あれば), reward: {(特殊能力があれば XX:YYみたいに指定できるように)} },
];

//隠し実績の情報（ネタバレ注意！）
export const hidden_achievements = [
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
      "基本5施設の、上位の施設のレベルが全ての下位よりも高くなりました\n薄れゆく達成感（本家）",
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
    hint: "まさか、この実績を一つ一つ取っているわけではないと思うが、もしそうならばそれは実績コンプの呪いにかかっており、一生解けぬ。",
    description: "i1～10を全て取得した状態で、実績画面を開く。", //ピザ窯ブースト1.1倍
  },
  // ... 他の隠し実績 ...
];
