"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { canonicalPlanId, chargeAmount, formatUzs, getTariff, TARIFFS, type BillingCycle, type PlanId } from "@/config/tariffs";
import { crmLoginUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register";

type AuthResult = {
  message: string;
  clinicId: string;
  username: string;
  clinicName: string;
  expiresAt: string;
  handoffUrl: string;
  crmUrl: string;
  step?: "choose" | "payment" | "crm";
  resumeToken?: string;
  plan?: string;
  cycle?: BillingCycle;
  amountUzs?: number;
  paymeLive?: boolean;
  clickLive?: boolean;
  orderId?: string;
  supportUrl?: string;
  paymentUrl?: string;
  pending?: boolean;
};

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
}

export function AuthPanel({
  mode,
  onMode,
  plan = "pro",
  cycle = "month",
}: {
  mode: Mode;
  onMode?: (mode: Mode) => void;
  plan?: PlanId;
  cycle?: BillingCycle;
}) {
  return mode === "login" ? <LoginForm onMode={onMode} /> : <RegisterForm onMode={onMode} plan={plan} cycle={cycle} />;
}

export function RegisterWithPlan() {
  const params = useSearchParams();
  const plan = canonicalPlanId(params.get("plan") || "") || "pro";
  const cycle: BillingCycle = params.get("cycle") === "year" ? "year" : "month";
  const resume = params.get("resume") || "";
  if (resume) return <ResumeWait token={resume} />;
  return <AuthPanel mode="register" plan={plan} cycle={cycle} />;
}

function switchMode(mode: Mode, onMode?: (mode: Mode) => void) {
  if (onMode) {
    onMode(mode);
    return;
  }
  window.location.assign(mode === "login" ? crmLoginUrl() : "/royxatdan-otish");
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-mute">{hint}</p> : null}
    </div>
  );
}

function goCrm(url: string) {
  window.location.assign(url);
}

export function ResumeWait({ token }: { token: string }) {
  const [note, setNote] = useState("To'lov tasdiqlangach CRM ochiladi.");
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      try {
        const response = await fetch("/api/auth/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await response.json()) as AuthResult & { error?: string };
        if (stopped) return;
        if (data.handoffUrl) {
          goCrm(data.handoffUrl);
          return;
        }
        setNote(data.error || "To'lov tasdiqlangach CRM ochiladi.");
      } catch {
        if (!stopped) setNote("Tarmoq xatosi. Qayta tekshirilmoqda.");
      }
      timer = window.setTimeout(tick, 4000);
    };
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [token]);
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">To&apos;lov</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">CRM ochilishini kutyapmiz</h2>
      <p className="mt-3 text-sm text-mute">{note}</p>
    </div>
  );
}

