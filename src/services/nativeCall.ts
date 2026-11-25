import { Capacitor, registerPlugin } from '@capacitor/core';

interface CallServicePlugin {
  start(options: { title: string; text: string }): Promise<{ running: boolean }>;
  stop(): Promise<{ running: boolean }>;
}

// Implemented in android/app/src/main/java/com/neriaok/lingo/CallServicePlugin.java
const CallService = registerPlugin<CallServicePlugin>('CallService');

const isAndroidApp = (): boolean => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CallService');

/** In the Android app, a foreground service keeps the mic alive while the call runs in the background. */
export const startBackgroundCall = async (title: string, text: string): Promise<void> => {
  if (!isAndroidApp()) return;
  await CallService.start({ title, text }).catch(() => undefined);
};

export const stopBackgroundCall = async (): Promise<void> => {
  if (!isAndroidApp()) return;
  await CallService.stop().catch(() => undefined);
};
