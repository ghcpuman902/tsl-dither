import type { Metadata } from "next";
import { V3Client } from "./V3Client";
import { getAbsoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "V3 — Palette",
  description:
    "Layered palette dither. Ordered or noise; strength 0 snaps to nearest colour.",
  alternates: {
    canonical: "/v3",
  },
  openGraph: {
    title: `V3 — Palette · ${siteConfig.name}`,
    description:
      "Layered palette dither. Ordered or noise; strength 0 snaps to nearest colour.",
    url: getAbsoluteUrl("/v3"),
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function V3Page() {
  return <V3Client />;
}
