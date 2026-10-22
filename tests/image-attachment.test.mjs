import test from "node:test";
import assert from "node:assert/strict";
import { readImageAttachment } from "../utils/imageAttachment.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=", "base64");
const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
// Complete tiny images, not just signatures: 2x3 JPEG and 1x1 lossy WebP.
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8rZ55LmaSaaRpZZGLvI7EszE5JJPUmiiijbRDbcm23ds//9k=", "base64");
const webp = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");
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

test("valid JPEG uploads retain bytes and support both jpg and jpeg extensions", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(jpeg));
  for (const fileExt of ["jpg", "jpeg"]) {
    const result = await readImageAttachment(attachment({ name: `image.${fileExt}`, size: jpeg.length }), {
      ...options, allowedTypes: ["png", "jpg", "webp"], maxDimension: 3,
    });
    assert.deepEqual(result.buffer, jpeg);
    assert.equal(result.fileExt, fileExt);
  }
});

test("valid WebP uploads retain bytes and normalize the file extension", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(webp));
  const result = await readImageAttachment(attachment({ name: "image.WEBP", size: webp.length }), {
    ...options, allowedTypes: ["png", "jpg", "webp"], maxDimension: 1,
  });
  assert.deepEqual(result.buffer, webp);
  assert.equal(result.fileExt, "webp");
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

test("deadline aborts a partially received body and restores all download slots", { timeout: 1000 }, async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const receivingBody = Promise.withResolvers();
  let signal;
  let pulls = 0;
  let settled = false;
  t.mock.method(globalThis, "fetch", async (_, init) => {
    signal = init.signal;
    return new Response(new ReadableStream({
      start(controller) {
        // Model fetch's abort propagation into an already-open response body.
        signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
      },
      pull(controller) {
        pulls++;
        if (pulls === 1) controller.enqueue(png.subarray(0, 20));
        else receivingBody.resolve(); // No further bytes and no EOF.
      },
    }, { highWaterMark: 0 }), { headers: { "content-length": String(png.length) } });
  });
  const download = readImageAttachment(attachment(), options);
  download.then(() => { settled = true; }, () => { settled = true; });
  const rejected = assert.rejects(download, /タイムアウト/);
  await receivingBody.promise;
  assert.equal(pulls, 2, "one chunk was consumed before waiting for the rest of the body");
  t.mock.timers.tick(14_999);
  assert.equal(signal.aborted, false);
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(signal.aborted, true);

  // Filling all four slots catches a leaked slot after a body-read failure.
  t.mock.method(globalThis, "fetch", async () => new Response(png));
  const next = await Promise.all(Array.from({ length: 4 }, () => readImageAttachment(attachment(), options)));
  for (const result of next) assert.deepEqual(result.buffer, png);
});
