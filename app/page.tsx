"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { DayRecord, FeedbackDraft, dayPlans, getDayRecords, saveDayRecord, saveFeedbackDraft } from "./experience";

const DEMO_CODE = "260824";
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
  { id: "done", label: "只分享完成", hint: "不显示作品和文字" },
  { id: "sentence", label: "分享一句话", hint: "显示标题与一句自述" },
  { id: "art", label: "分享作品", hint: "显示画面、标题与一句自述" },
] as const;

type BrushType = (typeof brushOptions)[number]["id"];
type Phase = "create" | "reflect" | "result" | "gallery";
type ShareMode = (typeof shareOptions)[number]["id"];

function padDay(day: number) { return String(day).padStart(2, "0"); }
function downloadDataUrl(url: string, filename: string) { const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }
function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const chars = [...text]; let line = ""; let lineIndex = 0;
  for (const char of chars) { const test = line + char; if (context.measureText(test).width > maxWidth && line) { context.fillText(line, x, y + lineIndex * lineHeight); line = char; lineIndex += 1; if (lineIndex >= maxLines) return; } else line = test; }
  if (lineIndex < maxLines) context.fillText(line, x, y + lineIndex * lineHeight);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [phase, setPhase] = useState<Phase>("create");
  const [day, setDay] = useState(1);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [storageNote, setStorageNote] = useState("");
  const [color, setColor] = useState(palette[0]);
  const [brushType, setBrushType] = useState<BrushType>("pencil");
  const [brush, setBrush] = useState(10);
  const [started, setStarted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [title, setTitle] = useState("");
  const [feelings, setFeelings] = useState<string[]>([]);
  const [energy, setEnergy] = useState(3);
  const [focus, setFocus] = useState("色彩");
  const [responseMode, setResponseMode] = useState("seen");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [shareMode, setShareMode] = useState<ShareMode>("art");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [engagement, setEngagement] = useState(4);
  const [hesitation, setHesitation] = useState("");
  const [continueChoice, setContinueChoice] = useState("愿意继续");
  const [feedbackNote, setFeedbackNote] = useState("");
  const plan = dayPlans[day - 1];
  const energyText = useMemo(() => ["", "很轻", "偏低", "中等", "在流动", "很充沛"][energy], [energy]);
  const completed = records.length;
  const allComplete = completed === 7;
  const sortedRecords = useMemo(() => [...records].sort((a, b) => a.day - b.day), [records]);
  const feelingSummary = useMemo(() => {
    const counts = new Map<string, number>(); records.flatMap((record) => record.feelings).forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([item]) => item);
  }, [records]);

  useEffect(() => {
    if (!unlocked || phase !== "create") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
    const context = canvas.getContext("2d"); context?.scale(ratio, ratio); if (!context) return;
    context.fillStyle = "#FBF8F3"; context.fillRect(0, 0, rect.width, rect.height); context.lineCap = "round"; context.lineJoin = "round";
    if (previewUrl) loadImage(previewUrl).then((image) => context.drawImage(image, 0, 0, rect.width, rect.height)).catch(() => undefined);
  }, [unlocked, phase, day]);

  async function unlock(event: React.FormEvent) {
    event.preventDefault(); if (code.trim() !== DEMO_CODE) { setCodeError("体验码不对，再和邀请你的伙伴确认一下。"); return; }
    setCodeError(""); setUnlocked(true);
    try { const saved = await getDayRecords(); setRecords(saved); const next = dayPlans.find((item) => !saved.some((record) => record.day === item.day))?.day ?? 7; setDay(next); setPhase(saved.length ? "gallery" : "create"); }
    catch { setStorageNote("当前浏览器阻止了本地保存；仍可体验和单独下载作品，但无法形成7日作品册。"); }
  }
  function point(event: PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function begin(event: PointerEvent<HTMLCanvasElement>) { const context = canvasRef.current?.getContext("2d"); if (!context) return; drawing.current = true; setStarted(true); event.currentTarget.setPointerCapture(event.pointerId); const current = point(event); context.beginPath(); context.moveTo(current.x, current.y); }
  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return; const context = canvasRef.current?.getContext("2d"); if (!context) return;
    const current = point(event); const pressure = event.pressure > 0 ? .72 + event.pressure * .28 : 1;
    const style = { pencil: { width: brush * .55, alpha: .72, blur: 0 }, oil: { width: brush * 1.1, alpha: .94, blur: 0 }, watercolor: { width: brush * 1.55, alpha: .18, blur: brush * .42 } }[brushType];
    context.strokeStyle = color; context.lineWidth = style.width * pressure; context.globalAlpha = style.alpha; context.shadowColor = color; context.shadowBlur = style.blur; context.lineTo(current.x, current.y); context.stroke();
  }
  function clearCanvas() { const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (!canvas || !context) return; context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.shadowBlur = 0; context.fillStyle = "#FBF8F3"; context.fillRect(0, 0, canvas.width, canvas.height); context.restore(); setStarted(false); setPreviewUrl(""); }
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
    setError(""); setRecords((current) => [...current.filter((item) => item.day !== day), record]); setPhase("result");
    try { await saveDayRecord(record); } catch { setStorageNote("这次作品没能写入本地作品册，请先下载作品保留。"); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetFields(targetDay: number) { setDay(targetDay); setPhase("create"); setStarted(false); setPreviewUrl(""); setTitle(""); setFeelings([]); setEnergy(3); setFocus("色彩"); setResponseMode("seen"); setNote(""); setError(""); setFeedbackOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function openDay(targetDay: number) { const saved = records.find((record) => record.day === targetDay); if (!saved) { resetFields(targetDay); return; } setDay(saved.day); setTitle(saved.title); setPreviewUrl(saved.image); setFeelings(saved.feelings); setEnergy(saved.energy); setFocus(saved.focus); setResponseMode(saved.responseMode); setNote(saved.note); setPhase("result"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function showGallery() { setPhase("gallery"); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function downloadArtwork() { downloadDataUrl(previewUrl, `Day${day}-${title.trim() || plan.shortTitle}.jpg`); }

  async function makeShareCard() {
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1440; const context = canvas.getContext("2d"); if (!context) return;
    context.fillStyle = "#F1EEE8"; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#2F5D62"; context.fillRect(64, 64, 952, 14);
    context.fillStyle = "#2F5D62"; context.font = "600 28px sans-serif"; context.fillText(`DAY ${padDay(day)} / 07 · ${plan.shortTitle}`, 78, 132);
    context.fillStyle = "#1F2B2A"; context.font = "700 70px serif"; wrapText(context, shareMode === "done" ? "我完成了今天的表达练习" : `《${title}》`, 78, 230, 920, 86, 2);
    let textY = 390;
    if (shareMode === "art") { const image = await loadImage(previewUrl); context.save(); context.beginPath(); context.roundRect(78, 366, 924, 760, 26); context.clip(); context.drawImage(image, 78, 366, 924, 760); context.restore(); textY = 1192; }
    if (shareMode !== "done") { context.fillStyle = "#4E5A58"; context.font = "34px serif"; wrapText(context, note.trim() || `此刻更接近：${feelings.join("、") || "还不急着命名"}`, 78, textY, 900, 48, 2); }
    context.fillStyle = "#667270"; context.font = "24px sans-serif"; context.fillText("织屿心理 · 我的7日表达性艺术探索", 78, 1360);
    const url = canvas.toDataURL("image/png"); const blob = await (await fetch(url)).blob(); const file = new File([blob], `Day${day}-自主分享卡.png`, { type: "image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) { try { await navigator.share({ files: [file], title: `Day ${day} · ${plan.shortTitle}` }); return; } catch { /* participant cancelled */ } }
    downloadDataUrl(url, file.name);
  }
  async function saveFeedback() {
    if (!hesitation) { setError("请选择一个最接近的卡点，也可以选择“没有明显卡点”。"); return; }
    const draft: FeedbackDraft = { day, engagement, hesitation, continueChoice, note: feedbackNote.trim(), savedAt: new Date().toISOString() };
    try { await saveFeedbackDraft(draft); setFeedbackOpen(false); setError(""); setStorageNote("匿名反馈草稿已保存在这台设备；当前体验版尚未发送给织屿。"); } catch { setError("反馈草稿没有保存成功，请截屏或直接告诉活动发起人。"); }
  }
  async function shareFeedbackPrivately() {
    if (!hesitation) { setError("先选择一个最接近的卡点，再生成匿名反馈内容。"); return; }
    const text = `织屿7日体验反馈（不含姓名）\nDay ${day}\n参与感：${engagement}/5\n卡点：${hesitation}\n继续意愿：${continueChoice}${feedbackNote.trim() ? `\n补充：${feedbackNote.trim()}` : ""}`;
    if (navigator.share) { try { await navigator.share({ title: "织屿匿名体验反馈", text }); return; } catch { /* participant cancelled */ } }
    try { await navigator.clipboard.writeText(text); setStorageNote("匿名反馈内容已复制，可粘贴到你选择的私聊或匿名问卷；私聊渠道仍可能显示你的账号身份。"); }
    catch { setError("当前浏览器无法复制，请截屏这组反馈后再私下发送。"); }
  }
  async function downloadArchive() {
    if (!allComplete) return; const canvas = document.createElement("canvas"); canvas.width = 1240; canvas.height = 3150; const context = canvas.getContext("2d"); if (!context) return;
    context.fillStyle = "#F1EEE8"; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#2F5D62"; context.fillRect(70, 70, 1100, 16);
    context.fillStyle = "#1F2B2A"; context.font = "700 76px serif"; context.fillText("我的7日内在作品档案", 70, 190); context.fillStyle = "#667270"; context.font = "28px sans-serif"; context.fillText("七次表达并置在一起，不作诊断，也不替你解释。", 70, 245);
    for (let index = 0; index < sortedRecords.length; index += 1) { const record = sortedRecords[index]; const x = index % 2 === 0 ? 70 : 640; const y = 330 + Math.floor(index / 2) * 590; context.fillStyle = "#FBF8F3"; context.beginPath(); context.roundRect(x, y, 530, 530, 24); context.fill(); const image = await loadImage(record.image); context.save(); context.beginPath(); context.roundRect(x + 20, y + 20, 490, 390, 18); context.clip(); context.drawImage(image, x + 20, y + 20, 490, 390); context.restore(); context.fillStyle = "#2F5D62"; context.font = "600 22px sans-serif"; context.fillText(`DAY ${padDay(record.day)} · ${dayPlans[record.day - 1].shortTitle}`, x + 24, y + 452); context.fillStyle = "#1F2B2A"; context.font = "600 30px serif"; wrapText(context, `《${record.title}》`, x + 24, y + 495, 480, 34, 1); }
    context.fillStyle = "#E7DED4"; context.beginPath(); context.roundRect(70, 2760, 1100, 290, 24); context.fill(); context.fillStyle = "#2F5D62"; context.font = "600 25px sans-serif"; context.fillText("回看线索（来自你的自述，不是心理分析）", 100, 2820); context.fillStyle = "#1F2B2A"; context.font = "34px serif"; wrapText(context, `这七天反复出现的感受词：${feelingSummary.join("、") || "尚未命名"}。能量记录从 ${sortedRecords[0].energy} 到 ${sortedRecords[6].energy}。此刻你最想把哪一个元素带回生活？`, 100, 2880, 1030, 48, 3); context.fillStyle = "#667270"; context.font = "22px sans-serif"; context.fillText("织屿心理 · 表达性艺术探索不是心理咨询或治疗", 70, 3110);
    downloadDataUrl(canvas.toDataURL("image/png"), "我的7日内在作品档案.png");
  }

  if (!unlocked) return <main className="gate-shell"><section className="gate-card"><span className="gate-badge">织屿心理 · 伙伴体验版</span><h1>把自己<br />画回来</h1><p>一个用颜色、书写和觉察慢慢靠近自己的7日表达性艺术探索。</p><form onSubmit={unlock}><label htmlFor="demo-code">输入6位体验码</label><input id="demo-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="••••••" />{codeError && <small role="alert">{codeError}</small>}<button type="submit">进入体验 <span>→</span></button></form><div className="privacy-note"><strong>作品只保存在当前设备</strong><span>不会上传到织屿。请连续使用同一台设备和同一浏览器；清除浏览器数据会同时清除作品册。请勿填写姓名、诊断史或联系方式。</span></div></section></main>;

  return <main className="app-shell">
    <header className="topbar"><button className="brand-mark" onClick={showGallery}>织屿心理</button><div><span>{completed}/7 已完成</span><button onClick={showGallery}>7日作品册</button></div></header>
    {storageNote && <div className="storage-banner">{storageNote}</div>}{error && <div className="error-banner" role="alert">{error}</div>}
    {phase === "create" && <><section className="intro-card"><div className="eyebrow">DAY {padDay(day)} / 07 · {plan.shortTitle}</div><h1>{plan.title}</h1><p>{plan.prompt}</p><div className="starter-note">起笔提示：{plan.starter}</div><div className="time-note"><span>约5分钟</span><span>没有标准答案</span><span>不分析画作</span></div></section><section className="studio" aria-label="绘画工作台"><div className="canvas-frame"><canvas ref={canvasRef} className="art-canvas" aria-label="用手指或鼠标自由绘画" onPointerDown={begin} onPointerMove={draw} onPointerUp={() => drawing.current = false} onPointerCancel={() => drawing.current = false} />{!started && <div className="canvas-hint" aria-hidden="true"><span />从这里落下第一笔</div>}</div><div className="art-tools"><div className="tool-section"><div className="tool-heading"><span>画材</span><button onClick={clearCanvas}>清空画布</button></div><div className="brush-types" aria-label="选择画材">{brushOptions.map((item) => <button key={item.id} className={brushType === item.id ? "selected" : ""} onClick={() => setBrushType(item.id)} aria-pressed={brushType === item.id}><i className={`brush-stroke ${item.id}`} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}</div></div><div className="tool-section"><div className="tool-heading"><span>笔触粗细</span><small>{brushSizes.find((item) => item.value === brush)?.label}</small></div><div className="brush-sizes" aria-label="选择笔触粗细">{brushSizes.map((item) => <button key={item.value} className={brush === item.value ? "selected" : ""} onClick={() => setBrush(item.value)} aria-label={`${item.label}笔触`} aria-pressed={brush === item.value}><i style={{ width: Math.max(5, item.value * .62), height: Math.max(5, item.value * .62), background: color }} /><span>{item.label}</span></button>)}</div></div><div className="tool-section"><div className="tool-heading"><span>色彩 · 36色</span><small>也可以自选</small></div><div className="palette" aria-label="选择画笔颜色">{palette.map((item) => <button key={item} className={`swatch ${color === item ? "selected" : ""}`} style={{ background: item }} aria-label={`选择颜色 ${item}`} onClick={() => setColor(item)} aria-pressed={color === item} />)}<label className="custom-color" aria-label="自选颜色"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>＋</span></label></div></div></div></section><section className="next-step"><div><span>{padDay(day)}</span><p>{plan.takeaway}</p></div><button className="primary-button" disabled={!started && !previewUrl} onClick={finishPainting}>完成这幅画 <span>→</span></button></section></>}
    {phase === "reflect" && <section className="reflection-flow"><button className="back-button" onClick={() => setPhase("create")}>← 回到画布</button><div className="art-preview"><img src={previewUrl} alt="刚刚完成的作品" /></div><div className="section-heading"><span>STEP 02</span><h2>由你来解释这幅画</h2><p>我们不会根据颜色或线条判断你的心理状态。回应只来自你愿意说出的部分。</p></div><label className="field"><span>{plan.reflectionLabel}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} placeholder={plan.titlePlaceholder} /></label><fieldset><legend>此刻更接近哪些感受？<small>最多选3个，也可以不命名</small></legend><div className="choice-cloud">{feelingsList.map((item) => <button type="button" key={item} className={feelings.includes(item) ? "active" : ""} onClick={() => toggleFeeling(item)}>{item}</button>)}</div></fieldset><label className="field range-field"><span>这幅作品现在有多少能量？<strong>{energyText}</strong></span><input type="range" min="1" max="5" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} /><div className="range-labels"><i>很轻</i><i>很充沛</i></div></label><fieldset><legend>你最想让人留意画面里的什么？</legend><div className="choice-cloud">{focusList.map((item) => <button type="button" key={item} className={focus === item ? "active" : ""} onClick={() => setFocus(item)}>{item}</button>)}</div></fieldset><label className="field"><span>如果愿意，再留下一句话<small>只保存在当前设备</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="我画到这里时，注意到……" /></label><fieldset><legend>今天希望怎样被回应？</legend><div className="response-grid">{responseOptions.map((item) => <button type="button" key={item.id} className={responseMode === item.id ? "active" : ""} onClick={() => setResponseMode(item.id)}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</div></fieldset><button className="primary-button" onClick={completeReflection}>保存并看看回应 <span>→</span></button></section>}
    {phase === "result" && <section className="result-flow"><div className="completion-mark">{padDay(day)}</div><div className="eyebrow">今天的作品完成了</div><h1>《{title}》</h1><div className="art-preview result-art"><img src={previewUrl} alt={title} /></div><div className="mirror-card"><span>即时镜面回应 · 体验版</span><p>{mirrorFeedback()}</p><small>回应只复述你主动提供的信息，不分析颜色、符号或人格。</small></div><div className="local-card"><strong>已经放进本机作品册</strong><p>作品只留在当前设备和浏览器，不会上传。建议同时下载一份到相册。</p><button onClick={downloadArtwork}>下载这幅作品</button></div><div className="share-card"><span>由你决定要不要分享</span><h2>生成一张自主分享卡</h2><p>不会自动发群，也不要求公开作品。先选择你愿意让别人看见到哪一步。</p><div className="share-options">{shareOptions.map((item) => <button key={item.id} className={shareMode === item.id ? "active" : ""} onClick={() => setShareMode(item.id)}><strong>{item.label}</strong><small>{item.hint}</small></button>)}</div><button className="card-action" onClick={makeShareCard}>生成 / 分享卡片</button></div>{[1, 4, 7].includes(day) && <div className="feedback-entry"><span>第 {day} 天体验脉冲</span><h2>愿意留下一份体验反馈吗？</h2><p>不评价你的作品，只记录体验是否顺畅。可以仅存本机，也可以生成不含姓名的文字后自行私下发送。</p><button onClick={() => setFeedbackOpen((value) => !value)}>{feedbackOpen ? "暂时收起" : "填写约30秒"}</button></div>}{feedbackOpen && <div className="feedback-form"><label className="field range-field"><span>今天的参与感<strong>{engagement}/5</strong></span><input type="range" min="1" max="5" value={engagement} onChange={(event) => setEngagement(Number(event.target.value))} /></label><fieldset><legend>哪里最容易卡住？</legend><div className="choice-cloud">{["不知道怎么开始", "操作不顺", "问题太难", "不想公开", "没有明显卡点"].map((item) => <button type="button" key={item} className={hesitation === item ? "active" : ""} onClick={() => setHesitation(item)}>{item}</button>)}</div></fieldset><fieldset><legend>你还愿意继续下一天吗？</legend><div className="choice-cloud">{["愿意继续", "需要更短", "暂时不想"].map((item) => <button type="button" key={item} className={continueChoice === item ? "active" : ""} onClick={() => setContinueChoice(item)}>{item}</button>)}</div></fieldset><label className="field"><span>还有一句想告诉设计者的话<small>选填</small></span><textarea value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} maxLength={180} /></label><button className="card-action" onClick={saveFeedback}>只保存到本机</button><button className="card-action secondary-action" onClick={shareFeedbackPrivately}>生成并私下发送</button><small className="identity-note">反馈文字不含姓名；如果用微信私聊发送，对方仍会看到你的账号身份。</small></div>}{day < 7 && <button className="primary-button" onClick={() => resetFields(day + 1)}>进入 Day {padDay(day + 1)} <span>→</span></button>}{day === 7 && allComplete && <button className="primary-button" onClick={downloadArchive}>下载7日个人作品档案 <span>↓</span></button>}<button className="primary-button secondary" onClick={showGallery}>查看7日作品册 <span>▦</span></button></section>}
    {phase === "gallery" && <section className="gallery-flow"><div className="eyebrow">我的本地作品册</div><h1>七天，不是七份作业</h1><p className="gallery-intro">每一天只留下一个当时的切片。完成度保存在当前设备，不做排名，也不会上传。</p><div className="progress-track"><i style={{ width: `${completed / 7 * 100}%` }} /></div><div className="progress-copy"><span>已完成 {completed} 天</span><span>{allComplete ? "可以收束了" : `还剩 ${7 - completed} 天`}</span></div><div className="gallery-grid">{dayPlans.map((item) => { const record = records.find((saved) => saved.day === item.day); return <button key={item.day} className={record ? "complete" : "pending"} onClick={() => openDay(item.day)}>{record ? <img src={record.image} alt={`Day ${item.day} 作品`} /> : <div className="empty-art"><span>{padDay(item.day)}</span><i /></div>}<span>DAY {padDay(item.day)} · {item.shortTitle}</span><strong>{record ? `《${record.title}》` : "等待你的这一笔"}</strong></button>; })}</div>{allComplete ? <div className="day-seven-summary"><span>DAY 07 · 收束</span><h2>把七幅作品放在一起看看</h2><p>你在七天里记录过的感受词包括：<strong>{feelingSummary.join("、") || "尚未命名"}</strong>。这只是你自述内容的并置，不是心理分析。</p><ul><li>哪一个元素在不同作品里再次出现？</li><li>哪一天的自己最让现在的你意外？</li><li>接下来，你想保留、松开或继续靠近什么？</li></ul><button className="card-action" onClick={downloadArchive}>下载7日个人作品档案</button></div> : <button className="primary-button" onClick={() => resetFields(dayPlans.find((item) => !records.some((record) => record.day === item.day))?.day ?? 1)}>继续下一幅作品 <span>→</span></button>}</section>}
    <footer><span>表达性艺术探索 · 不是心理咨询或治疗</span><span>© 织屿心理</span></footer>
  </main>;
}
