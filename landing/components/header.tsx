"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { crmLoginUrl } from "@/lib/utils";

const links = [
  { href: "/#imkoniyatlar", label: "Imkoniyatlar" },
  { href: "/#modullar", label: "Modullar" },
  { href: "/#tariflar", label: "Tariflar" },
  { href: "/#savollar", label: "FAQ" },
  { href: "/#aloqa", label: "Aloqa" },
];

export function Header({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [open, setOpen] = useState(false);
  const loginHref = crmLoginUrl();

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-md ${tone === "light" ? "border-slate-200 bg-white/90 text-[#102033]" : "border-white/10 bg-[#07090f]/80"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="/" aria-label="SHIFO CRM bosh sahifa" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1760ff]">
          <Logo tone={tone === "light" ? "dark" : "light"} />
        </a>
        <nav className={`hidden items-center gap-6 text-sm font-medium lg:flex ${tone === "light" ? "text-slate-600" : "text-[#c5d0e0]"}`} aria-label="Asosiy">
          {links.map((link) => (
            <a key={link.href} href={link.href} className={`transition ${tone === "light" ? "hover:text-[#0f766e]" : "hover:text-white"}`}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" asChild className={tone === "light" ? "border-slate-300 bg-white text-[#102033] hover:bg-slate-50" : ""}>
            <a href={loginHref}>Kirish</a>
          </Button>
          <Button asChild>
            <a href="/royxatdan-otish?plan=pro&cycle=month">Bepul sinab ko&apos;ring</a>
          </Button>
        </div>
        <button
          type="button"
          className={`grid h-11 w-11 place-items-center rounded-full border lg:hidden ${tone === "light" ? "border-slate-300 text-[#102033]" : "border-white/15"}`}
          aria-expanded={open}
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open ? (
        <nav className={`space-y-1 border-t px-4 py-3 lg:hidden ${tone === "light" ? "border-slate-200" : "border-white/10"}`} aria-label="Mobil">
          {links.map((link) => (
            <a key={link.href} href={link.href} className={`block rounded-xl px-3 py-3 font-medium ${tone === "light" ? "text-slate-700" : "text-[#d5deea]"}`} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <div className="grid gap-2 pt-2">
            <Button variant="outline" asChild className={`w-full ${tone === "light" ? "border-slate-300 bg-white text-[#102033]" : ""}`}>
              <a href={loginHref}>Kirish</a>
            </Button>
            <Button asChild className="w-full">
              <a href="/royxatdan-otish?plan=pro&cycle=month">Bepul sinab ko&apos;ring</a>
            </Button>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
