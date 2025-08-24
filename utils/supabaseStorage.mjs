// supabaseStorage.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_API_URL,
  process.env.SUPABASE_SERVICE_KEY
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
/**
 * 【究極進化版】ディレクトリのサイズを、サブディレクトリも含めて再帰的に取得します。
 * ディレクトリ名は、バケット内のパスを指定します。
 * これは、指定されたディレクトリ内の全ファイルのサイズを合計して返す
 * SupabaseのストレージAPIを使用して、ファイルのメタデータを取得します。
 * @param {string} directoryName - 探索を開始するパス (例: 'stickers')
 * @returns {Promise<number>} ディレクトリの合計サイズ (バイト単位)
 */
async function getDirectorySize(directoryName = '') {
  try {
    // Supabaseに、指定されたディレクトリのファイル一覧を要求
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(directoryName, {
        limit: 10000, // 多くのファイルを一度に取得
      });

    if (error) {
      console.error(`ストレージのリスト取得エラー (${directoryName}):`, error);
      return -1;
    }

    if (!files || files.length === 0) {
      return 0;
    }

    let totalSize = 0;

    // 取得したアイテムを一つずつ処理
    for (const file of files) {
      if (file.metadata) {
        // ★ これは「ファイル」なので、サイズを直接加算
        totalSize += file.metadata.size;
      } else {
        // ★ これは「フォルダ」なので、再帰的に自分自身を呼び出し、
        //    その中の合計サイズを取得して、加算する！
        const subfolderPath = directoryName ? `${directoryName}/${file.name}` : file.name; // フォルダのパスを作成
        const subfolderSize = await getDirectorySize(subfolderPath);

        if (subfolderSize !== -1) {
          totalSize += subfolderSize;
        }
      }
    }
    
    return totalSize;

  } catch (e) {
    console.error(`ディレクトリサイズ計算中に例外発生 (${directoryName}):`, e);
    return -1;
  }
}

/**
 * HTMLコンテンツをSupabase Storageにアップロード（または上書き）する関数
 * @param {string} htmlContent - アップロードするHTMLの文字列
 * @param {string} filePath - バケット内での保存パス (例: 'public/stamps.html')
 * @returns {Promise<string|null>} 成功した場合は公開URL、失敗した場合はnull
 */
async function uploadHtmlFile(htmlContent, filePath) {
  // HTMLのMIMEタイプは 'text/html'
  const contentType = "text/html;charset=utf-8";

  // HTMLコンテンツをBufferに変換
  const fileBuffer = Buffer.from(htmlContent, "utf-8");

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: true, // ★重要: trueに設定することで、同名ファイルがあれば上書きする
    });

  if (uploadError) {
    console.error("HTMLファイルのアップロードエラー:", uploadError);
    return null;
  }

  // 公開URLを取得して返す
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  console.log("HTMLファイルのアップロード成功:", urlData.publicUrl);
  return urlData.publicUrl;
}


export { uploadFile, deleteFile, getDirectorySize, uploadHtmlFile };
