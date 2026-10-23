// Run explicitly: node --test tests/docker/build-context.test.mjs
// Requires Docker with linux/arm64 support. Never starts the bot or reads local env files.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test("arm64 image keeps lockfile dependencies with a contaminated build context", { timeout: 20 * 60_000 }, () => {
  const context = mkdtempSync(join(tmpdir(), "maria-build-context-"));
  const image = `maria-context-regression:${Date.now()}`;
  // Copy tracked sources only; no host credentials, env files, or dependency tree.
  const files = run("git", ["ls-files", "-z"], { cwd: root }).split("\0").filter(Boolean);
  for (const file of new Set([...files, ".dockerignore"])) {
    if (file.split("/").some((part) => part === "node_modules" || part === ".git") ||
        (file.split("/").at(-1).startsWith(".env") && file !== ".env.example")) continue;
    const destination = resolve(context, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(root, file), destination);
  }
  const oldVersions = { "image-size": "2.0.2", axios: "1.13.2", ws: "8.18.3", undici: "6.21.3" };
  for (const [name, version] of Object.entries(oldVersions)) {
    const directory = join(context, "node_modules", name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name, version }));
  }
  for (const directory of ["node_modules", "nested/node_modules"]) {
    mkdirSync(join(context, directory), { recursive: true });
    writeFileSync(join(context, directory, "host-contamination"), "synthetic host fixture");
  }
  console.log(`Synthetic context retained at ${context}; image ${image}`);
  run("docker", ["build", "--platform=linux/arm64", "--progress=plain", "--tag", image, context], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  const check = `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const path = require('node:path');
    const lock = require('/app/package-lock.json');
    assert.equal(process.arch, 'arm64');
    assert.equal(process.version, 'v24.22.1');
    for (const marker of ['/app/node_modules/host-contamination', '/app/nested/node_modules/host-contamination']) {
      assert.equal(fs.existsSync(marker), false, marker);
    }
    const versions = {};
    for (const [location, entry] of Object.entries(lock.packages)) {
      if (!/(^|\\/)node_modules\\/(image-size|axios|ws|undici)$/.test(location)) continue;
      const actual = JSON.parse(fs.readFileSync(path.join('/app', location, 'package.json'), 'utf8')).version;
      assert.equal(actual, entry.version, location);
      versions[location] = actual;
    }
    assert.equal(Object.keys(versions).length >= 4, true);
    console.log(JSON.stringify({ node: process.version, arch: process.arch, versions }, null, 2));
  `;
  const output = run("docker", ["run", "--rm", "--platform=linux/arm64", "--network=none", "--read-only", "--cap-drop=ALL", "--entrypoint=node", image, "-e", check]);
  console.log(output);
  // Evidence is retained outside the repository; no production configuration is used.
  writeFileSync(join(context, "verification.json"), output);
  assert.equal(readFileSync(join(context, ".dockerignore"), "utf8"), readFileSync(join(root, ".dockerignore"), "utf8"));
});
