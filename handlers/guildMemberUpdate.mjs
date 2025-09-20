// handlers/guildMemberUpdate.mjs

import { Events } from "discord.js";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";
import config from "../config.mjs";

export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    // configで定義されているサーバーかチェック
    const boosterRoleId =
      config.chatBonus.booster_coin.roles[newMember.guild.id];
    if (!boosterRoleId) return;

    const supabase = getSupabaseClient();
    const oldHasRole = oldMember.roles.cache.has(boosterRoleId);
    const newHasRole = newMember.roles.cache.has(boosterRoleId);

    // ブースト開始
    if (!oldHasRole && newHasRole) {
      console.log(
        `[BOOSTER] ${newMember.user.tag} started boosting in ${newMember.guild.name}.`
      );
      const { error } = await supabase
        .from("booster_status")
        .insert({ user_id: newMember.id, guild_id: newMember.guild.id });
      if (error) console.error("[BOOSTER] Error adding booster:", error);
    }
    // ブースト終了
    else if (oldHasRole && !newHasRole) {
      console.log(
        `[BOOSTER] ${newMember.user.tag} stopped boosting in ${newMember.guild.name}.`
      );
      const { error } = await supabase
        .from("booster_status")
        .delete()
        .match({ user_id: newMember.id, guild_id: newMember.guild.id });
      if (error) console.error("[BOOSTER] Error removing booster:", error);
    }
  },
};
