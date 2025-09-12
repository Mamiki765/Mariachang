import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";

// チャット系のヘルプデータをインポート
import { chatHelpData } from "../../help/chat_help_data.mjs";

export const help = {
  category: "slash",
  description:
    "Botに搭載されている、全てのコマンドの機能や使い方を説明します。",
  notes: "今まさに、あなたが見ているこのコマンドですにゃ！",
};

export const data = new SlashCommandBuilder()
  .setName("help")
  .setNameLocalizations({
    ja: "ヘルプ",
  })
  .setDescription("このBOTの機能を説明します");

/*
  ==============================================================================
  ▼▼▼ 各コマンドファイルに記述する export const help のテンプレート ▼▼▼
  ==============================================================================

  // --- パターン1: サブコマンドがない、単一のスラッシュコマンド (/kampa など) ---
  export const help = {
    category: 'slash', // カテゴリ: 'slash', 'context', 'chat'
    // description と notes は、あえて書かなくてもOK。その場合は表示されない。
    description: 'このコマンドが何をするものかの簡単な説明。',
    notes: '補足情報や、詳しい使い方などをここに書く。'
  };

  // --- パターン2: サブコマンドを持つ、複合的なスラッシュコマンド (/casino など) ---
  export const help = {
    category: 'slash',
    subcommands: [
      {
        name: 'slots', // サブコマンド名
        description: 'スロットの説明。',
        notes: 'スロットの補足情報。'
      },
      {
        name: 'blackjack',
        description: 'ブラックジャックの説明。',
        notes: 'ブラックジャックの補足情報。'
      }
    ]
  };

  // --- パターン3: コンテキストメニューのコマンド ---
  export const help = {
    category: 'context',
    description: 'このコンテキストメニューの説明。',
    notes: '補足情報など。'
  };

  // --- パターン4: 管理者専用で、ヘルプに表示したくないコマンド ---
  // help を export しないか、以下のように adminOnly フラグを立てる
  export const help = {
    adminOnly: true
  };
  ==============================================================================
  */

