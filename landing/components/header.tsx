"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AuthDialog } from "@/components/auth-forms";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/#imkoniyatlar", label: "Imkoniyatlar" },
  { href: "/#modullar", label: "Modullar" },
  { href: "/#tariflar", label: "Tariflar" },
  { href: "/#savollar", label: "FAQ" },
  { href: "/#aloqa", label: "Aloqa" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<null | "login" | "register">(null);

  function show(mode: "login" | "register") {
    setOpen(false);
    setAuth(mode);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090f]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="/" aria-label="SHIFO CRM bosh sahifa" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1760ff]">
          <Logo />
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-[#c5d0e0] lg:flex" aria-label="Asosiy">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" onClick={() => show("login")}>Kirish</Button>
          <Button onClick={() => show("register")}>Ro&apos;yxatdan o&apos;tish</Button>
        </div>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open ? (
        <nav className="space-y-1 border-t border-white/10 px-4 py-3 lg:hidden" aria-label="Mobil">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="block rounded-xl px-3 py-3 font-medium text-[#d5deea]" onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <div className="grid gap-2 pt-2">
            <Button variant="outline" className="w-full" onClick={() => show("login")}>Kirish</Button>
            <Button className="w-full" onClick={() => show("register")}>Ro&apos;yxatdan o&apos;tish</Button>
          </div>
        </nav>
      ) : null}
      <AuthDialog key={auth ?? "closed"} open={auth !== null} onOpenChange={(next) => { if (!next) setAuth(null); }} initial={auth ?? "login"} />
    </header>
  );
}
