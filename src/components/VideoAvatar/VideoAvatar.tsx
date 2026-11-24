import { useEffect, useRef, type FC } from 'react';
import clsx from 'clsx';
import { tutorInfo } from '../../data/catalog';
import { getMouthLevel, isSpeaking } from '../../services/audio/mouth';
import type { TutorId } from '../../types';
import styles from './VideoAvatar.module.css';

interface VideoAvatarProps {
  tutor: TutorId;
  /** 'loop': gentle idle clip. 'lipsync': a single talking clip that plays only while the tutor's voice is audible. */
  mode: 'loop' | 'lipsync';
  className?: string;
  onFail?: () => void;
}

const VOICE_THRESHOLD = 0.06;
// How long the voice must be quiet before the mouth stops (ignores tiny gaps between syllables).
const SILENCE_MS = 160;
// After silence, keep playing at most this long to land on a closed-mouth frame, then snap to the nearest one.
const SETTLE_MS = 320;

const nearest = (list: number[], t: number): number =>
  list.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), list[0] ?? 0);

/**
 * Video tutor. In lipsync mode there is only ONE clip, so the head never jumps between videos:
 * it plays while the voice is audible and pauses on a closed-mouth frame when the tutor is silent.
 */
const VideoAvatar: FC<VideoAvatarProps> = ({ tutor, mode, className, onFail }) => {
  const t = tutorInfo(tutor);
  const ref = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const rest = t.talkRest ?? [];

  useEffect(() => {
    const v = ref.current;
    if (!v || mode !== 'lipsync') return undefined;
    let raf = 0;
    let lastVoice = 0;
    let silentSince = 0;
    let talking = false;

    const atRest = (): boolean => rest.some((x) => Math.abs(x - v.currentTime) < 0.03);

    const tick = (now: number): void => {
      const voice = isSpeaking() && getMouthLevel() > VOICE_THRESHOLD;
      if (voice) lastVoice = now;
      const shouldTalk = now - lastVoice < SILENCE_MS;

      if (shouldTalk) {
        silentSince = 0;
        if (!talking || v.paused) {
          talking = true;
          v.play().catch(() => undefined);
        }
      } else if (talking) {
        if (!silentSince) silentSince = now;
        if (atRest()) {
          v.pause();
          talking = false;
        } else if (now - silentSince > SETTLE_MS) {
          v.pause();
          if (rest.length) v.currentTime = nearest(rest, v.currentTime);
          talking = false;
        }
      }
      frameRef.current?.classList.toggle(styles.still, !talking);
      raf = requestAnimationFrame(tick);
    };

    const start = (): void => {
      if (rest.length) v.currentTime = rest[0];
      raf = requestAnimationFrame(tick);
    };
    if (v.readyState >= 1) start();
    else v.addEventListener('loadedmetadata', start, { once: true });

    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('loadedmetadata', start);
    };
  }, [mode, rest]);

  const clip = mode === 'lipsync' ? 'talk' : 'idle';

  return (
    <div
      ref={frameRef}
      className={clsx(styles.frame, mode === 'lipsync' && styles.still, className)}
      style={{ ['--avatar-bg' as string]: t.videoBg ?? 'var(--sun)' }}
    >
      <video
        ref={ref}
        className={styles.clip}
        src={`./avatars/${t.id}-${clip}.mp4`}
        poster={`./avatars/${t.id}-${mode === 'lipsync' ? 'talk-poster' : 'poster'}.jpg`}
        muted
        playsInline
        loop
        preload="auto"
        autoPlay={mode === 'loop'}
        aria-label={t.name}
        onError={onFail}
      />
    </div>
  );
};

export default VideoAvatar;
