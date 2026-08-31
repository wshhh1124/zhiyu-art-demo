"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addParticipantCode,
  deleteTeacherParticipant,
  generateParticipantCodes,
  getTeacherOverview,
  resetTeacherParticipant,
  setTeacherCurrentDay,
  TeacherOverview,
  updateTeacherParticipant,
} from "./cloudBackend";

function formatTime(value: string | null) {
  if (!value) return "尚未进入";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export default function TeacherDashboard() {
  const [password, setPassword] = useState("");
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [prefix, setPrefix] = useState("ZY");
  const [count, setCount] = useState(10);
  const [customCode, setCustomCode] = useState("");
  const [createdCodes, setCreatedCodes] = useState<string[]>([]);
  const [participantFilter, setParticipantFilter] = useState<"all" | "joined" | "unused" | "inactive">("all");
  const [participantQuery, setParticipantQuery] = useState("");
  const activeCount = useMemo(() => overview?.participants.filter((item) => item.status === "active").length ?? 0, [overview]);
  const joinedCount = useMemo(() => overview?.participants.filter((item) => item.joinedAt).length ?? 0, [overview]);
  const fullAttendance = useMemo(() => overview?.participants.filter((item) => item.completedDays.length === 7).length ?? 0, [overview]);
  const visibleParticipants = useMemo(() => {
    const query = participantQuery.trim().toUpperCase();
    return (overview?.participants ?? []).filter((item) => {
      const matchesQuery = !query || item.code.includes(query);
      const matchesFilter = participantFilter === "all"
        || (participantFilter === "joined" && Boolean(item.joinedAt))
        || (participantFilter === "unused" && !item.joinedAt && item.status === "active")
        || (participantFilter === "inactive" && item.status === "inactive");
      return matchesQuery && matchesFilter;
    });
  }, [overview, participantFilter, participantQuery]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("zhiyu-teacher-password");
    if (saved) { setPassword(saved); void load(saved); }
  }, []);

  async function run<T>(task: () => Promise<T>, apply?: (result: T) => void) {
    setLoading(true); setError(""); setNotice("");
    try { const result = await task(); apply?.(result); return result; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "操作失败，请重试。"); }
    finally { setLoading(false); }
  }
  async function load(secret = password) {
    await run(() => getTeacherOverview(secret), (result) => { setOverview(result); window.sessionStorage.setItem("zhiyu-teacher-password", secret); });
  }
  async function login(event: FormEvent) { event.preventDefault(); await load(); }
  async function changeDay(day: number) {
    if (!window.confirm(`确定把全员开放进度调整为 Day ${day} 吗？单独设置过的参与者不受影响。`)) return;
    await run(() => setTeacherCurrentDay(password, day), (result) => { setOverview(result); setNotice(`全员已开放到 Day ${day}。`); });
  }
  async function generate(event: FormEvent) {
    event.preventDefault();
    await run(() => generateParticipantCodes(password, prefix, count), (result) => { setOverview(result); setCreatedCodes(result.created || []); setNotice(`已生成 ${result.created?.length || 0} 个新编号。`); });
  }
  async function addCustom(event: FormEvent) {
    event.preventDefault();
    await run(() => addParticipantCode(password, customCode), (result) => { setOverview(result); setCreatedCodes([customCode.trim().toUpperCase()]); setCustomCode(""); setNotice("自定义编号已添加。") });
  }
  async function changeParticipant(code: string, update: { status?: "active" | "inactive"; dayOverride?: number | null }) {
    await run(() => updateTeacherParticipant(password, code, update), (result) => { setOverview(result); setNotice(`${code} 已更新。`); });
  }
  async function resetParticipant(code: string) {
    if (!window.confirm(`确定清空 ${code} 的云端加入时间、完成进度和个人开放设置吗？这不会删除对方手机里的作品。`)) return;
    await run(() => resetTeacherParticipant(password, code), (result) => { setOverview(result); setNotice(`${code} 的云端使用记录已清空，可以重新开始。`); });
  }
  async function deleteParticipant(code: string) {
    if (!window.confirm(`确定永久删除参与编号 ${code} 及其后端完成记录吗？此操作无法恢复，也不会删除对方手机里的作品。`)) return;
    await run(() => deleteTeacherParticipant(password, code), (result) => { setOverview(result); setNotice(`${code} 已删除。`); });
  }
  async function copyCodes() {
    if (!createdCodes.length) return;
    try { await navigator.clipboard.writeText(createdCodes.join("\n")); setNotice("新编号已复制，可以逐个发给参与者。") }
    catch { setError("浏览器无法自动复制，请手动选择下面的编号。") }
  }
  function logout() { window.sessionStorage.removeItem("zhiyu-teacher-password"); setPassword(""); setOverview(null); }

  if (!overview) return <main className="teacher-login-shell"><section className="teacher-login-card"><span>织屿心理 · 活动管理</span><h1>后端控制台</h1><p>管理本期开放进度和参与编号。管理员密码只保留在当前浏览器会话中。</p><form onSubmit={login}><label htmlFor="teacher-password">管理员密码</label><input id="teacher-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button disabled={loading}>{loading ? "正在连接……" : "进入后端控制台"}</button></form>{error && <div className="teacher-error" role="alert">{error}</div>}<small>请使用本期管理员密码进入；参与者页面不会显示或保存这个密码。</small></section></main>;

  return <main className="teacher-shell">
    <header className="teacher-header"><div><span>织屿心理 · 7日表达性艺术探索</span><h1>后端控制台</h1></div><div><button onClick={() => load()} disabled={loading}>刷新数据</button><button onClick={logout}>退出</button></div></header>
    {error && <div className="teacher-error" role="alert">{error}</div>}{notice && <div className="teacher-notice">{notice}</div>}
    <section className="teacher-metrics"><div><span>有效编号</span><strong>{activeCount}</strong></div><div><span>已经加入</span><strong>{joinedCount}</strong></div><div><span>七天全勤</span><strong>{fullAttendance}</strong></div><div><span>当前开放</span><strong>Day {overview.campaign.currentDay}</strong></div></section>
    <section className="teacher-panel"><div className="teacher-panel-heading"><div><span>开放控制</span><h2>全员开放到哪一天</h2></div><small>参与者刷新网页后生效</small></div><div className="teacher-day-buttons">{[1,2,3,4,5,6,7].map((day) => <button key={day} className={overview.campaign.currentDay === day ? "active" : ""} disabled={loading} onClick={() => changeDay(day)}>Day {day}</button>)}</div><p>调整为更早的天数不会删除已经完成的作品；给个人设置过“单独开放”的编号不受全员设置影响。</p></section>
    <section className="teacher-panel"><div className="teacher-panel-heading"><div><span>编号管理</span><h2>生成新参与编号</h2></div><small>建议一人一个编号</small></div><div className="teacher-create-grid"><form onSubmit={generate}><label>编号前缀<input value={prefix} onChange={(event) => setPrefix(event.target.value.toUpperCase())} maxLength={8} /></label><label>生成数量<input type="number" min="1" max="50" value={count} onChange={(event) => setCount(Number(event.target.value))} /></label><button disabled={loading}>批量生成</button></form><form onSubmit={addCustom}><label>添加指定编号<input value={customCode} onChange={(event) => setCustomCode(event.target.value.toUpperCase())} placeholder="例如 ZY-TEST01" maxLength={24} /></label><button disabled={loading || customCode.trim().length < 3}>添加编号</button></form></div>{createdCodes.length > 0 && <div className="teacher-created"><div><strong>本次新编号</strong><button onClick={copyCodes}>复制全部</button></div><pre>{createdCodes.join("\n")}</pre></div>}</section>
    <section className="teacher-panel teacher-participant-panel"><div className="teacher-panel-heading"><div><span>参与者总名单</span><h2>查看并控制所有参与编号</h2></div><small>{overview.participants.length} 个编号 · 当前显示 {visibleParticipants.length} 个</small></div><div className="teacher-list-tools"><input value={participantQuery} onChange={(event) => setParticipantQuery(event.target.value.toUpperCase())} placeholder="搜索参与编号" /><div>{([['all','全部'],['joined','已加入'],['unused','未使用'],['inactive','已暂停']] as const).map(([value, label]) => <button key={value} className={participantFilter === value ? "active" : ""} onClick={() => setParticipantFilter(value)}>{label}</button>)}</div></div>{overview.participants.length === 0 ? <div className="teacher-empty">还没有参与编号，先在上方生成一批。</div> : visibleParticipants.length === 0 ? <div className="teacher-empty">没有符合当前筛选条件的参与者。</div> : <div className="teacher-table-wrap"><table><thead><tr><th>编号</th><th>参与状态</th><th>完成进度</th><th>最后活动</th><th>开放控制</th><th>管理</th></tr></thead><tbody>{visibleParticipants.map((item) => <tr key={item.code}><td><strong>{item.code}</strong><small>{item.joinedAt ? `加入：${formatTime(item.joinedAt)}` : "尚未使用"}</small></td><td><i className={item.status}>{item.status === "active" ? "允许参与" : "已暂停"}</i></td><td><b>{item.completedDays.length}/7</b><small>{item.completedDays.length ? `Day ${item.completedDays.join("、")}` : "尚未完成"}</small></td><td>{formatTime(item.lastSeenAt)}</td><td><select value={item.dayOverride ?? ""} onChange={(event) => changeParticipant(item.code, { dayOverride: event.target.value ? Number(event.target.value) : null })}><option value="">跟随全员</option>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={day}>开放到 Day {day}</option>)}</select></td><td><div className="teacher-row-actions"><button className={item.status === "active" ? "danger" : "restore"} onClick={() => changeParticipant(item.code, { status: item.status === "active" ? "inactive" : "active" })}>{item.status === "active" ? "暂停参与" : "恢复参与"}</button><button className="reset" onClick={() => resetParticipant(item.code)}>清空记录</button><button className="reset" onClick={() => deleteParticipant(item.code)}>删除编号</button></div></td></tr>)}</tbody></table></div>}<p className="teacher-privacy-tip">后端控制台可查看编号、加入时间、完成天数和最后活动时间；作品、感受词和觉察文字仍只保存在参与者自己的设备中。</p></section>
    <footer className="teacher-footer"><span>后台不收集参与者作品和觉察内容</span><a href="./">返回参与者端</a></footer>
  </main>;
}
