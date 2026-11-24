import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { env } from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { waitFor } from "./local.mjs";

export async function openBrowser({ origin, directory }, cookies) {
  const process = spawn(env.GAMEVAULT_CHROME_BIN || "google-chrome", [
    "--headless", "--disable-gpu", "--disable-dev-shm-usage", "--disable-background-networking",
    "--no-first-run", "--no-default-browser-check", "--remote-debugging-pipe",
    "--user-data-dir=" + join(directory, "chrome"), "about:blank",
  ], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
  const pending = new Map();
  const errors = [];
  let sequence = 0;
  let buffer = "";

  function failPending(message) {
    for (const { reject } of pending.values()) reject(new Error(message));
    pending.clear();
  }

  process.once("exit", (code) => failPending("Chrome s’est arrêté, code " + code));
  process.once("error", () => failPending("Chrome est introuvable. Configure GAMEVAULT_CHROME_BIN."));
  process.stdio[3].on("error", () => {});
  process.stdio[4].setEncoding("utf8");
  process.stdio[4].on("data", (chunk) => {
    buffer += chunk;
    const messages = buffer.split("\0");
    buffer = messages.pop();
    for (const json of messages) {
      const message = JSON.parse(json);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
      const waiting = pending.get(message.id);
      if (!waiting) continue;
      pending.delete(message.id);
      if (message.error) waiting.reject(new Error(message.error.message));
      else waiting.resolve(message.result);
    }
  });

  function send(method, params = {}, sessionId) {
    const id = ++sequence;
    const received = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      process.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0");
    });
    return Promise.race([
      received,
      delay(15_000, undefined, { ref: false }).then(() => { throw new Error("Chrome sans réponse pour " + method); }),
    ]);
  }

  try {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const command = (method, params) => send(method, params, sessionId);
    await command("Page.enable");
    await command("Runtime.enable");
    await command("Network.enable");
    await command("Network.setBlockedURLs", { urls: ["*steamstatic.com*"] });

    for (const { pair, path, httpOnly } of cookies.values()) {
      const separator = pair.indexOf("=");
      await command("Network.setCookie", {
        name: pair.slice(0, separator), value: pair.slice(separator + 1), url: origin, path, httpOnly, sameSite: "Lax",
      });
    }

    async function evaluate(expression) {
      const result = await command("Runtime.evaluate", { expression, returnByValue: true });
      if (result.exceptionDetails) throw new Error("Erreur JavaScript pendant le scénario navigateur");
      return result.result.value;
    }
    const wait = (expression, label) => waitFor(() => evaluate(expression).catch(() => false), label);

    return {
      evaluate, wait, errors,
      close: () => process.kill(),
      async navigate(path, title) {
        await command("Page.navigate", { url: origin + path });
        await wait(`document.readyState === "complete" && location.pathname + location.search === ${JSON.stringify(path)} && document.querySelector("h1")?.textContent === ${JSON.stringify(title)}`, "navigation " + path);
        await delay(200);
      },
      viewport(width, height) {
        return command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      },
      async tab() {
        await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      },
      async submit(label, values = {}) {
        const submitted = await evaluate(`(() => {
          const button = [...document.querySelectorAll("main form button")].find((item) =>
            item.textContent === ${JSON.stringify(label)} && item.getBoundingClientRect().width > 0);
          if (!button) return false;
          for (const [name, value] of Object.entries(${JSON.stringify(values)})) button.form.elements.namedItem(name).value = value;
          button.form.requestSubmit(button);
          return true;
        })()`);
        assert.equal(submitted, true, "Formulaire absent " + label);
      },
    };
  } catch (error) {
    process.kill();
    throw error;
  }
}
