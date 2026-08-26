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

test("drawing surface exposes three media, an eraser and 36 preset colors", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /铅笔/);
  assert.match(page, /油画/);
  assert.match(page, /水彩/);
  assert.match(page, /橡皮擦/);
  assert.match(page, /brushType === "eraser" \? "#FBF8F3" : color/);
  const paletteSource = page.match(/const palette = \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.equal(paletteSource.match(/#[0-9A-F]{6}/g)?.length, 36);
  assert.match(page, /accept="image\/\*"/);
  assert.match(page, /拍照 \/ 选择图片/);
  assert.match(page, /图片仅导入当前画布/);
  assert.match(page, /URL\.createObjectURL\(file\)/);
  assert.match(page, /file\.size > 20 \* 1024 \* 1024/);
});

test("seven-day experience includes gallery, opt-in sharing, pulse feedback and archive", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const experience = await readFile(new URL("app/experience.ts", root), "utf8");
  assert.equal((experience.match(/day:\s[1-7],/g) ?? []).length, 7);
  assert.match(page, /7日作品册/);
  assert.match(page, /先生成，再决定是否分享/);
  assert.match(page, /作品＋标题/);
  assert.match(page, /作品＋一句话/);
  assert.match(page, /生成卡片预览/);
  assert.match(page, /作品已经嵌入卡片/);
  assert.match(page, /drawImageContain\(context, image/);
  assert.match(page, /匿名反馈草稿/);
  assert.match(page, /下载7日个人作品档案/);
  assert.doesNotMatch(page, /请带着三个问题回到伙伴群/);
});

test("artwork and share card open as long-pressable images instead of file previews", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(page, /长按保存作品/);
  assert.match(page, /长按保存卡片/);
  assert.match(page, /长按下面的图片/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /saveImagePreview\.url/);
  assert.doesNotMatch(page, /<a href=\{sharePreviewUrl\} download=/);
  assert.match(styles, /\.image-save-layer/);
  assert.match(styles, /-webkit-touch-callout:default/);
});

test("all seven days include psychoeducation, participant choice and grounding", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const experience = await readFile(new URL("app/experience.ts", root), "utf8");
  assert.equal((experience.match(/^    practiceAim:/gm) ?? []).length, 7);
  assert.equal((experience.match(/^    context:/gm) ?? []).length, 7);
  assert.equal((experience.match(/^    prepare:/gm) ?? []).length, 7);
  assert.equal((experience.match(/^    permission:/gm) ?? []).length, 7);
  assert.equal((experience.match(/^    closing:/gm) ?? []).length, 7);
  assert.match(page, /先了解这7天会发生什么/);
  assert.match(page, /任何一天都可以暂停、跳过或不公开作品/);
  assert.match(page, /如果此刻有点难受，先暂停一下/);
  assert.match(page, /联系可信任的人或合适的专业支持/);
  assert.match(page, /先把今天放回生活/);
});

test("pilot flow protects work and produces teacher-verifiable receipts", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const experience = await readFile(new URL("app/experience.ts", root), "utf8");
  assert.match(page, /参与编号/);
  assert.match(page, /发送打卡回执/);
  assert.match(page, /完成时间：/);
  assert.match(page, /回执只含参与编号、完成时间和天数/);
  assert.match(page, /撤销一步/);
  assert.match(page, /确定清空当前画面吗/);
  assert.match(page, /beforeunload/);
  assert.match(page, /正在保存到本机作品册/);
  assert.match(page, /Day \{padDay\(day \+ 1\)\} 明天解锁/);
  assert.match(page, /下载当前备份/);
  assert.match(page, /导入备份恢复/);
  assert.match(experience, /const DB_VERSION = 2/);
  assert.match(experience, /createExperienceBackup/);
  assert.match(experience, /restoreExperienceBackup/);
  assert.match(experience, /saveArtworkDraft/);
});
