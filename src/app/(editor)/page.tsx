import type { Metadata } from "next";
import { HomeClient } from "./HomeClient";
import { siteConfig } from "@/lib/site";

const DEFAULT_IMAGE_SRC = "/DSC04192_LowRes.jpg";

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  other: {
    preload: DEFAULT_IMAGE_SRC,
  },
};

export default function Home() {
  return (
    <>
      <link rel="preload" href={DEFAULT_IMAGE_SRC} as="image" />
      <HomeClient />
    </>
  );
}
