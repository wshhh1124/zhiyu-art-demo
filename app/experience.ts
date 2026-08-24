export type DayPlan = {
  day: number;
  shortTitle: string;
  title: string;
  prompt: string;
  starter: string;
  reflectionLabel: string;
  titlePlaceholder: string;
  takeaway: string;
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

export const dayPlans: DayPlan[] = [
  {
    day: 1,
    shortTitle: "内在天气",
    title: "把此刻的自己画成一种天气",
    prompt: "不用画得像，也不用先想明白。从色盘里选三种颜色，用线条、色块或随手的形状，画出“此刻待在我身体里的天气”。",
    starter: "如果不知道从哪里开始，先为最明显的感受选一种颜色。",
    reflectionLabel: "给今天的天气取一个名字",
    titlePlaceholder: "例如：雨停之前、安静的漩涡……",
    takeaway: "练习把模糊的内在体验变成可以被看见的形状。",
  },
  {
    day: 2,
    shortTitle: "身体信号",
    title: "画一张身体正在发送的信号",
    prompt: "闭眼停留三个呼吸，找到此刻身体里最有存在感的位置。用颜色、方向和轻重画出它的感觉，不需要画人体。",
    starter: "它更像一团、一条线、一块石头，还是一种温度？",
    reflectionLabel: "为这个身体信号取一个名字",
    titlePlaceholder: "例如：肩膀上的小石头、胸口的风……",
    takeaway: "在解释之前，先辨认身体已经知道的事情。",
  },
  {
    day: 3,
    shortTitle: "未完的话",
    title: "让一句没有说完的话拥有形状",
    prompt: "想起一句最近常在心里出现、却没有说完的话。不要写出具体人名，把这句话拆成颜色、笔画和留白。你可以覆盖、涂改，也可以只保留一个关键词。",
    starter: "先写下开头：“其实我想……”再允许画面把字盖住。",
    reflectionLabel: "这句话今天叫什么",
    titlePlaceholder: "例如：差一点说出口、被涂掉的但是……",
    takeaway: "让未完成的表达有一个安全出口，而不是逼自己立刻说清楚。",
  },
  {
    day: 4,
    shortTitle: "边界空间",
    title: "为自己造一个可以呼吸的边界",
    prompt: "画一个属于你的空间。它可以有墙、门、窗、桥或柔软的边缘。决定什么可以进来、什么先留在外面，以及门由谁打开。",
    starter: "边界不一定是一堵墙，也可能是一扇可以由你开合的门。",
    reflectionLabel: "为这个空间取一个名字",
    titlePlaceholder: "例如：只由我开门的房间、会呼吸的篱笆……",
    takeaway: "体验边界的核心不是拒绝，而是保留选择靠近与离开的权利。",
  },
  {
    day: 5,
    shortTitle: "关系距离",
    title: "画出一段关系里舒服的距离",
    prompt: "用两个形状代表“我”和“某个重要的人”，不写名字。移动它们的大小、方向和距离，直到画面里的你感觉稍微更舒服。",
    starter: "先画“我”，再决定另一个形状该离多远。",
    reflectionLabel: "为这段距离取一个名字",
    titlePlaceholder: "例如：靠近但不淹没、隔着一条小河……",
    takeaway: "关系不是只有靠近或离开，还可以协商一种刚刚好的距离。",
  },
  {
    day: 6,
    shortTitle: "内在支撑",
    title: "画出那些正在托住你的东西",
    prompt: "回想最近一个让你稍微松一口气的时刻。把其中的物件、声音、动作或陪伴画成一个支撑系统，真实或想象都可以。",
    starter: "从一个最小的支撑开始：一杯水、一束光、一次呼吸。",
    reflectionLabel: "为这份支撑取一个名字",
    titlePlaceholder: "例如：不会催我的角落、掌心里的灯……",
    takeaway: "把资源具体化，困难出现时更容易重新找到它。",
  },
  {
    day: 7,
    shortTitle: "内在地图",
    title: "为这七天画一张内在地图",
    prompt: "回看前六幅作品，选出反复出现或最想带走的颜色、线条与形状，把它们重新放进同一张画里。它不是总结答案，而是一张此刻的自我地图。",
    starter: "可以从三个元素开始：我要保留的、我要松开的、我要继续靠近的。",
    reflectionLabel: "为这张内在地图取一个名字",
    titlePlaceholder: "例如：我正在经过的地方、七种天气之后……",
    takeaway: "把七次表达并置，看见变化、重复与仍然开放的问题。",
  },
];

const DB_NAME = "zhiyu-art-demo";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("days")) db.createObjectStore("days", { keyPath: "day" });
      if (!db.objectStoreNames.contains("feedback")) db.createObjectStore("feedback", { keyPath: "day" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeStore<T>(storeName: "days" | "feedback", value: T) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function readStore<T>(storeName: "days" | "feedback"): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result as T[]); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export const saveDayRecord = (record: DayRecord) => writeStore("days", record);
export const getDayRecords = () => readStore<DayRecord>("days");
export const saveFeedbackDraft = (draft: FeedbackDraft) => writeStore("feedback", draft);
export const getFeedbackDrafts = () => readStore<FeedbackDraft>("feedback");
