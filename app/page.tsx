"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";

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
const brushSizes = [
  { value: 4, label: "细" },
  { value: 10, label: "中" },
  { value: 20, label: "粗" },
  { value: 34, label: "特粗" },
];
const feelingsList = ["平静", "紧绷", "混乱", "疲惫", "松动", "期待", "无法命名"];
const focusList = ["色彩", "线条", "留白", "重叠", "边缘"];
const responseOptions = [
  { id: "seen", label: "先看见我", hint: "如实复述，不解释" },
  { id: "question", label: "问我一个问题", hint: "给我继续探索的入口" },
  { id: "encourage", label: "给我一点鼓励", hint: "肯定我完成表达的过程" },
  { id: "quiet", label: "暂时不回应", hint: "允许作品只是它自己" },
] as const;

type BrushType = (typeof brushOptions)[number]["id"];
type Phase = "create" | "reflect" | "result";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [phase, setPhase] = useState<Phase>("create");
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

  useEffect(() => {
    if (!unlocked || phase !== "create") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const context = canvas.getContext("2d");
    context?.scale(ratio, ratio);
    if (context) {
      context.fillStyle = "#FBF8F3";
      context.fillRect(0, 0, rect.width, rect.height);
      context.lineCap = "round";
      context.lineJoin = "round";
    }
  }, [unlocked, phase]);

  const energyText = useMemo(
    () => ["", "很轻", "偏低", "中等", "在流动", "很充沛"][energy],
    [energy],
  );

  function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (code.trim() !== DEMO_CODE) {
      setCodeError("体验码不对，再和邀请你的伙伴确认一下。");
      return;
    }
    setCodeError("");
    setUnlocked(true);
  }

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function begin(event: PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    drawing.current = true;
    setStarted(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const current = point(event);
    const pressure = event.pressure > 0 ? 0.72 + event.pressure * 0.28 : 1;
    const style = {
      pencil: { width: brush * 0.55, alpha: 0.72, blur: 0 },
      oil: { width: brush * 1.1, alpha: 0.94, blur: 0 },
      watercolor: { width: brush * 1.55, alpha: 0.18, blur: brush * 0.42 },
    }[brushType];
    context.strokeStyle = color;
    context.lineWidth = style.width * pressure;
    context.globalAlpha = style.alpha;
    context.shadowColor = color;
    context.shadowBlur = style.blur;
    context.lineTo(current.x, current.y);
    context.stroke();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.shadowBlur = 0;
    context.fillStyle = "#FBF8F3";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    setStarted(false);
  }

  function finishPainting() {
    setPreviewUrl(canvasRef.current?.toDataURL("image/png") ?? "");
    setPhase("reflect");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleFeeling(item: string) {
    setFeelings((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : current.length < 3
          ? [...current, item]
          : current,
    );
  }

  function mirrorFeedback() {
    const feelingText = feelings.length ? feelings.join("、") : "还不急着命名的感受";
    const opening = `你把今天的作品叫作《${title.trim()}》。你留下了${feelingText}，此刻的能量感是“${energyText}”，最想让人留意的是${focus}。`;
    const endings: Record<string, string> = {
      seen: `我先把这些如实放在这里，不急着替你解释。${focus}已经替此刻的你留下了一点痕迹。`,
      question: focus === "留白" ? "如果这片留白可以多说一句，它会想为你保留什么？" : `如果画面里的${focus}可以移动一次，它更想靠近哪里，还是离开什么？`,
      encourage: "你不需要先把感受说清楚，才有资格表达。愿意落下这些颜色，本身已经是在靠近自己。",
      quiet: "这幅作品先停在这里。没有追加解释，也允许它暂时只是它自己。",
    };
    return `${opening}${endings[responseMode]}`;
  }

  function completeReflection() {
    if (!title.trim()) {
      setError("先为作品取一个只属于今天的名字。");
      return;
    }
    setError("");
    setPhase("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restart() {
    setPhase("create");
    setStarted(false);
    setPreviewUrl("");
    setTitle("");
    setFeelings([]);
    setEnergy(3);
    setFocus("色彩");
    setResponseMode("seen");
    setNote("");
    setError("");
  }

  function downloadArtwork() {
    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = `${title.trim() || "我的内在天气"}.png`;
    link.click();
  }

  if (!unlocked) {
    return (
      <main className="gate-shell">
        <section className="gate-card">
          <span className="gate-badge">织屿心理 · 伙伴体验版</span>
          <h1>把自己<br />画回来</h1>
          <p>一个用颜色、书写和觉察慢慢靠近自己的表达性艺术探索。</p>
          <form onSubmit={unlock}>
            <label htmlFor="demo-code">输入6位体验码</label>
            <input id="demo-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="••••••" />
            {codeError && <small role="alert">{codeError}</small>}
            <button type="submit">进入体验 <span>→</span></button>
          </form>
          <div className="privacy-note"><strong>这是一份无记录体验</strong><span>作品不会上传或长期保存，刷新页面即清除。请勿填写姓名、诊断史或联系方式等个人信息。</span></div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand-mark" onClick={restart}>织屿心理</button>
        <span>伙伴体验版 · 不上传作品</span>
      </header>
      {error && <div className="error-banner" role="alert">{error}</div>}

      {phase === "create" && (
        <>
          <section className="intro-card">
            <div className="eyebrow">DAY 01 / 07 · 内在天气</div>
            <h1>把此刻的自己<br />画成一种天气</h1>
            <p>不用画得像，也不用先想明白。从色盘里选三种颜色，用线条、色块或随手的形状，画出“此刻待在我身体里的天气”。</p>
            <div className="time-note"><span>约5分钟</span><span>没有标准答案</span><span>不分析画作</span></div>
          </section>

          <section className="studio" aria-label="绘画工作台">
            <div className="canvas-frame">
              <canvas ref={canvasRef} className="art-canvas" aria-label="用手指或鼠标自由绘画" onPointerDown={begin} onPointerMove={draw} onPointerUp={() => drawing.current = false} onPointerCancel={() => drawing.current = false} />
              {!started && <div className="canvas-hint" aria-hidden="true"><span />从这里落下第一笔</div>}
            </div>
            <div className="art-tools">
              <div className="tool-section">
                <div className="tool-heading"><span>画材</span><button onClick={clearCanvas}>清空画布</button></div>
                <div className="brush-types" aria-label="选择画材">
                  {brushOptions.map((item) => <button key={item.id} className={brushType === item.id ? "selected" : ""} onClick={() => setBrushType(item.id)} aria-pressed={brushType === item.id}><i className={`brush-stroke ${item.id}`} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}
                </div>
              </div>
              <div className="tool-section">
                <div className="tool-heading"><span>笔触粗细</span><small>{brushSizes.find((item) => item.value === brush)?.label}</small></div>
                <div className="brush-sizes" aria-label="选择笔触粗细">
                  {brushSizes.map((item) => <button key={item.value} className={brush === item.value ? "selected" : ""} onClick={() => setBrush(item.value)} aria-label={`${item.label}笔触`} aria-pressed={brush === item.value}><i style={{ width: Math.max(5, item.value * 0.62), height: Math.max(5, item.value * 0.62), background: color }} /><span>{item.label}</span></button>)}
                </div>
              </div>
              <div className="tool-section">
                <div className="tool-heading"><span>色彩 · 36色</span><small>也可以自选</small></div>
                <div className="palette" aria-label="选择画笔颜色">
                  {palette.map((item) => <button key={item} className={`swatch ${color === item ? "selected" : ""}`} style={{ background: item }} aria-label={`选择颜色 ${item}`} onClick={() => setColor(item)} aria-pressed={color === item} />)}
                  <label className="custom-color" aria-label="自选颜色"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>＋</span></label>
                </div>
              </div>
            </div>
          </section>
          <section className="next-step"><div><span>01</span><p>画完以后，不需要解释得很完整。只要告诉我们：这幅作品对你来说是什么。</p></div><button className="primary-button" disabled={!started} onClick={finishPainting}>完成这幅画 <span>→</span></button></section>
        </>
      )}

      {phase === "reflect" && (
        <section className="reflection-flow">
          <button className="back-button" onClick={() => setPhase("create")}>← 回到画布</button>
          <div className="art-preview"><img src={previewUrl} alt="你刚刚完成的内在天气作品" /></div>
          <div className="section-heading"><span>STEP 02</span><h2>由你来解释这幅画</h2><p>我们不会根据颜色或线条判断你的心理状态。回应只来自你愿意说出的部分。</p></div>
          <label className="field"><span>给今天的天气取一个名字</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} placeholder="例如：雨停之前、安静的漩涡……" /></label>
          <fieldset><legend>此刻更接近哪些感受？<small>最多选3个，也可以不命名</small></legend><div className="choice-cloud">{feelingsList.map((item) => <button type="button" key={item} className={feelings.includes(item) ? "active" : ""} onClick={() => toggleFeeling(item)}>{item}</button>)}</div></fieldset>
          <label className="field range-field"><span>这幅天气现在有多少能量？<strong>{energyText}</strong></span><input type="range" min="1" max="5" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} /><div className="range-labels"><i>很轻</i><i>很充沛</i></div></label>
          <fieldset><legend>你最想让人留意画面里的什么？</legend><div className="choice-cloud">{focusList.map((item) => <button type="button" key={item} className={focus === item ? "active" : ""} onClick={() => setFocus(item)}>{item}</button>)}</div></fieldset>
          <label className="field"><span>如果愿意，再留下一句话<small>只保留在当前页面</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="我画到这里时，注意到……" /></label>
          <fieldset><legend>今天希望怎样被回应？</legend><div className="response-grid">{responseOptions.map((item) => <button type="button" key={item.id} className={responseMode === item.id ? "active" : ""} onClick={() => setResponseMode(item.id)}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</div></fieldset>
          <button className="primary-button" onClick={completeReflection}>看看今天的回应 <span>→</span></button>
        </section>
      )}

      {phase === "result" && (
        <section className="result-flow">
          <div className="completion-mark">01</div>
          <div className="eyebrow">今天的作品完成了</div>
          <h1>《{title}》</h1>
          <div className="art-preview result-art"><img src={previewUrl} alt={title} /></div>
          <div className="mirror-card"><span>即时镜面回应 · 体验版</span><p>{mirrorFeedback()}</p><small>回应只复述你主动提供的信息，不分析颜色、符号或人格。</small></div>
          <div className="local-card"><strong>作品没有上传</strong><p>你可以下载到自己的设备，也可以直接关闭页面。体验版不会建立参与者档案。</p><button onClick={downloadArtwork}>下载我的作品</button></div>
          <div className="review-card"><span>给织屿的体验反馈</span><h2>请带着三个问题回到伙伴群</h2><ol><li>哪个瞬间最有参与感？</li><li>哪一步让你犹豫或想退出？</li><li>如果连续体验7天，你希望最后得到什么？</li></ol></div>
          <button className="primary-button secondary" onClick={restart}>再体验一次 <span>↺</span></button>
        </section>
      )}

      <footer><span>表达性艺术探索 · 不是心理咨询或治疗</span><span>© 织屿心理</span></footer>
    </main>
  );
}
