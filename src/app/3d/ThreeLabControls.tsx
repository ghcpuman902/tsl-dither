"use client";

import type { PostEffectControls, EffectMode, MediumMode } from "./three-lab-types";

type ThreeLabControlsProps = {
  controls: PostEffectControls;
  onControlsChange: (next: PostEffectControls) => void;
};

export const ThreeLabControls = ({ controls, onControlsChange }: ThreeLabControlsProps) => {
  const handleModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = event.target.value as EffectMode;
    onControlsChange({ ...controls, mode });
  };

  const handleMediumModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const mediumMode = event.target.value as MediumMode;
    onControlsChange({ ...controls, mediumMode });
  };

  const handleNumericControlChange =
    (key: Exclude<keyof PostEffectControls, "mode" | "mediumMode">) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isNaN(value)) return;
      onControlsChange({ ...controls, [key]: value });
    };

  return (
    <aside className="absolute right-0 top-0 z-10 h-full w-80 overflow-y-auto border-l border-white/20 bg-black/70 p-4 text-sm text-white backdrop-blur-sm">
      <h2 className="mb-4 text-base font-semibold text-white">Display Lab</h2>

      <div className="mb-4">
        <label htmlFor="effect-mode" className="mb-1 block text-xs uppercase tracking-wide text-white/70">
          Effect Mode
        </label>
        <select
          id="effect-mode"
          value={controls.mode}
          onChange={handleModeChange}
          className="w-full rounded border border-white/30 bg-black/70 px-2 py-1.5 text-sm text-white outline-none focus:border-white"
        >
          <option value="pixel">Pixel Grid</option>
          <option value="hex">Hex Dot Grid</option>
          <option value="lidar">LIDAR Dots</option>
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="medium-mode" className="mb-1 block text-xs uppercase tracking-wide text-white/70">
          Medium Response
        </label>
        <select
          id="medium-mode"
          value={controls.mediumMode}
          onChange={handleMediumModeChange}
          className="w-full rounded border border-white/30 bg-black/70 px-2 py-1.5 text-sm text-white outline-none focus:border-white"
        >
          <option value="digital">Digital</option>
          <option value="analog">Analog Curve</option>
        </select>
      </div>

      <div className="space-y-3">
        {(
          [
            ["pixelSize", "Pixel Size", 2, 24, 0.5, controls.pixelSize.toFixed(1)],
            ["hexSize", "Hex Size", 3, 28, 0.5, controls.hexSize.toFixed(1)],
            ["dotRadiusRatio", "Dot Radius Ratio", 0.08, 0.95, 0.01, controls.dotRadiusRatio.toFixed(2)],
            ["dotSoftnessPx", "Dot Softness px", 0.1, 5, 0.1, controls.dotSoftnessPx.toFixed(2)],
            ["noiseDensity", "Noise Density", 0, 0.45, 0.01, controls.noiseDensity.toFixed(2)],
            ["baseThreshold", "Base Threshold", 0.2, 0.8, 0.01, controls.baseThreshold.toFixed(2)],
            ["analogGammaR", "Analog Gamma R", 0.2, 1.8, 0.01, controls.analogGammaR.toFixed(2)],
            ["analogGammaG", "Analog Gamma G", 0.2, 1.8, 0.01, controls.analogGammaG.toFixed(2)],
            ["analogGammaB", "Analog Gamma B", 0.2, 1.8, 0.01, controls.analogGammaB.toFixed(2)],
            ["analogCrossTalk", "Analog Cross-Talk", 0, 0.3, 0.005, controls.analogCrossTalk.toFixed(2)],
            ["analogToe", "Analog Toe", 0, 1, 0.01, controls.analogToe.toFixed(2)],
            ["analogShoulder", "Analog Shoulder", 0, 1, 0.01, controls.analogShoulder.toFixed(2)],
            ["lidarStep", "LIDAR Step", 3, 24, 0.5, controls.lidarStep.toFixed(1)],
            ["lidarJitterPx", "LIDAR Jitter px", 0, 16, 0.1, controls.lidarJitterPx.toFixed(2)],
            ["lidarSigmaPx", "LIDAR Sigma px", 0.4, 12, 0.1, controls.lidarSigmaPx.toFixed(2)],
            ["lidarDensity", "LIDAR Density", 0.05, 1, 0.01, controls.lidarDensity.toFixed(2)],
          ] as const
        ).map(([key, label, min, max, step, display]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs text-white/70">
              {label} ({display})
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={controls[key]}
              onChange={handleNumericControlChange(key)}
              className="w-full accent-white"
            />
          </label>
        ))}
      </div>
    </aside>
  );
};
