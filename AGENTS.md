<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Payment prices and provider routing live in `payment-rules.ts`; server-created sessions use these rules to prevent client price tampering.
- Payment credentials come only from runtime secrets; payment orders use the dedicated `lumen_payment_orders` table, not shared bot settings, to isolate this app's transactions.
- A random device capability is generated locally and hashed server-side; provider-verified orders grant access without accounts or IP-based identity.
- Photos stay in IndexedDB; no payment flow may persist photos or card details.
- Checkout return messages trigger a server verification only, never activate subscriptions directly.
- Dodo checkout is imported after hydration using its inline SDK; Kashier sessions use its documented embedded frame.
