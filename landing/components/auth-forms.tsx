"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
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
};

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
}

export function AuthPanel({ mode, onMode }: { mode: Mode; onMode?: (mode: Mode) => void }) {
  return mode === "login" ? <LoginForm onMode={onMode} /> : <RegisterForm onMode={onMode} />;
}

function switchMode(mode: Mode, onMode?: (mode: Mode) => void) {
  if (onMode) {
    onMode(mode);
    return;
  }
  window.location.assign(mode === "login" ? "/kirish" : "/royxatdan-otish");
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

export function RegisterForm({ onMode }: { onMode?: (mode: Mode) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuthResult | null>(null);

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
          doctor: String(form.get("doctor") || ""),
          clinic: String(form.get("clinic") || ""),
          phone: String(form.get("phone") || ""),
          email: String(form.get("email") || ""),
          password,
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

  if (result) {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">Sinov ochildi</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">14 kunlik bepul sinov ochildi</h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          {result.clinicName} uchun CRM ochiq. Parolingizni eslab qoling — u qayta ko&apos;rsatilmaydi. Klinika ID va login CRM dagi kirish oynasida ham ishlaydi.
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
            <dt className="text-mute">Tugash</dt>
            <dd className="font-semibold">{formatDay(result.expiresAt)}</dd>
          </div>
        </dl>
        <Button asChild className="mt-5 w-full" size="lg">
          <a href={result.handoffUrl}>CRM ga kirish</a>
        </Button>
        <p className="mt-3 text-center text-xs text-mute">
          Avtomatik kirish ochilmasa,{" "}
          <a className="text-[#9db7ff] underline-offset-2 hover:underline" href={result.crmUrl}>
            CRM login
          </a>{" "}
          sahifasida klinika ID va loginni kiriting.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">14 kun bepul</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Ro&apos;yxatdan o&apos;tish</h2>
      </div>
      <Field id="reg-name" label="Ism">
        <Input id="reg-name" name="name" autoComplete="name" required placeholder="Dilnoza Rahimova" />
      </Field>
      <Field id="reg-clinic" label="Klinika nomi" hint="Klinika yoki shifokor ismidan kamida bittasi kerak.">
        <Input id="reg-clinic" name="clinic" autoComplete="organization" placeholder="Smile Dental" />
      </Field>
      <Field id="reg-doctor" label="Shifokor ismi">
        <Input id="reg-doctor" name="doctor" placeholder="Akmal Karimov" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="reg-phone" label="Telefon" hint="Telefon yoki email.">
          <Input id="reg-phone" name="phone" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" />
        </Field>
        <Field id="reg-email" label="Email">
          <Input id="reg-email" name="email" type="email" autoComplete="email" placeholder="klinika@example.uz" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="reg-password" label="Parol">
          <Input id="reg-password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Kamida 8 ta belgi" />
        </Field>
        <Field id="reg-confirm" label="Parolni tasdiqlang">
          <Input id="reg-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} placeholder="Qayta kiriting" />
        </Field>
      </div>
      {error ? <p className="text-sm font-semibold text-rose-300" role="alert">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Ochilmoqda..." : "14 kunlik sinovni ochish"}
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
