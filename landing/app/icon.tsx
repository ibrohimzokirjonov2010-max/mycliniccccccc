import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 64, height: 64, background: "#0d9488", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, borderRadius: 16 }}>
        S
      </div>
    ),
    size,
  );
}
