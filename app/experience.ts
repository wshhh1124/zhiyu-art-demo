export type DayPlan = {
  day: number;
  shortTitle: string;
  title: string;
  titleEmphasis: string;
  titleSecondaryEmphasis?: string;
  practiceAim: string;
  aimEmphasis: string;
  context: string;
  contextEmphasis: string;
  prepare: string;
  permission: string;
  prompt: string;
  promptEmphasis: string;
  starter: string;
  starterPrompts: [string, string, string];
  reflectionLabel: string;
  titlePlaceholder: string;
  takeaway: string;
  closing: string;
};

export type DayRecord = {
  day: number;
  title: string;
  image: string;
  feelings: string[];
  energy: number;
  focus: string;
  note: string;
  responseMode: string;
  completedAt: string;
};

export type FeedbackDraft = {
  day: number;
  engagement: number;
  hesitation: string;
  continueChoice: string;
  note: string;
  savedAt: string;
};

export type ParticipantProfile = {
  id: "profile";
  participantId: string;
  startedAt: string;
};

export type ArtworkDraft = {
  day: number;
  image: string;
  importedArtwork: boolean;
  updatedAt: string;
};

export type ExperienceBackup = {
  version: 1;
  exportedAt: string;
  profile: ParticipantProfile | null;
  days: DayRecord[];
  feedback: FeedbackDraft[];
  drafts: ArtworkDraft[];
};

