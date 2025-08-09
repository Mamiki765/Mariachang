// models/database.mjs
//同じファイル名があったためmodels/roleplay.mjsからの移行(2025/08/01)
import { Sequelize, DataTypes } from "sequelize";

// Supabase 接続情報
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;
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

//ボイチャ通知モデル
const Notification = sequelize.define("Notification", {
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
}, {
  // ▼▼▼ ここにオプションを追加します ▼▼▼
  tableName: 'notifications', // テーブル名を小文字の複数形に指定
  timestamps: false,          // createdAt, updatedAt を作成しない
});

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
    },
    totalpoint: {
      type: DataTypes.INTEGER, //整数型
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

// ドミノの履歴使用終了
/*
const DominoHistory = sequelize.define(
  "DominoHistory",
  {
    highestRecord: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    highestRecordHolder: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    zeroCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    players: {
      type: DataTypes.JSON, // JSON型に変更
      allowNull: false,
      defaultValue: [],
    },
    totals: {
      type: DataTypes.JSON, // JSON型に変更
      allowNull: false,
      defaultValue: [],
    },
    losers: {
      type: DataTypes.JSON, // JSON型に変更
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "dominohistorys",
    timestamps: false,
  }
);
*/
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

// データベースの同期処理
async function syncModels() {
  try {
    await sequelize.authenticate(); // 接続確認
    await Character.sync({ alter: true });
    await Icon.sync({ alter: true });
    await Point.sync({ alter: true });
    await CurrentDomino.sync({ alter: true });
    //    await DominoHistory.sync({ alter: true });
    await Notification.sync({ alter: true });
    await AdminMemo.sync({ alter: true });
    await DominoLog.sync({ alter: true });
    await Scenario.sync({ alter: true });
    await Sticker.sync({ alter: true }); // スタンプモデルの同期
    console.log("All models were synchronized successfully.");
  } catch (error) {
    console.error("Error synchronizing models:", error);
  }
}

export {
  sequelize,
  Character,
  Icon,
  Point,
  CurrentDomino,
  Notification,
  //  DominoHistory,
  AdminMemo,
  syncModels,
  DominoLog, // ← 追加
  Scenario, // シナリオモデルをエクスポート
  Sticker, // スタンプモデルをエクスポート
};
