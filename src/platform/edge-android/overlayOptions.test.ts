import { describe, expect, it } from "vitest";
import { createSurfaceOverlayOptions } from "./overlayOptions";

describe("surface overlay options", () => {
  it("keeps desktop overlay values unchanged", () => {
    expect(createSurfaceOverlayOptions({
      surface: "desktop-www",
      displayMode: "bilingual",
      fontScale: 1,
      verticalOffset: 84,
      viewportWidth: 1440,
      viewportHeight: 900
    })).toEqual({
      displayMode: "bilingual",
      fontScale: 1,
      verticalOffset: 84,
      horizontalInsetPercent: 12
    });
  });

  it("uses a more conservative tablet bottom offset", () => {
    const options = createSurfaceOverlayOptions({
      surface: "edge-android-tablet-www",
      displayMode: "zh",
      fontScale: 1,
      verticalOffset: 84,
      viewportWidth: 1280,
      viewportHeight: 800
    });

    expect(options.fontScale).toBe(0.92);
    expect(options.verticalOffset).toBe(96);
    expect(options.horizontalInsetPercent).toBe(10);
  });

  it("uses a narrower mobile inset", () => {
    const options = createSurfaceOverlayOptions({
      surface: "edge-android-mobile-m",
      displayMode: "bilingual",
      fontScale: 1,
      verticalOffset: 84,
      viewportWidth: 412,
      viewportHeight: 915
    });

    expect(options.fontScale).toBe(0.82);
    expect(options.verticalOffset).toBe(96);
    expect(options.horizontalInsetPercent).toBe(5);
  });
});
