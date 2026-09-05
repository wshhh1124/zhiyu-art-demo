import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dayPlans } from "../app/experience.ts";
import { emphasisParts, splitSentences } from "../app/reading.ts";
import { BackendError } from "../app/cloudBackend.ts";

const root = new URL("../", import.meta.url);

test("admin copy is neutral across the console, participant pages and API", async () => {
  for (const path of ["app/TeacherDashboard.tsx", "app/page.tsx", "app/cloudBackend.ts", "cloudfunctions/zhiyu-api/index.js"]) {
    const source = await readFile(new URL(path, root), "utf8");
    assert.doesNotMatch(source, /教师|老师/, path);
  }
  const dashboard = await readFile(new URL("app/TeacherDashboard.tsx", root), "utf8");
  assert.equal((dashboard.match(/<h1>后端控制台<\/h1>/g) ?? []).length, 2);
  assert.match(dashboard, /管理员密码/);
  assert.match(dashboard, /进入后端控制台/);
  const messages = {
    ADMIN_NOT_CONFIGURED: "管理员密码尚未在云函数环境变量中设置。",
    ADMIN_UNAUTHORIZED: "管理员密码不正确。",
    PARTICIPANT_NOT_FOUND: "参与编号不存在，请和活动管理员确认。",
    PARTICIPANT_INACTIVE: "这个参与编号目前已暂停，请联系活动管理员。",
    DAY_LOCKED: "这一天还没有由管理员开放。",
  };
  for (const [code, message] of Object.entries(messages)) {
    const error = new BackendError(code, "旧版服务提示");
    assert.equal(error.message, message);
    assert.equal(error.code, code);
  }
  assert.equal(new BackendError("NETWORK_ERROR", "网络暂时不可用").message, "网络暂时不可用");
});

test("partner demo is gated and keeps participant content device-local", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const backend = await readFile(new URL("app/cloudBackend.ts", root), "utf8");
  assert.match(page, /joinWithParticipantCode/);
  assert.match(page, /验证编号并进入/);
  assert.match(page, /作品只保存在当前设备/);
  assert.match(page, /清除旧记录并更换编号/);
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
  assert.doesNotMatch(page, /分享到微信|MicroMessenger|navigator\.canShare|navigator\.share|shareGeneratedCard|wechat-share/);
  assert.match(page, /openImageSavePreview\(sharePreviewUrl, "分享卡"\)/);
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

test("long-form guidance uses restrained visual reading cues", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.doesNotMatch(styles, /(?:\.intro-card h1|\.practice-guide>h2|\.section-heading h2|\.guide-grid strong)[^{]*\{[^}]*text-decoration:underline/);
  assert.doesNotMatch(styles, /\.intro-card h1[^{]*\{[^}]*background:(?!none)/);
  assert.match(styles, /\.theme-keyword \{[^}]*color:var\(--rose-ink\)/);
  assert.match(styles, /\.theme-keyword \{[^}]*background:none/);
  assert.match(styles, /\.sentence-line \{[^}]*display:block/);
  assert.match(page, /<ThemeText text=\{plan.title\} emphasis=\{plan.titleEmphasis\}/);
  assert.match(page, /additionalEmphasis=\{plan.titleSecondaryEmphasis\}/);
  assert.match(page, /<ThemeText text=\{plan.practiceAim\} emphasis=\{plan.aimEmphasis\}/);
  assert.match(page, /任选一题起笔/);
  assert.match(page, /plan\.starterPrompts\.map/);
  assert.match(page, /current === index \? null : index/);
  assert.match(page, /你带来的起笔问题/);
  assert.match(page, /plan\.starterPrompts\[selectedStarterPrompt\]/);
  assert.match(page, /它只是一个开始入口，不必在画里回答它/);
  assert.match(page, /重新选择/);
  assert.match(styles, /\.selected-starter-prompt/);
  for (const field of ["prompt", "context", "prepare", "permission", "starter", "takeaway", "closing"]) {
    assert.ok(page.includes(`<SentenceLines text={plan.${field}}`), `${field} must start each sentence on a new line`);
  }
  assert.match(styles, /\.starter-note>p \{[^}]*font-style:italic/);
  assert.match(styles, /\.starter-prompts button\.selected \{[^}]*border-color:var\(--teal\)/);
  assert.match(styles, /\.field>span,legend \{[^}]*color:var\(--teal\)/);
  assert.match(styles, /\.field small,legend small \{[^}]*font-style:italic/);
});

test("all seven days highlight selected words without changing their wording", () => {
  assert.equal(dayPlans.length, 7);
  for (const plan of dayPlans) {
    for (const [text, emphasis] of [[plan.title, plan.titleEmphasis], [plan.practiceAim, plan.aimEmphasis], [plan.prompt, plan.promptEmphasis]]) {
      assert.ok(emphasis.length > 0 && text.includes(emphasis), `Day ${plan.day}: emphasis must occur in the text`);
      assert.ok(emphasis.length < text.length / 2, `Day ${plan.day}: highlight only a short phrase`);
      const parts = emphasisParts(text, emphasis);
      assert.equal(parts[1], emphasis);
      assert.equal(parts.join(""), text);
    }
    assert.ok(plan.context.includes(plan.contextEmphasis), `Day ${plan.day}: context emphasis must occur in the text`);
    assert.equal(plan.starterPrompts.length, 3, `Day ${plan.day}: needs three optional starter prompts`);
    for (const text of [plan.prompt, plan.context, plan.prepare, plan.permission, plan.starter, plan.takeaway, plan.closing]) {
      assert.equal(splitSentences(text).join(""), text, `Day ${plan.day}: line breaks must retain all original wording and punctuation`);
    }
  }
  assert.deepEqual(emphasisParts("不含重点", "缺失"), ["不含重点", "", ""]);
  assert.deepEqual(emphasisParts("完整原文", ""), ["完整原文", "", ""]);
  assert.equal(dayPlans[1].titleSecondaryEmphasis, "身体");
});

test("sentence breaks keep closing quotes, questions and ellipses intact", () => {
  assert.deepEqual(splitSentences("今天先说到这里。”再看看房间。"), ["今天先说到这里。”", "再看看房间。"]);
  assert.deepEqual(splitSentences("它像什么？可以停一下！也可以不回答"), ["它像什么？", "可以停一下！", "也可以不回答"]);
  assert.deepEqual(splitSentences("先写‘其实我想……’再允许画面把字盖住。"), ["先写‘其实我想……’再允许画面把字盖住。"]);
  assert.deepEqual(splitSentences("第一行。\n第二行；第三行。"), ["第一行。", "第二行；", "第三行。"]);
  assert.deepEqual(splitSentences(""), []);
});

test("each daily task is split into a reversible five-page journey", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(page, /type PracticePhase = "intro" \| "ground" \| "guide" \| "create" \| "reflect"/);
  assert.match(page, /介绍/);
  assert.match(page, /呼吸 \/ 到场/);
  assert.match(page, /带着引导去作画/);
  assert.match(page, /完成这幅画，去赋义/);
  assert.match(page, /JourneyProgress current="reflect"/);
  assert.match(page, /setPhase\("intro"\)/);
  assert.match(page, /setPhase\("ground"\)/);
  assert.match(page, /setPhase\("guide"\)/);
  assert.match(page, /setPhase\("create"\)/);
  assert.match(page, /function leaveCanvasForGuide/);
  assert.match(page, /setPreviewUrl\(canvasRef\.current\.toDataURL/);
  assert.match(styles, /\.journey-progress/);
  assert.match(styles, /\.breath-practice/);
  assert.match(styles, /prefers-reduced-motion:reduce[^}]*animation:none!important/);
});

test("the daily theme returns after breathing on guide, creation and reflection pages", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(page, /function DayThemeReminder/);
  assert.equal((page.match(/<DayThemeReminder plan=\{plan\} \/>/g) ?? []).length, 3);
  assert.match(page, /今日主题 · DAY/);
  assert.match(page, /aria-label="今日主题提醒"/);
  assert.match(styles, /\.day-theme-reminder/);
});

