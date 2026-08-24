import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("partner demo is gated and does not upload participant content", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /const DEMO_CODE = "260824"/);
  assert.match(page, /作品不会上传或长期保存/);
  assert.doesNotMatch(page, /fetch\("\/api\/submissions/);
  assert.doesNotMatch(page, /回应工作台/);
});

test("drawing surface exposes three media and 36 preset colors", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /铅笔/);
  assert.match(page, /油画/);
  assert.match(page, /水彩/);
  const paletteSource = page.match(/const palette = \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.equal(paletteSource.match(/#[0-9A-F]{6}/g)?.length, 36);
});
