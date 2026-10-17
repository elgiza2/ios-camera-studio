import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "openai/gpt-image-2.5-flare";

export const aiEditImage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ image: z.string().min(20).max(15_000_000), prompt: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env["FASTROUTER_API_KEY"];
    if (!key) throw new Error("مفتاح الخدمة غير مضبوط");
    const m = data.image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) throw new Error("صورة غير صالحة");
    const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("model", MODEL);
    form.append("prompt", data.prompt);
    form.append("image", new Blob([bytes], { type: m[1]! }), "photo.jpg");
    const res = await fetch("https://api.fastrouter.ai/api/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`فشل المعالجة (${res.status}): ${text.slice(0, 200)}`);
    const json = JSON.parse(text);
    const item = json?.data?.[0];
    if (item?.b64_json) return { image: `data:image/png;base64,${item.b64_json}` };
    if (item?.url) {
      const r = await fetch(item.url);
      const buf = new Uint8Array(await r.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { image: `data:${r.headers.get("content-type") ?? "image/png"};base64,${btoa(s)}` };
    }
    throw new Error("لم ترجع صورة");
  });
