import type { Metadata } from "next";
import { ColorLabClient } from "./ColorLabClient";

export const metadata: Metadata = {
  title: "Color Lab",
  description:
    "Interactive laboratory for comparing RGB bit-plane, OKLab, indexed, and mixture colour dithering methods.",
  robots: { index: false, follow: false },
};

export default function ColorLabPage() {
  return <ColorLabClient />;
}
