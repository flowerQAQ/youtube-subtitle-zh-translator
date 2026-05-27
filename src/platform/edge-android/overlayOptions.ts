import type { DisplayMode } from "../../shared/types";
import type { YouTubeSurface } from "./detect";

export interface SurfaceOverlayOptions {
  displayMode: DisplayMode;
  fontScale: number;
  verticalOffset: number;
  horizontalInsetPercent: number;
}

export function createSurfaceOverlayOptions(params: {
  surface: YouTubeSurface;
  displayMode: DisplayMode;
  fontScale: number;
  verticalOffset: number;
  viewportWidth: number;
  viewportHeight: number;
}): SurfaceOverlayOptions {
  const landscape = params.viewportWidth > params.viewportHeight;

  if (params.surface === "edge-android-tablet-www") {
    return {
      displayMode: params.displayMode,
      fontScale: clamp(params.fontScale * 0.92, 0.7, 1.45),
      verticalOffset: Math.max(params.verticalOffset, landscape ? 96 : 112),
      horizontalInsetPercent: landscape ? 10 : 8
    };
  }

  if (params.surface === "edge-android-mobile-m") {
    return {
      displayMode: params.displayMode,
      fontScale: clamp(params.fontScale * 0.82, 0.65, 1.25),
      verticalOffset: Math.max(params.verticalOffset, landscape ? 76 : 96),
      horizontalInsetPercent: 5
    };
  }

  return {
    displayMode: params.displayMode,
    fontScale: params.fontScale,
    verticalOffset: params.verticalOffset,
    horizontalInsetPercent: 12
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
