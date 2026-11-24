import { useEffect, useRef, type FC } from 'react';
import clsx from 'clsx';
import { tutorInfo } from '../../data/catalog';
import { useSpeaking } from '../../hooks/useSpeaking';
import { getMouthLevel } from '../../services/audio/mouth';
import type { Mood, TutorId } from '../../types';
import styles from './Avatar.module.css';

interface AvatarProps {
  tutor: TutorId;
  mood?: Mood;
  size?: number;
  live?: boolean;
  className?: string;
}

const BROWS: Record<Mood, { l: string; r: string }> = {
  happy: { l: 'M68 92 Q80 85 92 90', r: 'M108 90 Q120 85 132 92' },
  thinking: { l: 'M68 88 Q80 86 92 92', r: 'M108 86 Q120 82 132 88' },
  surprised: { l: 'M68 84 Q80 76 92 83', r: 'M108 83 Q120 76 132 84' },
  encouraging: { l: 'M68 90 Q80 84 92 89', r: 'M108 89 Q120 84 132 90' },
};

const SMILE: Record<Mood, string> = {
  happy: 'M86 140 Q100 152 114 140',
  thinking: 'M88 143 Q100 145 112 141',
  surprised: 'M93 142 Q100 148 107 142',
  encouraging: 'M84 139 Q100 154 116 139',
};

const Hair: FC<{ style: string; color: string }> = ({ style, color }) => {
  switch (style) {
    case 'bob':
      return (
        <>
          <path d="M46 112 Q40 50 100 44 Q160 50 154 112 L154 150 Q146 160 138 150 L138 96 Q100 80 62 96 L62 150 Q54 160 46 150Z" fill={color} />
          <path d="M62 96 Q90 70 140 86 Q120 66 100 64 Q72 66 62 96Z" fill={color} />
        </>
      );
    case 'bun':
      return (
        <>
          <circle cx="100" cy="36" r="18" fill={color} />
          <path d="M54 106 Q50 52 100 50 Q150 52 146 106 Q138 78 100 74 Q62 78 54 106Z" fill={color} />
        </>
      );
    case 'curly':
      return (
        <g fill={color}>
          {[58, 74, 90, 106, 122, 138].map((x, i) => (
            <circle key={x} cx={x} cy={i % 2 ? 62 : 70} r="16" />
          ))}
          <circle cx="52" cy="90" r="13" />
          <circle cx="148" cy="90" r="13" />
        </g>
      );
    default:
      return <path d="M56 100 Q52 54 100 52 Q148 54 144 100 Q140 76 112 72 Q96 82 70 78 Q60 86 56 100Z" fill={color} />;
  }
};

const Avatar: FC<AvatarProps> = ({ tutor, mood = 'happy', size = 200, live = false, className }) => {
  const t = tutorInfo(tutor);
  const speakingNow = useSpeaking();
  const speaking = live && speakingNow;
  const mouthRef = useRef<SVGEllipseElement>(null);
  const jawRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!speaking) return undefined;
    let raf = 0;
    let open = 0;
    const tick = (): void => {
      // Real amplitude of the tutor's voice drives the mouth (fast attack, slower release).
      const target = getMouthLevel();
      open += (target - open) * (target > open ? 0.6 : 0.25);
      mouthRef.current?.setAttribute('ry', (1.5 + open * 10).toFixed(2));
      mouthRef.current?.setAttribute('rx', (11 + open * 3).toFixed(2));
      jawRef.current?.setAttribute('transform', `translate(0 ${(open * 2).toFixed(2)})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  const brow = BROWS[mood];

  return (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={size * 1.1}
      className={clsx(styles.avatar, speaking && styles.speaking, className)}
      role="img"
      aria-label={t.name}
    >
      <circle cx="100" cy="112" r="96" className={styles.halo} />
      <g className={styles.body}>
        <path d="M30 220 Q34 172 100 168 Q166 172 170 220Z" fill={t.shirt} />
        <path d="M84 168 L100 186 L116 168" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="3" />
        <rect x="88" y="150" width="24" height="22" rx="8" fill={t.skin} />
      </g>
      <g className={styles.head}>
        <ellipse cx="54" cy="116" rx="9" ry="13" fill={t.skin} />
        <ellipse cx="146" cy="116" rx="9" ry="13" fill={t.skin} />
        <ellipse cx="100" cy="110" rx="46" ry="54" fill={t.skin} />
        <ellipse cx="100" cy="128" rx="46" ry="34" fill="rgba(0,0,0,.04)" />
        <Hair style={t.style} color={t.hair} />
        <g className={styles.eyes}>
          <ellipse cx="80" cy="108" rx="6" ry={mood === 'surprised' ? 8 : 7} fill="#1b1b1f" />
          <ellipse cx="120" cy="108" rx="6" ry={mood === 'surprised' ? 8 : 7} fill="#1b1b1f" />
          <circle cx="82" cy="105" r="2" fill="#fff" />
          <circle cx="122" cy="105" r="2" fill="#fff" />
        </g>
        <g className={styles.lids}>
          <rect x="70" y="96" width="20" height="24" fill={t.skin} />
          <rect x="110" y="96" width="20" height="24" fill={t.skin} />
        </g>
        {t.glasses && (
          <g fill="none" stroke="#1b1b1f" strokeWidth="3">
            <rect x="64" y="96" width="32" height="24" rx="9" />
            <rect x="104" y="96" width="32" height="24" rx="9" />
            <path d="M96 106 Q100 102 104 106" />
          </g>
        )}
        <path d={brow.l} stroke={t.hair} strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d={brow.r} stroke={t.hair} strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M100 116 Q96 128 102 130" stroke="rgba(0,0,0,.25)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="72" cy="130" r="7" fill="#ff4f6d" opacity=".18" />
        <circle cx="128" cy="130" r="7" fill="#ff4f6d" opacity=".18" />
        {speaking ? (
          <g ref={jawRef}>
            <ellipse ref={mouthRef} cx="100" cy="143" rx="12" ry="3" fill="#5a1a24" />
            <rect x="92" y="136" width="16" height="4" rx="2" fill="#fff" opacity=".9" />
          </g>
        ) : (
          <path d={SMILE[mood]} stroke="#5a1a24" strokeWidth="4" strokeLinecap="round" fill="none" />
        )}
      </g>
    </svg>
  );
};

export default Avatar;
