import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { brotliCompressSync } from "node:zlib";
import axios from "axios";
import { REST } from "@discordjs/rest";
import { MockAgent } from "undici";
import { Receiver } from "ws";

test("axiosのJSON送受信・リダイレクト・通常Brotli応答・timeoutを維持する", { timeout: 5000 }, async (t) => {
  const server = createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/brotli" }).end();
    } else if (request.url === "/brotli") {
      response.writeHead(200, { "Content-Type": "application/json", "Content-Encoding": "br" });
      response.end(brotliCompressSync(Buffer.from('{"fixture":"compressed"}')));
    } else if (request.url === "/echo") {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(Buffer.concat(chunks));
      });
    } else {
      setTimeout(() => response.end("late fixture"), 100).unref();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  const client = axios.create({
    baseURL: `http://127.0.0.1:${server.address().port}`, proxy: false, timeout: 1000,
  });
  const payload = { operationName: "FixtureOperation", variables: { id: "fixture" }, query: "query fixture" };
  assert.deepEqual((await client.post("/echo", payload)).data, payload);
  assert.deepEqual((await client.get("/redirect")).data, { fixture: "compressed" });
  await assert.rejects(client.get("/slow", { timeout: 20 }), { code: "ECONNABORTED" });
});

test("Discord RESTの実undici経路でJSON応答を処理できる（外部接続禁止）", async (t) => {
  const agent = new MockAgent();
  agent.disableNetConnect();
  t.after(() => agent.close());
  agent.get("https://discord.com").intercept({ path: "/api/v10/gateway", method: "GET" })
    .reply(200, { url: "wss://fixture.invalid" }, { headers: { "Content-Type": "application/json" } });
  const rest = new REST({ version: "10" }).setAgent(agent);
  assert.deepEqual(await rest.get("/gateway", { auth: false }), { url: "wss://fixture.invalid" });
  agent.assertNoPendingInterceptors();
});

test("wsの受信パーサーは通常のテキストフレームを処理できる", async () => {
  const receiver = new Receiver({ isServer: false, maxPayload: 1024 });
  const received = once(receiver, "message");
  receiver.write(Buffer.from([0x81, 0x02, 0x6f, 0x6b]));
  const [message, isBinary] = await received;
  assert.equal(message.toString(), "ok");
  assert.equal(isBinary, false);
  receiver.destroy();
});
