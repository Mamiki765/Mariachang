import { timingSafeEqual } from "node:crypto";
import { unlockAchievements } from "./achievements.mjs";

// 条件の判定は箱庭が行う。ここでは既存のMaria実績IDへ結びつけるだけ。
const achievementIds = { island_secretary: 151 };
const pendingRequests = new Map();

export function hakoniwaAchievementHandler(client) {
  return async (req, res) => {
    const secret = process.env.HAKONIWA_LINK_SECRET;
    if (!secret) return res.sendStatus(503);
    const authorization = Buffer.from(req.get("authorization") || "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (
      authorization.length !== expected.length ||
      !timingSafeEqual(authorization, expected)
    ) {
      return res.sendStatus(401);
    }
    const { discord_user_id: userId, achievement_key: key } = req.body || {};
    if (
      typeof userId !== "string" ||
      !/^\d{17,20}$/.test(userId) ||
      typeof key !== "string" ||
      !Object.hasOwn(achievementIds, key)
    ) {
      return res.sendStatus(422);
    }
    try {
      // 未登録でも既存関数が実績行を作る。保存と所属者への通知も既存経路を使う。
      // 同じ人への同時再送も、既存cacheの読み込みが終わってから順番に扱う。
      const previous = pendingRequests.get(userId) || Promise.resolve();
      const pending = previous
        .catch(() => {})
        .then(() => unlockAchievements(client, userId, achievementIds[key]));
      pendingRequests.set(userId, pending);
      try {
        await pending;
      } finally {
        if (pendingRequests.get(userId) === pending)
          pendingRequests.delete(userId);
      }
      return res.json({ accepted: true });
    } catch {
      console.error("[Hakoniwa] 実績の受け付けに失敗しました。");
      return res.sendStatus(503);
    }
  };
}
