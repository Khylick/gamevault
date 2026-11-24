import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env, execPath, platform } from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { fetch, Headers, FormData } = globalThis;

export async function waitFor(check, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await check();
    if (result) return result;
    await delay(250);
  }
  throw new Error("Délai dépassé pour " + label);
}

async function localPorts(count) {
  const sockets = Array.from({ length: count }, () => createServer());
  try {
    return await Promise.all(sockets.map((socket) => new Promise((resolve, reject) => {
      socket.once("error", reject);
      socket.listen(0, "127.0.0.1", () => resolve(socket.address().port));
    })));
  } finally {
    for (const socket of sockets) socket.close();
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 600_000,
    maxBuffer: 10_000_000,
  });
  if (result.error || result.status !== 0) {
    const error = result.error?.message ?? "code " + result.status;
    const diagnostics = options.private ? "" : "\n" + result.stdout + result.stderr;
    throw new Error((options.label ?? command) + " a échoué (" + error + ")." + diagnostics);
  }
  return result.stdout;
}

function copyApp(directory) {
  mkdirSync(directory);
  for (const path of ["package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", "src", "public", "AGENTS.md"]) {
    cpSync(join(root, path), join(directory, path), { recursive: true });
  }
  symlinkSync(join(root, "node_modules"), join(directory, "node_modules"), "junction");
}

