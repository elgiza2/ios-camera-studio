import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Toaster, toast } from "sonner";
import {
  RefreshCw, Zap, ZapOff, Sparkles, X, Wand2, Crop, SlidersHorizontal, Trash2, Download, Crown, Check, ChevronLeft, Images,
} from "lucide-react";
import { aiEditImage } from "@/lib/ai.functions";
import {
  CAMERA_PROMPT, EFFECTS, consumeTrial, deletePhoto, isPro, listPhotos, savePhoto, trialsLeft, DAILY_TRIALS, type Photo,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — كاميرا الذكاء الاصطناعي" },
      { name: "description", content: "كاميرا بتصميم iOS زجاجي تحسّن صورك بالذكاء الاصطناعي وتحوّلها لليجو وأنمي وأكثر." },
      { property: "og:title", content: "Lumen — كاميرا الذكاء الاصطناعي" },
      { property: "og:description", content: "التقط، حسّن، وحوّل صورك بالذكاء الاصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

const MODES = [
  { id: "night", label: "NIGHT", aspect: 3 / 4, extra: " Night mode: bright, low noise, preserve night ambience." },
  { id: "portrait", label: "PORTRAIT", aspect: 3 / 4, extra: " Strong portrait-mode background blur, subject in sharp focus." },
  { id: "photo", label: "PHOTO", aspect: 3 / 4, extra: "" },
  { id: "square", label: "SQUARE", aspect: 1, extra: "" },
  { id: "pano", label: "PANO", aspect: 16 / 9, extra: " Wide panoramic look." },
] as const;

const uid = () => `${Date.now()}-${Math.floor(performance.now() * 1000) % 100000}`;

function downscale(src: string, max = 1280, aspect?: number, adjust = ""): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      let sw = img.width, sh = img.height, sx = 0, sy = 0;
      if (aspect) {
        if (sw / sh > aspect) { const nw = sh * aspect; sx = (sw - nw) / 2; sw = nw; }
        else { const nh = sw / aspect; sy = (sh - nh) / 2; sh = nh; }
      }
      const s = Math.min(1, max / Math.max(sw, sh));
      const c = document.createElement("canvas");
      c.width = Math.round(sw * s); c.height = Math.round(sh * s);
      const ctx = c.getContext("2d")!;
      if (adjust) ctx.filter = adjust;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.9));
    };
    img.src = src;
  });
}

type View = "camera" | "gallery" | "studio";

function App() {
  const [view, setView] = useState<View>("camera");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [studioPhoto, setStudioPhoto] = useState<Photo | null>(null);
  const [paywall, setPaywall] = useState(false);
  const edit = useServerFn(aiEditImage);

  const refresh = useCallback(() => listPhotos().then(setPhotos), []);
  useEffect(() => { refresh(); }, [refresh]);

  const runAI = useCallback(async (source: string, prompt: string, label: string, original?: string) => {
    const id = uid();
    const pending: Photo = { id, src: source, original: original ?? source, createdAt: Date.now(), label, pending: true };
    setPhotos((p) => [pending, ...p]);
    try {
      const { image } = await edit({ data: { image: source, prompt } });
      const done: Photo = { ...pending, src: image, pending: false };
      await savePhoto(done);
      setPhotos((p) => p.map((x) => (x.id === id ? done : x)));
      toast.success("صورتك جاهزة في المعرض ✨");
      return done;
    } catch (e) {
      const fallback: Photo = { ...pending, pending: false, label: "أصلية" };
      await savePhoto(fallback);
      setPhotos((p) => p.map((x) => (x.id === id ? fallback : x)));
      toast.error(e instanceof Error ? e.message : "فشل المعالجة");
      return null;
    }
  }, [edit]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground select-none" dir="ltr">
      <Toaster position="top-center" theme="dark" />
      {view === "camera" && (
        <Camera
          last={photos[0]}
          onCapture={(img, mode) => runAI(img, CAMERA_PROMPT + mode.extra, "محسّنة")}
          onGallery={() => setView("gallery")}
          onEdit={() => { setStudioPhoto(null); setView("studio"); }}
        />
      )}
      {view === "gallery" && (
        <Gallery
          photos={photos}
          onBack={() => setView("camera")}
          onEdit={(p) => { setStudioPhoto(p); setView("studio"); }}
          onDelete={async (id) => { await deletePhoto(id); refresh(); }}
        />
      )}
      {view === "studio" && (
        <Studio
          photos={photos}
          photo={studioPhoto}
          setPhoto={setStudioPhoto}
          onBack={() => setView("camera")}
          onPaywall={() => setPaywall(true)}
          runAI={runAI}
          onSaved={refresh}
        />
      )}
      {paywall && <Paywall onClose={() => setPaywall(false)} />}
    </div>
  );
}

