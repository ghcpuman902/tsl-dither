class PolyfilledImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

if (typeof globalThis.ImageData === "undefined") {
  (globalThis as { ImageData: typeof PolyfilledImageData }).ImageData = PolyfilledImageData;
}

