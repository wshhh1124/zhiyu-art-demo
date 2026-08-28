import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("partner demo is gated and keeps participant content device-local", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const backend = await readFile(new URL("app/cloudBackend.ts", root), "utf8");
  assert.match(page, /joinWithParticipantCode/);
  assert.match(page, /验证编号并进入/);
  assert.match(page, /作品只保存在当前设备/);
  assert.match(page, /直接清除旧记录并更换/);
  assert.match(page, /clearExperienceData/);
  assert.match(page, /不会上传到织屿/);
  assert.doesNotMatch(page, /fetch\("\/api\/submissions/);
  assert.doesNotMatch(page, /回应工作台/);
  assert.match(backend, /participant\.join/);
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

test("seven-day experience includes gallery, opt-in sharing and archive without a final feedback form", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const experience = await readFile(new URL("app/experience.ts", root), "utf8");
  assert.equal((experience.match(/day:\s[1-7],/g) ?? []).length, 7);
  assert.match(page, /7日作品册/);
  assert.match(page, /先生成，再决定是否分享/);
  assert.match(page, /作品＋标题/);
  assert.match(page, /作品＋一句话/);
  assert.match(page, /生成卡片预览/);
  assert.match(page, /分享到微信/);
  assert.match(page, /MicroMessenger/);
  assert.match(page, /navigator\.canShare/);
  assert.match(page, /openImageSavePreview\(sharePreviewUrl, "微信分享卡"\)/);
  assert.match(page, /作品已经嵌入卡片/);
  assert.match(page, /drawImageContain\(context, image/);
  assert.doesNotMatch(page, /愿意留下一份体验反馈吗/);
  assert.doesNotMatch(page, /匿名反馈草稿/);
  assert.match(page, /下载7日个人作品档案/);
  assert.doesNotMatch(page, /请带着三个问题回到伙伴群/);
});

test("artwork and share card open as long-pressable images instead of file previews", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.doesNotMatch(page, /长按保存作品/);
  assert.doesNotMatch(page, /长按保存卡片/);
  assert.match(page, /className="share-output-actions"[\s\S]*?>保存图片<\/button>/);
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
  assert.match(page, /完成记录已同步给老师/);
  assert.match(page, /syncParticipantCompletion/);
  assert.match(page, /云端只记录编号、天数和完成时间/);
  assert.match(page, /撤销一步/);
  assert.match(page, /确定清空当前画面吗/);
  assert.match(page, /beforeunload/);
  assert.match(page, /正在保存到本机作品册/);
  assert.match(page, /Day \{padDay\(day \+ 1\)\} 等待老师开放/);
  assert.match(page, /下载当前备份/);
  assert.match(page, /导入备份恢复/);
  assert.match(experience, /const DB_VERSION = 2/);
  assert.match(experience, /createExperienceBackup/);
  assert.match(experience, /restoreExperienceBackup/);
  assert.match(experience, /saveArtworkDraft/);
});

test("teacher backend controls participant codes, open day and completion metadata", async () => {
  const dashboard = await readFile(new URL("app/TeacherDashboard.tsx", root), "utf8");
  const api = await readFile(new URL("cloudfunctions/zhiyu-api/index.js", root), "utf8");
  assert.match(dashboard, /全员开放到哪一天/);
  assert.match(dashboard, /批量生成/);
  assert.match(dashboard, /单独开放/);
  assert.match(dashboard, /暂停/);
  assert.match(dashboard, /查看并控制所有参与编号/);
  assert.match(dashboard, /已加入/);
  assert.match(dashboard, /清空记录/);
  assert.match(api, /process\.env\.ADMIN_PASSWORD/);
  assert.match(api, /PARTICIPANT_NOT_FOUND/);
  assert.match(api, /DAY_LOCKED/);
  assert.match(api, /completedDays/);
  assert.match(api, /admin\.resetParticipant/);
  assert.doesNotMatch(api, /image|feelings|note/);
});
