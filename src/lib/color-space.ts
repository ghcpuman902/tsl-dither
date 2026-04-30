const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const clampByte = (value: number): number =>
  Math.max(0, Math.min(255, Math.round(value)));

export const srgb01ToLinear01 = (value: number): number => {
  const c = clamp01(value);
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
};

export const linear01ToSrgb01 = (value: number): number => {
  const c = clamp01(value);
  if (c <= 0.0031308) return c * 12.92;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
};

export const srgbByteToLinear01 = (value: number): number =>
  srgb01ToLinear01(clampByte(value) / 255);

export const linear01ToSrgbByte = (value: number): number =>
  clampByte(linear01ToSrgb01(value) * 255);

const createSrgbToLinearLut = (): Float32Array => {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = srgbByteToLinear01(i);
  }
  return lut;
};

const createLinearToSrgbLut = (): Uint8Array => {
  const lut = new Uint8Array(4096);
  const maxIndex = lut.length - 1;
  for (let i = 0; i <= maxIndex; i++) {
    const linear = i / maxIndex;
    lut[i] = linear01ToSrgbByte(linear);
  }
  return lut;
};

export const SRGB_TO_LINEAR_LUT = createSrgbToLinearLut();
const LINEAR_TO_SRGB_LUT = createLinearToSrgbLut();

export const linear01ToSrgbByteLut = (value: number): number => {
  const clamped = clamp01(value);
  const idx = Math.max(
    0,
    Math.min(LINEAR_TO_SRGB_LUT.length - 1, Math.round(clamped * (LINEAR_TO_SRGB_LUT.length - 1)))
  );
  return LINEAR_TO_SRGB_LUT[idx];
};

export const linearLuminance = (rLin: number, gLin: number, bLin: number): number =>
  rLin * 0.2126 + gLin * 0.7152 + bLin * 0.0722;

