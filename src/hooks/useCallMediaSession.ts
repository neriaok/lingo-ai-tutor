import { useEffect, useRef } from 'react';

interface CallMediaSession {
  active: boolean;
  title: string;
  subtitle: string;
  artwork: string;
  muted: boolean;
  onToggleMute: () => void;
  onHangUp: () => void;
}

type ExtendedAction = MediaSessionAction | 'togglemicrophone' | 'hangup';

/**
 * Registers the call with the OS media session, so while the app is in the background the
 * phone shows "Lingo · Maya" with mute / hang-up controls (where the browser supports it).
 */
export const useCallMediaSession = ({ active, title, subtitle, artwork, muted, onToggleMute, onHangUp }: CallMediaSession): void => {
  const handlers = useRef({ onToggleMute, onHangUp });
  handlers.current = { onToggleMute, onHangUp };

  useEffect(() => {
    if (!active || !('mediaSession' in navigator)) return undefined;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title,
        artist: subtitle,
        album: 'Lingo',
        artwork: [{ src: artwork, sizes: '480x600', type: 'image/jpeg' }],
      });
      ms.playbackState = 'playing';
    } catch {
      /* not supported */
    }
    const set = (action: ExtendedAction, fn: (() => void) | null): void => {
      try {
        ms.setActionHandler(action as MediaSessionAction, fn);
      } catch {
        /* action not supported by this browser */
      }
    };
    set('pause', () => handlers.current.onToggleMute());
    set('play', () => handlers.current.onToggleMute());
    set('togglemicrophone', () => handlers.current.onToggleMute());
    set('stop', () => handlers.current.onHangUp());
    set('hangup', () => handlers.current.onHangUp());
    return () => {
      (['pause', 'play', 'togglemicrophone', 'stop', 'hangup'] as ExtendedAction[]).forEach((a) => set(a, null));
      try {
        ms.metadata = null;
        ms.playbackState = 'none';
      } catch {
        /* ignore */
      }
    };
  }, [active, title, subtitle, artwork]);

  useEffect(() => {
    if (!active || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession as MediaSession & { setMicrophoneActive?: (on: boolean) => unknown };
    try {
      // Returns a promise in some browsers and nothing in others.
      void Promise.resolve(ms.setMicrophoneActive?.(!muted)).catch(() => undefined);
    } catch {
      /* unsupported */
    }
  }, [active, muted]);
};
