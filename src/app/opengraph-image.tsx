import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.title;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#000000",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          {["#ff00ff", "#ffff00", "#00ffff", "#ff00ff", "#ffff00", "#00ffff"].map(
            (color, index) => (
              <div
                key={index}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: color,
                }}
              />
            ),
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            {siteConfig.name}
          </div>
          <div
            style={{
              maxWidth: 900,
              fontSize: 32,
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {siteConfig.tagline}
          </div>
        </div>

        <div
          style={{
            fontSize: 24,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          Load · Downsize · Tone · Dither · Export
        </div>
      </div>
    ),
    size,
  );
}
