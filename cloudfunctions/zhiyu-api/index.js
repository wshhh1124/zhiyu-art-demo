"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const CAMPAIGN_ID = "zhiyu-7day-pilot";
const CAMPAIGNS = "zhiyu_campaigns";
const PARTICIPANTS = "zhiyu_participants";
const CHECKINS = "zhiyu_checkins";
const MAX_BODY_BYTES = 32 * 1024;
const DEFAULT_CAMPAIGN_NAME = "织屿7日表达性艺术探索";
const CAMPAIGN_STATUSES = new Set(["active", "paused", "closed"]);
const ALLOWED_ORIGINS = new Set([
  "https://wshhh1124.github.io",
  "https://zhiyu-art-demo.wshhh1124.chatgpt.site",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

function now() { return new Date().toISOString(); }
function normalizeCode(value) { return String(value || "").trim().toUpperCase().replace(/\s+/g, ""); }
function normalizeCampaignName(value) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40); }
function normalizeCampaignStatus(value) { return CAMPAIGN_STATUSES.has(value) ? value : "active"; }
function clampDay(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 7 ? parsed : fallback;
}
function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function requireAdmin(body) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) throw Object.assign(new Error("管理员密码尚未在云函数环境变量中设置。"), { statusCode: 503, code: "ADMIN_NOT_CONFIGURED" });
  if (!safeEqual(body.adminPassword, configured)) throw Object.assign(new Error("管理员密码不正确。"), { statusCode: 401, code: "ADMIN_UNAUTHORIZED" });
}
function randomCode(prefix) {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const suffix = Array.from(crypto.randomBytes(5), (byte) => alphabet[byte % alphabet.length]).join("");
  return `${prefix}-${suffix}`;
}
async function readCampaign() {
  const result = await db.collection(CAMPAIGNS).doc(CAMPAIGN_ID).get();
  if (result.data?.[0]) return result.data[0];
  const campaign = { name: DEFAULT_CAMPAIGN_NAME, currentDay: 1, status: "active", updatedAt: now() };
  await db.collection(CAMPAIGNS).doc(CAMPAIGN_ID).set(campaign);
  return { _id: CAMPAIGN_ID, ...campaign };
}
function requireActiveCampaign(campaign) {
  if (campaign.status === "paused") throw Object.assign(new Error("本期活动暂时暂停，请稍后再试。"), { statusCode: 403, code: "CAMPAIGN_PAUSED" });
  if (campaign.status === "closed") throw Object.assign(new Error("本期活动已经结束，暂时不能继续打卡。"), { statusCode: 403, code: "CAMPAIGN_CLOSED" });
  if (campaign.status !== "active") throw Object.assign(new Error("本期活动暂未开放。"), { statusCode: 403, code: "CAMPAIGN_INACTIVE" });
}
async function readParticipant(code) {
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) return null;
  const result = await db.collection(PARTICIPANTS).doc(code).get();
  return result.data?.[0] || null;
}
function participantView(participant, campaign) {
  const override = Number.isInteger(participant.dayOverride) ? participant.dayOverride : null;
  return {
    code: participant.code,
    status: participant.status,
    currentDay: override ?? clampDay(campaign.currentDay),
    dayOverride: override,
    completedDays: Array.isArray(participant.completedDays) ? participant.completedDays : [],
    joinedAt: participant.joinedAt || null,
  };
}
async function joinParticipant(body) {
  const code = normalizeCode(body.participantCode);
  const [campaign, participant] = await Promise.all([readCampaign(), readParticipant(code)]);
  if (!participant) throw Object.assign(new Error("参与编号不存在，请和活动管理员确认。"), { statusCode: 404, code: "PARTICIPANT_NOT_FOUND" });
  if (participant.status !== "active") throw Object.assign(new Error("这个参与编号目前已暂停，请联系活动管理员。"), { statusCode: 403, code: "PARTICIPANT_INACTIVE" });
  requireActiveCampaign(campaign);
  const timestamp = now();
  await db.collection(PARTICIPANTS).doc(code).update({ joinedAt: participant.joinedAt || timestamp, lastSeenAt: timestamp });
  return participantView({ ...participant, joinedAt: participant.joinedAt || timestamp }, campaign);
}
async function refreshAccess(body) {
  return joinParticipant(body);
}
async function completeDay(body) {
  const code = normalizeCode(body.participantCode);
  const day = clampDay(body.day, 0);
  if (!day) throw Object.assign(new Error("打卡天数无效。"), { statusCode: 400, code: "INVALID_DAY" });
  const [campaign, participant] = await Promise.all([readCampaign(), readParticipant(code)]);
  requireActiveCampaign(campaign);
  if (!participant || participant.status !== "active") throw Object.assign(new Error("参与编号无效或已暂停。"), { statusCode: 403, code: "PARTICIPANT_INACTIVE" });
  const allowedDay = participant.dayOverride ?? clampDay(campaign.currentDay);
  if (day > allowedDay) throw Object.assign(new Error("这一天还没有由管理员开放。"), { statusCode: 403, code: "DAY_LOCKED" });
  const completedDays = [...new Set([...(participant.completedDays || []), day])].sort((a, b) => a - b);
  const completedAt = typeof body.completedAt === "string" ? body.completedAt.slice(0, 40) : now();
  await Promise.all([
    db.collection(CHECKINS).doc(`${code}-day-${day}`).set({ participantCode: code, day, completedAt, syncedAt: now() }),
    db.collection(PARTICIPANTS).doc(code).update({ completedDays, latestCompletionAt: completedAt, lastSeenAt: now() }),
  ]);
  return { code, day, completedDays, synced: true };
}
async function adminOverview(body) {
  requireAdmin(body);
  const [campaign, participantResult] = await Promise.all([
    readCampaign(),
    db.collection(PARTICIPANTS).orderBy("createdAt", "desc").limit(500).get(),
  ]);
  const participants = (participantResult.data || []).map((item) => ({
    code: item.code,
    status: item.status,
    dayOverride: Number.isInteger(item.dayOverride) ? item.dayOverride : null,
    completedDays: Array.isArray(item.completedDays) ? item.completedDays : [],
    createdAt: item.createdAt,
    joinedAt: item.joinedAt || null,
    lastSeenAt: item.lastSeenAt || null,
    latestCompletionAt: item.latestCompletionAt || null,
  }));
  return { campaign: { name: normalizeCampaignName(campaign.name) || DEFAULT_CAMPAIGN_NAME, currentDay: clampDay(campaign.currentDay), status: normalizeCampaignStatus(campaign.status), updatedAt: campaign.updatedAt }, participants };
}
async function adminSetDay(body) {
  requireAdmin(body);
  const currentDay = clampDay(body.currentDay, 0);
  if (!currentDay) throw Object.assign(new Error("请选择 Day 1–Day 7。"), { statusCode: 400, code: "INVALID_DAY" });
  const campaign = await readCampaign();
  await db.collection(CAMPAIGNS).doc(CAMPAIGN_ID).set({ name: normalizeCampaignName(campaign.name) || DEFAULT_CAMPAIGN_NAME, currentDay, status: normalizeCampaignStatus(campaign.status), updatedAt: now() });
  return adminOverview(body);
}
async function adminUpdateCampaign(body) {
  requireAdmin(body);
  const campaign = await readCampaign();
  const name = body.name === undefined ? normalizeCampaignName(campaign.name) || DEFAULT_CAMPAIGN_NAME : normalizeCampaignName(body.name);
  const status = body.status === undefined ? normalizeCampaignStatus(campaign.status) : body.status;
  if (name.length < 2) throw Object.assign(new Error("本期名称请填写2–40个字符。"), { statusCode: 400, code: "INVALID_CAMPAIGN_NAME" });
  if (!CAMPAIGN_STATUSES.has(status)) throw Object.assign(new Error("活动状态无效。"), { statusCode: 400, code: "INVALID_CAMPAIGN_STATUS" });
  await db.collection(CAMPAIGNS).doc(CAMPAIGN_ID).set({ name, currentDay: clampDay(campaign.currentDay), status, updatedAt: now() });
  return adminOverview(body);
}
async function adminGenerate(body) {
  requireAdmin(body);
  const count = Math.max(1, Math.min(50, Number(body.count) || 1));
  const prefix = normalizeCode(body.prefix || "ZY").replace(/[^A-Z0-9]/g, "").slice(0, 8) || "ZY";
  const created = [];
  for (let index = 0; index < count; index += 1) {
    let code;
    let existing;
    do { code = randomCode(prefix); existing = await readParticipant(code); } while (existing);
    await db.collection(PARTICIPANTS).doc(code).set({ code, status: "active", dayOverride: null, completedDays: [], createdAt: now(), joinedAt: null, lastSeenAt: null });
    created.push(code);
  }
  return { created, ...(await adminOverview(body)) };
}
async function adminAddCode(body) {
  requireAdmin(body);
  const code = normalizeCode(body.participantCode);
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) throw Object.assign(new Error("编号请使用3–24位字母、数字或短横线。"), { statusCode: 400, code: "INVALID_CODE" });
  if (await readParticipant(code)) throw Object.assign(new Error("这个编号已经存在。"), { statusCode: 409, code: "CODE_EXISTS" });
  await db.collection(PARTICIPANTS).doc(code).set({ code, status: "active", dayOverride: null, completedDays: [], createdAt: now(), joinedAt: null, lastSeenAt: null });
  return adminOverview(body);
}
async function adminUpdateParticipant(body) {
  requireAdmin(body);
  const code = normalizeCode(body.participantCode);
  const participant = await readParticipant(code);
  if (!participant) throw Object.assign(new Error("参与编号不存在。"), { statusCode: 404, code: "PARTICIPANT_NOT_FOUND" });
  const update = { updatedAt: now() };
  if (body.status === "active" || body.status === "inactive") update.status = body.status;
  if (body.dayOverride === null || body.dayOverride === "") update.dayOverride = null;
  else if (body.dayOverride !== undefined) update.dayOverride = clampDay(body.dayOverride);
  await db.collection(PARTICIPANTS).doc(code).update(update);
  return adminOverview(body);
}
async function adminResetParticipant(body) {
  requireAdmin(body);
  const code = normalizeCode(body.participantCode);
  const participant = await readParticipant(code);
  if (!participant) throw Object.assign(new Error("参与编号不存在。"), { statusCode: 404, code: "PARTICIPANT_NOT_FOUND" });
  await Promise.all([
    db.collection(CHECKINS).where({ participantCode: code }).remove(),
    db.collection(PARTICIPANTS).doc(code).update({ completedDays: [], joinedAt: null, lastSeenAt: null, latestCompletionAt: null, dayOverride: null, updatedAt: now() }),
  ]);
  return adminOverview(body);
}
async function adminDeleteParticipant(body) {
  requireAdmin(body);
  const code = normalizeCode(body.participantCode);
  const participant = await readParticipant(code);
  if (!participant) throw Object.assign(new Error("参与编号不存在。"), { statusCode: 404, code: "PARTICIPANT_NOT_FOUND" });
  await Promise.all([
    db.collection(CHECKINS).where({ participantCode: code }).remove(),
    db.collection(PARTICIPANTS).doc(code).remove(),
  ]);
  return adminOverview(body);
}
async function adminDeleteParticipants(body) {
  requireAdmin(body);
  const codes = [...new Set(Array.isArray(body.participantCodes) ? body.participantCodes.map(normalizeCode) : [])];
  if (!codes.length || codes.length > 100 || codes.some((code) => !/^[A-Z0-9-]{3,24}$/.test(code))) throw Object.assign(new Error("请选择有效的参与编号。"), { statusCode: 400, code: "INVALID_CODES" });
  const existing = await Promise.all(codes.map(readParticipant));
  if (existing.some((item) => !item)) throw Object.assign(new Error("部分参与编号不存在，请刷新后重试。"), { statusCode: 404, code: "PARTICIPANT_NOT_FOUND" });
  await Promise.all(codes.flatMap((code) => [db.collection(CHECKINS).where({ participantCode: code }).remove(), db.collection(PARTICIPANTS).doc(code).remove()]));
  return adminOverview(body);
}

