// regist-commands.mjs
import fs from "fs";
import path from "path";
import { REST, Routes } from "discord.js";
/* =================================================================
 * === コマンド登録システムver2の取扱説明書 ===
 * =================================================================
 *
 * このスクリプトは、コマンドを以下の2種類に自動で仕分けして登録します。
 *
 * 1. グローバルコマンド (globalCommands):
 *    - どのサーバーでも使える、共通のコマンド。（例: /ping）
 *    - Discordへの反映に【最大1時間】かかります。
 *
 * 2. ギルドコマンド (guildCommands):
 *    - 特定のサーバーでのみ使える、限定コマンド。（例: /admin）
 *    - Discordへの反映は【即時】です。開発中のコマンドもこれに指定すると便利です。
 *
 * -----------------------------------------------------------------
 *
 * ■■■ ギルドコマンドとして登録する方法 ■■■
 *
 * 手順は、たったの2ステップです。
 *
 * 【ステップ1: コマンドファイルに「旗」を立てる】
 *
 *   ギルドコマンドにしたいコマンドのファイル（例: admin.mjs）を開き、
 *   以下の「一行」を、どこか（dataの定義の近くがオススメ）に追加してください。
 *
 *   export const scope = "guild";
 *
 *
 * 【ステップ2: 登録先のサーバーIDを設定する】
 *
 *   `.env` ファイル (またはKoyebの環境変数) に、コマンドを登録したい
 *   サーバーのIDを `GUILD_IDS` という名前で設定します。
 *
 *   --- 例：サーバーが1つの場合 ---
 *   GUILD_IDS=102XXXXXXXXXX
 *
 *   --- 例：サーバーが3つ（メイン、デバッグ、サブなど）の場合 ---
 *   カンマ区切りで、IDを好きなだけ追加できます。
 *   GUILD_IDS=102541622XXXXXXXXXX,125947643XXXXXXXXXX,新しいサブサーバーのID
 *
 *
 * これだけで、Botを再起動すれば、指定したコマンドが、指定した全ての
 * サーバーに、即時登録されるようになります。
 *
 * -----------------------------------------------------------------
 *
 * ■■■ デフォルトの挙動 ■■■
 *
 *   コマンドファイルに `export const scope = "guild";` を書き忘れたり、
 *   あえて書かなかったコマンドは、自動的に「グローバルコマンド」として
 *   扱われるので、安全です。
 *
 * =================================================================
 */
// グローバルコマンドとギルドコマンドを格納する、二つの空のリストを用意
const guildCommands = [];
const globalCommands = [];

// 'commands' フォルダ配下の全てのサブフォルダを動的に探索します
const foldersPath = path.join(process.cwd(), "commands");
const commandFolders = fs.readdirSync(foldersPath);

export default async () => {
  console.log("[INIT] コマンドの読み込みを開始します...");

  for (const folder of commandFolders) {
    // 各サブフォルダへのパスを正しく生成
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".mjs"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      try {
        const module = await import(`file://${filePath}`);

        // [安全装置] module.data が存在しないファイルを安全にスキップします
        if (!module.data) {
          console.warn(
            `[WARN] ${file} に 'data' がエクスポートされていません。コマンドとして扱わず、スキップします。`
          );
          continue; // 次のファイルへ
        }

        // コマンドファイルに 'scope' プロパティがあるかチェックし、リストに仕分ける
        // 'scope' が未定義の場合は、デフォルトでグローバルコマンドとして扱います
        if (module.scope === "guild") {
          guildCommands.push(module.data.toJSON());
        } else {
          globalCommands.push(module.data.toJSON());
        }
      } catch (error) {
        console.error(
          `[ERROR] コマンドファイル ${file} の読み込みに失敗しました:`,
          error
        );
      }
    }
  }

  console.log(
    `[INIT] ${globalCommands.length}個のグローバルコマンドと${guildCommands.length}個のギルドコマンドを読み込みました。`
  );

  // これ以降のDiscord APIへの登録処理は、以前の提案と同じです
  const rest = new REST().setToken(process.env.TOKEN);

  try {
    // === ギルドコマンドの登録処理 ===
    if (guildCommands.length > 0) {
      if (!process.env.GUILD_IDS) {
        console.error(
          "[ERROR] ギルドコマンドが存在しますが、.envにGUILD_IDSが設定されていません。登録をスキップします。"
        );
      } else {
        const guildIds = process.env.GUILD_IDS.split(",").map((id) =>
          id.trim()
        );
        console.log(
          `[INIT] ${guildCommands.length}個のギルドコマンドを、${guildIds.length}個のサーバーに登録します...`
        );

        await Promise.all(
          guildIds.map((guildId) =>
            rest.put(
              Routes.applicationGuildCommands(
                process.env.APPLICATION_ID,
                guildId
              ),
              { body: guildCommands }
            )
          )
        );
        console.log(
          "[SUCCESS] 全ての指定サーバーへのギルドコマンド登録が完了しました。"
        );
      }
    }

    // === グローバルコマンドの登録処理 ===
    if (globalCommands.length > 0) {
      console.log(
        `[INIT] ${globalCommands.length}個のコマンドをグローバルに登録します...`
      );
      await rest.put(Routes.applicationCommands(process.env.APPLICATION_ID), {
        body: globalCommands,
      });
      console.log("[SUCCESS] グローバルコマンドの登録が完了しました。");
    }

    console.log("[SUCCESS] 全てのコマンド登録処理が正常に完了しました。");
  } catch (error) {
    console.error(
      "[FATAL] Discordへのコマンド登録中に致命的なエラーが発生しました:",
      error
    );
  }
};
