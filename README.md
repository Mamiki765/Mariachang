# Mariachang Bot

「神谷マリアにゃ！マリアは雨宿りサーバーで動いているPBWプレイヤーの皆さんをサポートするBOTですにゃ」
このBotは、[EOi(@exteoi)様](https://note.com/exteoi/n/n0ea64e258797)が作成された `minipotato-bot` の雛形を元に、Rika Amamiya(@tw_e35140)が大幅な改修を加えて開発したものです。
素晴らしい雛形を公開してくださったEOi様に、心から感謝いたします。

### スラッシュコマンドの登録

本番環境では bot 起動時に自動でスラッシュコマンド登録を行いません。
必要な場合は手動で以下を実行してください。

```bash
docker exec -it mariachang npm run register:commands
```

## 箱庭実績の取得連携（Draft）

箱庭から `POST /internal/hakoniwa/achievement` で受信し、既存の実績付与・cache・毎分DB保存を使います。「島の秘書」は151、既存の `/hakoniwa` の「島主」は150です。Mariaに肩書きは追加しません。

導入時はOwnerが専用の共有secretを用意し、Mariaの実行envに `HAKONIWA_LINK_SECRET`、箱庭に同じ値を `MARIA_ACHIEVEMENTS_TOKEN` として設定します。箱庭の `MARIA_ACHIEVEMENTS_URL` は同じDocker network内の `http://mariachang:3000/internal/hakoniwa/achievement` が候補です。既存Bot TOKEN・DB資格情報は使い回しません。今回、設定・deploy・実付与・実通知はしていません。

実績は雨宿りの非所属者・退会者にも保存し、通知だけを抑止します。起動時に雨宿りのメンバーを一回取得し、以降はDiscord.jsがjoin/removeで更新するcacheを使います。初期取得未完了・失敗でも付与は続き、通知を抑止します。この判定は雨宿り向けの通常・隠し実績にも適用します。実績ごとのmember fetchやpollingはありません。

`accepted:true` は既存のcache/dirty保存経路での受付完了です。毎分DB保存前の強制終了で未保存分を失う既存の窓は変えていません。同じ実績の再送では、取得済み判定で通知を繰り返しません。

模擬検証: `node --experimental-vm-modules --test tests/idle-command.test.mjs tests/hakoniwa-achievement.test.mjs`。DB・Discordはstubで、実付与・送信しません。

## アセット保存について

画像アセット（ロールプレイ用アイコン、スタンプ）は Supabase Storage ではなく、OCI サーバー上のローカルディレクトリに保存されます。

- 保存先: `/srv/bot-assets`
- 公開URL: `https://assets.pbwlove.com`

主な内訳:

- ロールプレイ用アイコン: `/srv/bot-assets/icons`
- スタンプ: `/srv/bot-assets/stickers`

これらのファイルは Docker のボリュームマウントで永続化されており、`mariachang` コンテナと `assets` コンテナの両方から参照されます。

### 必要な環境変数

```env
ASSETS_ROOT=/srv/bot-assets
ASSETS_BASE_URL=https://assets.pbwlove.com
```
### 注意事項

* ローカル開発環境でアイコンやスタンプのアップロードを試す場合、`ASSETS_ROOT` の保存先と配信環境が一致していないと、アップロード後のURLが正しく見えないことがあります。
* 本番環境では `assets.pbwlove.com` が Nginx Proxy Manager 経由で `assets` コンテナに接続されています。
* 旧 Supabase Storage 用の `supabaseStorage.mjs` は廃止済みです。

## Supabase-js (RPC/API) 管理下のテーブル

これらのテーブルはSequelizeの管理外です。マイグレーションは手動またはSupabaseのSQL Editorで行う必要があります。

### `booster_status`

サーバーブースターのロールを現在持っているユーザーのリスト。

| カラム名     | 型            | 説明                         |
| :----------- | :------------ | :--------------------------- |
| `user_id`    | `TEXT`        | DiscordのユーザーID (主キー) |
| `guild_id`   | `TEXT`        | サーバーのID (主キー)        |
| `boosted_at` | `TIMESTAMPTZ` | Botが最後に確認した日時      |

### `task_logs`

定期実行タスクの最終成功日時を記録するテーブル。

| カラム名              | 型            | 説明                        |
| :-------------------- | :------------ | :-------------------------- |
| `task_name`           | `TEXT`        | タスクの一意な名前 (主キー) |
| `last_successful_run` | `TIMESTAMPTZ` | タスクが最後に成功した日時  |

### `app_config`

アプリケーション全体で共有する設定値やメタデータを格納するKey-Valueテーブル。

| カラム名      | 型            | 説明                                        |
| :------------ | :------------ | :------------------------------------------ |
| `key`         | `TEXT`        | 一意のキー名 (主キー)                       |
| `value`       | `JSONB`       | 設定値 (文字列、数値、JSONオブジェクトなど) |
| `description` | `TEXT`        | この設定が何のためのものかの説明            |
| `updated_at`  | `TIMESTAMPTZ` | 最終更新日時                                |

### `notified_rss_items`

RSS監視タスク(`rss-watcher.mjs`)が通知した投稿のURLを記録するテーブル。投稿の重複通知を防ぐために使用されます。テーブル内の古いデータ(3日以上経過)は、Supabaseの`pg_cron`によって毎日自動的に削除されます。

| カラム名     | 型            | 説明                                |
| :----------- | :------------ | :---------------------------------- |
| `url`        | `TEXT`        | 通知済みの投稿URL (主キー)          |
| `created_at` | `TIMESTAMPTZ` | レコードの作成日時 (自動削除の基準) |

## ライセンス

このプロジェクトは、MITライセンスの下で公開されています。
詳細は`LICENSE`ファイルをご覧ください。

### アセット (Assets)

- **ヨーロピアンルーレット盤面画像**
  - **作品名:** [European roulette.svg](https://commons.wikimedia.org/wiki/File:European_roulette.svg)
  - **作者:** [Solen Feyissa](https://commons.wikimedia.org/wiki/User:Solen_f)
  - **ライセンス:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.ja)

## 開発者

あまみやりか(@tw_e35140)
```
