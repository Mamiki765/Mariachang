// utils/characterApi.mjs
import axios from "axios";

/**
 * 【低レベル関数】（変更なし）
 * 指定されたキャラクターIDの詳細情報をAPIから直接取得します。
 * @param {string} characterId
 * @returns {Promise<object|null>}
 */
async function getCharacterDetail(characterId) {
  // この関数の中身は前回から一切変更ありません
  const url = "https://rev2.reversion.jp/graphql?opname=GetCharacterDetail";
  const headers = {
    "content-type": "application/json",
    accept: "*/*",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    referer: `https://rev2.reversion.jp/character/detail/${characterId}`,
  };
  const data = {
    operationName: "GetCharacterDetail",
    variables: { character_id: characterId },
    query:
      "query GetCharacterDetail($character_id: String!) { character: rev2GetCharacterDetail(character_id: $character_id) { ...CharacterDetailPageContent \n __typename } status_range: rev2GetStatusGlobalRanges { ...StatusGlobalRange \n __typename } notes: rev2GetCharacterNoteSummariesForSheet( character_id: $character_id page: 1 ) { ...CharacterNoteSummary \n __typename } } fragment CharacterDetailPageContent on Rev2CharacterDataDetail { name name_ruby org_name org_name_ruby given_part_at given_part_length character_id is_angel owner { ...Rev2Character \n __typename } roots { name popup \n __typename } roots_specialization { name ruby description is_specializing \n __typename } roots_specializable generation { name description popup \n __typename } gender { name description popup \n __typename } age { name description popup \n __typename } height { name description popup \n __typename } style { name description popup \n __typename } hair_color { name \n __typename } eye_color { name \n __typename } skin_color { name \n __typename } career { name popup \n __typename } sin { name popup \n __typename } punishment { name popup \n __typename } halo { name popup \n __typename } halo_emblem_id properties { name popup \n __typename } noise { name description popup \n __typename } title title_id licenses { ...ReversionPlayerLicense \n __typename } testament birthday icon_path main_sound_path catchphrase_icon_path catchphrase_sound_path profile profile_fragments { ...Rev2CharacterProfileFragmentView \n __typename } has_visible_fragment relation_depth catchphrase comment first_person second_person tone internal_attributes external_attributes visuals { ...CharacterVisualView \n __typename } sp nsp stp level exp exp_to_next state p m t c classes { ...Rev2EquipmentSkill \n __typename } esprits { ...Rev2EquipmentSkill \n __typename } skills { a { ...Rev2EquipmentActiveSkill \n __typename } p { ...Rev2EquipmentSkill \n __typename } n { ...Rev2EquipmentSkill \n __typename } \n __typename } allows_two_weapon items { ...Rev2EquipmentItem \n __typename } item_attachments { ...Rev2EquipmentItem \n __typename } sub_status { ...Rev2SubStatus \n __typename } build_tendency nexts { ...Rev2CharacterNext \n __typename } element_bonus { ...Rev2ElementBonus \n __typename } active_element_id fames { ...Rev2CharacterFame \n __typename } communities { ...Rev2CharacterCommunity \n __typename } friends { ...Rev2CharacterFriend \n __typename } handler_creator { id penname image_icon_url type \n __typename } \n __typename } fragment Rev2Character on Rev2CharacterView { ...Rev2CharacterTinyAndTitle \n icon_url \n __typename } fragment Rev2CharacterTinyAndTitle on Rev2CharacterView { ...Rev2CharacterTiny \n title \n __typename } fragment Rev2CharacterTiny on Rev2CharacterView { character_id name \n __typename } fragment ReversionPlayerLicense on ReversionPlayerLicense { id name description \n __typename } fragment Rev2CharacterProfileFragmentView on Rev2CharacterProfileFragment { key publicity title body expired image { id title image_url url width height \n __typename } sound { id title sound_url url \n __typename } sources { url title type \n __typename } \n __typename } fragment CharacterVisualView on Rev2CharacterVisual { id title thumb_url width height items { id order pos_x pos_y width rotation type title original_width original_height url \n __typename } \n __typename } fragment Rev2EquipmentSkill on Rev2CharacterSpecField { id name name_ruby description display_effects element specialization_base { name description \n __typename } included pinup { ...Rev2SkillPinup \n __typename } \n __typename } fragment Rev2SkillPinup on Rev2SkillPinup { illust { ...SkillPinupIllust \n __typename } sound { ...SkillPinupSound \n __typename } \n __typename } fragment SkillPinupIllust on Rev2IllustForUsage { type id title image_url width height \n __typename } fragment SkillPinupSound on Rev2SoundForUsage { type id title audio_url image_url \n __typename } fragment Rev2EquipmentActiveSkill on Rev2CharacterSpecField { ...Rev2EquipmentSkill \n active { category ap_cost ticks power hit critical fumble \n __typename } \n __typename } fragment Rev2EquipmentItem on Rev2CharacterItemField { id name name_ruby description display_effects icon_url element attachment_ids sender { ...Rev2Character \n __typename } specialization_base { name description \n __typename } slot_type ex_slot_type rarity price_type buy_price sell_price target desire_slot_count slot_count ex_slot_count level \n __typename } fragment Rev2SubStatus on Rev2CharacterSubStatusField { id type name abbr description value \n __typename } fragment Rev2CharacterNext on Rev2CharacterNextField { type name ruby description annotation rank is_visible accepted \n __typename } fragment Rev2ElementBonus on Rev2CharacterElementBonusField { element_id element_value name display_effects \n __typename } fragment Rev2CharacterFame on Rev2CharacterFameField { id name description value icon_url \n __typename } fragment Rev2CharacterCommunity on Rev2CharacterCommunityField { id name emblem_image_url \n __typename } fragment Rev2CharacterFriend on Rev2CharacterDataFriendField { character_id name icon_url text call_as \n __typename } fragment StatusGlobalRange on Rev2CharacterStatusGlobalRange { id min max \n __typename } fragment CharacterNoteSummary on Rev2CharacterNoteSummary { id title body_introduction has_image has_sound is_official \n __typename }",
  };
  try {
    const response = await axios.post(url, data, { headers });
    return response.data.data;
  } catch (error) {
    console.error(`[エラー] APIリクエストに失敗しました: ${error.message}`);
    return null;
  }
}

