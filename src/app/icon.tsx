import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

const dotColors = [
  "#ff00ff",
  "#ffff00",
  "#00ffff",
  "#ffff00",
  "#000000",
  "#ff00ff",
  "#00ffff",
  "#ff00ff",
  "#ffff00",
];

export default function Icon() {
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
            gap: 3,
          }}
        >
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: "flex", gap: 3 }}>
              {dotColors.slice(row * 3, row * 3 + 3).map((color, index) => (
                <div
                  key={index}
                  style={{
                    width: 6,
                    height: 6,
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
