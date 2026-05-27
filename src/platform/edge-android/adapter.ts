import type { ExtensionSettings } from "../../shared/types";
import type { OverlayOptions } from "../../ui/overlay";
import { getYouTubeSurface, type YouTubeSurfaceInfo } from "./detect";
import { createSurfaceOverlayOptions } from "./overlayOptions";
import { findPlayerContainer, findVideo } from "./selectors";

export interface YouTubePlatformAdapter {
  surfaceInfo: YouTubeSurfaceInfo;
  findVideo: () => HTMLVideoElement | null;
  findPlayerContainer: (video: HTMLVideoElement) => HTMLElement;
  createOverlayOptions: (settings: ExtensionSettings, video: HTMLVideoElement) => OverlayOptions;
  createDebugContext: (params?: { videoFound?: boolean; timedtextUrlCount?: number }) => {
    hostname: string;
    platform: string;
    isAndroidEdge: boolean;
    isTabletLike: boolean;
    isMobileYouTube: boolean;
    viewport: string;
    videoFound?: boolean;
    timedtextUrlCount?: number;
  };
}

export function createYouTubePlatformAdapter(): YouTubePlatformAdapter {
  const surfaceInfo = getYouTubeSurface();

  return {
    surfaceInfo,
    findVideo,
    findPlayerContainer: (video) => findPlayerContainer(surfaceInfo.surface, video),
    createOverlayOptions: (settings, video) => {
      const surfaceOptions = createSurfaceOverlayOptions({
        surface: surfaceInfo.surface,
        displayMode: settings.displayMode,
        fontScale: settings.fontScale,
        verticalOffset: settings.verticalOffset,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      });

      return {
        ...surfaceOptions,
        container: findPlayerContainer(surfaceInfo.surface, video)
      };
    },
    createDebugContext: (params = {}) => ({
      hostname: surfaceInfo.hostname,
      platform: surfaceInfo.surface,
      isAndroidEdge: surfaceInfo.isAndroidEdge,
      isTabletLike: surfaceInfo.isTabletLike,
      isMobileYouTube: surfaceInfo.isMobileYouTube,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      videoFound: params.videoFound,
      timedtextUrlCount: params.timedtextUrlCount
    })
  };
}
