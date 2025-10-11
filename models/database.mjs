// models/database.mjs
//同じファイル名があったためmodels/roleplay.mjsからの移行(2025/08/01)
import { Sequelize, DataTypes } from "sequelize";
// Supabase 接続情報
const supabaseDatabaseUrl = process.env.DATABASE_URL;
//console.log("[DEBUG] DATABASE_URL:", supabaseDatabaseUrl);
// Sequelize インスタンスの生成
const sequelize = new Sequelize(supabaseDatabaseUrl, {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true, // SSLを要求
      rejectUnauthorized: false, // 必要に応じて設定
    },
  },
  logging: (msg) => {
    if (msg.includes("ERROR")) {
      console.error(msg);
    }
  },
});

/**
 * ここで同期してないテーブル
 * - task_logs : ロスアカシナリオ一覧新着や、エクストラカード（アトリエカード）新着通知などの実行時間を保管しておくもの
 * 何時のデータか表示したり、1日1回だけ動くプログラムを動かすかの判断基準に使う
 * task_name(text,主キー):タスク名 last_successful_run(timestamptz):エラー無く実行できた時間
 *
 * - booster_status : サーバーブースターのロールを持っている人のリスト
 * 「リストに存在する」事そのものがロールを持っている判定になる
 * 複数鯖に対応できるようにしてある（複数のuser_idが存在することとなる）
 * user_id(text,主キー): DiscordのユーザーID guild_id(text,主キー):サーバーのID　boosted_at(timestamptz):ブーストした、あるいはBOTが所持を最後に確認した時間
 */

//ボイチャ通知モデル
const Notification = sequelize.define(
  "Notification",
  {
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    voiceChannelId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    textChannelId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    // ▼▼▼ ここにオプションを追加します ▼▼▼
    tableName: "notifications", // テーブル名を小文字の複数形に指定
    timestamps: false, // createdAt, updatedAt を作成しない
  }
);

// キャラクターモデル
const Character = sequelize.define(
  "Character",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true, // ★ ここに primaryKey: true を追加 ★
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pbwflag: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "characters",
    timestamps: false,
  }
);

// アイコンモデル
const Icon = sequelize.define(
  "Icon",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true, // ★ userId を主キーに設定 ★
    },
    iconUrl: {
      type: DataTypes.STRING,
    },
    deleteHash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    illustrator: {
      type: DataTypes.STRING,
    },
    pbw: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "icons",
    timestamps: false,
  }
);

// ポイントモデル
const Point = sequelize.define(
  "Point",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    point: {
      type: DataTypes.INTEGER, //整数型
      defaultValue: 0, // 新規ユーザーのために初期値を設定
    },
    totalpoint: {
      type: DataTypes.INTEGER, //整数型
      defaultValue: 0, // 新規ユーザーのために初期値を設定
    },
    //↑RP使用回数
    //↓あまやどんぐり
    acorn: {
      type: DataTypes.INTEGER,
      defaultValue: 0, // 新規ユーザーは0個からスタート
    },
    totalacorn: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastAcornDate: {
      type: DataTypes.DATE,
      allowNull: true, // まだ一度も拾ったことがないユーザーはnullになる
    },
    // コイン
    coin: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    //ニョボチップ
    //旧レガシーピザ（旧旧UnbelievaBoatのコイン)
    legacy_pizza: {
      type: DataTypes.DOUBLE, // ★ INTEGERからDOUBLEに変更
      defaultValue: 0,
    },
    //ニョボバンク
    nyobo_bank: {
      type: DataTypes.DOUBLE,
      defaultValue: 0,
    },
    lastRpDate: {
      type: DataTypes.DATE,
      allowNull: true, // まだ一度もRPを受け取っていないユーザーはnullになるようにします
    },
  },
  {
    tableName: "points",
    timestamps: false,
  }
);

// 現在のドミノ 開催数、ドミノの数、並べた人数
const CurrentDomino = sequelize.define(
  "CurrentDomino",
  {
    attemptNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    totalCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalPlayers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "currentdominos",
    timestamps: false,
  }
);

// ドミノの履歴v2（正規化版）
const DominoLog = sequelize.define(
  "DominoLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    attemptNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    totalCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    playerCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    loserName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "dominologs",
    timestamps: true, // createdAt, updatedAt
  }
);
//管理メモモデル
const AdminMemo = sequelize.define(
  "AdminMemo",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    authorId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isVisible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "admin_memos", // テーブル名を明示的に指定
    timestamps: true, // createdAt, updatedAt を自動管理
  }
);