/**
 * 能力値ゲージの文字列を生成するヘルパー関数
 * @param {number} currentValue 現在値
 * @param {number} minValue サーバー全体の最小値
 * @param {number} maxValue サーバー全体の最大値
 * @param {number} barLength ゲージの長さ (デフォルトは10)
 * @returns {string} テキストゲージ (例: "[||||||||||]★")
 */
function createStatusBar(currentValue, minValue, maxValue, barLength = 10) {
  const BG_CREAM_WHITE = "\u001b[47m"; // 背景: クリームホワイト(ゲージの背景)
  const FG_TEAL = "\u001b[1;36m"; // 文字: ブライトシアン (ゲージの色)
  const FG_WHITE = "\u001b[1;37m"; // 文字: ホワイト (空ゲージの色)
  const FG_GOLD = "\u001b[1;33m"; // 文字: ブライトイエロー (★の色)
  const RESET = "\u001b[0m"; // カラーのリセット
  // 最大値以上なら、満タンのゲージと★を返す
  if (currentValue >= maxValue) {
    return `${BG_CREAM_WHITE}${FG_TEAL}[${"|".repeat(barLength)}]${FG_GOLD}★${RESET}`;
  }
  // 最小値以下なら、空のゲージを返す
  if (currentValue <= minValue) {
    return `${BG_CREAM_WHITE}${FG_WHITE}[${".".repeat(barLength)}]${RESET}`;
  }

  const totalRange = maxValue - minValue;
  const progress = currentValue - minValue;
  const ratio = progress / totalRange;

  // 割合にゲージ長を掛け、小数点以下を「切り上げる」
  const filledCount = Math.ceil(ratio * barLength);

  // ゲージが0やマイナスにならないように念のため制約
  const safeFilledCount = Math.max(0, Math.min(barLength, filledCount));

  const filledPart = "|".repeat(safeFilledCount);
  const emptyPart = ".".repeat(barLength - safeFilledCount);

  return `${BG_CREAM_WHITE}${FG_TEAL}[${filledPart}${FG_WHITE}${emptyPart}${FG_TEAL}]${RESET}`;
}

