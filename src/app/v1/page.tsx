import type { Metadata } from "next";
import { HomeClient } from "./HomeClient";
import { getAbsoluteUrl, siteConfig } from "@/lib/site";

const DEFAULT_IMAGE_SRC = "/DSC04192_LowRes.jpg";

export const metadata: Metadata = {
  title: "V1 — Flat 2D",
  description: siteConfig.description,
  alternates: {
    canonical: "/v1",
  },
  openGraph: {
    title: `V1 — Flat 2D · ${siteConfig.name}`,
    description: siteConfig.description,
    url: getAbsoluteUrl("/v1"),
  },
  other: {
    preload: DEFAULT_IMAGE_SRC,
  },
};

export default function V1Page() {
  return (
    <>
      <link rel="preload" href={DEFAULT_IMAGE_SRC} as="image" />
      <HomeClient />
    </>
  );
}
