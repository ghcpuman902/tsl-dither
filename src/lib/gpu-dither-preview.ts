"use client";

import type { DitherParams } from "./types";
import type { CanvasPreviewMode } from "./canvas-preview";

type Channel = "rgb" | "r" | "g" | "b";

type GpuContext = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  tex: WebGLTexture;
  quad: WebGLBuffer;
  locs: {
    pos: number;
    uTex: WebGLUniformLocation | null;
    uThreshold: WebGLUniformLocation | null;
    uDensity: WebGLUniformLocation | null;
    uMode: WebGLUniformLocation | null;
    uChannel: WebGLUniformLocation | null;
    uBayerSize: WebGLUniformLocation | null;
    uViewport: WebGLUniformLocation | null;
  };
};

type DrawOptions = {
  mode: CanvasPreviewMode;
};

const getDrawRect = (
  canvas: HTMLCanvasElement,
  imageData: ImageData
): { canvasW: number; canvasH: number; drawX: number; drawY: number; drawW: number; drawH: number } | null => {
  const cssW = canvas.offsetWidth;
  const cssH = canvas.offsetHeight;
  if (cssW <= 0 || cssH <= 0 || imageData.width <= 0 || imageData.height <= 0) return null;

  const dpr = window.devicePixelRatio || 1;
  const canvasW = Math.max(1, Math.round(cssW * dpr));
  const canvasH = Math.max(1, Math.round(cssH * dpr));

  return {
    canvasW,
    canvasH,
    drawX: 0,
    drawY: 0,
    drawW: imageData.width,
    drawH: imageData.height,
  };
};

const fitDrawRect = (
  canvasW: number,
  canvasH: number,
  sourceW: number,
  sourceH: number,
  mode: CanvasPreviewMode
): { drawX: number; drawY: number; drawW: number; drawH: number } => {
  let drawW = sourceW;
  let drawH = sourceH;

  if (mode === "fit") {
    const scale = Math.min(canvasW / sourceW, canvasH / sourceH);
    drawW = Math.max(1, Math.round(sourceW * scale));
    drawH = Math.max(1, Math.round(sourceH * scale));
  }

  return {
    drawX: Math.floor((canvasW - drawW) * 0.5),
    drawY: Math.floor((canvasH - drawH) * 0.5),
    drawW,
    drawH,
  };
};