//文字の「表示幅」を計算するヘルパー関数
// 全角文字を2、半角文字を1としてカウントします。
function getVisualWidth(str) {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    // 文字コードが255より大きい（マルチバイト文字）なら2、そうでなければ1を加算
    width += str.charCodeAt(i) > 255 ? 2 : 1;
  }
  if (width == 2) {
    width += 1;
  }
  return width;
}

/**
 * 【高レベル関数】（PC/EXPC判別ロジックを追加）
 * キャラクター情報を取得し、PCかEXPCかによって整形されたサマリ文字列を返します。
 * @param {string} characterId
 * @returns {Promise<string>}
 */
/**
 * 【高レベル関数】（PC/EXPC判別ロジックを追加）
 * キャラクター情報を取得し、PCかEXPCかによって整形されたサマリ文字列を返します。
 * @param {string} characterId
 * @returns {Promise<string>}
 */
export async function getCharacterSummary(characterId) {
  try {
    const apiData = await getCharacterDetail(characterId);

    if (!apiData || !apiData.character) {
      return `キャラクター「${characterId}」の情報取得に失敗しました。IDが正しいか確認してください。`;
    }
    const { character, status_range } = apiData;

    if (character.character_id.startsWith("r2n")) {
      let reply = `${character.state ? `**【${character.state}】**` : ""}キャラクター「${character.name}」は **NPC** です。\n`;
      if (character.handler_creator) {
        reply += `> 担当: **${character.handler_creator.penname}** (${character.handler_creator.type})\n`;
      }
      return reply;
    } else if (character.owner) {
      const licenseDisplay = formatLicenseDisplay(character.licenses); //ライセンス確認
      let reply = `${character.state ? `**【${character.state}】**` : ""}キャラクター「${character.name}」は **${character.owner.name}**([${character.owner.character_id}](https://rev2.reversion.jp/character/detail/${character.owner.character_id}))のEXPCです。${licenseDisplay}\n`;
      return reply;
    } else {
      const licenseDisplay = formatLicenseDisplay(character.licenses); //ライセンス確認
      let reply = `${character.state ? `**【${character.state}】**` : ""}「${character.name}」${character.roots.name}×${character.generation.name}${licenseDisplay}\n`;
      //経験値プールしてたらレベル概算も出す、なんとなく
      let levelplus = "";
      if (character.exp >= character.exp_to_next) {
        const totalCumulativeXp =
          getTotalXpForLevel(character.level) + character.exp;
        const realLevel = calculateRealLevelFromTotalXp(
          totalCumulativeXp,
          character.level
        );
        levelplus = `(実レベル:${realLevel})`; //ExpやNextExpを出すかはさておき。
      }
      //levelplusここまで
      reply += `Lv.${character.level} Exp.${character.exp}/${character.exp_to_next}${levelplus} Testament.${character.testament}\n`;

      const displayOrder = [1, 2, 3, 4, 13, 9, 10, 5, 6, 7, 8, 11, 12, 14];
      const targetStatusIds = new Set(displayOrder);

      if (character.sub_status && character.sub_status.length > 0) {
        reply += `\`\`\`ansi\n▼副能力 | 主能力 P:${character.p} M:${character.m} T:${character.t} C:${character.c}`;

        const sortedSubStatus = character.sub_status
          .filter((s) => targetStatusIds.has(s.id))
          .sort(
            (a, b) => displayOrder.indexOf(a.id) - displayOrder.indexOf(b.id)
          );

        const TARGET_VISUAL_WIDTH = 6;

        for (const subStatus of sortedSubStatus) {
          const range = status_range.find((r) => r.id === subStatus.id);
          if (!range) continue;

          const bar = createStatusBar(
            subStatus.value,
            range.min,
            range.max,
            20
          );

          const currentWidth = getVisualWidth(subStatus.abbr);
          const paddingNeeded = Math.max(0, TARGET_VISUAL_WIDTH - currentWidth);
          const padding = " ".repeat(paddingNeeded);

          const statName = subStatus.abbr + padding;

          const formattedValue = String(subStatus.value).padStart(5, " ");

          reply += `\n${statName}${bar}${formattedValue}`;
        }

        // 属性値を色を付けて並べる
        const elementStatusIds = [101, 102, 103, 104, 105, 106, 199];
        const elementStatuses = character.sub_status.filter((s) =>
          elementStatusIds.includes(s.id)
        );
        if (elementStatuses.length > 0) {
          reply += `\n`;
          for (const statusId of elementStatusIds) {
            const status = elementStatuses.find((s) => s.id === statusId);
            if (status) {
              let statusText = `${status.abbr}: ${status.value}`;
              if (elementColorMap.has(statusId)) {
                const color = elementColorMap.get(statusId);
                statusText = `${color}${statusText}${RESET_COLOR}`;
              }
              reply += `${statusText} `; //半角スペース1つで区切る
            }
          }
        }

        // --- 2. 特殊能力のセクション ---
        const specialAbilities = character.sub_status.filter(
          (s) => s.id >= 200
        );

        if (specialAbilities.length > 0) {
          reply += `\n・その他能力\n`;
          for (const ability of specialAbilities) {
            const displayValue = ability.value ?? "-";
            reply += `${ability.name}: ${displayValue}  `;
          }
        }

        // 新しい関数を呼び出して、スキル情報の文字列を取得
        const skillsSection = createSkillsAndClassesSection(character);

        // スキル情報が空でなければ、コードブロックで囲んでreplyに追加
        if (skillsSection) {
          // もし、前のセクションが```で終わっているなら、```を付けずに結合
          // そうでなければ、新しく```で囲む
          // (ここでは、前の```を消して、最後にまとめて囲むのが綺麗)
          reply += `\n${skillsSection}`;
        }

        reply += `\`\`\``;
      } // ★★★ ここが正しい閉じ括弧の位置です ★★★

      return reply;
    }
  } catch (error) {
    console.error(
      `[エラー] ${characterId} のサマリ作成処理でエラーが発生しました:`,
      error
    );
    return `情報取得中にエラーが発生しました。しばらくしてからもう一度お試しください。`;
  }
}

