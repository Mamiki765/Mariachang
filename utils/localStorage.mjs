import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const STORAGE_ROOT = process.env.ASSETS_ROOT;
const ASSETS_BASE_URL = (process.env.ASSETS_BASE_URL).replace(/\/+$/, "");

function sanitizeFolder(folder) {
  return String(folder || "misc").replace(/[^a-zA-Z0-9_-]/g, "");
}

function normalizeExt(fileExt) {
  const ext = String(fileExt || "bin").toLowerCase().replace(/^\./, "");
  return ext || "bin";
}

function toUrlPath(...parts) {
  return parts.join("/").replace(/\\/g, "/");
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function uploadFile(buffer, userId, index = 0, fileExt = "bin", folder = "misc") {
  try {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("uploadFile: buffer must be a Buffer");
    }

    const safeFolder = sanitizeFolder(folder);
    const ext = normalizeExt(fileExt);

    const fileName = `${Date.now()}_${userId}_${index}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const relativePath = toUrlPath(safeFolder, String(userId), fileName);
    const absolutePath = path.join(STORAGE_ROOT, safeFolder, String(userId), fileName);

    await ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, buffer);

    return {
      path: relativePath,
      url: `${ASSETS_BASE_URL}/${relativePath}`,
    };
  } catch (error) {
    console.error("ローカルファイル保存エラー:", error);
    return null;
  }
}

export async function deleteFile(filePath) {
  if (!filePath) return true;

  try {
    const normalized = String(filePath).replace(/^\/+/, "");
    const absolutePath = path.join(STORAGE_ROOT, normalized);
    await fs.unlink(absolutePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return true;
    }
    console.error("ローカルファイル削除エラー:", error);
    return false;
  }
}

export async function getDirectorySize(folder = "") {
  try {
    const safeFolder = String(folder).replace(/^\/+/, "");
    const targetPath = safeFolder ? path.join(STORAGE_ROOT, safeFolder) : STORAGE_ROOT;

    async function getSizeRecursive(dir) {
      let total = 0;
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          total += await getSizeRecursive(fullPath);
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          total += stat.size;
        }
      }

      return total;
    }

    return await getSizeRecursive(targetPath);
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    console.error("ディレクトリサイズ取得エラー:", error);
    return -1;
  }
}