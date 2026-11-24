import { useEffect, useRef, useState, type FC } from 'react';
import clsx from 'clsx';
import { tutorInfo } from '../../data/catalog';
import { getMouthLevel, isSpeaking } from '../../services/audio/mouth';
import type { TutorId } from '../../types';
import styles from './VideoAvatar.module.css';

interface VideoAvatarProps {
  tutor: TutorId;
  /** 'loop': gentle idle clip. 'lipsync': the talking clip plays only while the tutor's voice is audible. */
  mode: 'loop' | 'lipsync';
  className?: string;
  onFail?: () => void;
}

const VOICE_THRESHOLD = 0.06;
// Quiet this long = the tutor stopped talking (ignores tiny gaps between syllables).
const SILENCE_MS = 180;

/**
 * Video tutor. In lipsync mode one talking clip plays while the voice is audible.
 * When the tutor is silent we fade to a still of the clip's first frame (eyes open, mouth closed)
 * and rewind behind it — so she never freezes mid-blink or with her mouth open, and the next
 * sentence starts seamlessly from that same frame.
 */
const VideoAvatar: FC<VideoAvatarProps> = ({ tutor, mode, className, onFail }) => {
  const t = tutorInfo(tutor);
  const ref = useRef<HTMLVideoElement>(null);
  const [talking, setTalking] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || mode !== 'lipsync') return undefined;
    let raf = 0;
    let lastVoice = -Infinity;
    let on = false;
    let rewindTimer = 0;

    const tick = (now: number): void => {
      if (isSpeaking() && getMouthLevel() > VOICE_THRESHOLD) lastVoice = now;
      const shouldTalk = now - lastVoice < SILENCE_MS;
      if (shouldTalk && !on) {
        on = true;
        window.clearTimeout(rewindTimer);
        setTalking(true);
        v.play().catch(() => undefined);
      } else if (!shouldTalk && on) {
        on = false;
        setTalking(false);
        // Rewind once the still image has faded in over the video.
        rewindTimer = window.setTimeout(() => {
          v.pause();
          v.currentTime = 0;
        }, 200);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(rewindTimer);
    };
  }, [mode]);

  const lipsync = mode === 'lipsync';

  return (
    <div
      className={clsx(styles.frame, lipsync && !talking && styles.still, className)}
      style={{ ['--avatar-bg' as string]: t.videoBg ?? 'var(--sun)' }}
    >
      <video
        ref={ref}
        className={styles.clip}
        src={`./avatars/${t.id}-${lipsync ? 'talk' : 'idle'}.mp4`}
        poster={`./avatars/${t.id}-${lipsync ? 'talk-poster' : 'poster'}.jpg`}
        muted
        playsInline
        loop
        preload="auto"
        autoPlay={!lipsync}
        aria-label={t.name}
        onError={onFail}
      />
      {lipsync && (
        <img className={clsx(styles.rest, !talking && styles.restOn)} src={`./avatars/${t.id}-talk-poster.jpg`} alt="" aria-hidden="true" />
      )}
    </div>
  );
};

export default VideoAvatar;
