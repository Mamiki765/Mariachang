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

async function uploadFile(fileBuffer, userId, slot, fileExt, directory = 'default') {
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

export { uploadFile, deleteFile };
