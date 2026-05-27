export type YouTubeSurface =
  | "desktop-www"
  | "edge-android-tablet-www"
  | "edge-android-mobile-m"
  | "unknown";

export interface YouTubeSurfaceEnvironment {
  userAgent: string;
  hostname: string;
  pathname: string;
  maxTouchPoints: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface YouTubeSurfaceInfo {
  surface: YouTubeSurface;
  hostname: string;
  isAndroidEdge: boolean;
  isTabletLike: boolean;
  isMobileYouTube: boolean;
  viewportWidth: number;
  viewportHeight: number;
  maxTouchPoints: number;
}

const TABLET_WIDTH_MIN = 700;

export function readYouTubeSurfaceEnvironment(): YouTubeSurfaceEnvironment {
  return {
    userAgent: navigator.userAgent,
    hostname: location.hostname,
    pathname: location.pathname,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  };
}

export function isAndroidEdge(env: Pick<YouTubeSurfaceEnvironment, "userAgent"> = readYouTubeSurfaceEnvironment()): boolean {
  const userAgent = env.userAgent.toLowerCase();
  return userAgent.includes("android") && (userAgent.includes("edga") || userAgent.includes("edg/"));
}

export function isTabletLikeYouTube(env: YouTubeSurfaceEnvironment = readYouTubeSurfaceEnvironment()): boolean {
  const hasTouch = env.maxTouchPoints > 0;
  const largestViewportSide = Math.max(env.viewportWidth, env.viewportHeight);
  return isAndroidEdge(env) && hasTouch && largestViewportSide >= TABLET_WIDTH_MIN;
}

export function isMobileYouTube(env: YouTubeSurfaceEnvironment = readYouTubeSurfaceEnvironment()): boolean {
  return env.hostname === "m.youtube.com";
}

export function getYouTubeSurface(env: YouTubeSurfaceEnvironment = readYouTubeSurfaceEnvironment()): YouTubeSurfaceInfo {
  const androidEdge = isAndroidEdge(env);
  const tabletLike = isTabletLikeYouTube(env);
  const mobileYouTube = isMobileYouTube(env);
  let surface: YouTubeSurface = "unknown";

  if (env.hostname === "www.youtube.com") {
    surface = androidEdge && tabletLike
      ? "edge-android-tablet-www"
      : "desktop-www";
  } else if (env.hostname === "m.youtube.com") {
    surface = androidEdge
      ? "edge-android-mobile-m"
      : "unknown";
  }

  return {
    surface,
    hostname: env.hostname,
    isAndroidEdge: androidEdge,
    isTabletLike: tabletLike,
    isMobileYouTube: mobileYouTube,
    viewportWidth: env.viewportWidth,
    viewportHeight: env.viewportHeight,
    maxTouchPoints: env.maxTouchPoints
  };
}