export function RegisterForm({
  onMode,
  plan = "pro",
  cycle = "month",
}: {
  onMode?: (mode: Mode) => void;
  plan?: PlanId;
  cycle?: BillingCycle;
}) {
  const [planId, setPlanId] = useState<PlanId>(plan);
  const [cycleId, setCycleId] = useState<BillingCycle>(cycle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuthResult | null>(null);
  const [payment, setPayment] = useState<AuthResult | null>(null);

  useEffect(() => {
    if (!payment?.resumeToken || payment.paymentUrl) return undefined;
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      try {
        const response = await fetch("/api/auth/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: payment.resumeToken }),
        });
        const data = (await response.json()) as AuthResult;
        if (!stopped && data.handoffUrl) {
          goCrm(data.handoffUrl);
          return;
        }
      } catch {
        /* keep waiting */
      }
      if (!stopped) timer = window.setTimeout(tick, 4000);
    };
    timer = window.setTimeout(tick, 4000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [payment]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password !== confirm) {
      setError("Parollar mos kelmadi.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          clinic: String(form.get("clinic") || ""),
          phone: String(form.get("phone") || ""),
          password,
          plan: planId,
          cycle: cycleId,
        }),
      });
      const data = (await response.json()) as AuthResult & { error?: string };
      if (!response.ok) {
        setError(data.error || "Ro'yxatdan o'tish amalga oshmadi.");
        return;
      }
      setResult(data);
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setPending(false);
    }
  }

  async function continueWith(action: "trial" | "pay", provider?: "payme" | "click") {
    if (!result?.resumeToken) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: result.resumeToken, action, provider }),
      });
      const data = (await response.json()) as AuthResult & { error?: string };
      if (!response.ok) {
        setError(data.error || "Davom etib bo'lmadi.");
        return;
      }
      if (data.handoffUrl) {
        goCrm(data.handoffUrl);
        return;
      }
      if (data.paymentUrl) {
        goCrm(data.paymentUrl);
        return;
      }
      setPayment(data);
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setPending(false);
    }
  }

  if (payment) {
    const amount = formatUzs(payment.amountUzs || 0);
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">To&apos;lov kutilmoqda</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Tarif sotib olish</h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          Payme va Click merchant kalitlari ulanmagan. Buyurtma saqlandi. To&apos;lovni Telegram orqali yuboring — super-admin tasdiqlagach shu klinika CRM i o&apos;zi ochiladi.
        </p>
        <dl className="mt-5 space-y-3 rounded-2xl border border-line bg-[#0c121c] p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-mute">Tarif</dt>
            <dd className="font-semibold">{getTariff(payment.plan || "")?.name} · {payment.cycle === "year" ? "yillik" : "oylik"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-mute">Summa</dt>
            <dd className="font-semibold">{amount} so&apos;m</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-mute">Buyurtma</dt>
            <dd className="font-semibold">{payment.orderId?.slice(0, 8)}</dd>
          </div>
        </dl>
        <Button asChild className="mt-5 w-full" size="lg">
          <a href={payment.supportUrl || "https://t.me/dentist_shaxin"} target="_blank" rel="noreferrer">Telegramda to&apos;lash</a>
        </Button>
        <p className="mt-3 text-center text-xs text-mute">Tasdiq kutilmoqda. Sahifani yopmang.</p>
        {error ? <p className="mt-3 text-sm font-semibold text-rose-300" role="alert">{error}</p> : null}
      </div>
    );
  }

  if (result) {
    const amount = formatUzs(result.amountUzs || chargeAmount(result.plan || planId, result.cycle || cycleId));
    const live = Boolean(result.paymeLive || result.clickLive);
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">Hisob ochildi</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sinov yoki to&apos;lov</h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          {result.clinicName} CRM da {getTariff(result.plan || "")?.name} tarif bilan yaratildi. 14 kun bepul boshlang yoki tarifni hozir sotib oling.
        </p>
        <dl className="mt-5 space-y-3 rounded-2xl border border-line bg-[#0c121c] p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-mute">Klinika ID</dt>
            <dd className="font-semibold tracking-wide">{result.clinicId}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-mute">Login</dt>
            <dd className="font-semibold">{result.username}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-mute">To&apos;lov</dt>
            <dd className="font-semibold">{amount} so&apos;m</dd>
          </div>
        </dl>
        <div className="mt-5 grid gap-2">
          <Button type="button" className="w-full" size="lg" disabled={pending} onClick={() => continueWith("trial")}>
            {pending ? "Ochilmoqda..." : "14 kunlik sinovni boshlash"}
          </Button>
          {live && result.paymeLive ? (
            <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => continueWith("pay", "payme")}>Payme orqali sotib olish</Button>
          ) : null}
          {live && result.clickLive ? (
            <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => continueWith("pay", "click")}>Click orqali sotib olish</Button>
          ) : null}
          {!live ? (
            <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => continueWith("pay")}>
              Tarif sotib olish
            </Button>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-rose-300" role="alert">{error}</p> : null}
      </div>
    );
  }

  const price = chargeAmount(planId, cycleId);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">Ro&apos;yxatdan o&apos;tish</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Klinika hisobini ochish</h2>
      </div>
      <Field id="reg-name" label="Ism">
        <Input id="reg-name" name="name" autoComplete="name" required placeholder="Dilnoza Rahimova" />
      </Field>
      <Field id="reg-phone" label="Telefon">
        <Input id="reg-phone" name="phone" inputMode="tel" autoComplete="tel" required placeholder="+998 90 123 45 67" />
      </Field>
      <Field id="reg-clinic" label="Klinika nomi">
        <Input id="reg-clinic" name="clinic" autoComplete="organization" required placeholder="Smile Dental" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="reg-password" label="Parol">
          <Input id="reg-password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Kamida 8 ta belgi" />
        </Field>
        <Field id="reg-confirm" label="Parolni tasdiqlang">
          <Input id="reg-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} placeholder="Qayta kiriting" />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tarif</legend>
        <div className="grid grid-cols-3 gap-2">
          {TARIFFS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPlanId(item.id)}
              className={`rounded-xl border px-2 py-2 text-sm font-semibold ${planId === item.id ? "border-[#1f8a84] bg-[#12312f] text-white" : "border-line text-mute"}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">To&apos;lov davri</legend>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setCycleId("month")} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${cycleId === "month" ? "border-[#1f8a84] bg-[#12312f] text-white" : "border-line text-mute"}`}>Oylik</button>
          <button type="button" onClick={() => setCycleId("year")} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${cycleId === "year" ? "border-[#1f8a84] bg-[#12312f] text-white" : "border-line text-mute"}`}>Yillik · 2 oy bepul</button>
        </div>
        <p className="text-sm text-mute">{formatUzs(price)} so&apos;m / {cycleId === "year" ? "yil" : "oy"}</p>
      </fieldset>
      {error ? <p className="text-sm font-semibold text-rose-300" role="alert">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Ochilmoqda..." : "Hisobni ochish"}
      </Button>
      <p className="text-center text-sm text-mute">
        Hisobingiz bormi?{" "}
        <button type="button" className="font-semibold text-[#9db7ff]" onClick={() => switchMode("login", onMode)}>
          Kirish
        </button>
      </p>
    </form>
  );
}

export function LoginForm({ onMode }: { onMode?: (mode: Mode) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuthResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: String(form.get("identifier") || ""),
          password: String(form.get("password") || ""),
        }),
      });
      const data = (await response.json()) as AuthResult & { error?: string };
      if (!response.ok) {
        setError(data.error || "Kirish amalga oshmadi.");
        return;
      }
      setResult(data);
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">Hisob topildi</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">CRM ga kirish tayyor</h2>
        <p className="mt-3 text-sm text-mute">
          {result.clinicName} · login <span className="font-semibold text-ink">{result.username}</span>
        </p>
        <Button asChild className="mt-5 w-full" size="lg">
          <a href={result.handoffUrl}>CRM ga kirish</a>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">Hisob</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Kirish</h2>
      </div>
      <Field id="login-id" label="Telefon, email yoki login">
        <Input id="login-id" name="identifier" autoComplete="username" required placeholder="dilnoza@smile.uz" />
      </Field>
      <Field id="login-password" label="Parol">
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required placeholder="Parol" />
      </Field>
      {error ? <p className="text-sm font-semibold text-rose-300" role="alert">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Tekshirilmoqda..." : "Kirish"}
      </Button>
      <p className="text-center text-sm text-mute">
        Hisob yo&apos;qmi?{" "}
        <button type="button" className="font-semibold text-[#9db7ff]" onClick={() => switchMode("register", onMode)}>
          Ro&apos;yxatdan o&apos;tish
        </button>
      </p>
    </form>
  );
}

export function TrialButton({
  children,
  size = "lg",
  variant = "default",
  className,
}: {
  children: ReactNode;
  size?: "default" | "lg" | "xl";
  variant?: "default" | "outline" | "cream" | "ghost" | "dark";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <AuthDialog open={open} onOpenChange={setOpen} initial="register" />
    </>
  );
}

export function AuthDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initial);
  useEffect(() => {
    if (open) setMode(initial);
  }, [open, initial]);
  return (
    <AuthDialogFrame open={open} onOpenChange={onOpenChange} mode={mode}>
      <AuthPanel mode={mode} onMode={setMode} />
    </AuthDialogFrame>
  );
}

function AuthDialogFrame({
  open,
  onOpenChange,
  mode,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="sr-only">
          <DialogTitle>{mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