/**
 * 【NEW】コンパクトサマリ用のステータス表示グループを定義します。
 * 内側の配列が、一行に表示されるステータスのIDグループです。
 */
const compactStatusGroups = [
  [1, 2], // HP, AP
  [3, 4, 13], // 主攻, 副攻, 回復
  [9, 10], // 命中, 回避
  [5, 6], // 防技, 抵抗
  [7, 8], // 速度, 機動
  [11, 12, 14], // CT, FB, ドラマ
  [101, 102, 103, 104], // 属性値　4属性
  [105, 106, 199], // 属性値　光闇無
];

/**
 * 属性IDと、それに対応するANSIカラーコードのマッピング
 */
const elementColorMap = new Map([
  [101, "\u001b[1;31m"], // 火
  [102, "\u001b[1;34m"], // 水
  [103, "\u001b[0;33m"], // 土
  [104, "\u001b[0;32m"], // 風
  [105, "\u001b[2;40m\u001b[1;37m"], // 光
  [106, "\u001b[2;45m\u001b[1;37m"], // 闇
  [199, "\u001b[1;30m\u001b[1;44m"], // 無
]);
const RESET_COLOR = "\u001b[0m";

/**
 * ライセンスの対応表
 * 将来絵文字にしたいなって時に置き換えれるように対応している
 */
const licenseMasterData = new Map([
  ["1", { shortName: "PC", emoji: "🎨" }], // 公式ライセンス（PC・EXPC）
  ["2", { shortName: "NPC", emoji: "🤝" }], // 公式ライセンス（NPC）
  ["3", { shortName: "EX", emoji: "👑" }], // 公式ライセンス（EX）
]);

/**
 * 【究極進化版】キャラクターが所有するライセンスをチェックし、
 * 「☑(PC)(NPC)」のような、最終的な表示用文字列を生成するヘルパー関数
 * @param {Array<object>} licensesArray - character.licenses の配列
 * @returns {string} - " ☑(PC)(NPC)" のような、整形済みの文字列
 */
