"use client";

import { useEffect, useState } from "react";

export function CountUp({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [current, setCurrent] = useState(value);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - progress) ** 3;
      setCurrent(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    setCurrent(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span>
      {current.toFixed(decimals)}
      {suffix}
    </span>
  );
}
