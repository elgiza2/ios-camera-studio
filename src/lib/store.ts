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

export const EFFECTS = [
  { id: "lego", name: "ليجو", emoji: "🧱", prompt: "Transform this photo into a detailed LEGO brick diorama, every element built from glossy LEGO bricks and minifigures, keep composition and identity." },
  { id: "pixar", name: "بيكسار 3D", emoji: "🎬", prompt: "Transform this photo into a Pixar-style 3D animated movie still, soft cinematic lighting, keep likeness." },
  { id: "ghibli", name: "جيبلي", emoji: "🌿", prompt: "Redraw this photo in Studio Ghibli hand-painted anime style, warm watercolor backgrounds, keep composition." },
  { id: "figure", name: "مجسم أكشن", emoji: "🧸", prompt: "Turn the subject into a collectible action figure inside a premium toy blister box with branded packaging and accessories." },
  { id: "clay", name: "صلصال", emoji: "🟠", prompt: "Recreate this photo as a claymation stop-motion scene made of plasticine with visible fingerprints texture." },
  { id: "simpsons", name: "سيمبسونز", emoji: "💛", prompt: "Redraw this photo in The Simpsons cartoon style, yellow skin, bold outlines, keep scene." },
  { id: "anime", name: "أنمي", emoji: "⚡", prompt: "Convert this photo into a high quality modern anime key visual, vibrant colors, sharp linework." },
  { id: "pixel", name: "بيكسل آرت", emoji: "👾", prompt: "Convert this photo into detailed 16-bit pixel art, retro game palette." },
  { id: "sketch", name: "رسم رصاص", emoji: "✏️", prompt: "Convert this photo into a realistic graphite pencil sketch on textured paper." },
  { id: "oil", name: "لوحة زيتية", emoji: "🖼️", prompt: "Repaint this photo as a classical oil painting with visible brush strokes, museum quality." },
  { id: "funko", name: "فانكو بوب", emoji: "🪆", prompt: "Turn the subject into a Funko Pop vinyl figure with oversized head, standing next to its box." },
  { id: "cyber", name: "سايبربانك", emoji: "🌃", prompt: "Restyle this photo as a neon cyberpunk night scene, rain reflections, cinematic." },
  { id: "plush", name: "دمية قطنية", emoji: "🧶", prompt: "Turn the subject into a cute knitted crochet plush toy, soft yarn texture." },
  { id: "comic", name: "كوميكس", emoji: "💥", prompt: "Redraw this photo as a Marvel-style comic book panel with halftone dots and ink lines." },
  { id: "sticker", name: "ستيكر", emoji: "🏷️", prompt: "Turn the subject into a die-cut glossy cartoon sticker with a thick white border on a plain background." },
  { id: "statue", name: "تمثال رخام", emoji: "🏛️", prompt: "Transform the subject into a classical white marble statue in a museum, dramatic lighting." },
] as const;
