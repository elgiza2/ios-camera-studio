import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ plan: z.enum(["monthly", "yearly"]) }).parse(d))
  .handler(async ({ data }) => {
    const { loadConfig } = await import("./config.server");
    const { createHmac } = await import("node:crypto");
    const { kashier } = await loadConfig();
    if (!kashier.merchantId || !kashier.apiKey) return { error: "الدفع غير مُفعّل بعد" };
    const amount = (data.plan === "monthly" ? kashier.monthly : kashier.yearly).toFixed(2);
    const orderId = `lumen-${data.plan}-${Date.now()}`;
    const path = `/?payment=${kashier.merchantId}.${orderId}.${amount}.${kashier.currency}`;
    const hash = createHmac("sha256", kashier.apiKey).update(path).digest("hex");
    const origin = new URL(getRequest().url).origin;
    const q = new URLSearchParams({
      merchantId: kashier.merchantId, orderId, amount, currency: kashier.currency, hash,
      mode: kashier.mode, merchantRedirect: `${origin}/pay-done`, display: "ar",
      allowedMethods: "card,wallet", brandColor: "#e6c34a", type: "external",
    });
    return { url: `https://checkout.kashier.io/?${q}`, orderId };
  });