//依頼一覧モデル（ロスアカ）
const Scenario = sequelize.define(
  "Scenario",
  {
    // "sce00001234"のようなIDを主キーとして保存
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source_name: {
      type: DataTypes.STRING,
      allowNull: true, // ソース名は必須ではない
    },
    creator_penname: {
      type: DataTypes.STRING,
    },
    // 将来の拡張のために、状態も保存しておくと便利
    status: {
      type: DataTypes.STRING,
    },
    difficulty: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    current_members: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    max_members: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    state: { type: DataTypes.STRING, allowNull: true },
    type: { type: DataTypes.STRING, allowNull: true },
    time: { type: DataTypes.STRING, allowNull: true }, // or DATE
    time_type: { type: DataTypes.STRING, allowNull: true },
    // キャッチフレーズを追加
    catchphrase: { type: DataTypes.STRING, allowNull: true },
    join_conditions: {
      //参加条件の配列
      type: DataTypes.ARRAY(DataTypes.STRING), // 文字列の配列型として定義
      allowNull: true, // データがない場合もあるのでnullを許可
    },
    //ラリー
    rally_playing_start: {
      type: DataTypes.DATE, // 日付/時刻型が適切です
      allowNull: true,
    },
    rally_playing_end: {
      type: DataTypes.DATE, // 日付/時刻型が適切です
      allowNull: true,
    },
    rally_member_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      // ★★★ これが、SQLの`DEFAULT now()`と同じ意味を持つ魔法です ★★★
      defaultValue: Sequelize.fn("now"),
    },
    // updatedAtカラムも同様に
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn("now"),
    },
  },
  {
    tableName: "scenarios", // DB内のテーブル名
    timestamps: false, // いつ追加されたか自動で記録してくれる
  }
);

//スタンプモデルの定義
const Sticker = sequelize.define(
  "Sticker",
  {
    // 自動で増えるID (主キー)
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // スタンプの名前 (オートコンプリートで検索する対象)
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // 画像のURL (Supabase Storageから取得)
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // 画像のパス (削除時に必要)
    filePath: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // 誰が登録したか
    ownerId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // 公開設定 (あなたの素晴らしいアイデア！)
    isPublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, // デフォルトは非公開
    },
  },
  {
    tableName: "stickers",
    timestamps: true,
  }
);

// カジノ統計モデル
const CasinoStats = sequelize.define(
  "CasinoStats",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true, // ユーザーIDを主キーの一部にする
    },
    gameName: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true, // ゲーム名を主キーの一部にする
    },
    gamesPlayed: {
      type: DataTypes.BIGINT, // BIGINTにしておくと安心
      defaultValue: 0,
    },
    totalBet: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },
    totalWin: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },
    gameData: {
      //各カジノに合わせたデータをjsonで保存する
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}, // デフォルト値を空のオブジェクトに
    },
  },
  {
    tableName: "casino_stats",
    timestamps: true, // 統計なので作成日時や更新日時があっても良いでしょう
  }
);

// Mee6 レベル情報モデル
const Mee6Level = sequelize.define(
  "Mee6Level",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    xpInLevel: {
      // 現在のレベル内での経験値
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    totalXp: {
      // 累計の経験値
      type: DataTypes.BIGINT, // 非常に大きくなる可能性があるのでBIGINT
      defaultValue: 0,
    },
    xpForNextLevel: {
      // 次のレベルまでに必要な経験値
      type: DataTypes.INTEGER,
      defaultValue: 55, // レベル1→2に必要なXP
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn("now"),
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn("now"),
    },
  },
  {
    tableName: "mee6_levels",
    timestamps: false, // データの最終同期日時を追跡するために `updatedAt` を利用
  }
);

