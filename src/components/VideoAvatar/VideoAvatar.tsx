import { useEffect, useRef, useState, type FC } from 'react';
import clsx from 'clsx';
import { tutorInfo } from '../../data/catalog';
import { getMouthLevel, isSpeaking } from '../../services/audio/mouth';
import type { TutorId } from '../../types';
import styles from './VideoAvatar.module.css';

interface VideoAvatarProps {
  tutor: TutorId;
  /** 'loop': idle clip only. 'lipsync': idle clip, cross-fading into the talking clip while the voice is audible. */
  mode: 'loop' | 'lipsync';
  className?: string;
  onFail?: () => void;
}

const VOICE_THRESHOLD = 0.06;
// Quiet this long = the tutor stopped talking (ignores the small gaps between words).
const SILENCE_MS = 260;
// Once the talking clip is shown, keep it at least this long, so short blips never flicker.
const MIN_TALK_MS = 600;
// Must match the CSS cross-fade duration.
const FADE_MS = 320;

/**
 * Video tutor built from two aligned loops: the idle clip always plays underneath, and the
 * talking clip cross-fades in while the tutor's voice is audible. Both clips were cropped to the
 * same face position, so the fade reads as one continuous person rather than a cut.
 */
const VideoAvatar: FC<VideoAvatarProps> = ({ tutor, mode, className, onFail }) => {
  const t = tutorInfo(tutor);
  const talkRef = useRef<HTMLVideoElement>(null);
  const [talking, setTalking] = useState(false);
  const lipsync = mode === 'lipsync' && (t.clips ?? []).includes('talk');

  useEffect(() => {
    const v = talkRef.current;
    if (!v || !lipsync) return undefined;
    let raf = 0;
    let lastVoice = -Infinity;
    let shownAt = 0;
    let on = false;
    let resetTimer = 0;

    const tick = (now: number): void => {
      if (isSpeaking() && getMouthLevel() > VOICE_THRESHOLD) lastVoice = now;
      const voice = now - lastVoice < SILENCE_MS;
      if (voice && !on) {
        on = true;
        shownAt = now;
        window.clearTimeout(resetTimer);
        v.play().catch(() => undefined);
        setTalking(true);
      } else if (!voice && on && now - shownAt > MIN_TALK_MS) {
        on = false;
        setTalking(false);
        // After the fade-out, rewind so the next sentence starts from the calm first frame.
        resetTimer = window.setTimeout(() => {
          v.pause();
          v.currentTime = 0;
        }, FADE_MS + 40);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resetTimer);
    };
  }, [lipsync]);

  return (
    <div className={clsx(styles.frame, className)} style={{ ['--avatar-bg' as string]: t.videoBg ?? 'var(--sun)' }}>
      <video
        className={styles.clip}
        src={`./avatars/${t.id}-idle.mp4`}
        poster={`./avatars/${t.id}-poster.jpg`}
        muted
        playsInline
        loop
        autoPlay
        preload="auto"
        aria-label={t.name}
        onError={onFail}
      />
      {lipsync && (
        <video
          ref={talkRef}
          className={clsx(styles.clip, styles.talk, talking && styles.talkOn)}
          src={`./avatars/${t.id}-talk.mp4`}
          muted
          playsInline
          loop
          preload="auto"
          aria-hidden="true"
          onError={onFail}
        />
      )}
    </div>
  );
};

export default VideoAvatar;
