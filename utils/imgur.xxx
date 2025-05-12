import axios from "axios";

/**
 * Imgurへ画像をアップロード（匿名・非公開）
 */
export async function uploadToImgur(buffer) {
  try {
    const response = await axios.post(
      "https://api.imgur.com/3/image",
      {
        image: buffer.toString("base64"),
        type: "base64",
      },
      {
        headers: {
          Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
        },
      }
    );
    const { link, deletehash } = response.data.data;
    return { link, deletehash };
  } catch (error) {
    console.error("Imgurアップロードに失敗しました:", error.response?.data || error);
    return null;
  }
}

/**
 * Imgur画像の削除（deletehashを使用）
 */
export async function deleteFromImgur(deleteHash) {
  try {
    await axios.delete(`https://api.imgur.com/3/image/${deleteHash}`, {
      headers: {
        Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
      },
    });
    console.log("Imgur画像を削除しました:", deleteHash);
    return true;
  } catch (error) {
    console.error("Imgur画像の削除に失敗しました:", error.response?.data || error);
    return false;
  }
}