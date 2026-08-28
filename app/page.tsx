"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArtworkDraft,
  clearExperienceData,
  createExperienceBackup,
  DayRecord,
  dayPlans,
  deleteArtworkDraft,
  getArtworkDraft,
  getDayRecords,
  getParticipantProfile,
  ParticipantProfile,
  restoreExperienceBackup,
  saveArtworkDraft,
  saveDayRecord,
  saveParticipantProfile,
} from "./experience";
import TeacherDashboard from "./TeacherDashboard";
import { joinWithParticipantCode, refreshParticipantAccess, syncParticipantCompletion } from "./cloudBackend";

const palette = [
  "#1F2933", "#53606B", "#9AA3AA", "#D7DADD", "#F4EFE8", "#FFFFFF",
  "#5B2333", "#9E3346", "#D85B67", "#F39AA3", "#F6C6C9", "#FFE3E0",
  "#7A3521", "#B85B32", "#E9854B", "#F4B66F", "#F8D7A4", "#FFF0D3",
  "#7A641C", "#B59A2E", "#E3C94A", "#F5DF75", "#F8EDAB", "#FFF7D6",
  "#264D3E", "#3F765D", "#69A47E", "#9AC59F", "#C6DEC2", "#E6F0DD",
  "#203D66", "#3568A2", "#5D91C8", "#8FB9DE", "#BED8EB", "#E2EFF7",
];
const brushOptions = [
  { id: "pencil", label: "铅笔", hint: "清晰细腻" },
  { id: "oil", label: "油画", hint: "浓厚饱满" },
  { id: "watercolor", label: "水彩", hint: "轻透晕染" },
  { id: "eraser", label: "橡皮擦", hint: "擦去画面" },
] as const;
const brushSizes = [{ value: 4, label: "细" }, { value: 10, label: "中" }, { value: 20, label: "粗" }, { value: 34, label: "特粗" }];
const feelingsList = ["平静", "紧绷", "混乱", "疲惫", "松动", "期待", "无法命名"];
const focusList = ["色彩", "线条", "留白", "重叠", "边缘"];
const responseOptions = [
  { id: "seen", label: "先看见我", hint: "如实复述，不解释" },
  { id: "question", label: "问我一个问题", hint: "给我继续探索的入口" },
  { id: "encourage", label: "给我一点鼓励", hint: "肯定我完成表达的过程" },
  { id: "quiet", label: "暂时不回应", hint: "允许作品只是它自己" },
] as const;
const shareOptions = [
  { id: "done", label: "只显示完成", hint: "不放作品，保留完全隐私" },
  { id: "artTitle", label: "作品＋标题", hint: "放入完整画面，不显示感受" },
  { id: "artStory", label: "作品＋一句话", hint: "画面、标题和你的自述" },
] as const;

type BrushType = (typeof brushOptions)[number]["id"];
type Phase = "create" | "reflect" | "result" | "gallery";
type ShareMode = (typeof shareOptions)[number]["id"];
type SaveStatus = "idle" | "saving" | "saved" | "failed";
type CloudSyncStatus = "idle" | "syncing" | "synced" | "failed";
type UndoSnapshot = { image: ImageData; started: boolean; importedArtwork: boolean; previewUrl: string };
type SaveImagePreview = { url: string; label: string } | null;

