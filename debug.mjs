import fs from 'fs';
import path from 'path';
import Keyv from 'keyv';

// データベースファイルのパスを指定
const dbFilePath = path.resolve('/app/.data', 'roleplaydb.sqlite3');

// データベースファイルの存在を確認
const checkDatabaseFile = () => {
  if (fs.existsSync(dbFilePath)) {
    const stats = fs.statSync(dbFilePath);
    console.log(`データベースファイルが存在します: ${dbFilePath}`);
    console.log(`ファイルサイズ: ${stats.size} バイト`);
    console.log(`最終更新日時: ${stats.mtime}`);
  } else {
    console.log(`データベースファイルが見つかりません: ${dbFilePath}`);
  }
};

// Keyvを使ってデータベースに接続して基本情報を取得
const checkDatabaseConnection = async () => {
  const chara = new Keyv(`sqlite://${dbFilePath}`, { table: 'chara' });
  const icons = new Keyv(`sqlite://${dbFilePath}`, { table: 'icons' });

  try {
    // 一時的にデータをセットして確認するためのキー
    await chara.set('test_key', 'test_value');
    const value = await chara.get('test_key');
    if (value === 'test_value') {
      console.log('Keyvデータベースへの接続に成功しました。');
    } else {
      console.error('データベースからの値取得に失敗しました。');
    }
    // テストキーを削除
    await chara.delete('test_key');
  } catch (error) {
    console.error('Keyvデータベースへの接続に失敗しました:', error);
  }
};

// デバッグ実行
const runDebug = async () => {
  checkDatabaseFile();
  await checkDatabaseConnection();
};

runDebug();