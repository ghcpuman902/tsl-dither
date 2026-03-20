"use client";

import type { ToneParams, ToneVisible } from "./types";
import { buildToneLUT } from "./tone-processor";

const defaultVisible: ToneVisible = {
  exposure: true,
  contrast: true,
  highlights: true,
  shadows: true,
  whites: true,
  blacks: true,
  saturation: true,
  temperature: true,
};

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  vec2 ndc = a_position * 0.5 + 0.5;
  v_uv = vec2(ndc.x, 1.0 - ndc.y);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D u_image;
uniform sampler2D u_lut;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_tempShift;
uniform float u_satFactor;
uniform bool u_useTemp;
uniform bool u_useExposure;
uniform bool u_useContrast;
uniform bool u_useLut;
uniform bool u_useSaturation;

varying vec2 v_uv;

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(float h, float s, float l) {
  if (s < 0.0001) return vec3(l, l, l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hue2rgb(p, q, h + 1.0/3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0/3.0)
  );
}

vec3 rgb2hsl(vec3 c) {
  float cmax = max(max(c.r, c.g), c.b);
  float cmin = min(min(c.r, c.g), c.b);
  float l = (cmax + cmin) * 0.5;
  if (cmax == cmin) return vec3(0.0, 0.0, l);
  float d = cmax - cmin;
  float s = l > 0.5 ? d / (2.0 - cmax - cmin) : d / (cmax + cmin);
  float h;
  if (cmax == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (cmax == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  h /= 6.0;
  return vec3(h, s, l);
}

void main() {
  vec4 tex = texture2D(u_image, v_uv);
  vec3 rgb = tex.rgb;

  if (u_useTemp) {
    rgb.r = clamp(rgb.r + u_tempShift, 0.0, 1.0);
    rgb.b = clamp(rgb.b - u_tempShift, 0.0, 1.0);
  }
  if (u_useExposure) {
    rgb *= u_exposure;
  }
  if (u_useContrast) {
    rgb = (rgb - 0.5) * u_contrast + 0.5;
  }
  if (u_useLut) {
    rgb.r = texture2D(u_lut, vec2(rgb.r, 0.5)).r;
    rgb.g = texture2D(u_lut, vec2(rgb.g, 0.5)).r;
    rgb.b = texture2D(u_lut, vec2(rgb.b, 0.5)).r;
  }
  if (u_useSaturation && abs(u_satFactor - 1.0) > 0.001) {
    vec3 hsl = rgb2hsl(rgb);
    hsl.g = clamp(hsl.g * u_satFactor, 0.0, 1.0);
    rgb = hsl2rgb(hsl.r, hsl.g, hsl.b);
  }

  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), tex.a);
}
`;

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

export type ToneRendererOptions = {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement | ImageBitmap;
  tone: ToneParams;
  toneVisible?: Partial<ToneVisible>;
  viewport: { x: number; y: number; w: number; h: number };
};

type UniformLocations = {
  u_image: WebGLUniformLocation | null;
  u_lut: WebGLUniformLocation | null;
  u_exposure: WebGLUniformLocation | null;
  u_contrast: WebGLUniformLocation | null;
  u_tempShift: WebGLUniformLocation | null;
  u_satFactor: WebGLUniformLocation | null;
  u_useTemp: WebGLUniformLocation | null;
  u_useExposure: WebGLUniformLocation | null;
  u_useContrast: WebGLUniformLocation | null;
  u_useLut: WebGLUniformLocation | null;
  u_useSaturation: WebGLUniformLocation | null;
};

type GPUResources = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  uniforms: UniformLocations;
  quadBuffer: WebGLBuffer;
  posLoc: number;
  lutTexture: WebGLTexture;
  imageTexture: WebGLTexture;
  imageRef: HTMLImageElement | ImageBitmap | null;
  lutKey: string;
};

let res: GPUResources | null = null;

const lutKeyFor = (p: ToneParams): string =>
  `${p.highlights}|${p.shadows}|${p.whites}|${p.blacks}`;

const initResources = (gl: WebGLRenderingContext): GPUResources | null => {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  gl.shaderSource(vs, VERTEX);
  gl.shaderSource(fs, FRAGMENT);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS) || !gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("Tone WebGL compile:", gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Tone WebGL link:", gl.getProgramInfoLog(program));
    return null;
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const uniforms: UniformLocations = {
    u_image: gl.getUniformLocation(program, "u_image"),
    u_lut: gl.getUniformLocation(program, "u_lut"),
    u_exposure: gl.getUniformLocation(program, "u_exposure"),
    u_contrast: gl.getUniformLocation(program, "u_contrast"),
    u_tempShift: gl.getUniformLocation(program, "u_tempShift"),
    u_satFactor: gl.getUniformLocation(program, "u_satFactor"),
    u_useTemp: gl.getUniformLocation(program, "u_useTemp"),
    u_useExposure: gl.getUniformLocation(program, "u_useExposure"),
    u_useContrast: gl.getUniformLocation(program, "u_useContrast"),
    u_useLut: gl.getUniformLocation(program, "u_useLut"),
    u_useSaturation: gl.getUniformLocation(program, "u_useSaturation"),
  };

  const quadBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, "a_position");

  const lutTexture = gl.createTexture()!;
  const imageTexture = gl.createTexture()!;

  return {
    gl, program, uniforms, quadBuffer, posLoc,
    lutTexture, imageTexture, imageRef: null, lutKey: "",
  };
};

const uploadLut = (r: GPUResources, lut: Uint8Array) => {
  const { gl, lutTexture } = r;
  const rgba = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const v = lut[i];
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  gl.bindTexture(gl.TEXTURE_2D, lutTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
};

const uploadImage = (r: GPUResources, image: HTMLImageElement | ImageBitmap) => {
  const { gl, imageTexture } = r;
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image as TexImageSource);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  r.imageRef = image;
};

export const renderToneGPU = (options: ToneRendererOptions): boolean => {
  const { canvas, image, tone, viewport } = options;
  const toneVisible = { ...defaultVisible, ...options.toneVisible };

  if (!res || res.gl.isContextLost()) {
    const gl = canvas.getContext("webgl", {
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return false;
    res = initResources(gl);
    if (!res) return false;
  }

  const r = res;
  const { gl, program, uniforms } = r;

  if (r.imageRef !== image) {
    uploadImage(r, image);
  }

  const key = lutKeyFor(tone);
  if (r.lutKey !== key) {
    uploadLut(r, buildToneLUT(tone));
    r.lutKey = key;
  }

  const exposureRounded = Math.round(tone.exposure * 100) / 100;

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(viewport.x, viewport.y, viewport.w, viewport.h);
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, r.quadBuffer);
  gl.enableVertexAttribArray(r.posLoc);
  gl.vertexAttribPointer(r.posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, r.imageTexture);
  gl.uniform1i(uniforms.u_image, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, r.lutTexture);
  gl.uniform1i(uniforms.u_lut, 1);

  gl.uniform1f(uniforms.u_exposure, Math.pow(2, exposureRounded));
  gl.uniform1f(uniforms.u_contrast, (100 + tone.contrast) / 100);
  gl.uniform1f(uniforms.u_tempShift, (tone.temperature * 0.3) / 255);
  gl.uniform1f(uniforms.u_satFactor, (100 + tone.saturation) / 100);

  const useLut = toneVisible.highlights || toneVisible.shadows || toneVisible.whites || toneVisible.blacks;
  gl.uniform1i(uniforms.u_useTemp, toneVisible.temperature ? 1 : 0);
  gl.uniform1i(uniforms.u_useExposure, toneVisible.exposure ? 1 : 0);
  gl.uniform1i(uniforms.u_useContrast, toneVisible.contrast ? 1 : 0);
  gl.uniform1i(uniforms.u_useLut, useLut ? 1 : 0);
  gl.uniform1i(uniforms.u_useSaturation, toneVisible.saturation ? 1 : 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  return true;
};

export const disposeGPU = () => {
  if (!res) return;
  const { gl, program, quadBuffer, lutTexture, imageTexture } = res;
  gl.deleteTexture(imageTexture);
  gl.deleteTexture(lutTexture);
  gl.deleteBuffer(quadBuffer);
  gl.deleteProgram(program);
  res = null;
};
