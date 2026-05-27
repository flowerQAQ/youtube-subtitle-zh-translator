import type { YouTubeSurface } from "./detect";

export function findVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("video");
}

export function findPlayerContainer(surface: YouTubeSurface, video: HTMLVideoElement): HTMLElement {
  const desktopPlayer = video.closest<HTMLElement>(".html5-video-player");
  if (surface === "desktop-www" || surface === "edge-android-tablet-www") {
    return desktopPlayer ?? video.closest<HTMLElement>("#movie_player") ?? video.parentElement ?? document.body;
  }

  return desktopPlayer
    ?? video.closest<HTMLElement>("ytm-player")
    ?? video.closest<HTMLElement>(".player-container")
    ?? video.parentElement
    ?? document.body;
}

export function findCaptionButton(surface: YouTubeSurface): HTMLButtonElement | null {
  const desktopButton = document.querySelector<HTMLButtonElement>(".ytp-subtitles-button");
  if (desktopButton) {
    return desktopButton;
  }

  if (surface === "edge-android-mobile-m") {
    return document.querySelector<HTMLButtonElement>(
      "button[aria-label*='caption' i], button[aria-label*='subtitle' i], button[aria-label*='字幕' i]"
    );
  }

  return null;
}
