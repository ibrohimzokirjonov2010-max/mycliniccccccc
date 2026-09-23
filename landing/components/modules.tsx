"use client";

import { useState } from "react";

const tabs = [
  {
    id: "bemorlar",
    title: "Bemorlar bazasi",
    text: "Qidiruv, tibbiy karta, allergiya va tashrif tarixi bir ro'yxatda.",
    rows: [
      ["Aliyeva Sardor", "Aktiv", "12.05"],
      ["Karimova Dilnoza", "Aktiv", "08.05"],
      ["Tursunov Jasur", "Navbatda", "03.05"],
    ],
  },
  {
    id: "qabul",
    title: "Qabul va navbat",
    text: "Shifokor jadvali, bekor bo'lgan vaqt va eslatma shu yerda turadi.",
    rows: [
      ["09:30 Sardor", "Implant", "Tugadi"],
      ["10:15 Gulnora", "Og'riq", "Davomida"],
      ["11:00 Jasur", "Kanal", "Kutilmoqda"],
    ],
  },
  {
    id: "implant",
    title: "Implant moduli",
    text: "Model, o'lcham va tish raqami davolash rejasiga yoziladi.",
    rows: [
      ["Straumann BLT", "4.1mm", "16"],
      ["Nobel Biocare", "4.3mm", "26"],
      ["BioHorizons", "4.0mm", "36"],
    ],
  },
  {
    id: "hisobot",
    title: "Hisobotlar",
    text: "Oylik tushum, bandlik va shifokor kesimi rahbar ekranida.",
    rows: [
      ["Tushum", "48.2 mln", "oy"],
      ["Qabullar", "312", "oy"],
      ["Qarzdorlik", "6.4 mln", "ochiq"],
    ],
  },
];

export function Modules() {
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  return (
    <section id="modullar" className="scroll-mt-24 py-20" aria-labelledby="modules-title">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="modules-title" className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Modullar qanday ishlaydi</h2>
        <div className="mt-10 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="flex gap-2 overflow-x-auto lg:flex-col" role="tablist" aria-label="Modullar">
            {tabs.map((tab) => {
              const selected = tab.id === current.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`shrink-0 rounded-xl border px-4 py-3 text-left text-sm font-semibold lg:w-full ${selected ? "border-[#1760ff] bg-[#1760ff] text-white" : "border-line bg-surface text-[#d5deea]"}`}
                  onClick={() => setActive(tab.id)}
                >
                  {tab.title}
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6" role="tabpanel">
            <h3 className="text-2xl font-semibold">{current.title}</h3>
            <p className="mt-2 max-w-xl text-mute">{current.text}</p>
            <ul className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10">
              {current.rows.map((row) => (
                <li key={row[0]} className="grid grid-cols-[1.4fr_.8fr_.6fr] gap-2 px-4 py-3 text-sm">
                  <span className="font-medium">{row[0]}</span>
                  <span className="text-mute">{row[1]}</span>
                  <span className="text-right text-[#9db7ff]">{row[2]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
