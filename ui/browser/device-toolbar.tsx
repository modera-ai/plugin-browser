import React from "react";
import { RotateCw, X } from "lucide-react";
import type { messages } from "./messages";
export const deviceDefaults = {
  width: 1265,
  height: 931,
  mobile: false,
  scale: 1,
  preset: "responsive",
};
export type Device = typeof deviceDefaults;
const presets = [
  ["4K", 3840, 2160, false],
  ["Laptop L", 1440, 900, false],
  ["Laptop", 1280, 800, false],
  ["Surface Pro 7", 912, 1368, true],
  ["iPad Air", 820, 1180, true],
  ["iPad Mini", 768, 1024, true],
  ["Surface Duo", 540, 720, true],
  ["iPhone 15 Pro Max", 430, 932, true],
  ["Pixel 8", 412, 915, true],
  ["iPhone 15 Pro", 393, 852, true],
  ["Samsung Galaxy S24 Ultra", 412, 915, true],
  ["iPhone SE", 375, 667, true],
] as const;
export function DeviceToolbar({
  text: t,
  value,
  change,
  close,
}: {
  text: ReturnType<typeof messages>;
  value: Device;
  change(value: Device): void;
  close(): void;
}) {
  return (
    <div className="browser-device-toolbar">
      <span>{t.dimensions}:</span>
      <select
        aria-label={t.device}
        value={value.preset}
        onChange={(event) => {
          const row = presets.find((row) => row[0] === event.target.value);
          change(
            row
              ? {
                  preset: row[0],
                  width: row[1],
                  height: row[2],
                  mobile: row[3],
                  scale: value.scale,
                }
              : { ...value, preset: "responsive", mobile: false },
          );
        }}
      >
        <option value="responsive">{t.responsive}</option>
        {presets.map((row) => (
          <option key={row[0]}>{row[0]}</option>
        ))}
      </select>
      <input
        aria-label="Width"
        type="number"
        min={200}
        max={7680}
        value={value.width}
        onChange={(event) => {
          const width = Math.round(Number(event.target.value));
          if (width >= 200 && width <= 7680)
            change({ ...value, width, preset: "responsive" });
        }}
      />
      <span>×</span>
      <input
        aria-label="Height"
        type="number"
        min={200}
        max={4320}
        value={value.height}
        onChange={(event) => {
          const height = Math.round(Number(event.target.value));
          if (height >= 200 && height <= 4320)
            change({ ...value, height, preset: "responsive" });
        }}
      />
      <button
        title={t.rotate}
        aria-label={t.rotate}
        onClick={() =>
          change({
            ...value,
            width: value.height,
            height: Math.min(4320, value.width),
            preset: "responsive",
          })
        }
      >
        <RotateCw size={16} />
      </button>
      <select
        aria-label={t.zoom}
        value={value.scale}
        onChange={(event) =>
          change({ ...value, scale: Number(event.target.value) })
        }
      >
        {[1, 0.75, 0.5, 0.25].map((scale) => (
          <option key={scale} value={scale}>
            {scale * 100}%
          </option>
        ))}
      </select>
      <button
        className="browser-device-close"
        title={t.close}
        aria-label={t.close}
        onClick={close}
      >
        <X size={16} />
      </button>
    </div>
  );
}
