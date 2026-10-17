import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/pay-done")({
  head: () => ({ meta: [{ title: "Lumen — نتيجة الدفع" }, { name: "robots", content: "noindex" }] }),
  component: PayDone,
});

function PayDone() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const s = new URLSearchParams(location.search).get("paymentStatus");
    const success = s === "SUCCESS";
    setOk(success);
    window.parent?.postMessage({ type: "lumen-pay", success }, location.origin);
  }, []);
  return (
    <div className="grid h-screen place-items-center text-center" dir="rtl">
      <p className="text-lg">{ok === null ? "…" : ok ? "تم الدفع بنجاح ✓" : "لم يكتمل الدفع"}</p>
    </div>
  );
}
