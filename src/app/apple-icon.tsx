import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

const dotColors = [
  "#ff00ff",
  "#ffff00",
  "#00ffff",
  "#ffff00",
  "#ff00ff",
  "#000000",
  "#ff00ff",
  "#ffff00",
  "#00ffff",
  "#000000",
  "#00ffff",
  "#ffff00",
  "#000000",
  "#ff00ff",
  "#00ffff",
  "#ff00ff",
  "#000000",
  "#ffff00",
  "#00ffff",
  "#ff00ff",
  "#ffff00",
  "#00ffff",
  "#ff00ff",
  "#ffff00",
  "#00ffff",
];

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} style={{ display: "flex", gap: 10 }}>
              {dotColors.slice(row * 5, row * 5 + 5).map((color, index) => (
                <div
                  key={index}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: color,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
