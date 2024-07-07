import { SlashCommandBuilder } from 'discord.js';
import { Client, Intents, MessageActionRow, MessageButton } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('suyasuya')
  .setDescription('（未実装）【！注意！】発言ができなくなります！（自粛用にどうぞ）')
  .addStringOption(option =>
    option
      .setName('minutes')
      .setDescription('タイムアウトする時間を分単位で入力してください（１-720）')
      .setRequired(true)
  );

// 解除ボタン
class TimeoutView {
    constructor(member) {
        this.member = member;
        this.view = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('untimeout_button')
                    .setLabel('→起こす←')
                    .setStyle('DANGER')
            );
    }

    // 起こすボタンのハンドラ
    async handleButton(interaction) {
        await this.member.timeout(null); // メソッド名は適宜変更する必要があります
        await interaction.message.delete();  // メッセージを削除

        await interaction.reply({
            content: `${this.member.toString()}のタイムアウトが解除されました。`,
            ephemeral: true,
            fetchReply: false
        });
    }

    // ビューの行を取得するメソッド
    getView() {
        return this.view;
    }
}

export async function execute(interaction){
  const nerunonya = interaction.options.getString('minutes');
  if (nerunonya < 1) {
        return await interaction.reply({
            content: '常識的な数字を入力するにゃ。',
            ephemeral: true
        });
    }
  if (nerunonya > 720) {
        return await interaction.reply({
            content: '永遠に寝るつもりにゃ？',
            ephemeral: true
        });
    }
	await interaction.reply({
    content: '${nerunonya}分封殺してやるにゃ！精々作業なり睡眠なりするにゃ！',
    components: [timeoutView.getView()],
    fetchReply: false
  });
  await interaction.member.timeout(60 * 1000 * nerunonya, "/suyasuyaによるセルフタイムアウト");
}
