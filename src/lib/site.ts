const defaultSiteUrl = "http://localhost:3737";

export const siteConfig = {
  name: "TSL Dither",
  title: "TSL Dither — Browser image dither editor",
  description:
    "A browser-based image editor for retro, high-saturation dithering. Load, downsize, tone, dither, and export photos with bright magenta, yellow, and blue dots on black.",
  tagline: "Retro dithering experiments in the browser",
  url: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? defaultSiteUrl,
  ogImagePath: "/opengraph-image",
  keywords: [
    "dither",
    "dithering",
    "image editor",
    "retro",
    "point cloud",
    "browser",
    "Web Worker",
    "Three.js",
    "TSL",
    "photo effect",
  ],
  author: "TSL Dither",
  locale: "en_US",
  twitterHandle: undefined as string | undefined,
} as const;

export const getAbsoluteUrl = (path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.url}${normalizedPath}`;
};
