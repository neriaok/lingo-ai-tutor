import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neriaok.lingo',
  appName: 'Lingo',
  webDir: 'dist',
  // The Android app loads the live web app, so every push to main reaches the phone
  // without reinstalling the APK. The bundled copy is only used for the offline page.
  server: {
    url: 'https://lingo.neriaokabik.workers.dev/',
    androidScheme: 'https',
    errorPath: 'offline.html',
  },
  android: { allowMixedContent: false },
};

export default config;
