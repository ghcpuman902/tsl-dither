import type { Metadata } from "next";
import { getAbsoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Live 3D dither",
  description:
    "Side-lit sculpture with an animated per-channel white-noise dither, plus a photo relief you can relight.",
  alternates: {
    canonical: "/live",
  },
  openGraph: {
    title: `Live 3D dither · ${siteConfig.name}`,
    description:
      "Side-lit sculpture with an animated per-channel white-noise dither, plus a photo relief you can relight.",
    url: getAbsoluteUrl("/live"),
  },
};

export default function LiveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
