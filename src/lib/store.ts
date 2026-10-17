export type Photo = { id: string; src: string; original?: string; createdAt: number; label?: string; pending?: boolean };

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open("lumen", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function listPhotos(): Promise<Photo[]> {
  const d = await db();
  return new Promise((res) => {
    const q = d.transaction("photos").objectStore("photos").getAll();
    q.onsuccess = () => res((q.result as Photo[]).sort((a, b) => b.createdAt - a.createdAt));
  });
}
export async function savePhoto(p: Photo) {
  const d = await db();
  d.transaction("photos", "readwrite").objectStore("photos").put(p);
}
export async function deletePhoto(id: string) {
  const d = await db();
  d.transaction("photos", "readwrite").objectStore("photos").delete(id);
}

export const DAILY_TRIALS = 2;
const today = () => new Date().toISOString().slice(0, 10);
export function trialsLeft(): number {
  const raw = JSON.parse(localStorage.getItem("lumen_trials") ?? "{}");
  return raw.day === today() ? Math.max(0, DAILY_TRIALS - raw.used) : DAILY_TRIALS;
}
export function consumeTrial() {
  const raw = JSON.parse(localStorage.getItem("lumen_trials") ?? "{}");
  const used = raw.day === today() ? raw.used + 1 : 1;
  localStorage.setItem("lumen_trials", JSON.stringify({ day: today(), used }));
}
export const isPro = () => localStorage.getItem("lumen_pro") === "1";

export const CAMERA_PROMPT =
  "Clean up image and add Bokeh effect with natural tone and make it from iPhone 18 pro max";

export const setPro = () => localStorage.setItem("lumen_pro", "1");
