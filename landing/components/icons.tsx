import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ToothMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-9 w-9", className)} aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 4c-4.8 0-8.2 2.6-9.8 6.4-1.3 3-2.2 5.2-4.2 6.8C7.2 19.4 5 21.6 5 26.2 5 32.2 8.4 37.6 12 43c1.6 2.4 3.2 4 5.6 4 2.2 0 3.2-2.2 4.6-5.6.6-1.6 1.2-1.6 1.8 0C25.4 44.8 26.4 47 28.6 47c2.4 0 4-1.6 5.6-4 3.6-5.4 7-10.8 7-16.8 0-4.6-2.2-6.8-5-9-2-1.6-2.9-3.8-4.2-6.8C32.4 6.6 29 4 24 4z"
      />
    </svg>
  );
}

export function Logo({ tone = "light" }: { tone?: "ink" | "light" }) {
  const light = tone === "light";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1760ff] text-white shadow-[0_10px_24px_-12px_#1760ff]">
        <ToothMark className="h-5 w-5" />
      </span>
      <span className={cn("font-body text-[1.2rem] font-semibold tracking-tight", light ? "text-white" : "text-ink")}>
        shifo <span className="text-[#8eb4ff]">crm</span>
      </span>
    </span>
  );
}

function Glyph({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("grid h-11 w-11 place-items-center rounded-2xl bg-teal text-white", className)}>{children}</span>
  );
}

export function IconPeople() {
  return (
    <Glyph>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="8" r="2.2" />
        <circle cx="16" cy="9" r="1.8" />
        <path d="M4.8 18c.6-2.4 2.4-3.6 4.2-3.6s3.6 1.2 4.2 3.6" />
        <path d="M14 14.6c1.5-.3 3 .4 3.8 2" />
      </svg>
    </Glyph>
  );
}

export function IconFolder() {
  return (
    <Glyph className="bg-white/10 text-white">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 8.5h6l1.5-2H21v11.2a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17.7V8.5z" />
        <path d="M12 11.2v4M10 13.2h4" />
      </svg>
    </Glyph>
  );
}

export function IconTooth() {
  return (
    <Glyph className="bg-white/10 text-white">
      <ToothMark className="h-5 w-5 text-white" />
    </Glyph>
  );
}

export function IconDoc() {
  return (
    <Glyph className="bg-white/10 text-white">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
        <path d="M13.5 3.8V8H18M8.5 12h7M8.5 15.5h5" />
      </svg>
    </Glyph>
  );
}

export function IconPhone() {
  return (
    <Glyph className="bg-white/10 text-white">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 4.5h2.2l1.2 3-1.6 1a11 11 0 0 0 5 5l1-1.6 3 1.2V18a1.5 1.5 0 0 1-1.6 1.5A14 14 0 0 1 4.5 8.1 1.5 1.5 0 0 1 6 6.5" />
      </svg>
    </Glyph>
  );
}

export function IconClock() {
  return (
    <Glyph className="bg-teal-soft text-teal-deep">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="7" />
        <path d="M12 8.5V12l2.5 2" />
      </svg>
    </Glyph>
  );
}

export function IconShield() {
  return (
    <Glyph className="bg-teal-soft text-teal-deep">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3.5 19 6v5.2c0 4-2.8 6.8-7 8.3-4.2-1.5-7-4.3-7-8.3V6l7-2.5z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    </Glyph>
  );
}

export function IconChart() {
  return (
    <Glyph className="bg-teal-soft text-teal-deep">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 19V9M10 19V5M15 19v-6M20 19V8" />
      </svg>
    </Glyph>
  );
}

export function IconSmile() {
  return (
    <Glyph className="bg-teal-soft text-teal-deep">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="7.5" />
        <path d="M8.5 13.5c.8 1.6 2 2.4 3.5 2.4s2.7-.8 3.5-2.4" />
        <path d="M9 10h.01M15 10h.01" />
      </svg>
    </Glyph>
  );
}

export function FeatureIcon({ id }: { id: string }) {
  const common = "h-4 w-4";
  const paths: Record<string, ReactNode> = {
    doctor: <circle cx="12" cy="8" r="3" />,
    patients: (
      <>
        <circle cx="9" cy="9" r="2.2" />
        <circle cx="16" cy="10" r="1.8" />
        <path d="M5 18c.7-2.2 2.4-3.3 4-3.3s3.3 1.1 4 3.3M14.2 14.8c1.3-.2 2.6.4 3.3 1.8" />
      </>
    ),
    schedule: (
      <>
        <rect x="4" y="6" width="16" height="14" rx="2" />
        <path d="M8 4v4M16 4v4M4 10h16" />
      </>
    ),
    payments: (
      <>
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M3 11h18" />
      </>
    ),
    doctors: (
      <>
        <circle cx="8" cy="9" r="2" />
        <circle cx="16" cy="9" r="2" />
        <path d="M4 18c.5-2 2-3 4-3s3.5 1 4 3M12 18c.5-2 2-3 4-3s3.5 1 4 3" />
      </>
    ),
    implant: <path d="M12 3c-2 3-3 5-3 8a3 3 0 0 0 6 0c0-3-1-5-3-8zM10 16h4M9 19h6" />,
    reports: <path d="M5 19V9M10 19V5M15 19v-7M20 19V8" />,
    odonto: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    branches: <path d="M4 20V9l8-5 8 5v11M9 20v-5h6v5" />,
    stock: <path d="M4 8h16v11H4zM8 8V5h8v3" />,
    support: (
      <>
        <path d="M5 13a7 7 0 0 1 14 0" />
        <path d="M5 13v3a2 2 0 0 0 2 2h1v-5H7a2 2 0 0 0-2 2zM19 13v3a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className={cn(common, "text-teal")} fill="none" stroke="currentColor" strokeWidth="1.7">
      {paths[id] ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
