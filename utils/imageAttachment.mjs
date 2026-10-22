import sizeOf, { disableTypes, types } from "image-size";

const IMAGE_TYPES = ["png", "jpg", "webp", "gif"];
disableTypes(types.filter((type) => !IMAGE_TYPES.includes(type)));
const MAX_ACTIVE_DOWNLOADS = 4;
const DOWNLOAD_TIMEOUT_MS = 15_000;
let activeDownloads = 0;

function detectType(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
  if (buffer.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "jpg";
  if (["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) return "gif";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

// Only Discord-uploaded attachments are accepted; redirects must not escape the CDN.
export async function readImageAttachment(attachment, {
  maxBytes,
  allowedTypes = IMAGE_TYPES,
  maxDimension = Infinity,
}) {
  const fileExt = attachment.name?.split(".").pop()?.toLowerCase();
  const expectedType = fileExt === "jpeg" ? "jpg" : fileExt;
  if (!allowedTypes.includes(expectedType)) throw new Error("対応していない画像形式です。");
  if (attachment.size > maxBytes) throw new Error("画像ファイルのサイズが上限を超えています。");
  const url = new URL(attachment.url);
  if (
    url.protocol !== "https:" || url.username || url.password || url.port ||
    !["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname) ||
    !/^\/(?:ephemeral-)?attachments\//.test(url.pathname)
  ) throw new Error("Discordにアップロードした画像を指定してください。");
  if (activeDownloads >= MAX_ACTIVE_DOWNLOADS) throw new Error("画像処理が混み合っています。少し待って再試行してください。");

  activeDownloads++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let reader;
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok || !response.body) throw new Error("画像を取得できませんでした。");
    const contentLength = Number(response.headers.get("content-length"));
    if (contentLength > maxBytes) throw new Error("画像ファイルのサイズが上限を超えています。");
    reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new Error("画像ファイルのサイズが上限を超えています。");
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks, length);
    // Check magic bytes before invoking any parser, even when the filename looks safe.
    if (detectType(buffer) !== expectedType) throw new Error("画像の内容とファイル形式が一致しません。");
    const { width, height } = sizeOf(buffer);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error("画像のサイズを確認できませんでした。");
    }
    if (width > maxDimension || height > maxDimension) {
      throw new Error(`画像の幅と高さは${maxDimension}ピクセル以下にしてください。`);
    }
    return { buffer, fileExt };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("画像の取得がタイムアウトしました。");
    // Do not expose signed attachment URLs or response contents in user-facing errors.
    if (error instanceof TypeError || error instanceof RangeError) throw new Error("画像を読み取れませんでした。");
    throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
    activeDownloads--;
  }
}
