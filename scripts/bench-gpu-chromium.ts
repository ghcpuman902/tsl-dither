import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const run = async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--disable-gpu-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setContent("<html><body><canvas id='bench' width='2048' height='2048'></canvas></body></html>");

  const result = await page.evaluate(async () => {
    const canvas = document.getElementById("bench") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false });
    if (!gl) return { supported: false, reason: "WebGL2 unavailable" };

    const vert = `#version 300 es
      in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }`;

    const frag = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      uniform sampler2D u_tex;
      uniform float u_threshold;
      out vec4 outColor;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      vec3 srgbToLinear(vec3 c) {
        vec3 lo = c / 12.92;
        vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
        return mix(lo, hi, step(vec3(0.04045), c));
      }
      void main() {
        vec3 rgb = texture(u_tex, v_uv).rgb;
        vec3 lin = srgbToLinear(rgb);
        float n = hash(gl_FragCoord.xy) - 0.5;
        vec3 q = step(vec3(u_threshold + n * 0.04), lin);
        outColor = vec4(q, 1.0);
      }`;

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
      }
      return shader;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "program link failed");
    }
    gl.useProgram(prog);

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const width = 2048;
    const height = 2048;
    const bytes = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        bytes[i] = Math.round((x / (width - 1)) * 255);
        bytes[i + 1] = Math.round((y / (height - 1)) * 255);
        bytes[i + 2] = Math.round((((x + y) * 0.5) / (width - 1)) * 255);
        bytes[i + 3] = 255;
      }
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    gl.uniform1i(gl.getUniformLocation(prog, "u_tex"), 0);
    const thresholdLoc = gl.getUniformLocation(prog, "u_threshold");

    const runs = 8;
    const samples: number[] = [];
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      gl.uniform1f(thresholdLoc, 0.5);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.finish();
      samples.push(performance.now() - start);
    }

    return {
      supported: true,
      runtime: "gpu-webgl2-chromium",
      width,
      height,
      samples,
      avgMs: samples.reduce((sum, v) => sum + v, 0) / samples.length,
    };
  });

  await browser.close();

  const outDir = join(process.cwd(), "bench-results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "gpu-benchmark.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
};

run().catch((error) => {
  const outDir = join(process.cwd(), "bench-results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "gpu-benchmark.json"),
    JSON.stringify(
      {
        supported: false,
        runtime: "gpu-webgl2-chromium",
        error: String(error),
      },
      null,
      2
    )
  );
  console.error(error);
  process.exit(1);
});

