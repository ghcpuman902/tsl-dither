import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

const DEFAULT_MODEL_PATH =
  "/Users/manglekuo/Downloads/Meshy_AI_Roman_statues_of_Fort_0324141615_generate.glb";

export const GET = async (): Promise<Response> => {
  const modelPath = process.env.MODEL_PATH ?? DEFAULT_MODEL_PATH;

  try {
    const buffer = await readFile(modelPath);
    const body = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    return new NextResponse(body, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown model read error";
    return NextResponse.json(
      { error: `Unable to load default GLB from disk: ${message}` },
      { status: 500 },
    );
  }
};