export const dayPlans: DayPlan[] = [
  {
    day: 1,
    shortTitle: "内在天气",
    title: "把此刻的自己画成一种天气",
    titleEmphasis: "天气",
    practiceAim: "先看见感受，不急着解释感受",
    aimEmphasis: "看见感受",
    promptEmphasis: "三种颜色",
    context: "感受还没变成语言时，可能像气压、温度或颜色。今天只把它放到画面上，不追问原因。",
    contextEmphasis: "不追问原因",
    prepare: "找一个舒服、安静的位置。",
    permission: "只画颜色和线条即可；不必回忆事件，也不用给别人看。",
    prompt: "不用画得像，也不用先想明白。从色盘里选三种颜色，用线条、色块或随手的形状，画出“此刻待在我身体里的天气”。",
    starter: "先选一种最明显的感受颜色。",
    starterPrompts: ["哪一种颜色最像它？", "它更像线条、色块，还是一团雾？", "它在身体里占多大地方？"],
    reflectionLabel: "给今天的天气取一个名字",
    titlePlaceholder: "例如：雨停之前、安静的漩涡……",
    takeaway: "练习把模糊的内在体验变成可以被看见的形状。",
    closing: "把目光从画面移回房间，找一件让你觉得熟悉或稳定的物品。今天不必继续想明白，先让这幅天气停在这里。",
  },
  {
    day: 2,
    shortTitle: "身体信号",
    title: "画一张身体正在发送的信号",
    titleEmphasis: "信号",
    titleSecondaryEmphasis: "身体",
    practiceAim: "辨认身体感觉，而不是替它下结论",
    aimEmphasis: "身体感觉",
    promptEmphasis: "最有存在感的位置",
    context: "身体常比语言更早出现紧、热、沉或轻。今天只注意它的位置和强弱，不给它下结论。",
    contextEmphasis: "不给它下结论",
    prepare: "双脚接地，保持自然呼吸。",
    permission: "避开最不舒服处也可以，只选一个容易靠近的感觉。",
    prompt: "闭眼停留三个呼吸，找到此刻身体里最有存在感的位置。用颜色、方向和轻重画出它的感觉，不需要画人体。",
    starter: "它像一团、一道线，还是一种温度？",
    starterPrompts: ["它像什么形状？", "它在向里缩、向外顶，还是停在原地？", "它更像冷、热、沉、轻，还是别的？"],
    reflectionLabel: "为这个身体信号取一个名字",
    titlePlaceholder: "例如：肩膀上的小石头、胸口的风……",
    takeaway: "在解释之前，先辨认身体已经知道的事情。",
    closing: "轻轻活动肩膀、手指和脚趾，感觉身体与椅子或地面的接触。你可以带走一个发现，其余的先不处理。",
  },
  {
    day: 3,
    shortTitle: "未完的话",
    title: "让一句没有说完的话拥有形状",
    titleEmphasis: "没有说完的话",
    practiceAim: "让未完成的表达有一个可控的出口",
    aimEmphasis: "可控的出口",
    promptEmphasis: "一个关键词",
    context: "没有说完的话，可以先留在画面里。它不等于你必须对谁说出口。",
    contextEmphasis: "不等于你必须",
    prepare: "选一件强度还能承受的小事。",
    permission: "不写名字、不讲完整故事也可以；随时可涂掉或跳过。",
    prompt: "想起一句最近常在心里出现、却没有说完的话。不要写出具体人名，把这句话拆成颜色、笔画和留白。你可以覆盖、涂改，也可以只保留一个关键词。",
    starter: "从“其实我想……”开始，再让画面盖住它。",
    starterPrompts: ["这句话最想从哪里开始？", "哪一个词最不想露出来？", "它需要被写清，还是被盖住？"],
    reflectionLabel: "这句话今天叫什么",
    titlePlaceholder: "例如：差一点说出口、被涂掉的但是……",
    takeaway: "让未完成的表达有一个安全出口，而不是逼自己立刻说清楚。",
    closing: "把画面放下，对自己说：“今天先说到这里。”再看一看此刻的时间和所在的房间，让注意回到现在。",
  },
  {
    day: 4,
    shortTitle: "边界空间",
    title: "为自己造一个可以呼吸的边界",
    titleEmphasis: "边界",
    practiceAim: "感受选择权，而不是练习把所有人推开",
    aimEmphasis: "选择权",
    promptEmphasis: "门由谁打开",
    context: "边界是分辨此刻什么可以靠近、什么需要等等的选择权。今天只在画面里试一试。",
    contextEmphasis: "选择权",
    prepare: "从独处时间、聊天频率等小场景开始。",
    permission: "它可以坚硬、柔软或会移动，没有标准画法。",
    prompt: "画一个属于你的空间。它可以有墙、门、窗、桥或柔软的边缘。决定什么可以进来、什么先留在外面，以及门由谁打开。",
    starter: "边界可以是一扇由你开合的门。",
    starterPrompts: ["它的边缘是硬的、软的，还是会移动？", "哪里可以进来？哪里先等等？", "这扇门由谁打开？"],
    reflectionLabel: "为这个空间取一个名字",
    titlePlaceholder: "例如：只由我开门的房间、会呼吸的篱笆……",
    takeaway: "体验边界的核心不是拒绝，而是保留选择靠近与离开的权利。",
    closing: "看一看你画出的门、边缘或通道。今天只需要记住一个最小信号：当你想停一下时，你有权让自己慢一点。",
  },
  {
    day: 5,
    shortTitle: "关系距离",
    title: "画出一段关系里舒服的距离",
    titleEmphasis: "舒服的距离",
    practiceAim: "观察距离带来的感受，不评判关系好坏",
    aimEmphasis: "距离带来的感受",
    promptEmphasis: "更舒服",
    context: "舒服的距离会随情境改变。今天只看画面里的你怎样更自在，不给关系下结论。",
    contextEmphasis: "不给关系下结论",
    prepare: "选一段你现在能够承受的关系。",
    permission: "可以用想象人物，或只画“我”和外部世界。",
    prompt: "用两个形状代表“我”和“某个重要的人”，不写名字。移动它们的大小、方向和距离，直到画面里的你感觉稍微更舒服。",
    starter: "先画“我”，再决定另一个形状该离多远。",
    starterPrompts: ["“我”在画面里要多大？", "另一个形状离多远刚好？", "中间需要一条线、一扇门还是一段空白？"],
    reflectionLabel: "为这段距离取一个名字",
    titlePlaceholder: "例如：靠近但不淹没、隔着一条小河……",
    takeaway: "关系不是只有靠近或离开，还可以协商一种刚刚好的距离。",
    closing: "把注意重新放回代表“我”的形状，为它补上一种支持性的颜色或空间。画面不需要替你决定现实中的去留。",
  },
  {
    day: 6,
    shortTitle: "内在支撑",
    title: "画出那些正在托住你的东西",
    titleEmphasis: "托住你",
    practiceAim: "把微小而真实的支撑变得更容易辨认",
    aimEmphasis: "真实的支撑",
    promptEmphasis: "松一口气",
    context: "支撑也可以很小：一杯水、一束光、一句不催促的话。今天把它画具体，方便以后再找到。",
    contextEmphasis: "很小",
    prepare: "想起最近让你稍微松动的一个瞬间。",
    permission: "真实或想象的支撑都可以；想不到就画你希望有的。",
    prompt: "回想最近一个让你稍微松一口气的时刻。把其中的物件、声音、动作或陪伴画成一个支撑系统，真实或想象都可以。",
    starter: "从一杯水、一束光或一次呼吸开始。",
    starterPrompts: ["最近什么让你稍微松一口气？", "它更像物件、光，还是一个动作？", "把它放在哪里，会更容易靠近？"],
    reflectionLabel: "为这份支撑取一个名字",
    titlePlaceholder: "例如：不会催我的角落、掌心里的灯……",
    takeaway: "把资源具体化，困难出现时更容易重新找到它。",
    closing: "从画面里选一项今天能够接近的支撑：喝水、走到窗边、联系一个可信任的人，或只是再停留一次呼吸。",
  },
  {
    day: 7,
    shortTitle: "内在地图",
    title: "为这七天画一张内在地图",
    titleEmphasis: "内在地图",
    practiceAim: "把七次表达并置起来，而不是给自己做总结判定",
    aimEmphasis: "七次表达并置",
    promptEmphasis: "最想带走",
    context: "把七个时刻放在一起，看见重复、变化和仍开放的部分；不为自己下结论。",
    contextEmphasis: "不为自己下结论",
    prepare: "快速看一遍前六幅，每幅只挑一个吸引你的元素。",
    permission: "不必完整、连贯或积极；可以只留三个元素。",
    prompt: "回看前六幅作品，选出反复出现或最想带走的颜色、线条与形状，把它们重新放进同一张画里。它不是总结答案，而是一张此刻的自我地图。",
    starter: "可以从三个元素开始：我要保留的、我要松开的、我要继续靠近的。",
    starterPrompts: ["哪一个元素想被保留？", "哪一个可以先松开？", "还有什么想继续靠近？"],
    reflectionLabel: "为这张内在地图取一个名字",
    titlePlaceholder: "例如：我正在经过的地方、七种天气之后……",
    takeaway: "把七次表达并置，看见变化、重复与仍然开放的问题。",
    closing: "为七天画下一个暂时的句号：说出一件想保留的、一件愿意松开的，以及一件还想慢慢靠近的事。答案以后可以改变。",
  },
];

