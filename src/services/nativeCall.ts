import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface CallNotification {
  title: string;
  text: string;
  /** Tutor id — the notification shows their portrait. */
  tutor: string;
  muted: boolean;
  muteLabel: string;
  unmuteLabel: string;
  hangupLabel: string;
}

interface CallServicePlugin {
  start(options: CallNotification): Promise<{ running: boolean }>;
  stop(): Promise<{ running: boolean }>;
  addListener(event: 'action', cb: (e: { action: 'mute' | 'hangup' }) => void): Promise<PluginListenerHandle>;
}

// Implemented in android/app/src/main/java/com/neriaok/lingo/CallServicePlugin.java
const CallService = registerPlugin<CallServicePlugin>('CallService');

export const isAndroidApp = (): boolean => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CallService');

/**
 * In the Android app, a foreground service keeps the mic alive while the call runs in the
 * background, with Mute / End buttons in its notification. Calling it again updates the notification.
 */
export const startBackgroundCall = async (n: CallNotification): Promise<void> => {
  if (!isAndroidApp()) return;
  await CallService.start(n).catch(() => undefined);
};

export const stopBackgroundCall = async (): Promise<void> => {
  if (!isAndroidApp()) return;
  await CallService.stop().catch(() => undefined);
};

export const onBackgroundCallAction = (cb: (action: 'mute' | 'hangup') => void): (() => void) => {
  if (!isAndroidApp()) return () => undefined;
  const handle = CallService.addListener('action', (e) => cb(e.action));
  return () => void handle.then((h) => h.remove());
};
