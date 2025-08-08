// supabaseStorage.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const BUCKET_NAME = "amayadori";

function getMimeType(ext) {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

async function uploadFile(
  fileBuffer,
  userId,
  slot,
  fileExt,
  directory = "default"
) {
  const timestamp = Date.now(); // ミリ秒単位のUNIX時間を取得
  const fileName = `slot${slot}_${timestamp}.${fileExt}`;
  const filePath = `${directory}/${userId}/${fileName}`;
  const contentType = getMimeType(fileExt);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Supabase Storage へのアップロードエラー:", uploadError);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
  };
}

async function deleteFile(filePath) {
  console.error("消したいファイル:", filePath);
  if (!filePath) return true;

  const { error: deleteError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (deleteError) {
    console.error("Supabase Storage からの削除エラー:", deleteError);
    return false;
  }

  return true;
}
// ディレクトリのサイズを取得する関数
// これは、指定されたディレクトリ内の全ファイルのサイズを合計して返す
// SupabaseのストレージAPIを使用して、ファイルのメタデータを取得します。
// ディレクトリ名は、バケット内のパスを指定します。
async function getDirectorySize(directoryName) {
  try {
    // Supabaseに、指定されたディレクトリのファイル一覧を要求
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(directoryName, {
        limit: 10000, // 多くのファイルを一度に取得
      });

    if (error) {
      console.error("ディレクトリサイズの取得エラー:", error);
      return -1; // エラーが起きたことを示す
    }

    if (!files || files.length === 0) {
      return 0; // ファイルがなければ0バイト
    }

    // fileリストの中から、"size"だけを取り出して、合計する
    const totalSize = files.reduce((sum, file) => sum + file.metadata.size, 0);
    return totalSize; // 合計サイズをバイト単位で返す
  } catch (e) {
    console.error("ディレクトリサイズ計算中に例外発生:", e);
    return -1;
  }
}

export { uploadFile, deleteFile, getDirectorySize };
