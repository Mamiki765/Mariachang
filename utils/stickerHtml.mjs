function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
}

export function renderStickerCard(sticker) {
  const name = escapeHtml(sticker.name);
  let imageUrl = "";
  try {
    const url = new URL(sticker.imageUrl);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) {
      imageUrl = escapeHtml(url.href);
    }
  } catch {
    // Keep the name visible even if a legacy row has an invalid image URL.
  }
  const card = `<div class="stamp-card">
    ${imageUrl ? `<img src="${imageUrl}" alt="${name}" loading="lazy">` : ""}
    <div class="stamp-name">${name}</div>
  </div>`;
  return imageUrl
    ? `<a class="stamp-link" href="${imageUrl}" target="_blank" rel="noopener noreferrer">${card}</a>`
    : card;
}