function padDay(day: number) { return String(day).padStart(2, "0"); }
function downloadDataUrl(url: string, filename: string) { const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); }
function downloadTextFile(content: string, filename: string) { const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" })); downloadDataUrl(url, filename); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }
function drawImageContain(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawnWidth = image.width * scale; const drawnHeight = image.height * scale;
  context.drawImage(image, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}
function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const chars = [...text]; let line = ""; let lineIndex = 0;
  for (const char of chars) { const test = line + char; if (context.measureText(test).width > maxWidth && line) { context.fillText(line, x, y + lineIndex * lineHeight); line = char; lineIndex += 1; if (lineIndex >= maxLines) return; } else line = test; }
  if (lineIndex < maxLines) context.fillText(line, x, y + lineIndex * lineHeight);
}
function localDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function formatLocalTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const undoSnapshot = useRef<UndoSnapshot | null>(null);
  const draftTimer = useRef<number | null>(null);
  const [teacherMode, setTeacherMode] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [participantIdInput, setParticipantIdInput] = useState("");
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [codeError, setCodeError] = useState("");
  const [switchCode, setSwitchCode] = useState("");
  const [cloudMaxDay, setCloudMaxDay] = useState(1);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("idle");
  const [phase, setPhase] = useState<Phase>("create");
  const [day, setDay] = useState(1);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [storageNote, setStorageNote] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [color, setColor] = useState(palette[0]);
  const [brushType, setBrushType] = useState<BrushType>("pencil");
  const [brush, setBrush] = useState(10);
  const [started, setStarted] = useState(false);
  const [importedArtwork, setImportedArtwork] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [title, setTitle] = useState("");
  const [feelings, setFeelings] = useState<string[]>([]);
  const [energy, setEnergy] = useState(3);
  const [focus, setFocus] = useState("色彩");
  const [responseMode, setResponseMode] = useState("seen");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [shareMode, setShareMode] = useState<ShareMode>("artTitle");
  const [sharePreviewUrl, setSharePreviewUrl] = useState("");
  const [shareGenerating, setShareGenerating] = useState(false);
  const [shareHint, setShareHint] = useState("");
  const [saveImagePreview, setSaveImagePreview] = useState<SaveImagePreview>(null);
  const plan = dayPlans[day - 1];
  const energyText = useMemo(() => ["", "很轻", "偏低", "中等", "在流动", "很充沛"][energy], [energy]);
  const completed = records.length;
  const allComplete = completed === 7;
  const maxUnlockedDay = Math.min(7, Math.max(1, cloudMaxDay));
  const nextIncompleteDay = dayPlans.find((item) => !records.some((record) => record.day === item.day))?.day ?? 7;
  const sortedRecords = useMemo(() => [...records].sort((a, b) => a.day - b.day), [records]);
  const feelingSummary = useMemo(() => {
    const counts = new Map<string, number>(); records.flatMap((record) => record.feelings).forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([item]) => item);
  }, [records]);

  useEffect(() => {
    setTeacherMode(new URLSearchParams(window.location.search).has("teacher"));
  }, []);

  useEffect(() => {
    if (!unlocked || phase !== "create") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
    const context = canvas.getContext("2d"); context?.scale(ratio, ratio); if (!context) return;
    context.fillStyle = "#FBF8F3"; context.fillRect(0, 0, rect.width, rect.height); context.lineCap = "round"; context.lineJoin = "round";
    if (previewUrl) loadImage(previewUrl).then((image) => context.drawImage(image, 0, 0, rect.width, rect.height)).catch(() => undefined);
  }, [unlocked, phase, day, previewUrl]);

  useEffect(() => {
    const hasUnsavedWork = (phase === "create" && started) || phase === "reflect";
    if (!hasUnsavedWork) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase, started]);

  useEffect(() => {
    if (!saveImagePreview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [saveImagePreview]);

  useEffect(() => () => { if (draftTimer.current) window.clearTimeout(draftTimer.current); }, []);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    const cleanParticipantId = participantIdInput.trim();
    if (cleanParticipantId.length < 3) { setCodeError("请输入老师单独发给你的参与编号。"); return; }
    setCodeError(""); setSwitchCode("");
    try {
      const access = await joinWithParticipantCode(cleanParticipantId);
      const saved = await getDayRecords(); const existingProfile = await getParticipantProfile();
      if (existingProfile && existingProfile.participantId !== access.code) { setSwitchCode(access.code); setCodeError(`这台设备保存着旧编号 ${existingProfile.participantId} 的本机记录。你可以先下载备份，再清除旧记录并改用 ${access.code}。`); return; }
      const earliestCompletion = [...saved].sort((a, b) => a.completedAt.localeCompare(b.completedAt))[0]?.completedAt;
      const activeProfile: ParticipantProfile = existingProfile
        ? existingProfile
        : { id: "profile", participantId: access.code, startedAt: earliestCompletion ?? access.joinedAt ?? new Date().toISOString() };
      await saveParticipantProfile(activeProfile); setProfile(activeProfile); setRecords(saved); setCloudMaxDay(access.currentDay); setUnlocked(true);
      const availableDay = access.currentDay;
      const next = dayPlans.find((item) => item.day <= availableDay && !saved.some((record) => record.day === item.day))?.day;
      if (saved.length || !next) { setDay(next ?? Math.min(availableDay, 7)); setPhase("gallery"); }
      else await resetFields(next);
    }
    catch (caught) { setCodeError(caught instanceof Error ? caught.message : "暂时无法验证参与编号，请稍后重试。"); }
  }
  async function clearLocalAndSwitch(downloadBackup: boolean) {
    if (!switchCode) return;
    const confirmed = window.confirm(`将永久清除这台设备上旧编号的作品、草稿和本机记录，然后改用 ${switchCode}。${downloadBackup ? "网页会先下载一份备份。" : "清除后无法恢复。"}确定继续吗？`);
    if (!confirmed) return;
    setCodeError("");
    try {
      if (downloadBackup) {
        const backup = await createExperienceBackup();
        downloadTextFile(JSON.stringify(backup), `织屿旧记录备份-${localDateKey(new Date())}.json`);
      }
      const access = await joinWithParticipantCode(switchCode);
      await clearExperienceData();
      const activeProfile: ParticipantProfile = { id: "profile", participantId: access.code, startedAt: access.joinedAt ?? new Date().toISOString() };
      await saveParticipantProfile(activeProfile);
      setProfile(activeProfile); setRecords([]); setCloudMaxDay(access.currentDay); setParticipantIdInput(access.code); setSwitchCode(""); setUnlocked(true); setStorageNote("旧记录已从这台设备清除，已经切换到新的参与编号。");
      await resetFields(1);
    } catch (caught) { setCodeError(caught instanceof Error ? caught.message : "清除或更换编号失败，请稍后重试。"); }
  }
  async function refreshCloudAccess() {
    if (!profile) return;
    try { const access = await refreshParticipantAccess(profile.participantId); setCloudMaxDay(access.currentDay); setStorageNote(`老师目前开放到 Day ${padDay(access.currentDay)}，进度已刷新。`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "开放进度刷新失败，请稍后重试。"); }
  }
  async function syncCompletion(record: DayRecord) {
    if (!profile) return;
    setCloudSyncStatus("syncing");
    try { await syncParticipantCompletion(profile.participantId, record.day, record.completedAt); setCloudSyncStatus("synced"); setStorageNote(`Day ${padDay(record.day)} 已保存到本机，完成记录也已同步给老师。`); }
    catch { setCloudSyncStatus("failed"); setStorageNote(`Day ${padDay(record.day)} 已安全保存在本机，但完成记录尚未同步。请检查网络后重试。`); }
  }
  function point(event: PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function captureUndoSnapshot() {
    const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (!canvas || !context) return;
    undoSnapshot.current = { image: context.getImageData(0, 0, canvas.width, canvas.height), started, importedArtwork, previewUrl };
    setUndoAvailable(true);
  }
  function undoLastChange() {
    const canvas = canvasRef.current; const context = canvas?.getContext("2d"); const snapshot = undoSnapshot.current;
    if (!canvas || !context || !snapshot) return;
    context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.shadowBlur = 0; context.putImageData(snapshot.image, 0, 0); context.restore();
    setStarted(snapshot.started); setImportedArtwork(snapshot.importedArtwork); setPreviewUrl(snapshot.previewUrl); undoSnapshot.current = null; setUndoAvailable(false); scheduleDraftSave(snapshot.started, snapshot.importedArtwork);
  }
  function scheduleDraftSave(shouldSave = true, importedOverride = importedArtwork) {
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    if (!shouldSave) return;
    draftTimer.current = window.setTimeout(async () => {
      const canvas = canvasRef.current; if (!canvas) return;
      const draft: ArtworkDraft = { day, image: canvas.toDataURL("image/jpeg", .82), importedArtwork: importedOverride, updatedAt: new Date().toISOString() };
      try { await saveArtworkDraft(draft); setStorageNote("当前画面已自动保存为本机草稿。"); }
      catch { setStorageNote("自动保存草稿失败，请先下载或导出备份保存作品。"); }
    }, 450);
  }
  function begin(event: PointerEvent<HTMLCanvasElement>) { const context = canvasRef.current?.getContext("2d"); if (!context) return; captureUndoSnapshot(); drawing.current = true; setStarted(true); event.currentTarget.setPointerCapture(event.pointerId); const current = point(event); context.beginPath(); context.moveTo(current.x, current.y); }
  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return; const context = canvasRef.current?.getContext("2d"); if (!context) return;
    const current = point(event); const pressure = event.pressure > 0 ? .72 + event.pressure * .28 : 1;
    const style = { pencil: { width: brush * .55, alpha: .72, blur: 0 }, oil: { width: brush * 1.1, alpha: .94, blur: 0 }, watercolor: { width: brush * 1.55, alpha: .18, blur: brush * .42 }, eraser: { width: brush * 1.65, alpha: 1, blur: 0 } }[brushType];
    const strokeColor = brushType === "eraser" ? "#FBF8F3" : color;
    context.globalCompositeOperation = "source-over"; context.strokeStyle = strokeColor; context.lineWidth = style.width * pressure; context.globalAlpha = style.alpha; context.shadowColor = strokeColor; context.shadowBlur = style.blur; context.lineTo(current.x, current.y); context.stroke();
  }
  function endDrawing() { if (!drawing.current) return; drawing.current = false; scheduleDraftSave(true); }
  function clearCanvas() {
    const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (!canvas || !context || (!started && !previewUrl)) return;
    if (!window.confirm("确定清空当前画面吗？清空后仍可以撤销一次。")) return;
    captureUndoSnapshot(); context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.shadowBlur = 0; context.fillStyle = "#FBF8F3"; context.fillRect(0, 0, canvas.width, canvas.height); context.restore(); setStarted(false); setImportedArtwork(false); setPreviewUrl("");
    deleteArtworkDraft(day).catch(() => undefined);
  }
  async function importArtwork(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return;
    if (!file.type.startsWith("image/")) { setError("请选择一张图片文件。"); return; }
    if (file.size > 20 * 1024 * 1024) { setError("图片超过20MB，请先在相册里缩小后再选择。"); return; }
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(objectUrl); const canvas = canvasRef.current; const context = canvas?.getContext("2d");
      if (!canvas || !context) throw new Error("Canvas unavailable");
      captureUndoSnapshot();
      const rect = canvas.getBoundingClientRect();
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.shadowBlur = 0; context.fillStyle = "#FBF8F3"; context.fillRect(0, 0, canvas.width, canvas.height); context.restore();
      context.save(); context.globalAlpha = 1; context.shadowBlur = 0; drawImageContain(context, image, 0, 0, rect.width, rect.height); context.restore();
      setStarted(true); setImportedArtwork(true); setPreviewUrl(canvas.toDataURL("image/jpeg", .86)); setError("");
      setStorageNote("纸上作品已导入当前画布，只在这台设备内处理；你还可以继续使用网页画笔补充。");
      scheduleDraftSave(true, true);
    } catch { setError("这张图片暂时无法读取，请换一张 JPG、PNG 或相册照片再试。"); }
    finally { URL.revokeObjectURL(objectUrl); }
  }
  function finishPainting() { setPreviewUrl(canvasRef.current?.toDataURL("image/jpeg", .86) ?? ""); setPhase("reflect"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function toggleFeeling(item: string) { setFeelings((current) => current.includes(item) ? current.filter((value) => value !== item) : current.length < 3 ? [...current, item] : current); }
  function mirrorFeedback() {
    const feelingText = feelings.length ? feelings.join("、") : "还不急着命名的感受";
    const opening = `你把今天的作品叫作《${title.trim()}》。你留下了${feelingText}，此刻的能量感是“${energyText}”，最想让人留意的是${focus}。`;
    const endings: Record<string, string> = { seen: `我先把这些如实放在这里，不急着替你解释。${focus}已经替此刻的你留下了一点痕迹。`, question: focus === "留白" ? "如果这片留白可以多说一句，它会想为你保留什么？" : `如果画面里的${focus}可以移动一次，它更想靠近哪里，还是离开什么？`, encourage: "你不需要先把感受说清楚，才有资格表达。愿意落下这些痕迹，本身已经是在靠近自己。", quiet: "这幅作品先停在这里。没有追加解释，也允许它暂时只是它自己。" };
    return `${opening}${endings[responseMode]}`;
  }
  async function completeReflection() {
    if (!title.trim()) { setError("先为作品取一个只属于今天的名字。"); return; }
    const record: DayRecord = { day, title: title.trim(), image: previewUrl, feelings, energy, focus, responseMode, note: note.trim(), completedAt: new Date().toISOString() };
    setError(""); setSaveStatus("saving");
    try {
      await saveDayRecord(record); deleteArtworkDraft(day).catch(() => undefined);
      setRecords((current) => [...current.filter((item) => item.day !== day), record]); setSaveStatus("saved"); setStorageNote(`Day ${padDay(day)} 已确认保存在本机，正在同步完成记录。`); setPhase("result");
    } catch { setSaveStatus("failed"); setError("保存失败，作品尚未进入作品册。请重试，或先返回画布下载备份。"); return; }
    void syncCompletion(record);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function resetFields(targetDay: number) {
    if (targetDay > maxUnlockedDay && !records.some((record) => record.day === targetDay)) { setStorageNote(`Day ${padDay(targetDay)} 还没有由老师开放。开放后刷新网页即可进入。`); return; }
    setDay(targetDay); setPhase("create"); setStarted(false); setImportedArtwork(false); setPreviewUrl(""); setTitle(""); setFeelings([]); setEnergy(3); setFocus("色彩"); setResponseMode("seen"); setNote(""); setError(""); setSaveStatus("idle"); setSharePreviewUrl(""); setShareHint(""); setShareMode("artTitle"); setSaveImagePreview(null); undoSnapshot.current = null; setUndoAvailable(false);
    try { const draft = await getArtworkDraft(targetDay); if (draft) { setPreviewUrl(draft.image); setStarted(true); setImportedArtwork(draft.importedArtwork); setStorageNote(`已恢复 Day ${padDay(targetDay)} 的本机草稿。`); } }
    catch { setStorageNote("没有读到本机草稿，可以继续创作；完成后建议导出备份。"); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openDay(targetDay: number) {
    const saved = records.find((record) => record.day === targetDay);
    if (!saved && targetDay > maxUnlockedDay) { setStorageNote(`Day ${padDay(targetDay)} 还没有由老师开放。`); return; }
    if (!saved) { void resetFields(targetDay); return; }
    setDay(saved.day); setTitle(saved.title); setPreviewUrl(saved.image); setFeelings(saved.feelings); setEnergy(saved.energy); setFocus(saved.focus); setResponseMode(saved.responseMode); setNote(saved.note); setSharePreviewUrl(""); setShareMode("artTitle"); setSaveImagePreview(null); setSaveStatus("saved"); setPhase("result"); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showGallery() {
    if (((phase === "create" && started) || phase === "reflect") && !window.confirm("当前内容还没有正式保存。草稿已尽量自动保留，确定先离开吗？")) return;
    setPhase("gallery"); setError(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openImageSavePreview(url: string, label: string) {
    if (!url) return;
    setSaveImagePreview({ url, label });
  }

  async function shareCheckinReceipt() {
    const record = records.find((item) => item.day === day); if (!record || !profile) return;
    const text = `织屿7日打卡回执\n参与编号：${profile.participantId}\nDay ${padDay(day)} · ${plan.shortTitle}\n完成时间：${formatLocalTime(record.completedAt)}\n累计完成：${completed}/7\n作品：未附（由参与者自行决定是否分享）`;
    if (navigator.share) { try { await navigator.share({ title: `Day ${padDay(day)} 打卡回执`, text }); return; } catch { /* participant cancelled */ } }
    try { await navigator.clipboard.writeText(text); setStorageNote("打卡回执已复制。请粘贴到活动群或发给老师，作为完成记录。"); }
    catch { setError("当前浏览器无法复制打卡回执，请截屏完成页发给老师。"); }
  }

  async function exportBackup() {
    try { const backup = await createExperienceBackup(); downloadTextFile(JSON.stringify(backup), `织屿7日作品备份-${profile?.participantId || "未编号"}-${localDateKey(new Date())}.json`); setStorageNote("备份已经下载。请保留这个文件；换设备时可在作品册中导入恢复。"); }
    catch { setError("备份生成失败，请先逐日下载作品图片。"); }
  }
  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return;
    if (file.size > 60 * 1024 * 1024) { setError("备份文件超过60MB，暂时无法导入。"); return; }
    try {
      const backup = await restoreExperienceBackup(await file.text()); const restoredProfile = backup.profile;
      setRecords(backup.days); if (restoredProfile) { setProfile(restoredProfile); setParticipantIdInput(restoredProfile.participantId); }
      setPhase("gallery"); setError(""); setStorageNote(`已恢复 ${backup.days.length} 天作品与本机草稿。`);
    } catch { setError("这不是有效的织屿作品备份文件，请重新选择之前下载的 JSON 文件。"); }
  }

  async function makeShareCard() {
    setShareGenerating(true); setError("");
    try {
      const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1440;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas unavailable");
      context.fillStyle = "#F1EEE8"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#DCE7E3"; context.beginPath(); context.arc(1018, 70, 250, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#E9CFC5"; context.beginPath(); context.arc(40, 1400, 230, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#2F5D62"; context.font = "600 28px sans-serif"; context.fillText("织屿心理 · 7日表达性艺术探索", 76, 92);
      context.fillStyle = "#FFFFFF"; context.beginPath(); context.roundRect(800, 54, 204, 64, 32); context.fill();
      context.fillStyle = "#2F5D62"; context.font = "600 25px sans-serif"; context.textAlign = "center"; context.fillText(`DAY ${padDay(day)} / 07`, 902, 96); context.textAlign = "left";
      context.fillStyle = "#1F2B2A"; context.font = '700 62px "Songti SC", serif';
      wrapText(context, shareMode === "done" ? "我完成了今天的表达练习" : `《${title.trim()}》`, 76, 190, 920, 72, 2);
      context.fillStyle = "#2F5D62"; context.font = "500 26px sans-serif"; context.fillText(plan.shortTitle, 78, 278);

      if (shareMode === "done") {
        context.fillStyle = "rgba(255,255,255,.7)"; context.beginPath(); context.roundRect(76, 340, 928, 720, 38); context.fill();
        context.strokeStyle = "rgba(47,93,98,.28)"; context.lineWidth = 3; context.setLineDash([12, 14]); context.beginPath(); context.ellipse(540, 680, 280, 180, -.14, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
        context.fillStyle = "#2F5D62"; context.font = '700 116px "Songti SC", serif'; context.textAlign = "center"; context.fillText(padDay(day), 540, 720); context.font = '36px "Songti SC", serif'; context.fillText("今天，我为自己留下了一点时间", 540, 815); context.textAlign = "left";
      } else {
        const image = await loadImage(previewUrl);
        context.fillStyle = "rgba(255,255,255,.82)"; context.beginPath(); context.roundRect(76, 326, 928, 808, 34); context.fill();
        context.save(); context.beginPath(); context.roundRect(104, 354, 872, 752, 22); context.clip();
        context.fillStyle = "#FBF8F3"; context.fillRect(104, 354, 872, 752); drawImageContain(context, image, 104, 354, 872, 752); context.restore();
      }

      context.fillStyle = "#1F2B2A"; context.font = '34px "Songti SC", serif';
      if (shareMode === "artStory") wrapText(context, note.trim() || `此刻更接近：${feelings.join("、") || "还不急着命名"}`, 78, 1206, 920, 48, 2);
      else if (shareMode === "artTitle") context.fillText("这是我今天留下的一点痕迹。", 78, 1210);
      else context.fillText("完成，不等于必须公开。", 78, 1210);
      context.strokeStyle = "rgba(31,43,42,.16)"; context.lineWidth = 2; context.beginPath(); context.moveTo(78, 1312); context.lineTo(1002, 1312); context.stroke();
      context.fillStyle = "#667270"; context.font = "23px sans-serif"; context.fillText("由我决定，被看见到哪一步", 78, 1360); context.textAlign = "right"; context.fillText("表达，不需要被分析", 1002, 1360); context.textAlign = "left";
      setSharePreviewUrl(canvas.toDataURL("image/png"));
      window.setTimeout(() => document.getElementById("share-card-preview")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    } catch { setError("分享卡没有生成成功，请重新选择一种卡片后再试。即使失败，你的原作品也不会丢失。"); }
    finally { setShareGenerating(false); }
  }
  async function shareGeneratedCard() {
    if (!sharePreviewUrl) return;
    const blob = await (await fetch(sharePreviewUrl)).blob(); const file = new File([blob], `Day${day}-${title.trim() || plan.shortTitle}-分享卡.png`, { type: "image/png" });
    setShareHint("");
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `Day ${day} · ${plan.shortTitle}` }); return; }
      catch (caught) { if (caught instanceof DOMException && caught.name === "AbortError") return; }
    }
    const inWeChat = /MicroMessenger/i.test(navigator.userAgent);
    const hint = inWeChat
      ? "微信内暂时不能由网页直接代发图片：请长按保存分享卡，再返回聊天选择这张图片发送。"
      : "当前浏览器不能把图片直接交给微信：请长按保存分享卡，再从微信相册选择发送。";
    setShareHint(hint); setStorageNote(hint); openImageSavePreview(sharePreviewUrl, "微信分享卡");
  }
  async function downloadArchive() {
    if (!allComplete) return; const canvas = document.createElement("canvas"); canvas.width = 1240; canvas.height = 3150; const context = canvas.getContext("2d"); if (!context) return;
    context.fillStyle = "#F1EEE8"; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#2F5D62"; context.fillRect(70, 70, 1100, 16);
    context.fillStyle = "#1F2B2A"; context.font = "700 76px serif"; context.fillText("我的7日内在作品档案", 70, 190); context.fillStyle = "#667270"; context.font = "28px sans-serif"; context.fillText("七次表达并置在一起，不作诊断，也不替你解释。", 70, 245);
    for (let index = 0; index < sortedRecords.length; index += 1) { const record = sortedRecords[index]; const x = index % 2 === 0 ? 70 : 640; const y = 330 + Math.floor(index / 2) * 590; context.fillStyle = "#FBF8F3"; context.beginPath(); context.roundRect(x, y, 530, 530, 24); context.fill(); const image = await loadImage(record.image); context.save(); context.beginPath(); context.roundRect(x + 20, y + 20, 490, 390, 18); context.clip(); context.drawImage(image, x + 20, y + 20, 490, 390); context.restore(); context.fillStyle = "#2F5D62"; context.font = "600 22px sans-serif"; context.fillText(`DAY ${padDay(record.day)} · ${dayPlans[record.day - 1].shortTitle}`, x + 24, y + 452); context.fillStyle = "#1F2B2A"; context.font = "600 30px serif"; wrapText(context, `《${record.title}》`, x + 24, y + 495, 480, 34, 1); }
    context.fillStyle = "#E7DED4"; context.beginPath(); context.roundRect(70, 2760, 1100, 290, 24); context.fill(); context.fillStyle = "#2F5D62"; context.font = "600 25px sans-serif"; context.fillText("回看线索（来自你的自述，不是心理分析）", 100, 2820); context.fillStyle = "#1F2B2A"; context.font = "34px serif"; wrapText(context, `这七天反复出现的感受词：${feelingSummary.join("、") || "尚未命名"}。能量记录从 ${sortedRecords[0].energy} 到 ${sortedRecords[6].energy}。此刻你最想把哪一个元素带回生活？`, 100, 2880, 1030, 48, 3); context.fillStyle = "#667270"; context.font = "22px sans-serif"; context.fillText("织屿心理 · 表达性艺术探索不是心理咨询或治疗", 70, 3110);
    downloadDataUrl(canvas.toDataURL("image/png"), "我的7日内在作品档案.png");
  }

  if (teacherMode) return <TeacherDashboard />;
  if (!unlocked) return <main className="gate-shell"><section className="gate-card"><span className="gate-badge">织屿心理 · 伙伴体验版</span><h1>把自己<br />画回来</h1><p>一个用颜色、书写和觉察慢慢靠近自己的7日表达性艺术探索。</p><div className="gate-facts"><span>每天约5–8分钟</span><span>完成7幅个人作品</span><span>不要求公开分享</span></div><details className="program-intro"><summary>先了解这7天会发生什么</summary><p>老师会按本期活动进度开放主题。你可以直接在网页绘画，也可以上传纸上作品；完成后由你为作品命名并选择希望获得的回应。</p><ol>{dayPlans.map((item) => <li key={item.day}><strong>Day {padDay(item.day)}</strong><span>{item.shortTitle}</span></li>)}</ol><small>这是一项心理教育与自我探索活动，不提供诊断或治疗。任何一天都可以暂停、跳过或不公开作品。</small></details><form onSubmit={unlock}><label htmlFor="participant-id">参与编号</label><input className="participant-input" id="participant-id" autoComplete="off" maxLength={24} value={participantIdInput} onChange={(event) => { setParticipantIdInput(event.target.value.toUpperCase()); setSwitchCode(""); setCodeError(""); }} placeholder="例如 ZY-7K3MP" /><small className="field-help">输入老师单独发给你的编号，不要填写真实姓名。</small>{codeError && <small role="alert">{codeError}</small>}{switchCode && <div className="switch-code-actions"><button type="button" className="outline" onClick={() => clearLocalAndSwitch(true)}>先备份，再更换编号</button><button type="button" className="danger" onClick={() => clearLocalAndSwitch(false)}>直接清除旧记录并更换</button></div>}<button type="submit">验证编号并进入 <span>→</span></button></form><div className="privacy-note"><strong>作品只保存在当前设备</strong><span>后台只记录参与编号、开放进度和完成时间，不上传你的作品、感受词或觉察文字。</span></div></section></main>;

  return <main className="app-shell">
    <header className="topbar"><button className="brand-mark" onClick={showGallery}>织屿心理</button><div><span>{completed}/7 已完成 · 开放至 Day {maxUnlockedDay}</span><button onClick={refreshCloudAccess}>刷新开放</button><button onClick={showGallery}>7日作品册</button></div></header>
    {storageNote && <div className="storage-banner">{storageNote}</div>}{error && <div className="error-banner" role="alert">{error}</div>}
    {phase === "create" && <><section className="intro-card"><div className="eyebrow">DAY {padDay(day)} / 07 · {plan.shortTitle}</div><h1>{plan.title}</h1><p>{plan.prompt}</p><div className="starter-note">起笔提示：{plan.starter}</div><div className="time-note"><span>约5–8分钟</span><span>没有标准答案</span><span>不分析画作</span></div></section><section className="practice-guide" aria-label="今日练习说明"><span>今天我们在练习</span><h2>{plan.practiceAim}</h2><p>{plan.context}</p><div className="guide-grid"><div><strong>开始前</strong><p>{plan.prepare}</p></div><div><strong>你的选择权</strong><p>{plan.permission}</p></div></div><details className="pause-guide"><summary>如果此刻有点难受，先暂停一下</summary><p>睁开眼睛，看看周围，依次找到3样看得见的东西、2种听得到的声音和1处身体与地面或椅子的接触。等注意回到当下后，再决定继续、改画轻一点的主题，或今天就停在这里。</p><small>如果不适持续或明显加重，请停止练习，并联系可信任的人或合适的专业支持。</small></details></section><section className="studio" aria-label="绘画工作台"><div className="creation-source"><div><span>选择创作方式</span><strong>{importedArtwork ? "纸上作品已经导入" : "网页直接画，或上传真实手绘"}</strong><small>{importedArtwork ? "可以继续用下面的画笔在照片上补充" : "拍下纸上的画，也可以从手机相册选择"}</small></div><label className={importedArtwork ? "imported" : ""}><input type="file" accept="image/*" onChange={importArtwork} /><span>{importedArtwork ? "更换图片" : "拍照 / 选择图片"}</span></label><p>图片仅导入当前画布，在本机处理，不会上传到织屿。</p></div><div className="canvas-frame"><canvas ref={canvasRef} className="art-canvas" aria-label="用手指或鼠标自由绘画" onPointerDown={begin} onPointerMove={draw} onPointerUp={endDrawing} onPointerCancel={endDrawing} />{!started && <div className="canvas-hint" aria-hidden="true"><span />从这里落下第一笔</div>}</div><div className="art-tools"><div className="tool-section"><div className="tool-heading"><span>画材</span><div className="canvas-history"><button disabled={!undoAvailable} onClick={undoLastChange}>撤销一步</button><button onClick={clearCanvas}>清空画布</button></div></div><div className="brush-types" aria-label="选择画材">{brushOptions.map((item) => <button key={item.id} className={brushType === item.id ? "selected" : ""} onClick={() => setBrushType(item.id)} aria-pressed={brushType === item.id}><i className={`brush-stroke ${item.id}`} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}</div></div><div className="tool-section"><div className="tool-heading"><span>笔触粗细</span><small>{brushSizes.find((item) => item.value === brush)?.label}</small></div><div className="brush-sizes" aria-label="选择笔触粗细">{brushSizes.map((item) => <button key={item.value} className={brush === item.value ? "selected" : ""} onClick={() => setBrush(item.value)} aria-label={`${item.label}笔触`} aria-pressed={brush === item.value}><i style={{ width: Math.max(5, item.value * .62), height: Math.max(5, item.value * .62), background: brushType === "eraser" ? "#FBF8F3" : color }} /><span>{item.label}</span></button>)}</div></div><div className="tool-section"><div className="tool-heading"><span>色彩 · 36色</span><small>{brushType === "eraser" ? "切换颜色会继续保留橡皮擦" : "也可以自选"}</small></div><div className="palette" aria-label="选择画笔颜色">{palette.map((item) => <button key={item} className={`swatch ${color === item ? "selected" : ""}`} style={{ background: item }} aria-label={`选择颜色 ${item}`} onClick={() => setColor(item)} aria-pressed={color === item} />)}<label className="custom-color" aria-label="自选颜色"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>＋</span></label></div></div></div></section><section className="next-step"><div><span>{padDay(day)}</span><p>{plan.takeaway}</p></div><button className="primary-button" disabled={!started && !previewUrl} onClick={finishPainting}>完成这幅画 <span>→</span></button></section></>}
    {phase === "reflect" && <section className="reflection-flow"><button className="back-button" onClick={() => setPhase("create")}>← 回到画布</button><div className="art-preview"><img src={previewUrl} alt="刚刚完成的作品" /></div><div className="section-heading"><span>STEP 02</span><h2>由你来解释这幅画</h2><p>我们不会根据颜色或线条判断你的心理状态。回应只来自你愿意说出的部分。</p></div><label className="field"><span>{plan.reflectionLabel}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} placeholder={plan.titlePlaceholder} /></label><fieldset><legend>此刻更接近哪些感受？<small>最多选3个，也可以不命名</small></legend><div className="choice-cloud">{feelingsList.map((item) => <button type="button" key={item} className={feelings.includes(item) ? "active" : ""} onClick={() => toggleFeeling(item)}>{item}</button>)}</div></fieldset><label className="field range-field"><span>这幅作品现在有多少能量？<strong>{energyText}</strong></span><input type="range" min="1" max="5" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} /><div className="range-labels"><i>很轻</i><i>很充沛</i></div></label><fieldset><legend>你最想让人留意画面里的什么？</legend><div className="choice-cloud">{focusList.map((item) => <button type="button" key={item} className={focus === item ? "active" : ""} onClick={() => setFocus(item)}>{item}</button>)}</div></fieldset><label className="field"><span>如果愿意，再留下一句话<small>只保存在当前设备</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="我画到这里时，注意到……" /></label><fieldset><legend>今天希望怎样被回应？</legend><div className="response-grid">{responseOptions.map((item) => <button type="button" key={item.id} className={responseMode === item.id ? "active" : ""} onClick={() => setResponseMode(item.id)}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</div></fieldset><button className="primary-button" disabled={saveStatus === "saving"} onClick={completeReflection}>{saveStatus === "saving" ? "正在保存到本机作品册……" : saveStatus === "failed" ? "重新保存" : "保存并看看回应"} <span>→</span></button></section>}
    {phase === "result" && <section className="result-flow">
      <div className="completion-mark">{padDay(day)}</div><div className="eyebrow">今天的作品完成了</div><h1>《{title}》</h1>
      <div className="art-preview result-art"><img src={previewUrl} alt={title} /></div>
      <div className="mirror-card"><span>即时镜面回应 · 体验版</span><p>{mirrorFeedback()}</p><small>回应只复述你主动提供的信息，不分析颜色、符号或人格。</small></div>
      <div className="closing-card"><span>先把今天放回生活</span><p>{plan.closing}</p></div>
      <div className={`local-card ${saveStatus}`}><strong>{saveStatus === "saved" ? "已确认保存到本机作品册" : "正在确认保存状态"}</strong><p>{saveStatus === "saved" ? "作品已写入当前设备和浏览器，也可以在下面生成分享卡后保存图片。" : "只有本机数据库确认写入后，才会显示保存成功。"}</p><div className="cloud-sync-line"><span className={cloudSyncStatus}>{cloudSyncStatus === "syncing" ? "正在同步完成记录" : cloudSyncStatus === "synced" ? "完成记录已同步给老师" : cloudSyncStatus === "failed" ? "完成记录尚未同步" : "等待同步完成记录"}</span>{cloudSyncStatus === "failed" && records.find((item) => item.day === day) && <button onClick={() => { const record = records.find((item) => item.day === day); if (record) void syncCompletion(record); }}>重试同步</button>}</div><div className="local-actions"><button className="outline" onClick={shareCheckinReceipt}>发送打卡回执（备用）</button></div><small>云端只记录编号、天数和完成时间，不包含作品与感受；备用回执可在网络异常时发给老师。</small></div>
      <div className="share-card"><span>由你决定要不要分享</span><h2>先生成，再决定是否分享</h2><p>选择卡片里出现的内容。后两种都会嵌入你刚完成的完整画面，不会自动发群。</p><div className="share-options">{shareOptions.map((item) => <button key={item.id} className={shareMode === item.id ? "active" : ""} onClick={() => { setShareMode(item.id); setSharePreviewUrl(""); setShareHint(""); }}><strong>{item.label}</strong><small>{item.hint}</small></button>)}</div><button className="card-action" disabled={shareGenerating} onClick={makeShareCard}>{shareGenerating ? "正在生成……" : "生成卡片预览"}</button>{sharePreviewUrl && <div className="share-output" id="share-card-preview"><div className="share-output-heading"><span>生成结果 · 3:4 图片</span><strong>作品已经嵌入卡片</strong></div><img src={sharePreviewUrl} alt={`Day ${day} 自主分享卡预览`} /><p>确认内容和作品都正确后，再在这里保存图片或分享到微信。</p><div className="share-output-actions"><button onClick={() => openImageSavePreview(sharePreviewUrl, "分享卡")}>保存图片</button><button className="wechat-share-button" onClick={shareGeneratedCard}>分享到微信</button></div>{shareHint && <div className="wechat-share-hint" role="status">{shareHint}</div>}</div>}</div>
      {day < 7 && (day + 1 <= maxUnlockedDay ? <button className="primary-button" onClick={() => openDay(day + 1)}>{records.some((record) => record.day === day + 1) ? "查看" : "进入"} Day {padDay(day + 1)} <span>→</span></button> : <div className="locked-next"><strong>Day {padDay(day + 1)} 等待老师开放</strong><span>开放后点击顶部“刷新开放”即可进入；今天可以先在这里收束。</span></div>)}
      {day === 7 && allComplete && <button className="primary-button" onClick={downloadArchive}>下载7日个人作品档案 <span>↓</span></button>}
      <button className="primary-button secondary" onClick={showGallery}>查看7日作品册 <span>▦</span></button>
    </section>}
    {phase === "gallery" && <section className="gallery-flow">
      <div className="eyebrow">参与编号 {profile?.participantId} · 老师已开放至 Day {maxUnlockedDay}</div><h1>七天，不是七份作业</h1><p className="gallery-intro">每一天只留下一个当时的切片。未来章节由老师开放；作品不自动上传，由你决定分享范围。</p>
      <div className="progress-track"><i style={{ width: `${completed / 7 * 100}%` }} /></div><div className="progress-copy"><span>已完成 {completed} 天</span><span>{allComplete ? "可以收束了" : `还剩 ${7 - completed} 天`}</span></div>
      <div className="gallery-grid">{dayPlans.map((item) => { const record = records.find((saved) => saved.day === item.day); const locked = !record && item.day > maxUnlockedDay; return <button key={item.day} disabled={locked} className={record ? "complete" : locked ? "locked" : "pending"} onClick={() => openDay(item.day)}>{record ? <img src={record.image} alt={`Day ${item.day} 作品`} /> : <div className="empty-art"><span>{locked ? "锁" : padDay(item.day)}</span><i /></div>}<span>DAY {padDay(item.day)} · {item.shortTitle}</span><strong>{record ? `《${record.title}》` : locked ? `第 ${item.day} 天开放` : "等待你的这一笔"}</strong></button>; })}</div>
      <div className="backup-card"><span>跨设备备份</span><h2>把当前进度保存成一个文件</h2><p>备份包含作品、觉察记录、完成时间和未完成草稿。请妥善保管，不要转发给无关的人。</p><div className="backup-actions"><button onClick={exportBackup}>下载当前备份</button><label><input type="file" accept="application/json,.json" onChange={importBackup} />导入备份恢复</label></div></div>
      {allComplete ? <div className="day-seven-summary"><span>DAY 07 · 收束</span><h2>把七幅作品放在一起看看</h2><p>你在七天里记录过的感受词包括：<strong>{feelingSummary.join("、") || "尚未命名"}</strong>。这只是你自述内容的并置，不是心理分析。</p><ul><li>哪一个元素在不同作品里再次出现？</li><li>哪一天的自己最让现在的你意外？</li><li>接下来，你想保留、松开或继续靠近什么？</li></ul><button className="card-action" onClick={downloadArchive}>下载7日个人作品档案</button></div> : nextIncompleteDay <= maxUnlockedDay ? <button className="primary-button" onClick={() => resetFields(nextIncompleteDay)}>继续 Day {padDay(nextIncompleteDay)} <span>→</span></button> : <div className="locked-next"><strong>今天开放的章节已经完成</strong><span>老师开放下一章后，点击顶部“刷新开放”即可继续。你可以先下载备份或回看作品。</span></div>}
    </section>}
    {saveImagePreview && <div className="image-save-layer" role="dialog" aria-modal="true" aria-label={`保存${saveImagePreview.label}`} onClick={() => setSaveImagePreview(null)}>
      <div className="image-save-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="image-save-heading"><div><span>保存到系统相册</span><strong>长按下面的图片</strong></div><button type="button" aria-label="关闭保存图片窗口" onClick={() => setSaveImagePreview(null)}>×</button></div>
        <p>在微信中长按图片，选择“保存图片”。如果没有出现菜单，请点右上角“…”并选择“在默认浏览器打开”，然后再长按。</p>
        <img src={saveImagePreview.url} alt={`${saveImagePreview.label}，长按保存到相册`} />
        <small>这是一张网页中的纯图片，不会自动上传，也不会自动发送给任何人。</small>
        <button type="button" className="image-save-close" onClick={() => setSaveImagePreview(null)}>我已保存 / 关闭</button>
      </div>
    </div>}
    <footer><span>表达性艺术探索 · 不是心理咨询或治疗</span><span>© 织屿心理</span></footer>
  </main>;
}
