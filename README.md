# Mariachang Bot

「神谷マリアにゃ！マリアは雨宿りサーバーで動いているPBWプレイヤーの皆さんをサポートするBOTですにゃ」
このBotは、[EOi(@exteoi)様](https://note.com/exteoi/n/n0ea64e258797)が作成された `minipotato-bot` の雛形を元に、Rika Amamiya(@tw_e35140)が大幅な改修を加えて開発したものです。
素晴らしい雛形を公開してくださったEOi様に、心から感謝いたします。

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