export async function prepareLocalStack() {
  const [appPort, apiPort, dbPort, shadowPort, mailPort] = await localPorts(5);
  const directory = mkdtempSync(join(tmpdir(), "gamevault-e2e-"));
  const projectId = "gamevault-e2e-" + randomUUID().slice(0, 8);
  const origin = "http://127.0.0.1:" + appPort;
  const supabaseDirectory = join(directory, "supabase");
  const appDirectory = join(directory, "app");
  const executable = env.GAMEVAULT_SUPABASE_CLI || (platform === "win32" ? "npx.cmd" : "npx");
  const prefix = env.GAMEVAULT_SUPABASE_CLI ? [] : ["--yes", "supabase@3.3.0"];
  const cli = (args, options = {}) => run(executable, [...prefix, "--agent", "no", "--workdir", directory, ...args], {
    env: { ...env, SUPABASE_TELEMETRY_DISABLED: "1" },
    ...options,
  });
  let app;
  let started = false;

  async function stop() {
    if (app && app.exitCode === null) {
      app.kill();
      await Promise.race([new Promise((resolve) => app.once("exit", resolve)), delay(2_000, undefined, { ref: false })]);
    }
    if (started) cli(["stop", "--project-id", projectId, "--no-backup"], { label: "Arrêt de la pile de test", private: true });
    rmSync(directory, { recursive: true, force: true });
  }

  try {
    mkdirSync(supabaseDirectory);
    for (const path of ["migrations", "tests"]) {
      cpSync(join(root, "supabase", path), join(supabaseDirectory, path), { recursive: true });
    }
    const originalConfig = readFileSync(join(root, "supabase/config.toml"), "utf8")
      .replace(/^project_id = .+$/m, 'project_id = "' + projectId + '"')
      .replace(/^port = 54322$/m, "port = " + dbPort)
      .replace(/^shadow_port = 54320$/m, "shadow_port = " + shadowPort)
      .replaceAll("http://localhost:3000", origin);
    writeFileSync(join(supabaseDirectory, "config.toml"), originalConfig
      + "\n[api]\nport = " + apiPort + "\n\n[local_smtp]\nport = " + mailPort + "\n");
    copyApp(appDirectory);

    started = true;
    cli(["start", "-x", "realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"],
      { label: "Démarrage de la pile Supabase isolée", private: true });
    const config = JSON.parse(cli(["status", "-o", "json"], { label: "État de la pile Supabase isolée", private: true }));
    for (const [target, port] of [[config.API_URL, apiPort], [config.MAILPIT_URL, mailPort]]) {
      const url = new URL(target);
      assert.ok(url.hostname === "127.0.0.1" || url.hostname === "localhost", "La pile de test doit rester en boucle locale");
      assert.equal(url.port, String(port), "La pile de test doit utiliser ses propres ports");
    }
    assert.ok(config.PUBLISHABLE_KEY && config.SECRET_KEY, "La pile locale doit fournir ses clés de test");
    const sql = cli(["test", "db"], { label: "Tests pgTAP sur la base vierge" });
    cli(["db", "lint", "--schema", "public,gamevault_private", "--fail-on", "warning"], { label: "Lint du schéma SQL" });
    const checks = sql.match(/Tests=\d+/)?.[0];
    if (checks) globalThis.console.log("Migrations, lint SQL et pgTAP sur base vierge · " + checks);

    const testEnv = {
      ...env,
      NEXT_TELEMETRY_DISABLED: "1",
      APP_URL: origin,
      NEXT_PUBLIC_SUPABASE_URL: config.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY,
      SUPABASE_SECRET_KEY: config.SECRET_KEY,
      STEAM_WEB_API_KEY: "fixture-only",
      OPENAI_API_KEY: "fixture-only",
      OPENAI_ADVISOR_MODEL: "gpt-4.1-mini",
    };
    const next = join(appDirectory, "node_modules/next/dist/bin/next");
    run(execPath, [next, "build", "--webpack"], { cwd: appDirectory, env: testEnv, label: "Build isolé", private: true });
    app = spawn(execPath, [
      "--import", fileURLToPath(new URL("./providers.mjs", import.meta.url)), next,
      "start", "--hostname", "127.0.0.1", "--port", String(appPort),
    ], { cwd: appDirectory, env: testEnv, stdio: "ignore" });
    await waitFor(() => fetch(origin + "/settings").then(({ ok }) => ok).catch(() => false), "démarrage Next.js");
    return { origin, config, directory, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

export function createLocalSession(origin) {
  const cookies = new Map();

  async function request(path, options = {}) {
    const url = new URL(path, origin);
    assert.equal(url.origin, origin, "Les cookies restent sur l’application locale");
    const headers = new Headers(options.headers);
    const pairs = [...cookies.values()].filter((cookie) =>
      cookie.path === "/" || url.pathname === cookie.path || url.pathname.startsWith(cookie.path + "/"));
    if (pairs.length > 0) headers.set("cookie", pairs.map(({ pair }) => pair).join("; "));

    const response = await fetch(url, { ...options, headers, redirect: "manual" });
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";")[0];
      const name = pair.split("=")[0];
      const path = /;\s*Path=([^;]+)/i.exec(header)?.[1] ?? "/";
      if (/;\s*Max-Age=0(?:;|$)/i.test(header) || pair.endsWith("=")) cookies.delete(name);
      else cookies.set(name, { pair, path, httpOnly: /;\s*HttpOnly(?:;|$)/i.test(header) });
    }
    return response;
  }

  async function submitSettings(label, fields = {}, path = "/settings") {
    const html = await (await request(path)).text();
    const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].find(([tag]) => tag.includes(label))?.[0];
    const name = form?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
    assert.ok(name, "Formulaire introuvable pour " + label);
    const body = new FormData();
    body.set(name, "");
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return request(path, { method: "POST", headers: { Origin: origin }, body });
  }

  async function followAuthEmail(config, email, destination) {
    const messageId = await waitFor(async () => {
      const messages = await fetch(config.MAILPIT_URL + "/api/v1/messages").then((response) => response.json());
      return messages.messages.find((message) => message.To.some(({ Address }) => Address === email))?.ID;
    }, "lien d’authentification dans Mailpit");
    const message = await fetch(config.MAILPIT_URL + "/api/v1/message/" + messageId).then((response) => response.json());
    const found = (message.HTML ?? "").match(/href="([^"]+\/auth\/v1\/verify\?[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    assert.ok(found, "Lien Supabase absent du message local");
    assert.equal(new URL(found).origin, new URL(config.API_URL).origin, "Le lien doit provenir de Supabase local");
    const verified = await fetch(found, { redirect: "manual" });
    const callback = new URL(verified.headers.get("location"));
    assert.equal(callback.origin, origin);
    assert.equal(callback.pathname, "/auth/callback");
    const returned = await request(callback);
    assert.equal(returned.headers.get("location"), destination);
    assert.equal(returned.headers.get("referrer-policy"), "no-referrer");
    assert.ok([...cookies.values()].some(({ pair, httpOnly }) => pair.includes("auth-token") && httpOnly));
  }

  return { request, submitSettings, cookies, followAuthEmail };
}