// 放置ゲーム状態モデル
const IdleGame = sequelize.define(
  "IdleGame",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    // 人口は天文学的な数値になる可能性があるのでDOUBLE型が最適
    population: {
      type: DataTypes.TEXT,
      defaultValue: '0', // デフォルト値も文字列に
    },
    pizzaOvenLevel: {
      // ピザ窯（ベース生産量）
      type: DataTypes.INTEGER,
      defaultValue: 0, // レベル0では人口が増えないので、初期値は0
    },
    cheeseFactoryLevel: {
      //チーズ工場（乗算係数）
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    tomatoFarmLevel: {
      // トマト農場（乗算係数その２）
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    mushroomFarmLevel: {
      // マッシュルーム農場（乗算係数その３）
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    anchovyFactoryLevel: {
      // アンチョビ工場（乗算係数その４）
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    //(指数施設である精肉工場のLVはMee6テーブルのLVから持ってくる)
    //プレステージ
    prestigeCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0, // プレステージ回数
    },
    prestigePower: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0, // プレステージパワー(PP)
    },
    highestPopulation: {
      type: DataTypes.TEXT,
      defaultValue: '0', // デフォルト値も文字列に
    },
    skillPoints: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0, // スキルポイント(SP)
    },
    //スキル (infinity前)
    skillLevel1: {
      // 燃え上がるピザ工場
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    skillLevel2: {
      // 加速する時間
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    skillLevel3: {
      // ニョボシの怒り
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    skillLevel4: {
      // 【光輝】
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // TP（超越ポイント）スキル(infinity前)
    transcendencePoints: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0,
    },
    skillLevel5: {
      // TPスキル #5
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    skillLevel6: {
      // TPスキル #6
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    skillLevel7: {
      // TPスキル #7
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    chipsSpentThisInfinity: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },
    skillLevel8: {
      // TPスキル #8
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    buffMultiplier: {
      //ブースト(最終結果に対する乗算)
      type: DataTypes.DOUBLE,
      defaultValue: 1.0, // 初期値は倍率1（何もない状態）
    },
    buffExpiresAt: {
      // ブーストの有効期限
      type: DataTypes.DATE,
      allowNull: true, // nullならバフなし
    },
    // 計算されたピザボーナス％を自動で計算保存しておく場所（チャットピザ用）
    pizzaBonusPercentage: {
      type: DataTypes.DOUBLE, // 小数点を扱うのでDOUBLE型
      allowNull: false,
      defaultValue: 0, // デフォルト値は0%
    },
    // 最後に資源計算を反映した時刻
    lastUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn("now"),
    },
  },
  {
    tableName: "idle_games",
    timestamps: false,
  }
);

// ユーザー実績モデル
const UserAchievement = sequelize.define(
  "UserAchievement",
  {
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    achievements: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { unlocked: [], progress: {}, hidden_unlocked: [] },
    },
  },
  {
    tableName: "user_achievements",
    timestamps: true, // いつ初めて実績を取ったかなどを記録できる
  }
);

// カウンティングゲーム状態モデル
const CountingGame = sequelize.define(
  "CountingGame",
  {
    channelId: {
      // どのチャンネルのゲームか
      type: DataTypes.STRING,
      primaryKey: true,
    },
    currentNumber: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastUserId: {
      // 最後に成功したユーザーID
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastMessageId: {
      // 最後に成功したメッセージID
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "counting_games",
    timestamps: true,
  }
);

// データベースの同期処理
async function syncModels() {
  try {
    await sequelize.authenticate(); // 接続確認
    await Character.sync({ alter: true });
    await Icon.sync({ alter: true });
    await Point.sync({ alter: true });
    await CurrentDomino.sync({ alter: true });
    await Notification.sync({ alter: true });
    await AdminMemo.sync({ alter: true });
    await DominoLog.sync({ alter: true });
    await Scenario.sync({ alter: true });
    await Sticker.sync({ alter: true }); // スタンプモデルの同期
    await CasinoStats.sync({ alter: true });
    await Mee6Level.sync({ alter: true });
    await UserAchievement.sync({ alter: true });
    await IdleGame.sync({ alter: true });
    await CountingGame.sync({ alter: true });
    console.log("All models were synchronized successfully.");
  } catch (error) {
    console.error("Error synchronizing models:", error);
  }
}

/**
 * Sequelizeのデータベース接続を安全に閉じるための関数
 * これを main.mjs から呼び出す
 */
export async function closeDatabase() {
  try {
    await sequelize.close();
    console.log("[Database] Sequelize connection has been closed gracefully.");
  } catch (error) {
    // 既に接続が切れている場合などにエラーが出ても、シャットダウンは続行させたいので
    // ここでは console.error に留めるのが安全です。
    console.error("[Database] Error closing the Sequelize connection:", error);
  }
}

export {
  sequelize,
  Character,
  Icon,
  Point,
  CurrentDomino,
  Notification,
  AdminMemo,
  syncModels,
  DominoLog, // ← 追加
  Scenario, // シナリオモデルをエクスポート
  Sticker, // スタンプモデルをエクスポート
  Mee6Level,
  UserAchievement,
  CasinoStats,
  IdleGame,
  CountingGame,
};
