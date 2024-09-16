import { Sequelize, DataTypes } from 'sequelize';


// Sequelizeのインスタンスを作成
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: '.data/roleplaydb.sqlite3',
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


export { sequelize, Character, Icon, Point };