const DB_NAME = "zhiyu-art-demo";
const DB_VERSION = 2;
type StoreName = "days" | "feedback" | "profile" | "drafts";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("days")) db.createObjectStore("days", { keyPath: "day" });
      if (!db.objectStoreNames.contains("feedback")) db.createObjectStore("feedback", { keyPath: "day" });
      if (!db.objectStoreNames.contains("profile")) db.createObjectStore("profile", { keyPath: "id" });
      if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts", { keyPath: "day" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeStore<T>(storeName: StoreName, value: T) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function readStore<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result as T[]); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function deleteFromStore(storeName: StoreName, key: IDBValidKey) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export const saveDayRecord = (record: DayRecord) => writeStore("days", record);
export const getDayRecords = () => readStore<DayRecord>("days");
export const saveFeedbackDraft = (draft: FeedbackDraft) => writeStore("feedback", draft);
export const getFeedbackDrafts = () => readStore<FeedbackDraft>("feedback");
export const saveParticipantProfile = (profile: ParticipantProfile) => writeStore("profile", profile);
export const getParticipantProfile = async () => (await readStore<ParticipantProfile>("profile"))[0] ?? null;
export const saveArtworkDraft = (draft: ArtworkDraft) => writeStore("drafts", draft);
export const getArtworkDraft = async (day: number) => (await readStore<ArtworkDraft>("drafts")).find((draft) => draft.day === day) ?? null;
export const deleteArtworkDraft = (day: number) => deleteFromStore("drafts", day);

export async function clearExperienceData() {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(["days", "feedback", "profile", "drafts"], "readwrite");
    transaction.objectStore("days").clear();
    transaction.objectStore("feedback").clear();
    transaction.objectStore("profile").clear();
    transaction.objectStore("drafts").clear();
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function createExperienceBackup(): Promise<ExperienceBackup> {
  const [profile, days, feedback, drafts] = await Promise.all([
    getParticipantProfile(),
    getDayRecords(),
    getFeedbackDrafts(),
    readStore<ArtworkDraft>("drafts"),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), profile, days, feedback, drafts };
}

function isValidBackup(value: unknown): value is ExperienceBackup {
  if (!value || typeof value !== "object") return false;
  const backup = value as Partial<ExperienceBackup>;
  return backup.version === 1 && Array.isArray(backup.days) && Array.isArray(backup.feedback) && Array.isArray(backup.drafts)
    && backup.days.every((record) => Number.isInteger(record?.day) && record.day >= 1 && record.day <= 7 && typeof record.image === "string")
    && (backup.profile === null || (typeof backup.profile?.participantId === "string" && typeof backup.profile?.startedAt === "string"));
}

export async function restoreExperienceBackup(raw: string): Promise<ExperienceBackup> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("INVALID_BACKUP"); }
  if (!isValidBackup(parsed)) throw new Error("INVALID_BACKUP");
  const backup = parsed;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(["days", "feedback", "profile", "drafts"], "readwrite");
    const days = transaction.objectStore("days"); const feedback = transaction.objectStore("feedback");
    const profile = transaction.objectStore("profile"); const drafts = transaction.objectStore("drafts");
    days.clear(); feedback.clear(); profile.clear(); drafts.clear();
    backup.days.forEach((record) => days.put(record));
    backup.feedback.forEach((record) => feedback.put(record));
    backup.drafts.forEach((record) => drafts.put(record));
    if (backup.profile) profile.put(backup.profile);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
  return backup;
}
