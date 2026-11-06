"use client";
import { useState } from "react";
import { ArrowLeft, RotateCw } from "lucide-react";
import { OtpInput } from "@/components/ui/otp-input";
import { Button } from "@/components/ui/button";
import { useCountdown } from "./use-countdown";

/** Reusable OTP verification step (login + both registration steps). */
export function OtpStep({
  sentTo,
  resendIn,
  onVerify,
  onResend,
  onBack,
  cta = "Verify & continue",
}: {
  sentTo: string;
  resendIn: number;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<number | void>;
  onBack: () => void;
  cta?: string;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [left, setLeft] = useCountdown(resendIn);

  const submit = async (c = code) => {
    if (c.length !== 6 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onVerify(c);
    } catch (e) {
      setErr((e as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())} className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Change
      </button>
      <div className="rounded-2xl bg-surface p-4 text-sm text-ink">
        We sent a 6-digit code to <b className="font-bold">{sentTo}</b>
      </div>
      <OtpInput value={code} onChange={setCode} onComplete={(c) => submit(c)} disabled={busy} error={!!err} />
      {err && <p className="text-sm font-medium text-red-600">{err}</p>}
      <Button type="submit" className="w-full" size="lg" loading={busy} disabled={code.length !== 6}>
        {cta}
      </Button>
      <div className="text-center text-sm text-muted">
        {left > 0 ? (
          <>Resend code in <b className="tabular-nums text-ink">0:{String(left).padStart(2, "0")}</b></>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-bold text-brand hover:underline"
            onClick={async () => {
              setErr(null);
              try {
                const s = await onResend();
                setLeft(typeof s === "number" ? s : 45);
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            <RotateCw className="h-3.5 w-3.5" /> Resend code
          </button>
        )}
      </div>
    </form>
  );
}
