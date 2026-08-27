export type ParticipantAccess = {
  code: string;
  status: "active" | "inactive";
  currentDay: number;
  dayOverride: number | null;
  completedDays: number[];
  joinedAt: string | null;
};

export type TeacherParticipant = {
  code: string;
  status: "active" | "inactive";
  dayOverride: number | null;
  completedDays: number[];
  createdAt: string;
  joinedAt: string | null;
  lastSeenAt: string | null;
  latestCompletionAt: string | null;
};

export type TeacherOverview = {
  campaign: { currentDay: number; status: string; updatedAt: string };
  participants: TeacherParticipant[];
  created?: string[];
};

export const CLOUD_BACKEND_URL = "https://cloud1-5gbfrdn5944358bc.service.tcloudbase.com/zhiyu-api";

type BackendEnvelope<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export class BackendError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

async function request<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!CLOUD_BACKEND_URL) throw new BackendError("BACKEND_NOT_DEPLOYED", "老师后台正在连接中，请稍后再试。");
  let response: Response;
  try {
    response = await fetch(CLOUD_BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch { throw new BackendError("NETWORK_ERROR", "暂时无法连接活动后台，请检查网络后重试。"); }
  const result = await response.json().catch(() => null) as BackendEnvelope<T> | null;
  if (!result || !result.ok) throw new BackendError(result?.code || "BACKEND_ERROR", result?.message || "活动后台暂时不可用。");
  return result.data;
}

export const joinWithParticipantCode = (participantCode: string) => request<ParticipantAccess>("participant.join", { participantCode });
export const refreshParticipantAccess = (participantCode: string) => request<ParticipantAccess>("participant.refresh", { participantCode });
export const syncParticipantCompletion = (participantCode: string, day: number, completedAt: string) => request<{ synced: true; completedDays: number[] }>("participant.complete", { participantCode, day, completedAt });
export const getTeacherOverview = (adminPassword: string) => request<TeacherOverview>("admin.overview", { adminPassword });
export const setTeacherCurrentDay = (adminPassword: string, currentDay: number) => request<TeacherOverview>("admin.setDay", { adminPassword, currentDay });
export const generateParticipantCodes = (adminPassword: string, prefix: string, count: number) => request<TeacherOverview>("admin.generate", { adminPassword, prefix, count });
export const addParticipantCode = (adminPassword: string, participantCode: string) => request<TeacherOverview>("admin.addCode", { adminPassword, participantCode });
export const updateTeacherParticipant = (adminPassword: string, participantCode: string, update: { status?: "active" | "inactive"; dayOverride?: number | null }) => request<TeacherOverview>("admin.updateParticipant", { adminPassword, participantCode, ...update });
export const resetTeacherParticipant = (adminPassword: string, participantCode: string) => request<TeacherOverview>("admin.resetParticipant", { adminPassword, participantCode });
