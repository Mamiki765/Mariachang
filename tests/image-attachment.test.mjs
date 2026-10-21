import test from "node:test";
import assert from "node:assert/strict";
import { readImageAttachment } from "../utils/imageAttachment.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=", "base64");
const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const attachment = (extra = {}) => ({ name: "image.png", size: 1, url: "https://cdn.discordapp.com/attachments/1/2/image.png?ex=signed", ...extra });
const options = { maxBytes: 1024, maxDimension: 800 };

test("valid PNG and GIF remain supported and actual bytes are returned", async (t) => {
  for (const [data, name] of [[png, "image.png"], [gif, "image.gif"]]) {
    t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(url.hostname, "cdn.discordapp.com");
      assert.equal(init.redirect, "error");
      assert.ok(init.signal);
      return new Response(data);
    });
    const result = await readImageAttachment(attachment({ name }), options);
    assert.deepEqual(result.buffer, data);
  }
});

test("metadata and URL rejection happens before a request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => { throw Error("must not fetch"); });
  for (const extra of [
    { size: 1025 }, { name: "image.svg" },
    { url: "https://example.com/image.png" },
    { url: "http://cdn.discordapp.com/attachments/1/2/a.png" },
    { url: "https://cdn.discordapp.com.evil.example/attachments/1/2/a.png" },
    { url: "https://user:pass@cdn.discordapp.com/attachments/1/2/a.png" },
  ]) await assert.rejects(readImageAttachment(attachment(extra), options));
  assert.equal(fetch.mock.callCount(), 0);
});

test("stream limit is enforced without trusting attachment size or Content-Length", async (t) => {
  for (const headers of [{}, { "content-length": "1" }]) {
    let cancelled = false;
    let signal;
    t.mock.method(globalThis, "fetch", async (_, init) => {
      signal = init.signal;
      return new Response(new ReadableStream({
        pull(controller) { controller.enqueue(new Uint8Array(700)); },
        cancel() { cancelled = true; },
      }), { headers });
    });
    await assert.rejects(readImageAttachment(attachment(), options), /上限/);
    assert.equal(cancelled, true);
    assert.equal(signal.aborted, true);
  }
});

test("oversized headers and HTTP errors are rejected without consuming their bodies", async (t) => {
  for (const response of [
    new Response(png, { headers: { "content-length": "2048" } }),
    new Response(png, { status: 503 }),
  ]) {
    t.mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(readImageAttachment(attachment(), options));
    assert.equal(response.bodyUsed, false);
  }
});

test("unsupported magic, mismatched extensions, empty images and large dimensions fail", async (t) => {
  const largePng = Buffer.from(png);
  largePng.writeUInt32BE(801, 16);
  for (const data of [Buffer.from("icns-benign-header"), gif, Buffer.alloc(0), largePng]) {
    t.mock.method(globalThis, "fetch", async () => new Response(data));
    await assert.rejects(readImageAttachment(attachment(), options));
  }
  t.mock.method(globalThis, "fetch", async () => new Response(gif));
  await assert.rejects(readImageAttachment(attachment({ name: "image.gif" }), {
    ...options, allowedTypes: ["png", "jpg", "webp"],
  }));
});

test("deadline aborts a stalled download and releases its concurrency slot", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal;
  t.mock.method(globalThis, "fetch", (_, init) => {
    signal = init.signal;
    return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  });
  const stalled = assert.rejects(readImageAttachment(attachment(), options), /タイムアウト/);
  t.mock.timers.tick(15_000);
  await stalled;
  assert.equal(signal.aborted, true);
  t.mock.method(globalThis, "fetch", async () => new Response(png));
  assert.deepEqual((await readImageAttachment(attachment(), options)).buffer, png);
});

test("concurrent downloads are bounded and failed requests release all slots", async (t) => {
  const release = [];
  t.mock.method(globalThis, "fetch", () => new Promise((resolve) => release.push(resolve)));
  const active = Array.from({ length: 4 }, () => assert.rejects(readImageAttachment(attachment(), options)));
  await assert.rejects(readImageAttachment(attachment(), options), /混み合/);
  assert.equal(release.length, 4);
  release.forEach((resolve) => resolve(new Response(null, { status: 503 })));
  await Promise.all(active);
  t.mock.method(globalThis, "fetch", async () => new Response(png));
  await readImageAttachment(attachment(), options);
});
