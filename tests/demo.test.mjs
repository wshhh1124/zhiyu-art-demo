import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("partner demo is gated and keeps participant content device-local", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /const DEMO_CODE = "260824"/);
  assert.match(page, /作品只保存在当前设备/);
  assert.match(page, /不会上传到织屿/);
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

test("seven-day experience includes gallery, opt-in sharing, pulse feedback and archive", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const experience = await readFile(new URL("app/experience.ts", root), "utf8");
  assert.equal((experience.match(/day:\s[1-7],/g) ?? []).length, 7);
  assert.match(page, /7日作品册/);
  assert.match(page, /生成一张自主分享卡/);
  assert.match(page, /匿名反馈草稿/);
  assert.match(page, /下载7日个人作品档案/);
  assert.doesNotMatch(page, /请带着三个问题回到伙伴群/);
});