function formatLicenseDisplay(licensesArray) {
  if (!licensesArray || licensesArray.length === 0) {
    return "";
  }

  // 所有ライセンスIDの中から、マスターデータに存在するshortNameだけを抽出
  const ownedLicenseNames = licensesArray
    .map((license) => {
      const data = licenseMasterData.get(license.id);
      return data ? data.shortName : null;
    })
    .filter(Boolean); // 変換できなかったもの(null)を取り除く

  // 表示すべきライセンスが1つもなければ、何も返さない
  if (ownedLicenseNames.length === 0) {
    return "";
  }

  // "(PC)", "(NPC)" のようなパーツの配列を作る
  const nameParts = ownedLicenseNames.map((name) => `(${name})`);

  // 「 ☑(PC)(NPC)」という、最終的な文字列を組み立てて返す
  return ` ☑${nameParts.join("")}`;
}

/**
 * 【NEW】文字列からXML/HTMLタグを取り除くヘルパー関数
 * @param {string} text タグを含む可能性のある文字列
 * @returns {string} タグが取り除かれた文字列
 */
function stripXmlTags(text) {
  // textが存在しない、または空の文字列の場合は、そのまま空文字を返す
  if (!text) {
    return "";
  }
  // <...> のパターンに一致するものを、すべて空文字に置き換える（削除する）
  return text.replace(/<[^>]+>/g, "");
}

/**
 * 【NEW】スキル配列を整形して、名前のリスト文字列を生成するヘルパー関数
 * 特殊化を考慮し、「特殊化後名（特殊化前名）」の形式に対応します。
 * @param {Array<object>} skillArray - スキルの配列 (例: character.skills.a)
 * @returns {string} - "スキルA、スキルB（元スキルB）" のような整形済み文字列
 */
function formatSkillNames(skillArray) {
  // スキル配列が存在しない、または空の場合は、何も返さない
  if (!skillArray || skillArray.length === 0) {
    return "";
  }

  // 配列の各スキルを、整形後の名前に変換する
  const formattedNames = skillArray.map((skill) => {
    // 'specialization_base' が存在し、その中に 'name' があれば特殊化済み
    if (skill.specialization_base && skill.specialization_base.name) {
      return `${skill.name}（${skill.specialization_base.name}）`;
    } else {
      // 特殊化されていなければ、そのままの名前を返す
      return skill.name;
    }
  });

  // 変換した名前の配列を、「、」で連結して返す
  return formattedNames.join("、");
}

/**
 * 【NEW】コンパクトサマリを生成する高レベル関数
 * ゲージをなくし、ステータスをグループ化して表示します。
 * @param {string} characterId
 * @returns {Promise<string>}
 */
