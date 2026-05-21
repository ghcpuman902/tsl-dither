import type { Metadata } from "next";
import { getAbsoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "3D Display Lab",
  description:
    "Interactive Three.js WebGPU post-process demo with pixel, hex, and LIDAR-style dithered dot rendering.",
  alternates: {
    canonical: "/3d",
  },
  openGraph: {
    title: `3D Display Lab · ${siteConfig.name}`,
    description:
      "Interactive Three.js WebGPU post-process demo with pixel, hex, and LIDAR-style dithered dot rendering.",
    url: getAbsoluteUrl("/3d"),
  },
};

export default function ThreeDLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