const actions = {
  "participant.join": joinParticipant,
  "participant.refresh": refreshAccess,
  "participant.complete": completeDay,
  "admin.overview": adminOverview,
  "admin.setDay": adminSetDay,
  "admin.updateCampaign": adminUpdateCampaign,
  "admin.generate": adminGenerate,
  "admin.addCode": adminAddCode,
  "admin.updateParticipant": adminUpdateParticipant,
  "admin.resetParticipant": adminResetParticipant,
  "admin.deleteParticipant": adminDeleteParticipant,
  "admin.deleteParticipants": adminDeleteParticipants,
};

function corsHeaders(req) {
  const origin = req.headers.origin;
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://wshhh1124.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function sendJson(req, res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req) });
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) { bytes += chunk.length; if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error("请求内容过大。"), { statusCode: 413, code: "BODY_TOO_LARGE" }); chunks.push(chunk); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("请求格式不正确。"), { statusCode: 400, code: "INVALID_JSON" }); }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, corsHeaders(req)); res.end(); return; }
  if (req.method === "GET" && (req.url === "/" || req.url?.startsWith("/health"))) { sendJson(req, res, 200, { ok: true, service: "zhiyu-api", environment: "cloud1-5gbfrdn5944358bc" }); return; }
  if (req.method !== "POST") { sendJson(req, res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "仅支持 POST 请求。" }); return; }
  try {
    const body = await readBody(req); const handler = actions[body.action];
    if (!handler) throw Object.assign(new Error("未知操作。"), { statusCode: 404, code: "UNKNOWN_ACTION" });
    const data = await handler(body);
    sendJson(req, res, 200, { ok: true, data });
  } catch (error) {
    console.error(error);
    sendJson(req, res, error.statusCode || 500, { ok: false, code: error.code || "INTERNAL_ERROR", message: error.statusCode ? error.message : "后台暂时不可用，请稍后再试。" });
  }
});

server.listen(9000, "0.0.0.0", () => console.log("zhiyu-api listening on 9000"));