export async function getCharacterSummaryCompact(characterId) {
  try {
    const apiData = await getCharacterDetail(characterId);

    if (!apiData || !apiData.character) {
      return `キャラクター「${characterId}」の情報取得に失敗しました。IDが正しいか確認してください。`;
    }
    const { character } = apiData; // status_rangeは今回不要

    if (character.character_id.startsWith("r2n")) {
      let reply = `${character.state ? `**【${character.state}】**` : ""}キャラクター「${character.name}」は **NPC** です。\n`;
      if (character.handler_creator) {
        reply += `> 担当: **${character.handler_creator.penname}** (${character.handler_creator.type})\n`;
      }
      return reply;
    } else if (character.owner) {
      const licenseDisplay = formatLicenseDisplay(character.licenses); //ライセンス確認
      let reply = `${character.state ? `**【${character.state}】**` : ""}キャラクター「${character.name}」は **${character.owner.name}**([${character.owner.character_id}](https://rev2.reversion.jp/character/detail/${character.owner.character_id}))のEXPCです。${licenseDisplay}\n`;
      return reply;
    } else {
      const licenseDisplay = formatLicenseDisplay(character.licenses); //ライセンス確認
      let reply = `${character.state ? `**【${character.state}】**` : ""}「${character.name}」${character.roots.name}×${character.generation.name}${licenseDisplay}\n`;
      //経験値プールしてたらレベル概算も出す、なんとなく
      let levelplus = "";
      if (character.exp >= character.exp_to_next) {
        const totalCumulativeXp =
          getTotalXpForLevel(character.level) + character.exp;
        const realLevel = calculateRealLevelFromTotalXp(
          totalCumulativeXp,
          character.level
        );
        levelplus = `(実レベル:${realLevel})`; //ExpやNextExpを出すかはさておき。
      }
      //levelplusここまで
      reply += `Lv.${character.level} Exp.${character.exp}/${character.exp_to_next}${levelplus} Testament.${character.testament}\n`;
      if (character.sub_status && character.sub_status.length > 0) {
        reply += `\`\`\`ansi\nP:${character.p} M:${character.m} T:${character.t} C:${character.c}`;

        // 効率的にステータスを検索できるよう、IDをキーにしたMapを作成
        const statusMap = new Map(character.sub_status.map((s) => [s.id, s]));

        // 定義したグループに基づいて行を生成
        for (const group of compactStatusGroups) {
          const lineParts = []; // 一行分のパーツを格納する配列

          for (const statusId of group) {
            if (statusMap.has(statusId)) {
              const subStatus = statusMap.get(statusId);
              // 「名前: 値」の形式でパーツを作成
              let statusText = `${subStatus.abbr}: ${subStatus.value}`;
              // 属性値なら、色を付ける
              if (elementColorMap.has(statusId)) {
                const color = elementColorMap.get(statusId);
                statusText = `${color}${statusText}${RESET_COLOR}`;
              }
              lineParts.push(statusText);
            }
          }

          // その行に表示すべきステータスが1つでもあれば、文字列として結合して追加
          if (lineParts.length > 0) {
            // 半角スペース2つで区切る
            reply += `\n${lineParts.join("  ")}`;
          }
        }

        const specialAbilities = character.sub_status.filter(
          (s) => s.id >= 200
        );

        if (specialAbilities.length > 0) {
          reply += `\n・その他能力\n`;
          for (const ability of specialAbilities) {
            // ability.valueがnullかundefinedの場合のみ、右側の「-」が採用される
            const displayValue = ability.value ?? "-";
            reply += `${ability.name}: ${displayValue}  `;
          }
        }
        /*長くなるので一旦省略
        // アクティブスキル情報のセクションを追加
        // character.skills.a が存在し、配列の長さが0より大きいことを確認
        if (
          character.skills &&
          Array.isArray(character.skills.a) &&
          character.skills.a.length > 0
        ) {
          // 前のセクションと区別するために、改行を2つ入れる
          reply += `\n・アクティブスキル\n`;

          // 各スキルをループ処理
          for (const skill of character.skills.a) {
            // 'active'プロパティが存在しない場合に備え、空のオブジェクトをデフォルト値とする
            const activeProps = skill.active || {};

            // 各パラメータを取得（存在しない場合は 'N/A' とする）
            const ticks = activeProps.ticks ?? "N/A";
            const ap = activeProps.ap_cost ?? "N/A";
            const power = activeProps.power ?? "N/A";
            const hit = activeProps.hit ?? "N/A";
            const critical = activeProps.critical ?? "N/A";
            const fumble = activeProps.fumble ?? "N/A";

            // スキルの基本情報を一行にまとめる
            let skillLine = `・${skill.name} (行動値:${ticks} AP:${ap} 威力:${power} 命中:${hit} CT:${critical} FB:${fumble})`;

            // 'display_effects' があれば、インデントして追加
            if (skill.display_effects) {
              const cleanedEffects = stripXmlTags(skill.display_effects);
              skillLine += `\n  └ 効果: ${cleanedEffects}`;
            }
            skillLine += `\n`;
            reply += skillLine;
          }
        }
        // ★★★ アクティブスキル情報の追加はここまで ★★★
        */
        //代わりにスキル名だけを表示するセクションを追加
        //クラス・エスプリ表記
        // 'classes' または 'esprits' が存在する場合のみ、セクションを表示
        // 新しい関数を呼び出して、スキル情報の文字列を取得
        const skillsSection = createSkillsAndClassesSection(character);

        // スキル情報が空でなければ、コードブロックで囲んでreplyに追加
        if (skillsSection) {
          // もし、前のセクションが```で終わっているなら、```を付けずに結合
          // そうでなければ、新しく```で囲む
          // (ここでは、前の```を消して、最後にまとめて囲むのが綺麗)
          reply += `\n${skillsSection}`;
        }

        reply += `\`\`\``;
      }
      return reply;
    }
  } catch (error) {
    console.error(
      `[エラー] ${characterId} のコンパクトサマリ作成処理でエラーが発生しました:`,
      error
    );
    return `情報取得中にエラーが発生しました。しばらくしてからもう一度お試しください。`;
  }
}

