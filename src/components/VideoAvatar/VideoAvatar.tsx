import { useEffect, useRef, useState, type FC } from 'react';
import clsx from 'clsx';
import { tutorInfo } from '../../data/catalog';
import type { TutorId } from '../../types';
import styles from './VideoAvatar.module.css';

export type AvatarClip = 'idle' | 'listen' | 'talk' | 'think';

interface VideoAvatarProps {
  tutor: TutorId;
  clip: AvatarClip;
  className?: string;
  /** Called if a clip cannot be played, so the parent can fall back to the drawn avatar. */
  onFail?: () => void;
}

const CLIPS: AvatarClip[] = ['idle', 'listen', 'talk', 'think'];
// Leaving "talk" waits a moment, so short pauses between words don't make the face flicker.
const TALK_HOLD_MS = 450;

/** Animated tutor made of short looping clips; cross-fades between them by call state. */
const VideoAvatar: FC<VideoAvatarProps> = ({ tutor, clip, className, onFail }) => {
  const t = tutorInfo(tutor);
  const refs = useRef<Record<AvatarClip, HTMLVideoElement | null>>({ idle: null, listen: null, talk: null, think: null });
  const [shown, setShown] = useState<AvatarClip>(clip);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (clip === shown) return undefined;
    const delay = shown === 'talk' ? TALK_HOLD_MS : 0;
    const timer = window.setTimeout(() => setShown(clip), delay);
    return () => window.clearTimeout(timer);
  }, [clip, shown]);

  useEffect(() => {
    CLIPS.forEach((c) => {
      const v = refs.current[c];
      if (!v) return;
      if (c === shown) {
        v.play().catch(() => undefined);
      } else {
        // Pause the hidden clips after the cross-fade to save battery.
        window.setTimeout(() => {
          if (refs.current[c] && c !== shownRef.current) refs.current[c]?.pause();
        }, 300);
      }
    });
  }, [shown]);

  const available = t.clips ?? [];
  const src = (c: AvatarClip): string => `./avatars/${t.id}-${available.includes(c) ? c : 'idle'}.mp4`;

  return (
    <div className={clsx(styles.frame, className)} style={{ ['--avatar-bg' as string]: t.videoBg ?? 'var(--sun)' }}>
      <img className={styles.poster} src={`./avatars/${t.id}-poster.jpg`} alt={t.name} />
      {CLIPS.map((c) => (
        <video
          key={c}
          ref={(el) => {
            refs.current[c] = el;
          }}
          className={clsx(styles.clip, shown === c && styles.on)}
          src={src(c)}
          muted
          loop
          playsInline
          preload="auto"
          autoPlay={c === shown}
          aria-hidden="true"
          onError={onFail}
        />
      ))}
    </div>
  );
};

export default VideoAvatar;
