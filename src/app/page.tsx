import type { Metadata } from "next";
import { HomeClient } from "./HomeClient";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
};

export default function Home() {
  return <HomeClient />;
}
