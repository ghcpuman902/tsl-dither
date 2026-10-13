import type { Metadata } from "next";
import { V2Client } from "./V2Client";
import { getAbsoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "V2 — Layers",
  description:
    "Sky and foreground dither. Background gets Bayer; foreground uses threshold with noise opacity.",
  alternates: {
    canonical: "/v2",
  },
  openGraph: {
    title: `V2 — Layers · ${siteConfig.name}`,
    description:
      "Sky and foreground dither. Background gets Bayer; foreground uses threshold with noise opacity.",
    url: getAbsoluteUrl("/v2"),
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function V2Page() {
  return <V2Client />;
}
