"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArtworkDraft,
  clearExperienceData,
  DayRecord,
  dayPlans,
  deleteArtworkDraft,
  getArtworkDraft,
  getDayRecords,
  getParticipantProfile,
  ParticipantProfile,
  saveArtworkDraft,
  saveDayRecord,
  saveParticipantProfile,
} from "./experience";
import TeacherDashboard from "./TeacherDashboard";
import { emphasisParts, splitSentences } from "./reading";
import { joinWithParticipantCode, refreshParticipantAccess, syncParticipantCompletion } from "./cloudBackend";
import type { ParticipantAccess } from "./cloudBackend";

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
type PracticePhase = "intro" | "ground" | "guide" | "create" | "reflect";
type Phase = PracticePhase | "result" | "gallery";
type ShareMode = (typeof shareOptions)[number]["id"];
type SaveStatus = "idle" | "saving" | "saved" | "failed";
type CloudSyncStatus = "idle" | "syncing" | "synced" | "failed";
type UndoSnapshot = { image: ImageData; started: boolean; importedArtwork: boolean; previewUrl: string };
type SaveImagePreview = { url: string; label: string } | null;

const taskSteps: { id: PracticePhase; label: string }[] = [
  { id: "intro", label: "介绍" },
  { id: "ground", label: "呼吸" },
  { id: "guide", label: "引导" },
  { id: "create", label: "作画" },
  { id: "reflect", label: "赋义" },
];

function JourneyProgress({ current }: { current: PracticePhase }) {
  const currentIndex = taskSteps.findIndex((item) => item.id === current);
  return <nav className="journey-progress" aria-label="今日练习进度">
    {taskSteps.map((item, index) => <span key={item.id} className={index === currentIndex ? "current" : index < currentIndex ? "complete" : ""}><i>{index < currentIndex ? "✓" : index + 1}</i><em>{item.label}</em></span>)}
  </nav>;
}

function ThemeText({ text, emphasis = "", additionalEmphasis = "" }: { text: string; emphasis?: string; additionalEmphasis?: string }) {
  if (additionalEmphasis) {
    const [before, keyword, after] = emphasisParts(text, additionalEmphasis);
    return <>{before}{keyword && <strong className="theme-keyword">{keyword}</strong>}<ThemeText text={after} emphasis={emphasis} /></>;
  }
  const [before, keyword, after] = emphasisParts(text, emphasis);
  return <>{before}{keyword && <strong className="theme-keyword">{keyword}</strong>}{after}</>;
}

function SentenceLines({ text, emphasis = "" }: { text: string; emphasis?: string }) {
  return <>{splitSentences(text).map((sentence, index) => <span className="sentence-line" key={index}><ThemeText text={sentence} emphasis={emphasis} /></span>)}</>;
}

