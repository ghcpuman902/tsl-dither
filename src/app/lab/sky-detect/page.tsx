import type { Metadata } from "next";
import { SkyDetectLabClient } from "./SkyDetectLabClient";

export const metadata: Metadata = {
  title: "Sky detect lab",
  description:
    "Native-resolution SegFormer sky detection via onnxruntime-web WebGPU — compare samples before migrating v2.",
  robots: { index: false, follow: false },
};

export default function SkyDetectLabPage() {
  return <SkyDetectLabClient />;
}
