// utils/supabaseClient.mjs
import { createClient } from '@supabase/supabase-js';

// 【補足】
// このファイルは、SupabaseのWeb APIと通信するための「クライアント」を
// 一元管理するためのものです。
// SequelizeがDBと「直接」対話するのとは、全く別の窓口です。

// ★★★ あなたの既存の環境変数を、そのまま使います ★★★
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_KEY; // 中身がサービスキーなので、変数名を分かりやすく変更

// Supabaseクライアントを初期化し、エクスポートします
export const supabase = createClient(supabaseUrl, supabaseServiceKey);