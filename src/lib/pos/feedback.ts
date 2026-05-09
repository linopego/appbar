const SOUNDS = {
  beep: "/sounds/beep.mp3",
  success: "/sounds/success.mp3",
  warn: "/sounds/warn.mp3",
  error: "/sounds/error.mp3",
} as const;

const audioCache: Partial<Record<keyof typeof SOUNDS, HTMLAudioElement>> = {};

export function playSound(key: keyof typeof SOUNDS): void {
  if (typeof window === "undefined") return;
  let audio = audioCache[key];
  if (!audio) {
    audio = new Audio(SOUNDS[key]);
    audio.volume = 0.7;
    audioCache[key] = audio;
  }
  audio.currentTime = 0;
  audio.play().catch(() => {
    // autoplay blocked — ignore silently
  });
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
