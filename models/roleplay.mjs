import {
  Sequelize,
  DataTypes
} from 'sequelize';


const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: '.data/roleplaydb.sqlite3',
  logging: (msg) => {
    // エラーメッセージだけを表示
    if (msg.includes('ERROR')) {
      console.error(msg);
    }
  }
});

// キャラクターモデル
const Character = sequelize.define('Character', {
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  pbwflag: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'characters',
  timestamps: false
});

// アイコンモデル
const Icon = sequelize.define('Icon', {
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  iconUrl: {
    type: DataTypes.STRING
  },
  illustrator: {
    type: DataTypes.STRING
  },
  pbw: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'icons',
  timestamps: false
});

// ポイントモデル
const Point = sequelize.define('Point', {
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  point: {
    type: DataTypes.INTEGER //整数型
  },
  totalpoint: {
    type: DataTypes.INTEGER //整数型
  }
}, {
  tableName: 'points',
  timestamps: false
});

// 現在のドミノ 開催数、ドミノの数、並べた人数
const CurrentDomino = sequelize.define('CurrentDomino', {
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
  }
}, {
  tableName: 'currentdominos',
  timestamps: false
});

// ドミノの履歴
const DominoHistory = sequelize.define('DominoHistory', {
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
  }
}, {
  tableName: 'dominohistorys',
  timestamps: false
});

// データベースの同期処理をまとめて行う
async function syncModels() {
  await Character.sync({
    alter: true
  });
  await Icon.sync({
    alter: true
  });
  await Point.sync({
    alter: true
  });
  await CurrentDomino.sync({
    alter: true
  });
  await DominoHistory.sync({
    alter: true
  });
}

export {
  sequelize,
  Character,
  Icon,
  Point,
  CurrentDomino,
  DominoHistory,
  syncModels
};