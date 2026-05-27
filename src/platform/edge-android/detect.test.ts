import { describe, expect, it } from "vitest";
import { getYouTubeSurface, isAndroidEdge, isTabletLikeYouTube, type YouTubeSurfaceEnvironment } from "./detect";

const edgeAndroidTablet: YouTubeSurfaceEnvironment = {
  userAgent: "Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 EdgA/124.0.0.0",
  hostname: "www.youtube.com",
  pathname: "/watch",
  maxTouchPoints: 5,
  viewportWidth: 1280,
  viewportHeight: 800
};

describe("YouTube surface detection", () => {
  it("detects Android Edge", () => {
    expect(isAndroidEdge(edgeAndroidTablet)).toBe(true);
  });

  it("treats Android Edge tablet www.youtube.com as tablet surface", () => {
    expect(getYouTubeSurface(edgeAndroidTablet).surface).toBe("edge-android-tablet-www");
    expect(isTabletLikeYouTube(edgeAndroidTablet)).toBe(true);
  });

  it("keeps desktop www.youtube.com on the desktop surface", () => {
    expect(getYouTubeSurface({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
      hostname: "www.youtube.com",
      pathname: "/watch",
      maxTouchPoints: 0,
      viewportWidth: 1440,
      viewportHeight: 900
    }).surface).toBe("desktop-www");
  });

  it("detects Android Edge mobile m.youtube.com", () => {
    expect(getYouTubeSurface({
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36 EdgA/124.0.0.0",
      hostname: "m.youtube.com",
      pathname: "/watch",
      maxTouchPoints: 5,
      viewportWidth: 412,
      viewportHeight: 915
    }).surface).toBe("edge-android-mobile-m");
  });
});