function padDay(day: number) { return String(day).padStart(2, "0"); }
function downloadDataUrl(url: string, filename: string) { const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); }
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
export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const undoSnapshot = useRef<UndoSnapshot | null>(null);
  const draftTimer = useRef<number | null>(null);
  const [teacherMode, setTeacherMode] = useState(false);
  const [restoringParticipant, setRestoringParticipant] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [participantIdInput, setParticipantIdInput] = useState("");
  const [participationAccepted, setParticipationAccepted] = useState(false);
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [codeError, setCodeError] = useState("");
  const [switchCode, setSwitchCode] = useState("");
  const [cloudMaxDay, setCloudMaxDay] = useState(1);
  const [cloudCompletedDays, setCloudCompletedDays] = useState<number[]>([]);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("idle");
  const [phase, setPhase] = useState<Phase>("intro");
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
  const [energyChosen, setEnergyChosen] = useState(false);
  const [focus, setFocus] = useState("色彩");
  const [focusChosen, setFocusChosen] = useState(false);
  const [responseMode, setResponseMode] = useState("seen");
  const [responseChosen, setResponseChosen] = useState(false);
  const [note, setNote] = useState("");
  const [selectedStarterPrompt, setSelectedStarterPrompt] = useState<number | null>(null);
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
  const completionRequirements = [
    { label: "完成作品", done: Boolean(previewUrl) },
    { label: "为作品命名", done: Boolean(title.trim()) },
    { label: "选择此刻的感受", done: feelings.length > 0 },
    { label: "记录作品能量", done: energyChosen },
    { label: "选择想被留意的部分", done: focusChosen },
    { label: "留下一句话", done: Boolean(note.trim()) },
    { label: "选择希望获得的回应", done: responseChosen },
  ];
  const completionReady = completionRequirements.every((item) => item.done);
  const nextIncompleteDay = dayPlans.find((item) => !records.some((record) => record.day === item.day))?.day ?? 7;
  const sortedRecords = useMemo(() => [...records].sort((a, b) => a.day - b.day), [records]);
  const feelingSummary = useMemo(() => {
    const counts = new Map<string, number>(); records.flatMap((record) => record.feelings).forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([item]) => item);
  }, [records]);

  useEffect(() => {
    let cancelled = false;
    const isTeacherMode = new URLSearchParams(window.location.search).has("teacher");
    setTeacherMode(isTeacherMode);
    if (isTeacherMode) { setRestoringParticipant(false); return; }

    async function restoreParticipant() {
      try {
        const savedProfile = await getParticipantProfile();
        if (!savedProfile || cancelled) return;
        setParticipantIdInput(savedProfile.participantId);
        const [access, saved] = await Promise.all([
          refreshParticipantAccess(savedProfile.participantId),
          getDayRecords(),
        ]);
        if (cancelled) return;
        setProfile(savedProfile); setRecords(saved); setCloudMaxDay(access.currentDay); setCloudCompletedDays(access.completedDays); setUnlocked(true);
        const next = dayPlans.find((item) => item.day <= access.currentDay && !saved.some((record) => record.day === item.day))?.day;
        if (saved.length || !next) { setDay(next ?? Math.min(access.currentDay, 7)); setPhase("gallery"); }
        else { setDay(next); setPhase("intro"); }
        setStorageNote(`已自动恢复参与编号 ${access.code} 和这台设备上的作品进度。`);
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "暂时无法连接活动后台。";
        setCodeError(`没有自动进入：${message} 你可以稍后点击“验证编号并进入”重试。`);
      } finally {
        if (!cancelled) setRestoringParticipant(false);
      }
    }

    void restoreParticipant();
    return () => { cancelled = true; };
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

  async function enterExperience(access: ParticipantAccess, activeProfile: ParticipantProfile, saved: DayRecord[], restoreMessage = "") {
    await saveParticipantProfile(activeProfile);
    setProfile(activeProfile); setRecords(saved); setCloudMaxDay(access.currentDay); setCloudCompletedDays(access.completedDays); setUnlocked(true);
    const availableDay = access.currentDay;
    const next = dayPlans.find((item) => item.day <= availableDay && !saved.some((record) => record.day === item.day))?.day;
    if (saved.length || !next) { setDay(next ?? Math.min(availableDay, 7)); setPhase("gallery"); }
    else await resetFields(next);
    if (restoreMessage) setStorageNote(restoreMessage);
  }

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    const cleanParticipantId = participantIdInput.trim();
    if (!participationAccepted) { setCodeError("请先阅读并确认参与说明。"); return; }
    if (cleanParticipantId.length < 3) { setCodeError("请输入管理员单独发给你的参与编号。"); return; }
    setCodeError(""); setSwitchCode("");
    try {
      const access = await joinWithParticipantCode(cleanParticipantId);
      const saved = await getDayRecords(); const existingProfile = await getParticipantProfile();
      if (existingProfile && existingProfile.participantId !== access.code) { setSwitchCode(access.code); setCodeError(`这台设备保存着旧编号 ${existingProfile.participantId} 的本机记录。如需改用 ${access.code}，必须先清除旧编号在这台设备上的作品和草稿。`); return; }
      const earliestCompletion = [...saved].sort((a, b) => a.completedAt.localeCompare(b.completedAt))[0]?.completedAt;
      const activeProfile: ParticipantProfile = existingProfile
        ? existingProfile
        : { id: "profile", participantId: access.code, startedAt: earliestCompletion ?? access.joinedAt ?? new Date().toISOString() };
      await enterExperience(access, activeProfile, saved);
    }
    catch (caught) { setCodeError(caught instanceof Error ? caught.message : "暂时无法验证参与编号，请稍后重试。"); }
  }
  async function clearLocalAndSwitch() {
    if (!switchCode) return;
    const confirmed = window.confirm(`将永久清除这台设备上旧编号的作品、草稿和本机记录，然后改用 ${switchCode}。清除后无法恢复，确定继续吗？`);
    if (!confirmed) return;
    setCodeError("");
    try {
      const access = await joinWithParticipantCode(switchCode);
      await clearExperienceData();
      const activeProfile: ParticipantProfile = { id: "profile", participantId: access.code, startedAt: access.joinedAt ?? new Date().toISOString() };
      await saveParticipantProfile(activeProfile);
      setProfile(activeProfile); setRecords([]); setCloudMaxDay(access.currentDay); setCloudCompletedDays(access.completedDays); setParticipantIdInput(access.code); setSwitchCode(""); setUnlocked(true); setStorageNote("旧记录已从这台设备清除，已经切换到新的参与编号。");
      await resetFields(1);
    } catch (caught) { setCodeError(caught instanceof Error ? caught.message : "清除或更换编号失败，请稍后重试。"); }
  }
  async function refreshCloudAccess() {
    if (!profile) return;
    try { const access = await refreshParticipantAccess(profile.participantId); setCloudMaxDay(access.currentDay); setCloudCompletedDays(access.completedDays); setStorageNote(`管理员目前开放到 Day ${padDay(access.currentDay)}，进度已刷新。`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "开放进度刷新失败，请稍后重试。"); }
  }
  async function syncCompletion(record: DayRecord) {
    if (!profile) return false;
    setCloudSyncStatus("syncing");
    try {
      await syncParticipantCompletion(profile.participantId, record.day, record.completedAt);
      setCloudCompletedDays((current) => current.includes(record.day) ? current : [...current, record.day]);
      setCloudSyncStatus("synced"); setStorageNote(`Day ${padDay(record.day)} 打卡成功，后端已经记录。`); return true;
    }
    catch { setCloudSyncStatus("failed"); setStorageNote(`Day ${padDay(record.day)} 的作品已安全保存在本机，但打卡还没有同步到后端。请点击“重新同步完成打卡”。`); return false; }
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
      catch { setStorageNote("自动保存草稿失败，请先完成本次作品，并及时保存作品图片。"); }
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
  function leaveCanvasForGuide() {
    if (started && canvasRef.current) setPreviewUrl(canvasRef.current.toDataURL("image/jpeg", .86));
    setPhase("guide"); window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (!completionReady) { setError("请先完成上方所有必填步骤，再提交今天的打卡。"); return; }
    const record: DayRecord = { day, title: title.trim(), image: previewUrl, feelings, energy, focus, responseMode, note: note.trim(), completedAt: new Date().toISOString() };
    setError(""); setSaveStatus("saving");
    try {
      await saveDayRecord(record); deleteArtworkDraft(day).catch(() => undefined);
      setRecords((current) => [...current.filter((item) => item.day !== day), record]); setSaveStatus("saved"); setStorageNote(`Day ${padDay(day)} 已确认保存在本机，正在同步完成记录。`); setPhase("result");
    } catch { setSaveStatus("failed"); setError("保存失败，作品尚未进入作品册。请保持当前页面并重新尝试。"); return; }
    void syncCompletion(record);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function resetFields(targetDay: number) {
    if (targetDay > maxUnlockedDay && !records.some((record) => record.day === targetDay)) { setStorageNote(`Day ${padDay(targetDay)} 还没有由管理员开放。开放后刷新网页即可进入。`); return; }
    setDay(targetDay); setPhase("intro"); setStarted(false); setImportedArtwork(false); setPreviewUrl(""); setTitle(""); setFeelings([]); setEnergy(3); setEnergyChosen(false); setFocus("色彩"); setFocusChosen(false); setResponseMode("seen"); setResponseChosen(false); setNote(""); setSelectedStarterPrompt(null); setError(""); setSaveStatus("idle"); setCloudSyncStatus("idle"); setSharePreviewUrl(""); setShareHint(""); setShareMode("artTitle"); setSaveImagePreview(null); undoSnapshot.current = null; setUndoAvailable(false);
    try { const draft = await getArtworkDraft(targetDay); if (draft) { setPreviewUrl(draft.image); setStarted(true); setImportedArtwork(draft.importedArtwork); setStorageNote(`已恢复 Day ${padDay(targetDay)} 的本机草稿。`); } }
    catch { setStorageNote("没有读到本机草稿，可以继续创作。"); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openDay(targetDay: number) {
    const saved = records.find((record) => record.day === targetDay);
    if (!saved && targetDay > maxUnlockedDay) { setStorageNote(`Day ${padDay(targetDay)} 还没有由管理员开放。`); return; }
    if (!saved) { void resetFields(targetDay); return; }
    setDay(saved.day); setTitle(saved.title); setPreviewUrl(saved.image); setFeelings(saved.feelings); setEnergy(saved.energy); setEnergyChosen(true); setFocus(saved.focus); setFocusChosen(true); setResponseMode(saved.responseMode); setResponseChosen(true); setNote(saved.note); setSharePreviewUrl(""); setShareMode("artTitle"); setSaveImagePreview(null); setSaveStatus("saved"); setCloudSyncStatus(cloudCompletedDays.includes(saved.day) ? "synced" : "failed"); setPhase("result"); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showGallery() {
    if (((phase === "create" && started) || phase === "reflect") && !window.confirm("当前内容还没有正式保存。草稿已尽量自动保留，确定先离开吗？")) return;
    setPhase("gallery"); setError(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openImageSavePreview(url: string, label: string) {
    if (!url) return;
    setSaveImagePreview({ url, label });
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
  if (restoringParticipant) return <main className="gate-shell"><section className="gate-card" aria-live="polite"><span className="gate-badge">织屿心理 · 伙伴体验版</span><h1>正在恢复<br />上次进度</h1><p>正在读取这台设备上保存的参与编号和作品，请稍候……</p></section></main>;
  if (!unlocked) return <main className="gate-shell"><section className="gate-card"><span className="gate-badge">织屿心理 · 伙伴体验版</span><h1>把自己<br />画回来</h1><p>一个用颜色、书写和觉察慢慢靠近自己的7日表达性艺术探索。</p><div className="gate-facts"><span>每天约5–8分钟</span><span>完成7幅个人作品</span><span>不要求公开分享</span></div><details className="program-intro"><summary>先了解这7天会发生什么</summary><p>管理员会按本期活动进度开放主题。你可以直接在网页绘画，也可以上传纸上作品；完成后由你为作品命名并选择希望获得的回应。</p><ol>{dayPlans.map((item) => <li key={item.day}><strong>Day {padDay(item.day)}</strong><span>{item.shortTitle}</span></li>)}</ol><small>任何一天都可以暂停、跳过或不公开作品。</small></details><details className="participation-notice" open><summary>正式参与说明 · 请先阅读</summary><div><section><strong>参与范围与活动性质</strong><p>本期面向18岁及以上成年人。这是一项心理教育与自我探索活动，不替代心理咨询、诊断、治疗或医疗服务。</p></section><section><strong>你的选择权</strong><p>你可以随时跳过、暂停或退出，不必解释原因；完成天数不代表心理健康水平。</p></section><section><strong>数据与作品保存</strong><p>作品和觉察文字只保存在当前浏览器。后台仅记录参与编号、开放进度、完成日期和最近活动时间。换设备、清除网站数据或使用无痕模式可能使本机作品无法恢复；建议始终使用同一台设备和浏览器完成练习，并在每天结束后保存作品图片。</p></section><section><strong>社群分享边界</strong><p>不要求在群内公开作品。若自主分享，请避免透露可识别信息；请勿截图或转发他人内容，但群聊无法保证绝对保密。</p></section><section><strong>出现明显不适时</strong><p>如果练习引发强烈或持续不适、自伤或伤人想法，或你正处于紧急危险中，请立即停止，联系可信任的人、当地紧急服务或合适的专业支持。本活动不提供24小时危机干预，工作人员回复时间以群公告为准。</p></section><section><strong>删除记录</strong><p>需要删除后台编号和完成记录时，请联系活动管理员。管理员无法远程查看或删除你手机中的本机作品。</p></section></div></details><form onSubmit={unlock}><label htmlFor="participant-id">参与编号</label><input className="participant-input" id="participant-id" autoComplete="off" maxLength={24} value={participantIdInput} onChange={(event) => { setParticipantIdInput(event.target.value.toUpperCase()); setSwitchCode(""); setCodeError(""); }} placeholder="例如 ZY-7K3MP" /><small className="field-help">输入管理员单独发给你的编号，不要填写真实姓名。</small><label className="participation-consent"><input type="checkbox" checked={participationAccepted} onChange={(event) => { setParticipationAccepted(event.target.checked); setCodeError(""); }} required /><span><strong>我已阅读并理解参与说明</strong><small>我确认已满18周岁，并理解这不是心理咨询或治疗。</small></span></label>{codeError && <small role="alert">{codeError}</small>}{switchCode && <div className="switch-code-actions"><button type="button" className="danger" onClick={clearLocalAndSwitch}>清除旧记录并更换编号</button></div>}<button type="submit" disabled={!participationAccepted}>验证编号并进入 <span>→</span></button></form><div className="privacy-note"><strong>作品只保存在当前设备</strong><span>后台只记录参与编号、开放进度和完成时间，不上传你的作品、感受词或觉察文字。</span></div></section></main>;

  return <main className="app-shell">
    <header className="topbar"><button className="brand-mark" onClick={showGallery}>织屿心理</button><div><span>{completed}/7 已完成 · 开放至 Day {maxUnlockedDay}</span><button onClick={refreshCloudAccess}>刷新开放</button><button onClick={showGallery}>7日作品册</button></div></header>
    {storageNote && <div className="storage-banner">{storageNote}</div>}{error && <div className="error-banner" role="alert">{error}</div>}
    {phase === "intro" && <section className="task-page intro-card">
      <JourneyProgress current="intro" />
      <button className="back-button" onClick={showGallery}>← 返回作品册</button>
      <div className="eyebrow">DAY {padDay(day)} / 07 · {plan.shortTitle}</div><h1><ThemeText text={plan.title} emphasis={plan.titleEmphasis} additionalEmphasis={plan.titleSecondaryEmphasis} /></h1><p><SentenceLines text={plan.prompt} emphasis={plan.promptEmphasis} /></p>
      <div className="time-note"><span>约5–8分钟</span><span>一次只做一步</span><span>随时可以返回</span></div>
      <button className="primary-button" onClick={() => setPhase("ground")}>开始今天的探索 <span>→</span></button>
    </section>}
    {phase === "ground" && <section className="task-page grounding-page">
      <JourneyProgress current="ground" />
      <button className="back-button" onClick={() => setPhase("intro")}>← 上一步：介绍</button>
      <div className="section-heading"><span>STEP 02 · 呼吸 / 到场</span><h2>先给自己一点抵达这里的时间</h2><p><SentenceLines text="不需要闭眼，也不必强迫自己深呼吸。选择一个舒服的姿势，让目光停在面前真实存在的事物上。" /></p></div>
      <div className="breath-practice"><div className="breath-orbit" aria-hidden="true"><i /></div><ol><li><strong>吸气</strong><span>自然吸气，轻轻数到 4</span></li><li><strong>呼气</strong><span>慢慢呼气，轻轻数到 6</span></li><li><strong>重复</strong><span>做 3 轮，或者保持你原本的呼吸</span></li></ol></div>
      <div className="grounding-permission"><strong>以舒服为准</strong><p><SentenceLines text="如果数拍让你紧张、头晕或不舒服，请立刻回到自然呼吸。你也可以跳过这一步。" /></p></div>
      <button className="primary-button" onClick={() => setPhase("guide")}>我准备好了 <span>→</span></button>
    </section>}
    {phase === "guide" && <section className="task-page guide-page">
      <JourneyProgress current="guide" />
      <button className="back-button" onClick={() => setPhase("ground")}>← 上一步：呼吸</button>
      <section className="practice-guide" aria-label="今日练习说明"><span>今天只练一件事</span><h2><ThemeText text={plan.practiceAim} emphasis={plan.aimEmphasis} /></h2><p><SentenceLines text={plan.context} emphasis={plan.contextEmphasis} /></p><div className="starter-note"><strong className="hint-label">任选一题起笔</strong><p>轻点一题，或不选也可以直接作画。再次点击已选题目可以取消。</p><div className="starter-prompts" aria-label="任选一个起笔问题">{plan.starterPrompts.map((prompt, index) => <button type="button" key={prompt} className={selectedStarterPrompt === index ? "selected" : ""} aria-pressed={selectedStarterPrompt === index} onClick={() => setSelectedStarterPrompt((current) => current === index ? null : index)}><i>{index + 1}</i><span>{prompt}</span></button>)}</div></div><div className="guide-grid"><div><strong>先准备</strong><p><SentenceLines text={plan.prepare} /></p></div><div><strong>你可以</strong><p><SentenceLines text={plan.permission} /></p></div></div><details className="pause-guide"><summary>如果此刻有点难受，先暂停一下</summary><p><SentenceLines text="睁开眼睛，看看周围，依次找到3样看得见的东西、2种听得到的声音和1处身体与地面或椅子的接触。等注意回到当下后，再决定继续、改画轻一点的主题，或今天就停在这里。" /></p><small>如果不适持续或明显加重，请停止练习，并联系可信任的人或合适的专业支持。</small></details></section>
      <button className="primary-button" onClick={() => setPhase("create")}>带着引导去作画 <span>→</span></button>
    </section>}
    {phase === "create" && <section className="task-page creation-page">
      <JourneyProgress current="create" />
      <button className="back-button" onClick={leaveCanvasForGuide}>← 上一步：引导</button>
      <div className="section-heading compact"><span>STEP 04 · 作画</span><h2>把注意交给颜色和线条</h2><p><SentenceLines text={plan.starter} /></p></div>
      {selectedStarterPrompt !== null && <aside className="selected-starter-prompt" aria-label="你选择的起笔问题"><div><span>你带来的起笔问题</span><p>{plan.starterPrompts[selectedStarterPrompt]}</p><small>它只是一个开始入口，不必在画里回答它。</small></div><button type="button" onClick={() => setPhase("guide")}>重新选择</button></aside>}
      <section className="studio" aria-label="绘画工作台"><div className="creation-source"><div><span>选择创作方式</span><strong>{importedArtwork ? "纸上作品已经导入" : "网页直接画，或上传真实手绘"}</strong><small>{importedArtwork ? "可以继续用下面的画笔在照片上补充" : "拍下纸上的画，也可以从手机相册选择"}</small></div><label className={importedArtwork ? "imported" : ""}><input type="file" accept="image/*" onChange={importArtwork} /><span>{importedArtwork ? "更换图片" : "拍照 / 选择图片"}</span></label><p>图片仅导入当前画布，在本机处理，不会上传到织屿。</p></div><div className="canvas-frame"><canvas ref={canvasRef} className="art-canvas" aria-label="用手指或鼠标自由绘画" onPointerDown={begin} onPointerMove={draw} onPointerUp={endDrawing} onPointerCancel={endDrawing} />{!started && <div className="canvas-hint" aria-hidden="true"><span />从这里落下第一笔</div>}</div><div className="art-tools"><div className="tool-section"><div className="tool-heading"><span>画材</span><div className="canvas-history"><button disabled={!undoAvailable} onClick={undoLastChange}>撤销一步</button><button onClick={clearCanvas}>清空画布</button></div></div><div className="brush-types" aria-label="选择画材">{brushOptions.map((item) => <button key={item.id} className={brushType === item.id ? "selected" : ""} onClick={() => setBrushType(item.id)} aria-pressed={brushType === item.id}><i className={`brush-stroke ${item.id}`} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}</div></div><div className="tool-section"><div className="tool-heading"><span>笔触粗细</span><small>{brushSizes.find((item) => item.value === brush)?.label}</small></div><div className="brush-sizes" aria-label="选择笔触粗细">{brushSizes.map((item) => <button key={item.value} className={brush === item.value ? "selected" : ""} onClick={() => setBrush(item.value)} aria-label={`${item.label}笔触`} aria-pressed={brush === item.value}><i style={{ width: Math.max(5, item.value * .62), height: Math.max(5, item.value * .62), background: brushType === "eraser" ? "#FBF8F3" : color }} /><span>{item.label}</span></button>)}</div></div><div className="tool-section"><div className="tool-heading"><span>色彩 · 36色</span><small>{brushType === "eraser" ? "切换颜色会继续保留橡皮擦" : "也可以自选"}</small></div><div className="palette" aria-label="选择画笔颜色">{palette.map((item) => <button key={item} className={`swatch ${color === item ? "selected" : ""}`} style={{ background: item }} aria-label={`选择颜色 ${item}`} onClick={() => setColor(item)} aria-pressed={color === item} />)}<label className="custom-color" aria-label="自选颜色"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>＋</span></label></div></div></div></section><section className="next-step"><div><span>{padDay(day)}</span><p><SentenceLines text={plan.takeaway} /></p></div><button className="primary-button" disabled={!started && !previewUrl} onClick={finishPainting}>完成这幅画，去赋义 <span>→</span></button></section>
    </section>}
    {phase === "reflect" && <JourneyProgress current="reflect" />}
    {phase === "reflect" && <section className="reflection-flow"><button className="back-button" onClick={() => setPhase("create")}>← 回到画布</button><div className="art-preview"><img src={previewUrl} alt="刚刚完成的作品" /></div><div className="section-heading"><span>STEP 02</span><h2>由你来解释这幅画</h2><p><SentenceLines text="我们不会根据颜色或线条判断你的心理状态。回应只来自你愿意说出的部分。" /></p></div><label className="field"><span>{plan.reflectionLabel}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} placeholder={plan.titlePlaceholder} /></label><fieldset><legend>此刻更接近哪些感受？<small>最多选3个；不想命名可选“无法命名”</small></legend><div className="choice-cloud">{feelingsList.map((item) => <button type="button" key={item} className={feelings.includes(item) ? "active" : ""} onClick={() => toggleFeeling(item)}>{item}</button>)}</div></fieldset><label className={`field range-field ${energyChosen ? "answered" : ""}`}><span>这幅作品现在有多少能量？<strong>{energyChosen ? energyText : "请拖动选择"}</strong></span><input type="range" min="1" max="5" value={energy} onChange={(event) => { setEnergy(Number(event.target.value)); setEnergyChosen(true); }} /><div className="range-labels"><i>很轻</i><i>很充沛</i></div></label><fieldset><legend>你最想让人留意画面里的什么？</legend><div className="choice-cloud">{focusList.map((item) => <button type="button" key={item} className={focusChosen && focus === item ? "active" : ""} onClick={() => { setFocus(item); setFocusChosen(true); }}>{item}</button>)}</div></fieldset><label className="field"><span>再留下一句话<small>必填 · 只保存在当前设备</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="我画到这里时，注意到……" /></label><fieldset><legend>今天希望怎样被回应？</legend><div className="response-grid">{responseOptions.map((item) => <button type="button" key={item.id} className={responseChosen && responseMode === item.id ? "active" : ""} onClick={() => { setResponseMode(item.id); setResponseChosen(true); }}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</div></fieldset><div className={`completion-gate ${completionReady ? "ready" : ""}`}><strong>{completionReady ? "今天的必填内容已完成" : "完成以下内容后即可打卡"}</strong><div>{completionRequirements.map((item) => <span key={item.label} className={item.done ? "done" : ""}>{item.done ? "✓" : "○"} {item.label}</span>)}</div></div><button className="primary-button complete-checkin-button" disabled={!completionReady || saveStatus === "saving"} onClick={completeReflection}>{saveStatus === "saving" ? "正在完成打卡……" : "完成打卡"} <span>→</span></button></section>}
    {phase === "result" && <section className="result-flow">
      <div className="completion-mark">{padDay(day)}</div><div className="eyebrow">今天的作品完成了</div><h1>《{title}》</h1>
      <div className="art-preview result-art"><img src={previewUrl} alt={title} /></div>
      <div className="mirror-card"><span>即时镜面回应 · 体验版</span><p>{mirrorFeedback()}</p><small>回应只复述你主动提供的信息，不分析颜色、符号或人格。</small></div>
      <div className="closing-card"><span>先把今天放回生活</span><p><SentenceLines text={plan.closing} /></p></div>
      <div className={`local-card ${saveStatus} ${cloudSyncStatus}`}><strong>{cloudSyncStatus === "synced" ? "完成打卡 · 后端已记录" : cloudSyncStatus === "failed" ? "作品已保存，但打卡尚未同步" : "正在完成打卡"}</strong><p>{cloudSyncStatus === "synced" ? "你不需要再做任何操作。作品保存在当前设备，后端只看到编号、完成天数和时间。" : cloudSyncStatus === "failed" ? "请检查网络后重新同步；同步成功前，后端暂时看不到这一天已完成。" : "正在保存作品并向后端同步完成状态，请稍候。"}</p><div className="cloud-sync-line"><span className={cloudSyncStatus}>{cloudSyncStatus === "syncing" ? "正在同步到后端……" : cloudSyncStatus === "synced" ? "✓ 同步成功" : cloudSyncStatus === "failed" ? "同步失败" : "等待同步"}</span>{cloudSyncStatus === "failed" && records.find((item) => item.day === day) && <button onClick={() => { const record = records.find((item) => item.day === day); if (record) void syncCompletion(record); }}>重新同步完成打卡</button>}</div><small>作品、感受词和觉察文字不会上传到后端。</small></div>
      <div className="share-card"><span>由你决定要不要分享</span><h2>先生成，再决定是否分享</h2><p>选择卡片里出现的内容。后两种都会嵌入你刚完成的完整画面，不会自动发群。</p><div className="share-options">{shareOptions.map((item) => <button key={item.id} className={shareMode === item.id ? "active" : ""} onClick={() => { setShareMode(item.id); setSharePreviewUrl(""); setShareHint(""); }}><strong>{item.label}</strong><small>{item.hint}</small></button>)}</div><button className="card-action" disabled={shareGenerating} onClick={makeShareCard}>{shareGenerating ? "正在生成……" : "生成卡片预览"}</button>{sharePreviewUrl && <div className="share-output" id="share-card-preview"><div className="share-output-heading"><span>生成结果 · 3:4 图片</span><strong>作品已经嵌入卡片</strong></div><img src={sharePreviewUrl} alt={`Day ${day} 自主分享卡预览`} /><p>确认内容和作品都正确后，再在这里保存图片或分享到微信。</p><div className="share-output-actions"><button onClick={() => openImageSavePreview(sharePreviewUrl, "分享卡")}>保存图片</button><button className="wechat-share-button" onClick={shareGeneratedCard}>分享到微信</button></div>{shareHint && <div className="wechat-share-hint" role="status">{shareHint}</div>}</div>}</div>
      {day < 7 && (day + 1 <= maxUnlockedDay ? <button className="primary-button" onClick={() => openDay(day + 1)}>{records.some((record) => record.day === day + 1) ? "查看" : "进入"} Day {padDay(day + 1)} <span>→</span></button> : <div className="locked-next"><strong>Day {padDay(day + 1)} 等待管理员开放</strong><span>开放后点击顶部“刷新开放”即可进入；今天可以先在这里收束。</span></div>)}
      {day === 7 && allComplete && <button className="primary-button" onClick={downloadArchive}>下载7日个人作品档案 <span>↓</span></button>}
      <button className="primary-button secondary" onClick={showGallery}>查看7日作品册 <span>▦</span></button>
    </section>}
    {phase === "gallery" && <section className="gallery-flow">
      <div className="eyebrow">参与编号 {profile?.participantId} · 管理员已开放至 Day {maxUnlockedDay}</div><h1>七天，不是七份作业</h1><p className="gallery-intro">每一天只留下一个当时的切片。未来章节由管理员开放；作品不自动上传，由你决定分享范围。</p>
      <div className="progress-track"><i style={{ width: `${completed / 7 * 100}%` }} /></div><div className="progress-copy"><span>已完成 {completed} 天</span><span>{allComplete ? "可以收束了" : `还剩 ${7 - completed} 天`}</span></div>
      <div className="gallery-grid">{dayPlans.map((item) => { const record = records.find((saved) => saved.day === item.day); const locked = !record && item.day > maxUnlockedDay; return <button key={item.day} disabled={locked} className={record ? "complete" : locked ? "locked" : "pending"} onClick={() => openDay(item.day)}>{record ? <img src={record.image} alt={`Day ${item.day} 作品`} /> : <div className="empty-art"><span>{locked ? "锁" : padDay(item.day)}</span><i /></div>}<span>DAY {padDay(item.day)} · {item.shortTitle}</span><strong>{record ? `《${record.title}》` : locked ? `第 ${item.day} 天开放` : "等待你的这一笔"}</strong></button>; })}</div>
      {allComplete ? <div className="day-seven-summary"><span>DAY 07 · 收束</span><h2>把七幅作品放在一起看看</h2><p>你在七天里记录过的感受词包括：<strong>{feelingSummary.join("、") || "尚未命名"}</strong>。这只是你自述内容的并置，不是心理分析。</p><ul><li>哪一个元素在不同作品里再次出现？</li><li>哪一天的自己最让现在的你意外？</li><li>接下来，你想保留、松开或继续靠近什么？</li></ul><button className="card-action" onClick={downloadArchive}>下载7日个人作品档案</button></div> : nextIncompleteDay <= maxUnlockedDay ? <button className="primary-button" onClick={() => resetFields(nextIncompleteDay)}>继续 Day {padDay(nextIncompleteDay)} <span>→</span></button> : <div className="locked-next"><strong>今天开放的章节已经完成</strong><span>管理员开放下一章后，点击顶部“刷新开放”即可继续。你可以先回看或保存今天的作品。</span></div>}
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
