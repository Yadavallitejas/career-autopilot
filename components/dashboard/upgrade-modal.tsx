"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Check,
  Zap,
  Loader2,
  Crown,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: "free" | "pro" | "team";
  userEmail?: string;
  userName?: string;
}

type BillingCycle = "monthly" | "annual";

declare global {
  interface Window {
    // Razorpay checkout loaded via <Script> in layout.tsx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

// ---------------------------------------------------------------------------
// Plan comparison data
// ---------------------------------------------------------------------------

const FREE_FEATURES = [
  "3 achievements / month",
  "LinkedIn post drafts",
  "1 resume version",
  "Basic career coach (5 msgs/day)",
];

const PRO_FEATURES = [
  "Unlimited achievements",
  "Direct LinkedIn publishing",
  "Unlimited resume versions",
  "AI voice profiling",
  "Portfolio auto-deploy",
  "Unlimited career coach",
  "Priority support",
];

// ---------------------------------------------------------------------------
// Upgrade modal
// ---------------------------------------------------------------------------

export function UpgradeModal({
  isOpen,
  onClose,
  currentPlan,
  userEmail = "",
  userName = "",
}: Props) {
  const router = useRouter();
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!isOpen) return null;

  const isAlreadyPro = currentPlan === "pro" || currentPlan === "team";

  const planType = billing === "annual" ? "pro_annual" : "pro_monthly";
  const displayPrice = billing === "annual" ? "₹3,999/year" : "₹499/month";
  const displayMonthly =
    billing === "annual" ? "₹333/month billed annually" : null;
  const savings = billing === "annual" ? "Save ₹2,000/year" : null;

  // ── Checkout flow ─────────────────────────────────────────────────────────
  async function handleUpgrade() {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Create server-side order
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });

      const orderData = (await orderRes.json()) as
        | { orderId: string; amount: number; currency: string; keyId: string }
        | { error: string };

      if ("error" in orderData) {
        setError(orderData.error);
        setIsLoading(false);
        return;
      }

      // 2. Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Career Autopilot",
        description:
          billing === "annual"
            ? "Pro Plan — Annual (Unlimited achievements)"
            : "Pro Plan — Monthly (Unlimited achievements)",
        order_id: orderData.orderId,
        prefill: {
          name: userName,
          email: userEmail,
        },
        theme: { color: "#34d399" },
        modal: {
          ondismiss: () => setIsLoading(false),
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 3. Verify on server
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...response,
                planType,
              }),
            });

            if (verifyRes.ok) {
              // 4. Refresh server data + close modal
              startTransition(() => {
                router.refresh();
              });
              onClose();
            } else {
              const verifyData = (await verifyRes.json()) as { error?: string };
              setError(verifyData.error ?? "Verification failed");
            }
          } catch {
            setError("Network error — please contact support");
          } finally {
            setIsLoading(false);
          }
        },
      });

      rzp.open();
    } catch (err) {
      console.error("[upgrade-modal]", err);
      setError("Checkout failed — please try again");
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-zinc-800 bg-gradient-to-r from-emerald-950/40 to-zinc-900">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Crown size={20} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Upgrade to Pro
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Unlock unlimited achievements, publishing, and more
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-1 bg-zinc-800/50 rounded-xl p-1 self-start mx-auto w-fit">
            {(["monthly", "annual"] as BillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                onClick={() => setBilling(cycle)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  billing === cycle
                    ? "bg-zinc-700 text-white shadow"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {cycle === "monthly" ? "Monthly" : "Annual"}
                {cycle === "annual" && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                    -33%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Plan comparison grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Free */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-zinc-300">Free</p>
                  <p className="text-2xl font-bold text-white mt-1">₹0</p>
                </div>
                {currentPlan === "free" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Current
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {FREE_FEATURES.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-xs text-zinc-500"
                  >
                    <Check size={12} className="mt-0.5 shrink-0 text-zinc-600" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 relative overflow-hidden">
              {/* Sparkle glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

              <div className="flex items-center justify-between mb-4 relative">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-white">Pro</p>
                    <Sparkles size={12} className="text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {displayPrice}
                  </p>
                  {displayMonthly && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {displayMonthly}
                    </p>
                  )}
                  {savings && (
                    <p className="text-xs text-emerald-400 mt-0.5 font-semibold">
                      {savings}
                    </p>
                  )}
                </div>
                {isAlreadyPro && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Current
                  </span>
                )}
              </div>

              <ul className="space-y-2 relative">
                {PRO_FEATURES.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-xs text-zinc-300"
                  >
                    <Check
                      size={12}
                      className="mt-0.5 shrink-0 text-emerald-400"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
              <Zap size={13} className="shrink-0" />
              {error}
            </div>
          )}

          {/* CTA */}
          {!isAlreadyPro ? (
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => void handleUpgrade()}
                disabled={isLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm py-5 shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-400/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={15} className="mr-2 animate-spin" />
                    Opening checkout…
                  </>
                ) : (
                  <>
                    <Zap size={15} className="mr-2" />
                    Upgrade to Pro — {displayPrice}
                    <ArrowRight size={14} className="ml-2" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-zinc-600">
                Secure payment via Razorpay · Cancel anytime · Instant access
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-emerald-400">
              <CheckCircle size={16} />
              You&apos;re already on the Pro plan
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Local re-export to avoid unused import lint warning
function CheckCircle({ size, className }: { size: number; className?: string }) {
  return <Check size={size} className={className} />;
}
