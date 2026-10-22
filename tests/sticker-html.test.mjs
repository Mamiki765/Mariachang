import test from "node:test";
import assert from "node:assert/strict";
import { renderStickerCard } from "../utils/stickerHtml.mjs";

test("stored names are escaped in both text and attributes", () => {
  const html = renderStickerCard({ name: `春 & 秋 <img src=x onerror="test()"> '`, imageUrl: "https://example.com/image.png?a=1&b=2" });
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("春 &amp; 秋 &lt;img src=x onerror=&quot;test()&quot;&gt; &#39;"));
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.ok(html.includes("?a=1&amp;b=2"));
});

test("image URL attribute injection is escaped and active URL schemes never render", () => {
  const html = renderStickerCard({ name: "sample", imageUrl: `https://example.com/'><script>alert(1)</script>` });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("'"));
  for (const url of ["javascript:alert(1)", "data:text/html,<script>test()</script>", "//example.com/a", "not a URL", "https://user:pass@example.com/a"]) {
    const card = renderStickerCard({ name: "saved name", imageUrl: url });
    assert.ok(card.includes("saved name"));
    assert.ok(!card.includes("href="));
    assert.ok(!card.includes("<img"));
  }
});
