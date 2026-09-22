"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/utils";

const links = [
  { href: "/#imkoniyatlar", label: "Imkoniyatlar" },
  { href: "/#modullar", label: "Modullar" },
  { href: "/#xavfsizlik", label: "Xavfsizlik" },
  { href: "/#biz-haqimizda", label: "Biz haqimizda" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-4">
        <a href="/" aria-label="SHIFO CRM bosh sahifa" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
          <Logo />
        </a>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-ink/80 md:flex" aria-label="Asosiy">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-teal-ink">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:block">
          <Button asChild>
            <a href={appUrl()}>Kirish <span aria-hidden>→</span></a>
          </Button>
        </div>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-line md:hidden"
          aria-expanded={open}
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open ? (
        <nav className="space-y-1 border-t border-line px-4 py-3 md:hidden" aria-label="Mobil">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="block rounded-xl px-3 py-3 font-semibold" onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <Button asChild className="mt-2 w-full">
            <a href={appUrl()}>Kirish</a>
          </Button>
        </nav>
      ) : null}
    </header>
  );
}