// execute関数を、新しい骨組みに入れ替えます
export async function execute(interaction) {
  // =============================================================
  // ▼ ステップ1: 全てのコマンドのヘルプ情報を、ここで動的に収集する ▼
  // =============================================================
  const allCommandsHelp = [];

  // 1-1. スラッシュコマンドとコンテキストメニューのヘルプ情報を収集
  for (const command of interaction.client.commands.values()) {
    if (!command.help || command.help.adminOnly) {
      continue; // help情報がないか、管理者用ならスキップ
    }

    if (command.help.subcommands) {
      // --- サブコマンドを持つコマンドの処理 ---
      command.help.subcommands.forEach((sub) => {
        // ▼▼▼ ここからがアップグレード部分 ▼▼▼
        // 1. command.data.optionsの中から、該当するサブコマンドの定義を探す
        const subcommandData = command.data.options.find(
          (opt) => opt.name === sub.name
        );

        // 2. 日本語名があれば取得、なければ英語名をそのまま使う
        const subJaName = subcommandData?.name_localizations?.ja;
        const subDisplayName = subJaName
          ? `${subJaName} (${sub.name})`
          : sub.name;
        // ▲▲▲ ここまでがアップグレード部分 ▲▲▲

        allCommandsHelp.push({
          category: command.help.category,
          // メインコマンド名と、上で作った表示用のサブコマンド名を結合
          name: `/${command.data.name} ${subDisplayName}`,
          // サブコマンドのdescriptionも、dataから動的に取得してみる
          description:
            sub.description ||
            subcommandData?.description ||
            "説明がありません。",
          notes: sub.notes || null,
        });
      });
    } else {
      // --- 単一のコマンドの処理 (/kampa, コンテキストメニューなど) ---
      const jaName = command.data.name_localizations?.ja;
      const baseName = command.data.name;

      // 日本語名があれば「日本語名 (english_name)」形式、なければ英語名のみ
      let displayName = jaName ? `${jaName} (${baseName})` : baseName;

      // カテゴリに応じて、表示名を調整
      if (command.help.category === "slash") {
        displayName = `/${displayName}`;
      }

      allCommandsHelp.push({
        category: command.help.category,
        name: displayName,
        description:
          command.help.description ||
          command.data.description ||
          "説明がありません。",
        notes: command.help.notes || null,
      });
    }
  }

  // 1-2. ファイルに分離した、チャット系コマンドのヘルプ情報を結合
  allCommandsHelp.push(...chatHelpData);

  // デバッグ用に、収集したヘルプ情報の件数をコンソールに出力
  console.log(
    `[Help System] Collected ${allCommandsHelp.length} help entries.`
  );
  // =============================================================
  // ▼ ステップ2: カテゴリ選択メニューを表示する ▼
  // =============================================================
  const categories = {
    slash: {
      title: "スラッシュコマンド",
      description: "「/」で始まるコマンドです。",
    },
    context: {
      title: "コンテキストメニュー",
      description: "メッセージを右クリック/長押し→アプリで使えるコマンドです。",
    },
    chat: {
      title: "チャットコマンド",
      description:
        "直接発言欄に書き込むことなどで反応する機能や、その他の機能です。",
    },
  };

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder("見たいヘルプのカテゴリを選んでにゃ")
    .addOptions(
      Object.keys(categories).map((key) => ({
        label: categories[key].title,
        value: key,
      }))
    );

  const initialRow = new ActionRowBuilder().addComponents(selectMenu);

  const initialEmbed = new EmbedBuilder()
    .setTitle("神谷マリアbot ヘルプ")
    .setDescription(
      "下のメニューから、知りたいコマンドのカテゴリを選んでにゃ。"
    )
    .setColor("#B78CFE");

  const reply = await interaction.reply({
    embeds: [initialEmbed],
    components: [initialRow],
    ephemeral: true,
  });

  // =============================================================
  // ▼ ステップ3: 選択後のページング処理を行う ▼
  // =============================================================

  // 3-1. セレクトメニューの操作を待つコレクターを起動
  const selectCollector = reply.createMessageComponentCollector({
    // このコレクターは、StringSelectMenuからの操作のみを受け付ける
    componentType: ComponentType.StringSelect,
    // 操作できるのは、コマンドを実行したユーザーのみ
    filter: (i) => i.user.id === interaction.user.id,
    // 2分間、操作がなければ終了
    time: 120_000,
  });

  // セレクトメニューでカテゴリが選択されたら、この 'collect' イベントが発火する
  selectCollector.on("collect", async (selectInteraction) => {
    const selectedCategory = selectInteraction.values[0];
    const commandsInCategory = allCommandsHelp.filter(
      (cmd) => cmd.category === selectedCategory
    );
    const itemsPerPage = 5; // ★ 1ページに表示するコマンド数をここで調整！
    const totalPages = Math.ceil(commandsInCategory.length / itemsPerPage);
    let currentPage = 0;

    // 3-2. 現在のページに基づいてEmbedとボタンを生成する、非常に重要な「ヘルパー関数」
    const generatePage = (page) => {
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const commandsOnPage = commandsInCategory.slice(start, end);

      const embed = new EmbedBuilder()
        .setTitle(`ヘルプ：${categories[selectedCategory].title}`)
        .setColor("#B78CFE")
        .setFooter({ text: `ページ ${page + 1} / ${totalPages}` });

      if (commandsOnPage.length === 0) {
        embed.setDescription(
          "このカテゴリには、まだコマンドが登録されていにゃいみたいですにゃ。"
        );
      } else {
        for (const cmd of commandsOnPage) {
          let fieldValue = cmd.description;
          if (cmd.notes) {
            // notesがあれば、「マリアメモ」として追加
            fieldValue += `\n-# ${cmd.notes}`;
          }
          embed.addFields({ name: cmd.name, value: fieldValue });
        }
      }

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("help_prev_page")
          .setLabel("◀️ 前へ")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0), // 最初のページでは「前へ」を無効化
        new ButtonBuilder()
          .setCustomId("help_next_page")
          .setLabel("次へ ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= totalPages - 1) // 最後のページでは「次へ」を無効化
      );

      return { embeds: [embed], components: [buttons], ephemeral: true };
    };

    // 3-3. 最初のページ(0ページ目)を生成し、セレクトメニューの応答としてメッセージを更新
    await selectInteraction.update(generatePage(currentPage));

    // 3-4. ボタン操作を待つ「ページング専用」のコレクターを起動
    const buttonCollector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 120_000,
    });

    // 「前へ」か「次へ」ボタンが押されたら、この 'collect' イベントが発火する
    buttonCollector.on("collect", async (buttonInteraction) => {
      if (
        buttonInteraction.customId === "help_next_page" &&
        currentPage < totalPages - 1
      ) {
        currentPage++;
      } else if (
        buttonInteraction.customId === "help_prev_page" &&
        currentPage > 0
      ) {
        currentPage--;
      }

      // 新しいページ番号でページを再生成し、メッセージを更新
      await buttonInteraction.update(generatePage(currentPage));
    });

    // タイムアウトしたら、ボタンを無効化してページングを終了
    buttonCollector.on("end", () => {
      // ボタンのあるメッセージを取得して、コンポーネントを空にする
      interaction.editReply({ components: [initialRow] }).catch(() => {}); // メニューを再表示
    });
  });

  // タイムアウト（セレクトメニューが一度も操作されなかった）場合、メニューを消す
  selectCollector.on("end", (collected) => {
    if (collected.size === 0) {
      interaction.editReply({ components: [] }).catch(() => {});
    }
  });
}
