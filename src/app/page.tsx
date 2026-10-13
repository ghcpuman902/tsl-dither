import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
};

type AppCard = {
  href: string;
  title: string;
  role: string;
  status: "live" | "soon";
  imageSrc: string;
  imageAlt: string;
};

const APPS: AppCard[] = [
  {
    href: "/v1",
    title: "V1 — Flat 2D",
    role: "Load → downsize → tone → threshold dither (with noise opacity) → export.",
    status: "live",
    imageSrc: "/DSC04192_LowRes.jpg",
    imageAlt: "Sample photo for the flat 2D dither editor",
  },
  {
    href: "/v2",
    title: "V2 — Layers",
    role: "Sky and foreground — Bayer / threshold with noise opacity.",
    status: "live",
    imageSrc: "/samples/saturated-abstract-landscape.png",
    imageAlt: "Saturated landscape sample for multi-layer dithering",
  },
  {
    href: "/v3",
    title: "V3 — Palette",
    role: "Ordered or noise into a target palette. Strength 0 = hard snap.",
    status: "live",
    imageSrc: "/samples/saturated-abstract-landscape.png",
    imageAlt: "Saturated landscape sample for palette dithering",
  },
  {
    href: "/3d",
    title: "3D / TSL",
    role: "WebGPU post-process lab with pixel, hex, and lidar-style dots.",
    status: "live",
    imageSrc: "/samples/statue-of-liberty.jpg",
    imageAlt: "Sample image representing the 3D display lab",
  },
  {
    href: "/lab/sky-detect",
    title: "Sky detect lab",
    role: "Native-res SegFormer via onnxruntime-web — compare before migrating v2.",
    status: "live",
    imageSrc: "/samples/eiffel-tower.jpg",
    imageAlt: "Eiffel Tower sample for sky detection comparison",
  },
  {
    href: "/lab/color",
    title: "Color Lab",
    role: "Compare RGB bit-plane, OKLab cube, indexed palette, and mixture dithering.",
    status: "live",
    imageSrc: "/samples/saturated-abstract-landscape.png",
    imageAlt: "Saturated landscape for colour dithering experiments",
  },
];

export default function LandingPage() {
  return (
    <main className="flex min-h-svh flex-col bg-background px-6 py-12 md:px-10 md:py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 md:flex-row md:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-10">
        <header className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            {siteConfig.name}
          </h1>
          <p className="mt-3 text-muted-foreground">{siteConfig.tagline}</p>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Apps">
          {APPS.map((app) => (
            <li key={app.href}>
              <Link
                href={app.href}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={
                  app.status === "soon"
                    ? `${app.title}, coming soon`
                    : `Open ${app.title}`
                }
                tabIndex={0}
              >
                <div className="relative aspect-4/3 overflow-hidden bg-muted">
                  <Image
                    src={app.imageSrc}
                    alt={app.imageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    priority={app.href === "/v1"}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-medium text-foreground">{app.title}</h2>
                    {app.status === "soon" ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Coming soon
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{app.role}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        </div>

        <aside
          className="flex w-full shrink-0 flex-col border-t border-border pt-6 md:w-60 md:border-t-0 md:border-l md:pt-2 md:pl-6"
          aria-label="More experiments"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            More
          </p>
          <div className="mt-auto pt-10">
            <Link
              href="/live"
              data-testid="live-dither-link"
              className="flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open the live 3D dither demo"
              tabIndex={0}
            >
              <span className="text-sm font-medium text-primary">Live 3D dither</span>
              <span className="text-sm text-muted-foreground">
                Side-lit sculpture and a photo relief. Animated white noise on each channel. Drag the light.
              </span>
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