const createContext = (canvas: HTMLCanvasElement): GpuContext | null => {
  const gl = canvas.getContext("webgl2", { alpha: false, premultipliedAlpha: false });
  if (!gl) return null;
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  gl.shaderSource(
    vs,
    `#version 300 es
     in vec2 aPos;
     out vec2 vUv;
     void main() {
       vec2 uv = aPos * 0.5 + 0.5;
       vUv = vec2(uv.x, 1.0 - uv.y);
       gl_Position = vec4(aPos, 0.0, 1.0);
     }`
  );
  gl.shaderSource(
    fs,
    `#version 300 es
     precision highp float;
     in vec2 vUv;
     out vec4 outColor;
     uniform sampler2D uTex;
     uniform float uThreshold;
     uniform float uDensity;
     uniform float uMode; // 0 threshold, 1 white-noise, 2 bayer
     uniform float uChannel; // 0 rgb, 1 r, 2 g, 3 b
     uniform float uBayerSize;
     uniform vec2 uViewport;
     float srgbToLinear(float c) {
       return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
     }
     float hash(vec2 p) {
       return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
     }
     float bayer(vec2 xy, float n) {
       vec2 m = mod(xy, n);
       float x = m.x;
       float y = m.y;
       if (n < 3.0) {
         float idx = y * 2.0 + x;
         if (idx < 0.5) return 0.125;
         if (idx < 1.5) return 0.625;
         if (idx < 2.5) return 0.875;
         return 0.375;
       }
       if (n < 5.0) {
         float i = y * 4.0 + x;
         float values[16] = float[16](0.03125,0.53125,0.15625,0.65625,0.78125,0.28125,0.90625,0.40625,0.21875,0.71875,0.09375,0.59375,0.96875,0.46875,0.84375,0.34375);
         return values[int(i)];
       }
       float i = y * 8.0 + x;
       float values8[64] = float[64](
         0.0078125,0.5078125,0.1328125,0.6328125,0.0390625,0.5390625,0.1640625,0.6640625,
         0.7578125,0.2578125,0.8828125,0.3828125,0.7890625,0.2890625,0.9140625,0.4140625,
         0.1953125,0.6953125,0.0703125,0.5703125,0.2265625,0.7265625,0.1015625,0.6015625,
         0.9453125,0.4453125,0.8203125,0.3203125,0.9765625,0.4765625,0.8515625,0.3515625,
         0.0546875,0.5546875,0.1796875,0.6796875,0.0234375,0.5234375,0.1484375,0.6484375,
         0.8046875,0.3046875,0.9296875,0.4296875,0.7734375,0.2734375,0.8984375,0.3984375,
         0.2421875,0.7421875,0.1171875,0.6171875,0.2109375,0.7109375,0.0859375,0.5859375,
         0.9921875,0.4921875,0.8671875,0.3671875,0.9609375,0.4609375,0.8359375,0.3359375
       );
       return values8[int(i)];
     }
     void main() {
       vec3 s = texture(uTex, vUv).rgb;
       vec3 lin = vec3(srgbToLinear(s.r), srgbToLinear(s.g), srgbToLinear(s.b));
       float noise = hash(gl_FragCoord.xy) - 0.5;
       float t = uThreshold;
       if (uMode > 0.5 && uMode < 1.5) t = clamp(uThreshold + noise * uDensity, 0.0, 1.0);
       if (uMode > 1.5) t = bayer(gl_FragCoord.xy, uBayerSize);
       vec3 q = step(vec3(t), lin);
       if (uChannel > 0.5 && uChannel < 1.5) q = vec3(q.r);
       else if (uChannel > 1.5 && uChannel < 2.5) q = vec3(q.g);
       else if (uChannel > 2.5) q = vec3(q.b);
       outColor = vec4(q, 1.0);
     }`
  );
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS) || !gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const quad = gl.createBuffer();
  if (!quad) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return {
    gl,
    program,
    tex,
    quad,
    locs: {
      pos,
      uTex: gl.getUniformLocation(program, "uTex"),
      uThreshold: gl.getUniformLocation(program, "uThreshold"),
      uDensity: gl.getUniformLocation(program, "uDensity"),
      uMode: gl.getUniformLocation(program, "uMode"),
      uChannel: gl.getUniformLocation(program, "uChannel"),
      uBayerSize: gl.getUniformLocation(program, "uBayerSize"),
      uViewport: gl.getUniformLocation(program, "uViewport"),
    },
  };
};

const methodToMode = (method: DitherParams["method"]): number => {
  if (method === "threshold") return 0;
  if (method === "white-noise") return 1;
  return 2;
};

const channelToValue = (channel: Channel): number => {
  if (channel === "rgb") return 0;
  if (channel === "r") return 1;
  if (channel === "g") return 2;
  return 3;
};

export const drawDitherPreviewGpu = (
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  params: DitherParams,
  channel: Channel,
  options: DrawOptions
): boolean => {
  const rect = getDrawRect(canvas, imageData);
  if (!rect) return false;
  const { canvasW, canvasH } = rect;
  const { drawX, drawY, drawW, drawH } = fitDrawRect(
    canvasW,
    canvasH,
    imageData.width,
    imageData.height,
    options.mode
  );
  canvas.width = canvasW;
  canvas.height = canvasH;

  const ctx = createContext(canvas);
  if (!ctx) return false;
  const { gl, tex, locs } = ctx;
  gl.viewport(0, 0, canvasW, canvasH);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(drawX, canvasH - drawY - drawH, drawW, drawH);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    imageData.width,
    imageData.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    imageData.data
  );
  gl.uniform1i(locs.uTex, 0);
  gl.uniform1f(locs.uThreshold, params.threshold / 100);
  gl.uniform1f(locs.uDensity, params.density / 100);
  gl.uniform1f(locs.uMode, methodToMode(params.method));
  gl.uniform1f(locs.uChannel, channelToValue(channel));
  gl.uniform1f(locs.uBayerSize, params.bayerSize <= 2 ? 2 : params.bayerSize <= 4 ? 4 : 8);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
};