test("reflection offers content, visual and uncertainty choices for what to notice", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  for (const option of ["画面内容", "色彩", "线条", "形状", "留白", "重叠", "边缘", "位置与距离", "整体感觉", "还说不清"]) {
    assert.ok(page.includes(`"${option}"`), `missing focus option: ${option}`);
  }
  assert.match(page, /选第一眼最想指给别人看的；不确定也可以/);
});

test("pilot flow protects work and requires a complete, backend-synced check-in", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const experience = await readFile(new URL("app/experience.ts", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(page, /参与编号/);
  assert.match(page, /正式参与说明 · 请先阅读/);
  assert.match(page, /本期面向18岁及以上成年人/);
  assert.match(page, /不替代心理咨询、诊断、治疗或医疗服务/);
  assert.match(page, /群聊无法保证绝对保密/);
  assert.match(page, /不提供24小时危机干预/);
  assert.match(page, /工作人员回复时间以群公告为准/);
  assert.match(page, /需要删除后台编号和完成记录/);
  assert.match(page, /我已阅读并理解参与说明/);
  assert.match(page, /请先阅读并确认参与说明/);
  assert.match(page, /disabled=\{!participationAccepted\}/);
  assert.match(styles, /\.participation-notice/);
  assert.match(styles, /\.participation-consent/);
  assert.match(page, /正在恢复.*上次进度/s);
  assert.match(page, /const savedProfile = await getParticipantProfile\(\)/);
  assert.match(page, /refreshParticipantAccess\(savedProfile\.participantId\)/);
  assert.match(page, /已自动恢复参与编号/);
  assert.doesNotMatch(page, /发送打卡回执/);
  assert.match(page, /完成打卡 · 后端已记录/);
  assert.match(page, /completionRequirements/);
  assert.match(page, /disabled=\{!completionReady \|\| saveStatus === "saving"\}/);
  assert.match(page, /重新同步完成打卡/);
  assert.match(page, /syncParticipantCompletion/);
  assert.match(page, /后端只看到编号、完成天数和时间/);
  assert.match(page, /撤销一步/);
  assert.match(page, /确定清空当前画面吗/);
  assert.match(page, /beforeunload/);
  assert.match(page, /正在完成打卡/);
  assert.match(page, /Day \{padDay\(day \+ 1\)\} 等待管理员开放/);
  assert.doesNotMatch(page, /跨设备备份|下载当前备份|导入备份恢复/);
  assert.doesNotMatch(page, /exportBackup|importBackup/);
  assert.match(experience, /const DB_VERSION = 2/);
  assert.doesNotMatch(experience, /createExperienceBackup|restoreExperienceBackup|ExperienceBackup/);
  assert.match(experience, /saveArtworkDraft/);
});

test("teacher backend controls participant codes, open day and completion metadata", async () => {
  const dashboard = await readFile(new URL("app/TeacherDashboard.tsx", root), "utf8");
  const backend = await readFile(new URL("app/cloudBackend.ts", root), "utf8");
  const api = await readFile(new URL("cloudfunctions/zhiyu-api/index.js", root), "utf8");
  assert.match(dashboard, /本期名称/);
  assert.match(dashboard, /暂停活动/);
  assert.match(dashboard, /结束本期/);
  assert.match(dashboard, /导出参与数据/);
  assert.match(dashboard, /text\/csv;charset=utf-8/);
  assert.match(dashboard, /item\.completedDays\.join/);
  assert.match(dashboard, /全员开放到哪一天/);
  assert.match(dashboard, /批量生成/);
  assert.match(dashboard, /单独开放/);
  assert.match(dashboard, /暂停/);
  assert.match(dashboard, /查看并控制所有参与编号/);
  assert.match(dashboard, /已加入/);
  assert.match(dashboard, /清空记录/);
  assert.match(dashboard, /删除编号/);
  assert.match(dashboard, /批量删除/);
  assert.match(dashboard, /全选当前筛选结果/);
  assert.match(api, /process\.env\.ADMIN_PASSWORD/);
  assert.match(api, /CAMPAIGN_PAUSED/);
  assert.match(api, /CAMPAIGN_CLOSED/);
  assert.equal((api.match(/requireActiveCampaign\(campaign\)/g) ?? []).length, 4);
  assert.match(api, /admin\.updateCampaign/);
  assert.match(api, /normalizeCampaignStatus\(campaign\.status\)/);
  assert.match(backend, /admin\.updateCampaign/);
  assert.match(api, /PARTICIPANT_NOT_FOUND/);
  assert.match(api, /DAY_LOCKED/);
  assert.match(api, /completedDays/);
  assert.match(api, /admin\.resetParticipant/);
  assert.match(api, /admin\.deleteParticipant/);
  assert.match(api, /admin\.deleteParticipants/);
  assert.match(api, /participantCodes/);
  assert.match(api, /db\.collection\(PARTICIPANTS\)\.doc\(code\)\.remove\(\)/);
  assert.doesNotMatch(api, /image|feelings|note/);
});

test("Day 7 product survey and daily incomplete reminder are wired end to end", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const dashboard = await readFile(new URL("app/TeacherDashboard.tsx", root), "utf8");
  const backend = await readFile(new URL("app/cloudBackend.ts", root), "utf8");
  const api = await readFile(new URL("cloudfunctions/zhiyu-api/index.js", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(dashboard, /复制未完成名单/);
  assert.match(dashboard, /item\.joinedAt && item\.status === "active"/);
  assert.match(dashboard, /只看体验与产品选择/);
  assert.match(dashboard, /结营体验评分/);
  assert.match(dashboard, /参与编号[\s\S]*提交时间[\s\S]*体验评分[\s\S]*最想保留[\s\S]*下期意愿[\s\S]*可接受价格/);
  assert.match(dashboard, /删除问卷/);
  assert.match(dashboard, /只会删除这份问卷，不会删除参与编号、完成进度/);
  assert.match(page, /一份很短的结营问卷/);
  assert.match(page, /约30秒 · 自愿填写/);
  assert.match(page, /你最想保留哪个环节/);
  assert.match(page, /如果下期换一个主题/);
  assert.match(page, /可接受的报名费/);
  assert.match(page, /不分析也不上传你的作品内容/);
  assert.match(page, /submitParticipantExitSurvey/);
  assert.doesNotMatch(page, /surveyComment|问卷意见|补充建议/);
  assert.match(backend, /participant\.submitSurvey/);
  assert.match(backend, /admin\.deleteSurvey/);
  assert.match(api, /zhiyu_exit_surveys/);
  assert.match(api, /SURVEY_NOT_READY/);
  assert.match(api, /participant\.submitSurvey/);
  assert.match(api, /admin\.deleteSurvey/);
  assert.match(api, /db\.collection\(SURVEYS\)\.doc\(code\)\.set/);
  assert.match(api, /db\.collection\(SURVEYS\)\.doc\(code\)\.remove/);
  assert.match(api, /surveySubmittedAt: null/);
  assert.match(styles, /\.exit-survey/);
  assert.match(styles, /\.teacher-reminder/);
});
