//main.mjs
import fs from "fs";
import path from "path";
import express from "express";
import { pathToFileURL } from "url"; //localでもnetでも動く用に
import {
  Client,
  Collection,
  GatewayIntentBits,
  EmbedBuilder,
  Partials,
} from "discord.js";
import CommandsRegister from "./regist-commands.mjs";
import config from "./config.mjs";
import { closeDatabase } from "./models/database.mjs";

// クラッシュ時にログを残す
process.on("uncaughtException", (error, origin) => {
  console.error("[FATAL ERROR/UNCAUGHT EXCEPTION]");
  console.error("Origin:", origin);
  console.error(error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL ERROR/UNHANDLED REJECTION]");
  console.error("Reason:", reason);
  console.error("Promise:", promise);
});
//クラッシュ時ログここまで

const app = express();
let postCount = 0;
//get(ブラウザ閲覧)された時に見せるHTMLファイル
const statusPageHtml = fs.readFileSync("./index.html", "utf8");

app.post("/", function (req, res) {
  console.log(`Received POST request.`);
  postCount++;
  if (postCount == 10) {
    postCount = 0;
  }
  res.send("POST response by koyeb");
});

app.get("/", function (req, res) {
  console.log(
    `[${new Date().toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour12: false,
    })}] Received ${req.method} request.`
  );
  res.send(statusPageHtml);
});

let server; // Expressサーバーのインスタンスを保持するための変数

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildWebhooks,
  ],
  partials: [
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    //		Partials.GuildScheduledEvent,
    Partials.ThreadMember,
  ],
});

async function startBot() {
  console.log("[Loader] Loading commands and handlers...");
  console.log('NODE_ENV:', process.env.NODE_ENV);
  client.commands = new Collection();
  const handlers = new Map();
  // === 将来の改善案 (Node.js v22以降) ===
  // 現在のコマンド読み込み処理は、`fs.readdirSync`を使ってフォルダを2段階で読み込んでいます。
  // これは確実な方法ですが、将来的にコマンドの階層が増えた場合に対応できません。
  //
  // Node.js v22からは、ファイル検索が得意な `fs.globSync` が標準機能として追加されました。
  // これを使うと、ネスト(入れ子)がなくなり、どんなに深い階層のファイルでも一発で取得できる、
  // よりシンプルで柔軟なコードに書き換えることができます。
  //
  // --- 書き換え例 (一行ずつコメントアウトしているので安全です) ---
  // const commandFiles = fs.globSync("commands/**/*.mjs");
  // const commandPromises = [];
  //
  // for (const filePath of commandFiles) {
  //   commandPromises.push(
  //     // import()に渡すパスは、絶対パスに変換するとより安全
  //     import(path.resolve(filePath)).then((module) => {
  //       client.commands.set(module.data.name, module);
  //     })
  //   );
  // }
  // =======================================

  // === 現在のコマンド読み込み処理 (動作確認済み) ===
  const categoryFoldersPath = path.join(process.cwd(), "commands");
  const commandFolders = fs.readdirSync(categoryFoldersPath);
  const commandPromises = [];
  for (const folder of commandFolders) {
    const commandsPath = path.join(categoryFoldersPath, folder);
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".mjs"));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      commandPromises.push(
        import(pathToFileURL(filePath)).then((module) => {
          client.commands.set(module.data.name, module);
        })
      );
    }
  }
  // ↑ ここまでが、コマンド読み込みの一連の処理です
  const handlersPath = path.join(process.cwd(), "handlers");
  const handlerFiles = fs
    .readdirSync(handlersPath)
    .filter((file) => file.endsWith(".mjs"));
  const handlerPromises = handlerFiles.map((file) => {
    const filePath = path.join(handlersPath, file);
    return import(pathToFileURL(filePath)).then((module) => {
      handlers.set(file.slice(0, -4), module);
    });
  });

  await Promise.all([...commandPromises, ...handlerPromises]);
  console.log(
    "[Loader] All commands and handlers have been loaded successfully."
  );

  client.on("guildCreate", (guild) =>
    handlers.get("guildCreate").default(guild, client)
  );
  client.on("guildDelete", (guild) =>
    handlers.get("guildDelete").default(guild, client)
  );
  client.on("interactionCreate", (interaction) =>
    handlers.get("interactionCreate").default(interaction)
  );
  client.on("voiceStateUpdate", async (oldState, newState) => {
    await handlers.get("voiceStateUpdate").default(oldState, newState);
  });
  client.on("threadCreate", (thread) =>
    handlers.get("threadCreate").default(thread)
  );
  client.on("messageCreate", (message) => {
    if (message.author.id == client.user.id || message.author.bot) return;
    handlers.get("messageCreate").default(message);
  });
  client.on("messageReactionAdd", (reaction, user) => {
    if (user.id == client.user.id || user.bot) return;
    handlers.get("messageReactionAdd").default(reaction, user);
  });
  client.on("warn", (info) => console.warn("Discord.js warning:", info));
  client.on("error", async (error) => {
    // Koyeb側のログに、エラーのスタックトレースを詳細に出力する
    console.error("An error occurred in the client:", error.stack || error);
    // ▼▼▼ Discord 内への通知を止めるもの▼▼▼
    // Koyebが再起動時に古いバージョンと同時起動したり、
    // あるいは起動時にコマンドの再登録でよく出るエラー
    // この配列に、無視したいエラーコードを追加していくだけで、
    // 将来、どんなノイズが増えても、簡単に対処できます。
    const ignoredErrorCodes = [
      10062, // Unknown Interaction
      40060, // Interaction has already been acknowledged
    ];

    if (ignoredErrorCodes.includes(error.code)) {
      console.log(
        `[INFO] Ignored sending error with code ${error.code} to Discord.`
      );
      return;
    }
    try {
      const channel = await client.channels.fetch(config.logch.error);
      if (channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle("🚨 エラーが発生しました")
          .setDescription("クライアントで予期せぬエラーが検出されました。")
          .setColor("#ff0000") // 赤色
          .setTimestamp()
          .setFields(
            // .addFieldsを複数書く代わりに、.setFieldsで配列として渡すこともできます
            {
              name: "エラーメッセージ",
              value: "```\n" + error.message + "\n```",
            },
            {
              name: "スタックトレース",
              // 長すぎる場合に備え、1020文字で切り詰める
              value: "```\n" + String(error.stack).substring(0, 1020) + "\n```",
            }
          );

        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      // Discordへの通知自体が失敗した場合のログ
      console.error("エラーメッセージのDiscordへの送信に失敗しました:", err);
    }
  });
  client.on("clientReady", () => handlers.get("clientReady").default(client));

  server = app.listen(3000, (error) => {
    if (error) {
      //express5からエラーハンドリングに対応したので念の為
      console.error("[EXPRESS]Express server failed to start:", error);
      throw error;
    }
    console.log(
      "[EXPRESS]Express server is listening on port 3000 for health checks."
    );
  });

  await CommandsRegister();
  await client.login(process.env.TOKEN);
}

