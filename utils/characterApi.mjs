// utils/characterApi.mjs
import axios from 'axios';

/**
 * 【低レベル関数】（変更なし）
 * 指定されたキャラクターIDの詳細情報をAPIから直接取得します。
 * @param {string} characterId 
 * @returns {Promise<object|null>}
 */
async function getCharacterDetail(characterId) {
  // この関数の中身は前回から一切変更ありません
  const url = 'https://rev2.reversion.jp/graphql?opname=GetCharacterDetail';
  const headers = {
    'content-type': 'application/json',
    'accept': '*/*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    'referer': `https://rev2.reversion.jp/character/detail/${characterId}`
  };
  const data = {
    "operationName": "GetCharacterDetail",
    "variables": { "character_id": characterId },
    "query": "query GetCharacterDetail($character_id: String!) { character: rev2GetCharacterDetail(character_id: $character_id) { ...CharacterDetailPageContent \n __typename } status_range: rev2GetStatusGlobalRanges { ...StatusGlobalRange \n __typename } notes: rev2GetCharacterNoteSummariesForSheet( character_id: $character_id page: 1 ) { ...CharacterNoteSummary \n __typename } } fragment CharacterDetailPageContent on Rev2CharacterDataDetail { name name_ruby org_name org_name_ruby given_part_at given_part_length character_id is_angel owner { ...Rev2Character \n __typename } roots { name popup \n __typename } roots_specialization { name ruby description is_specializing \n __typename } roots_specializable generation { name description popup \n __typename } gender { name description popup \n __typename } age { name description popup \n __typename } height { name description popup \n __typename } style { name description popup \n __typename } hair_color { name \n __typename } eye_color { name \n __typename } skin_color { name \n __typename } career { name popup \n __typename } sin { name popup \n __typename } punishment { name popup \n __typename } halo { name popup \n __typename } halo_emblem_id properties { name popup \n __typename } noise { name description popup \n __typename } title title_id licenses { ...ReversionPlayerLicense \n __typename } testament birthday icon_path main_sound_path catchphrase_icon_path catchphrase_sound_path profile profile_fragments { ...Rev2CharacterProfileFragmentView \n __typename } has_visible_fragment relation_depth catchphrase comment first_person second_person tone internal_attributes external_attributes visuals { ...CharacterVisualView \n __typename } sp nsp stp level exp exp_to_next state p m t c classes { ...Rev2EquipmentSkill \n __typename } esprits { ...Rev2EquipmentSkill \n __typename } skills { a { ...Rev2EquipmentActiveSkill \n __typename } p { ...Rev2EquipmentSkill \n __typename } n { ...Rev2EquipmentSkill \n __typename } \n __typename } allows_two_weapon items { ...Rev2EquipmentItem \n __typename } item_attachments { ...Rev2EquipmentItem \n __typename } sub_status { ...Rev2SubStatus \n __typename } build_tendency nexts { ...Rev2CharacterNext \n __typename } element_bonus { ...Rev2ElementBonus \n __typename } active_element_id fames { ...Rev2CharacterFame \n __typename } communities { ...Rev2CharacterCommunity \n __typename } friends { ...Rev2CharacterFriend \n __typename } handler_creator { id penname image_icon_url type \n __typename } \n __typename } fragment Rev2Character on Rev2CharacterView { ...Rev2CharacterTinyAndTitle \n icon_url \n __typename } fragment Rev2CharacterTinyAndTitle on Rev2CharacterView { ...Rev2CharacterTiny \n title \n __typename } fragment Rev2CharacterTiny on Rev2CharacterView { character_id name \n __typename } fragment ReversionPlayerLicense on ReversionPlayerLicense { id name description \n __typename } fragment Rev2CharacterProfileFragmentView on Rev2CharacterProfileFragment { key publicity title body expired image { id title image_url url width height \n __typename } sound { id title sound_url url \n __typename } sources { url title type \n __typename } \n __typename } fragment CharacterVisualView on Rev2CharacterVisual { id title thumb_url width height items { id order pos_x pos_y width rotation type title original_width original_height url \n __typename } \n __typename } fragment Rev2EquipmentSkill on Rev2CharacterSpecField { id name name_ruby description display_effects element specialization_base { name description \n __typename } included pinup { ...Rev2SkillPinup \n __typename } \n __typename } fragment Rev2SkillPinup on Rev2SkillPinup { illust { ...SkillPinupIllust \n __typename } sound { ...SkillPinupSound \n __typename } \n __typename } fragment SkillPinupIllust on Rev2IllustForUsage { type id title image_url width height \n __typename } fragment SkillPinupSound on Rev2SoundForUsage { type id title audio_url image_url \n __typename } fragment Rev2EquipmentActiveSkill on Rev2CharacterSpecField { ...Rev2EquipmentSkill \n active { category ap_cost ticks power hit critical fumble \n __typename } \n __typename } fragment Rev2EquipmentItem on Rev2CharacterItemField { id name name_ruby description display_effects icon_url element attachment_ids sender { ...Rev2Character \n __typename } specialization_base { name description \n __typename } slot_type ex_slot_type rarity price_type buy_price sell_price target desire_slot_count slot_count ex_slot_count level \n __typename } fragment Rev2SubStatus on Rev2CharacterSubStatusField { id type name abbr description value \n __typename } fragment Rev2CharacterNext on Rev2CharacterNextField { type name ruby description annotation rank is_visible accepted \n __typename } fragment Rev2ElementBonus on Rev2CharacterElementBonusField { element_id element_value name display_effects \n __typename } fragment Rev2CharacterFame on Rev2CharacterFameField { id name description value icon_url \n __typename } fragment Rev2CharacterCommunity on Rev2CharacterCommunityField { id name emblem_image_url \n __typename } fragment Rev2CharacterFriend on Rev2CharacterDataFriendField { character_id name icon_url text call_as \n __typename } fragment StatusGlobalRange on Rev2CharacterStatusGlobalRange { id min max \n __typename } fragment CharacterNoteSummary on Rev2CharacterNoteSummary { id title body_introduction has_image has_sound is_official \n __typename }"
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
 * @returns {string} テキストゲージ (例: "[■■■□□□□□□□]★")
 */
function createStatusBar(currentValue, minValue, maxValue, barLength = 10) {
  // 最大値以上なら、満タンのゲージと★を返す
  if (currentValue >= maxValue) {
    return `[${'■'.repeat(barLength)}]★`;
  }
  // 最小値以下なら、空のゲージを返す
  if (currentValue <= minValue) {
    return `[${'□'.repeat(barLength)}]`;
  }
  
  const totalRange = maxValue - minValue;
  const progress = currentValue - minValue;
  const ratio = progress / totalRange;

  // 割合にゲージ長を掛け、小数点以下を「切り上げる」
  const filledCount = Math.ceil(ratio * barLength);
  
  // ゲージが0やマイナスにならないように念のため制約
  const safeFilledCount = Math.max(0, Math.min(barLength, filledCount));

  const filledPart = '■'.repeat(safeFilledCount);
  const emptyPart = '□'.repeat(barLength - safeFilledCount);

  return `[${filledPart}${emptyPart}]`;
}

/**
 * 【高レベル関数】（PC/EXPC判別ロジックを追加）
 * キャラクター情報を取得し、PCかEXPCかによって整形されたサマリ文字列を返します。
 * @param {string} characterId 
 * @returns {Promise<string>}
 */
export async function getCharacterSummary(characterId) {
  try {
    const apiData = await getCharacterDetail(characterId);

    // apiData自体、またはその中のcharacterがnullならエラー
    if (!apiData || !apiData.character) {
      return `キャラクター「${characterId}」の情報取得に失敗しました。IDが正しいか確認してください。`;
    }
    // characterプロパティを分割代入で取り出しておく
    const { character, status_range } = apiData;

    // ownerプロパティの有無でPCとEXPCを判別
    if (character.owner) {
      // --- EXPCの場合の処理 ---
      let reply = `キャラクター「${character.name}」は **${character.owner.name}**([${character.owner.character_id}](https://rev2.reversion.jp/character/detail/${character.owner.character_id}))のEXPCです。\n`;
    return reply;
    } else {
      // --- PCの場合の処理 ---
      let reply = `「${character.name}」${character.roots.name}×${character.generation.name
}\n`;
      reply += `Lv:${character.level} Exp.${character.exp}/${character.exp_to_next}\n`;
      
      // 副能力の情報を整形して追加
           // ★★★ 追加: 表示したいステータスのIDリストを定義 ★★★
      const targetStatusIds = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
      
      if (character.sub_status && character.sub_status.length > 0) {
        reply += `・副能力`;
        
        // sub_statusをループする前に、表示したいID順に並べ替える
        const sortedSubStatus = character.sub_status
          .filter(s => targetStatusIds.has(s.id))
          .sort((a, b) => a.id - b.id);

        for (const subStatus of sortedSubStatus) {
          // ★★★ 変更点: filter済なのでIDチェックは不要 ★★★
          const range = status_range.find(r => r.id === subStatus.id);
          if (!range) continue;

          // ★★★ 変更点: ゲージの長さを10に設定 ★★★
          const bar = createStatusBar(subStatus.value, range.min, range.max, 10);

          const statName = subStatus.abbr.padEnd(4, '　');
          
          reply += `\n${statName}${bar} ${subStatus.value}`;
        }
      }
      return reply;
    }

  } catch (error) {
    console.error(`[エラー] ${characterId} のサマリ作成処理でエラーが発生しました:`, error);
    return `情報取得中にエラーが発生しました。しばらくしてからもう一度お試しください。`;
  }
}