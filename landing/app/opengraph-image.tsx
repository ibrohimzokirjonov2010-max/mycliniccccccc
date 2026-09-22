import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#f3efe6", color: "#142421" }}>
        <div style={{ fontSize: 28, letterSpacing: 4, color: "#0f766e" }}>SHIFO CRM</div>
        <div style={{ marginTop: 16, fontSize: 76, lineHeight: 1, maxWidth: 900 }}>Klinika chalkashligi tugadi</div>
        <div style={{ marginTop: 24, fontSize: 28, color: "#5c6b66" }}>Stomatolog klinikasi uchun bemor, implant, navbat va to&apos;lov.</div>
      </div>
    ),
    size,
  );
}
