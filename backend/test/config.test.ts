// config.ts must not read developer .env files under test: a value setup-env.ts doesn't pin would otherwise leak in
// from backend/.env or the repo-root .env and change what the suites exercise.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("config under NODE_ENV=test", () => {
  const cwd = process.cwd();
  let dir: string | undefined;

  afterEach(() => {
    process.chdir(cwd);
    if (dir) rmSync(dir, { recursive: true, force: true });
    delete process.env.ISSUER_GAS_FUNDING_WEI;
  });

  it("ignores .env files in the working directory and its parent", async () => {
    dir = mkdtempSync(join(tmpdir(), "zkred-config-"));
    const backendDir = join(dir, "backend");
    mkdirSync(backendDir);
    writeFileSync(join(backendDir, ".env"), "ISSUER_GAS_FUNDING_WEI=7\n");
    writeFileSync(join(dir, ".env"), "ISSUER_GAS_FUNDING_WEI=9\n");
    delete process.env.ISSUER_GAS_FUNDING_WEI;
    process.chdir(backendDir);

    vi.resetModules();
    const { config } = await import("../src/config");

    expect(process.env.ISSUER_GAS_FUNDING_WEI).toBeUndefined();
    expect(config.ISSUER_GAS_FUNDING_WEI).not.toBe("7");
    expect(config.ISSUER_GAS_FUNDING_WEI).not.toBe("9");
  });
});