/**
 * 終了シグナルを受け取った際に、各種サービスを安全に停止させる関数
 * @param {string} signal - 受け取ったシグナル名
 */
// 既にシャットダウン処理中かどうかの目印
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  // もし既にお片付け中なら、何もしない（二重実行防止）
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

  // 万が一、処理が終わらない場合に備えた保険（10秒後に強制終了）
  const forceShutdown = setTimeout(() => {
    console.error(
      "[Shutdown] Could not close connections in time, forcing shutdown."
    );
    process.exit(1);
  }, 10000);

  // 1. Webサーバーを停止
  if (server) {
    server.close(() => {
      console.log("[Shutdown] Express server closed.");
    });
  }

  // 2. Discord Botをログアウト
  try {
    await client.destroy();
    console.log("[Shutdown] Discord client destroyed.");
  } catch (err) {
    console.error("[Shutdown] Error destroying Discord client:", err);
  }

  // 3. データベース接続を閉じる
  try {
    await closeDatabase(); // ステップ1でimportした関数
  } catch (err) {
    console.error("[Shutdown] Error closing database:", err);
  }

  console.log("[Shutdown] Graceful shutdown complete. Exiting.");
  clearTimeout(forceShutdown); // 無事に終わったので、保険は解除
  process.exit(0); // 全ての後片付けが終わったので、正常に終了
}

// 寝ろ！マリア！と言われた時に寝るためのもの
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT")); // ローカル開発でCtrl+C用
// こっちは起きる方　寝ろとか起きろとかうるせえにゃ
startBot().catch((error) => {
  console.error(
    "[FATAL ERROR]Botの起動中に致命的なエラーが発生しました:",
    error
  );
  process.exit(1);
});
