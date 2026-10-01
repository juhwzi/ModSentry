import type { DetectionResult } from "./types";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  audioContext ??= new AudioContext();
  return audioContext;
}

export function playCalloutAlert(volume = 0.6): void {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(800, start);
  oscillator.frequency.linearRampToValueAtTime(1000, start + 0.18);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, Math.min(volume, 1)), start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.36);
}

export function notifyCallout(result: DetectionResult): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notification = new Notification(`ModSentry · ${result.message.channelSlug}`, {
    body: `@${result.message.sender.username}: ${result.reason}`,
    tag: `modsentry:${result.message.platform}:${result.message.channelSlug}:callout`,
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission === "default") return Notification.requestPermission();
  return Notification.permission;
}

export function dispatchDetectionAlert(result: DetectionResult): void {
  if (result.kind !== "callout" || !result.soundAllowed) return;
  playCalloutAlert();
  if (result.notificationAllowed) notifyCallout(result);
}