/**
 * キャラクターのクラス、エスプリ、スキル情報を整形して、
 * Discordのコードブロックで表示するための文字列を生成します。
 * @param {object} character - APIから取得したキャラクターオブジェクト
 * @returns {string} 整形されたスキル情報の文字列。表示すべき情報がなければ空文字列を返す。
 */
function createSkillsAndClassesSection(character) {
  // 表示する行を、この配列にどんどん追加していく
  const lines = [];

  // --- 1. クラスとエスプリのセクション ---
  if (
    (character.classes && character.classes.length > 0) ||
    (character.esprits && character.esprits.length > 0)
  ) {
    const class1Name =
      formatSkillNames(character.classes?.[0] ? [character.classes[0]] : []) ||
      "なし";
    const class2Name =
      formatSkillNames(character.classes?.[1] ? [character.classes[1]] : []) ||
      "なし";
    const espritName =
      formatSkillNames(character.esprits?.[0] ? [character.esprits[0]] : []) ||
      "なし";

    let finalClass1Part = class1Name;
    if (class1Name !== "なし" && espritName !== "なし") {
      finalClass1Part = `${class1Name}(${espritName})`;
    }

    let classLine = "・クラス　　：" + finalClass1Part; // 位置を揃えるため全角スペース
    if (class2Name !== "なし") {
      classLine += ` / ${class2Name}`;
    }

    // どちらかが「なし」でなければ、行を追加
    if (class1Name !== "なし" || class2Name !== "なし") {
      lines.push(classLine);
    }
  }

  // --- 2. 活性化スキルのセクション ---
  if (character.skills) {
    const activeSkills = formatSkillNames(character.skills.a);
    const passiveSkills = formatSkillNames(character.skills.p);
    const nonCombatSkills = formatSkillNames(character.skills.n);

    // 何か一つでもスキルがあれば、ヘッダーを追加
    if (activeSkills || passiveSkills || nonCombatSkills) {
      lines.push("・活性化スキル");
      if (activeSkills) lines.push(`アクティブ：${activeSkills}`);
      if (passiveSkills) lines.push(`パッシブ　：${passiveSkills}`);
      if (nonCombatSkills) lines.push(`非戦　　　：${nonCombatSkills}`);
    }
  }

  // 配列に何も追加されていなければ空文字列を、そうでなければ改行で連結して返す
  return lines.length > 0 ? lines.join("\n") : "";
}

//ネタ
/**
 * レベルnに到達するための「累計」経験値を計算します。 (前回の関数)
 */
function getTotalXpForLevel(n) {
  if (n <= 1) return 0; //1レベルなら0
  const term1 = 5 * n * (n + 1) * (n - 1);
  const term2 = 90 * (n - 1) * 3;
  return Math.round((term1 + term2) / 3);
}
/**
 * 総経験値を受け取り、それが何レベルに相当するかを逆算します。
 * @param {number} totalXp キャラクターが獲得した累計の総経験値
 * @param {number} [startLevel=2] 探索を開始するレベル。
 * @returns {number} レベルキャップがなかった場合の実レベル
 */
function calculateRealLevelFromTotalXp(totalXp, startLevel = 2) {
  if (totalXp < 100) return 1;

  // ★★★ あなたの指摘を反映！ ★★★
  // startLevelから探索を開始することで、無駄なループを完全に排除する
  let level = startLevel;

  while (level < 10000) {
    // 安全装置
    // 次のレベル (level + 1) になるための累計経験値を超えているか？
    if (totalXp < getTotalXpForLevel(level + 1)) {
      // 超えていなければ、現在のレベルが実レベル
      return level;
    }
    level++;
  }
}
