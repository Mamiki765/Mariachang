// utils/supabaseClient.mjs
import { createClient } from '@supabase/supabase-js';

// 【補足】
// このファイルは、SupabaseのWeb APIと通信するための「クライアント」を
// 一元管理するためのものです。
// SequelizeがDBと「直接」対話するのとは、全く別の窓口です。

// クライアントを保持するための変数を定義
let supabaseClient = null;

/**
 * Supabaseクライアントを初期化または取得する関数
 */
export function getSupabaseClient() {
  // すでに初期化されていれば、それを返す
  if (supabaseClient) {
    return supabaseClient;
  }

  // ★★★ 環境変数を使って、クライアントを初期化 ★★★
  const supabaseUrl = process.env.SUPABASE_API_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase API URL or Service Key is not set in environment variables.");
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}