/* ---------------- Camera ---------------- */
function Camera({ last, onCapture, onGallery, onEdit }: {
  last?: Photo; onCapture: (img: string, mode: (typeof MODES)[number]) => void; onGallery: () => void; onEdit: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [modeIdx, setModeIdx] = useState(2);
  const [zoom, setZoom] = useState(1);
  const [flash, setFlash] = useState(false);
  const [blink, setBlink] = useState(false);
  const [err, setErr] = useState("");
  const mode = MODES[modeIdx]!;

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => { stream = s; if (videoRef.current) videoRef.current.srcObject = s; setErr(""); })
      .catch(() => setErr("اسمح بالوصول للكاميرا لبدء التصوير"));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [facing]);

  const shoot = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    if (flash) { setBlink(true); await new Promise((r) => setTimeout(r, 180)); }
    const c = document.createElement("canvas");
    const w = v.videoWidth / zoom, h = v.videoHeight / zoom;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    if (facing === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, w, h);
    setBlink(true);
    setTimeout(() => setBlink(false), 150);
    const img = await downscale(c.toDataURL("image/jpeg", 0.92), 1280, mode.aspect);
    onCapture(img, mode);
  };

  // swipe between modes
  const touchX = useRef(0);

  return (
    <div className="relative h-full w-full flex flex-col"
      onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0]!.clientX - touchX.current;
        if (Math.abs(dx) > 50) setModeIdx((i) => Math.min(MODES.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1))));
      }}>
      {/* top bar */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)] pb-3">
        <button onClick={() => setFlash((f) => !f)} className="glass grid size-10 place-items-center rounded-full" aria-label="الفلاش">
          {flash ? <Zap className="size-5 text-primary" fill="currentColor" /> : <ZapOff className="size-5" />}
        </button>
        <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide">
          <Sparkles className="size-3.5 text-primary" /> AI ENHANCE
        </div>
        <button onClick={onEdit} className="glass grid size-10 place-items-center rounded-full" aria-label="الاستوديو">
          <Wand2 className="size-5" />
        </button>
      </div>

      {/* viewfinder */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <div className="relative w-full overflow-hidden transition-all duration-500 ease-out"
          style={{ aspectRatio: mode.aspect === 1 ? "1" : mode.aspect > 1 ? "16/9" : "3/4", maxHeight: "100%" }}>
          <video ref={videoRef} autoPlay playsInline muted
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300"
            style={{ transform: `scale(${zoom}) ${facing === "user" ? "scaleX(-1)" : ""}`, filter: mode.id === "night" ? "brightness(1.25)" : undefined }} />
          {mode.id === "portrait" && (
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_40px_var(--scrim)]" />
          )}
          {err && <div className="absolute inset-0 grid place-items-center p-8 text-center text-muted-foreground">{err}</div>}
          {blink && <div className="absolute inset-0 bg-shutter" />}
        </div>
        {/* zoom pills */}
        <div className="glass absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 rounded-full p-1">
          {[0.5, 1, 2, 3].map((z) => {
            const val = z < 1 ? 1 : z;
            const active = zoom === val && (z >= 1 || false);
            return (
              <button key={z} onClick={() => setZoom(val)}
                className={`grid size-9 place-items-center rounded-full text-[11px] font-bold transition ${active ? "bg-scrim text-primary scale-110" : "text-foreground"}`}>
                {z === 0.5 ? ".5" : z}{active ? "×" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* modes */}
      <div className="relative h-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 flex -translate-y-1/2 gap-6 transition-transform duration-300"
          style={{ transform: `translate(calc(-${modeIdx * 84 + 30}px), -50%)` }}>
          {MODES.map((m, i) => (
            <button key={m.id} onClick={() => setModeIdx(i)}
              className={`w-[60px] text-center text-[13px] font-semibold tracking-wider transition ${i === modeIdx ? "text-primary" : "text-muted-foreground"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* bottom controls */}
      <div className="flex items-center justify-between px-9 pt-3 pb-[max(env(safe-area-inset-bottom),28px)]">
        <button onClick={onGallery} className="relative size-14 overflow-hidden rounded-xl border-2 border-glass-border bg-glass" aria-label="المعرض">
          {last ? <img src={last.src} className="h-full w-full object-cover" alt="" /> : <Images className="m-auto size-6 text-muted-foreground" />}
          {last?.pending && <div className="shimmer absolute inset-0" />}
        </button>
        <button onClick={shoot} aria-label="التقاط"
          className="grid size-[78px] place-items-center rounded-full border-4 border-shutter transition active:scale-90">
          <span className="size-[62px] rounded-full bg-shutter transition active:scale-90" />
        </button>
        <button onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="glass grid size-14 place-items-center rounded-full transition active:rotate-180" aria-label="قلب الكاميرا">
          <RefreshCw className="size-6" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Gallery ---------------- */
function Gallery({ photos, onBack, onEdit, onDelete }: {
  photos: Photo[]; onBack: () => void; onEdit: (p: Photo) => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState<Photo | null>(null);
  const [showOrig, setShowOrig] = useState(false);
  return (
    <div className="h-full overflow-y-auto pb-32" dir="rtl">
      <Header title="المعرض" onBack={onBack} />
      {photos.length === 0 && <p className="mt-32 text-center text-muted-foreground">لا توجد صور بعد — التقط أول صورة!</p>}
      <div className="grid grid-cols-3 gap-0.5 px-0.5">
        {photos.map((p) => (
          <button key={p.id} onClick={() => !p.pending && setOpen(p)} className="relative aspect-square overflow-hidden bg-muted">
            <img src={p.src} className={`h-full w-full object-cover ${p.pending ? "blur-md scale-110" : ""}`} alt="" />
            {p.pending && <div className="shimmer absolute inset-0 grid place-items-center"><Sparkles className="size-6 animate-pulse text-primary" /></div>}
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),14px)] pb-2">
            <button onClick={() => setOpen(null)} className="glass grid size-10 place-items-center rounded-full"><X className="size-5" /></button>
            <span className="glass rounded-full px-3 py-1 text-xs">{open.label ?? "صورة"}</span>
            <a href={open.src} download={`lumen-${open.id}.png`} className="glass grid size-10 place-items-center rounded-full"><Download className="size-5" /></a>
          </div>
          <div className="relative flex-1 grid place-items-center p-2"
            onPointerDown={() => setShowOrig(true)} onPointerUp={() => setShowOrig(false)} onPointerLeave={() => setShowOrig(false)}>
            <img src={showOrig && open.original ? open.original : open.src} className="max-h-full max-w-full rounded-2xl object-contain" alt="" />
            {open.original && <span className="glass absolute bottom-4 rounded-full px-3 py-1 text-[11px] text-muted-foreground">اضغط مطولاً لرؤية الأصل</span>}
          </div>
          <div className="glass-strong mx-auto mb-[max(env(safe-area-inset-bottom),20px)] flex gap-2 rounded-full p-1.5">
            <button onClick={() => { onEdit(open); setOpen(null); }} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              <Wand2 className="size-4" /> تعديل
            </button>
            <button onClick={() => { onDelete(open.id); setOpen(null); }} className="grid size-10 place-items-center rounded-full text-destructive">
              <Trash2 className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 glass flex items-center justify-between border-x-0 border-t-0 px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3">
      <button onClick={onBack} className="flex items-center gap-1 text-primary"><ChevronLeft className="size-5 rotate-180" />الكاميرا</button>
      <h1 className="text-[17px] font-semibold">{title}</h1>
      <div className="min-w-16 flex justify-end">{right}</div>
    </div>
  );
}

/* ---------------- Studio ---------------- */
const CROPS = [{ l: "أصلي", v: 0 }, { l: "1:1", v: 1 }, { l: "4:5", v: 4 / 5 }, { l: "3:4", v: 3 / 4 }, { l: "16:9", v: 16 / 9 }, { l: "9:16", v: 9 / 16 }];
const ADJ = [
  { k: "brightness", l: "السطوع", min: 50, max: 150 },
  { k: "contrast", l: "التباين", min: 50, max: 150 },
  { k: "saturate", l: "التشبع", min: 0, max: 200 },
  { k: "warmth", l: "الدفء", min: -50, max: 50 },
] as const;

function Studio({ photos, photo, setPhoto, onBack, onPaywall, runAI, onSaved }: {
  photos: Photo[]; photo: Photo | null; setPhoto: (p: Photo | null) => void; onBack: () => void; onPaywall: () => void;
  runAI: (src: string, prompt: string, label: string, original?: string) => Promise<Photo | null>; onSaved: () => void;
}) {
  const [tab, setTab] = useState<"ai" | "crop" | "adjust">("ai");
  const [crop, setCrop] = useState(0);
  const [adj, setAdj] = useState({ brightness: 100, contrast: 100, saturate: 100, warmth: 0 });
  const [busy, setBusy] = useState(false);
  const [ad, setAd] = useState<null | (() => void)>(null);
  const [left, setLeft] = useState(DAILY_TRIALS);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setLeft(trialsLeft()), [ad]);

  const cssFilter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturate}%) sepia(${Math.max(0, adj.warmth)}%) hue-rotate(${adj.warmth < 0 ? adj.warmth : 0}deg)`;

  if (!photo) {
    return (
      <div className="h-full overflow-y-auto pb-20" dir="rtl">
        <Header title="اختر صورة" onBack={onBack}
          right={<button onClick={() => fileRef.current?.click()} className="text-primary text-sm">من الجهاز</button>} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const r = new FileReader();
          r.onload = async () => setPhoto({ id: uid(), src: await downscale(r.result as string), createdAt: Date.now() });
          r.readAsDataURL(f);
        }} />
        {photos.length === 0 && <p className="mt-32 text-center text-muted-foreground">المعرض فارغ — ارفع صورة من جهازك</p>}
        <div className="grid grid-cols-3 gap-0.5 px-0.5">
          {photos.filter((p) => !p.pending).map((p) => (
            <button key={p.id} onClick={() => setPhoto(p)} className="aspect-square overflow-hidden"><img src={p.src} className="h-full w-full object-cover" alt="" /></button>
          ))}
        </div>
      </div>
    );
  }

  const applyEffect = (e: (typeof EFFECTS)[number]) => {
    const go = async () => {
      setBusy(true);
      const res = await runAI(photo.src, e.prompt, e.name, photo.src);
      setBusy(false);
      if (res) setPhoto(res);
    };
    if (isPro()) return go();
    if (trialsLeft() <= 0) return onPaywall();
    setAd(() => () => { consumeTrial(); go(); });
  };

  const saveManual = async () => {
    const out = await downscale(photo.src, 2048, crop || undefined, cssFilter);
    const p: Photo = { id: uid(), src: out, original: photo.src, createdAt: Date.now(), label: "معدّلة" };
    await savePhoto(p); onSaved(); setPhoto(p);
    setCrop(0); setAdj({ brightness: 100, contrast: 100, saturate: 100, warmth: 0 });
    toast.success("تم الحفظ في المعرض");
  };

  return (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),14px)] pb-2">
        <button onClick={() => setPhoto(null)} className="glass rounded-full px-4 py-2 text-sm">إلغاء</button>
        <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs">
          {isPro() ? <><Crown className="size-3.5 text-primary" /> Pro</> : <>متبقي اليوم: {left}/{DAILY_TRIALS}</>}
        </span>
        <button onClick={saveManual} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">تم</button>
      </div>

      <div className="relative flex-1 grid place-items-center overflow-hidden p-4">
        <div className="relative max-h-full max-w-full overflow-hidden rounded-2xl" style={crop ? { aspectRatio: String(crop), height: crop < 1 ? "100%" : undefined, width: crop >= 1 ? "100%" : undefined } : undefined}>
          <img src={photo.src} style={{ filter: cssFilter }} className={`h-full w-full ${crop ? "object-cover" : "object-contain max-h-[60vh]"} ${busy ? "blur-md scale-105" : ""} transition`} alt="" />
          {busy && <div className="shimmer absolute inset-0 grid place-items-center"><span className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm"><Sparkles className="size-4 animate-spin text-primary" /> جاري السحر…</span></div>}
        </div>
      </div>

      <div className="min-h-[150px] px-3">
        {tab === "ai" && (
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
            {EFFECTS.map((e) => (
              <button key={e.id} disabled={busy} onClick={() => applyEffect(e)} className="flex shrink-0 flex-col items-center gap-1.5 disabled:opacity-40">
                <span className="glass grid size-[68px] place-items-center rounded-2xl text-3xl transition active:scale-90">{e.emoji}</span>
                <span className="text-[11px] text-muted-foreground">{e.name}</span>
              </button>
            ))}
          </div>
        )}
        {tab === "crop" && (
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {CROPS.map((c) => (
              <button key={c.l} onClick={() => setCrop(c.v)} className={`rounded-full px-4 py-2 text-sm ${crop === c.v ? "bg-primary text-primary-foreground" : "glass"}`}>{c.l}</button>
            ))}
          </div>
        )}
        {tab === "adjust" && (
          <div className="space-y-2 pt-1">
            {ADJ.map((a) => (
              <label key={a.k} className="flex items-center gap-3 text-xs">
                <span className="w-14 text-muted-foreground">{a.l}</span>
                <input type="range" min={a.min} max={a.max} value={adj[a.k]} onChange={(e) => setAdj({ ...adj, [a.k]: +e.target.value })} className="flex-1 accent-primary" />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="glass-strong mx-auto mb-[max(env(safe-area-inset-bottom),18px)] flex gap-1 rounded-full p-1.5">
        {([["ai", "ذكاء", Sparkles], ["crop", "قص", Crop], ["adjust", "تعديل", SlidersHorizontal]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition ${tab === k ? "bg-glass-strong text-primary" : "text-muted-foreground"}`}>
            <I className="size-4" />{l}
          </button>
        ))}
      </div>

      {ad && <AdModal onDone={() => { const f = ad; setAd(null); f(); }} onCancel={() => setAd(null)} />}
    </div>
  );
}

/* ---------------- Ad + Paywall ---------------- */
function AdModal({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [t, setT] = useState(5);
  useEffect(() => {
    if (t <= 0) return;
    const id = setTimeout(() => setT(t - 1), 1000);
    return () => clearTimeout(id);
  }, [t]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-scrim p-6 backdrop-blur-xl" dir="rtl">
      <div className="glass-strong w-full max-w-sm rounded-[2rem] p-6 text-center">
        <p className="text-xs text-muted-foreground">إعلان</p>
        <div className="my-5 grid aspect-video place-items-center rounded-2xl bg-muted"><span className="text-4xl">📺</span></div>
        <p className="text-sm">شاهد الإعلان لفتح تجربة مجانية</p>
        {t > 0 ? (
          <div className="mt-5 flex items-center justify-between">
            <button onClick={onCancel} className="text-sm text-muted-foreground">إلغاء</button>
            <span className="glass rounded-full px-4 py-2 text-sm tabular-nums">{t} ث</span>
          </div>
        ) : (
          <button onClick={onDone} className="mt-5 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">متابعة</button>
        )}
      </div>
    </div>
  );
}

function Paywall({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-scrim backdrop-blur-xl" dir="rtl">
      <div className="glass-strong w-full rounded-t-[2.5rem] p-7 pb-[max(env(safe-area-inset-bottom),28px)]">
        <button onClick={onClose} className="glass mb-2 grid size-9 place-items-center rounded-full"><X className="size-4" /></button>
        <Crown className="mx-auto size-12 text-primary" />
        <h2 className="mt-3 text-center text-2xl font-bold">Lumen Pro</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">خلصت تجاربك المجانية لليوم</p>
        <ul className="mt-6 space-y-3 text-sm">
          {["كل التأثيرات بلا حدود", "بدون إعلانات", "أعلى جودة للصور", "تأثيرات جديدة كل أسبوع"].map((x) => (
            <li key={x} className="flex items-center gap-2"><Check className="size-4 text-primary" />{x}</li>
          ))}
        </ul>
        <button onClick={() => toast.info("الاشتراك سيُفعّل قريباً")} className="mt-7 w-full rounded-full bg-primary py-4 font-semibold text-primary-foreground">اشترك شهرياً</button>
        <p className="mt-3 text-center text-xs text-muted-foreground">أو ارجع بكرة لتجربتين مجانيتين</p>
      </div>
    </div>
  );
}
