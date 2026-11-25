import type { FC } from 'react';
import styles from './Icon.module.css';

const PATHS: Record<string, string> = {
  chat: 'M4 5h16v11H9l-5 4z',
  cup: 'M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2',
  plane: 'M2 13l20-8-6 16-4-7zM12 14l4-4',
  brief: 'M3 8h18v11H3zM8 8V5h8v3M3 13h18',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  spark: 'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11v2',
  speaker: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  send: 'M4 12l16-8-6 16-2-6z',
  translate: 'M3 5h10M8 3v2M5 5c1 4 4 7 7 8M11 5c-1 4-4 7-7 8M13 21l4-9 4 9M14.5 18h5',
  back: 'M15 5l-7 7 7 7',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  cards: 'M7 4h12v14H7zM4 7v13h12',
  flame: 'M12 21a6 6 0 0 1-6-6c0-4 4-6 4-11 3 2 8 6 8 11a6 6 0 0 1-6 6zM12 21a2.5 2.5 0 0 1-2.5-2.5c0-2 2.5-3.5 2.5-3.5s2.5 1.5 2.5 3.5A2.5 2.5 0 0 1 12 21z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  close: 'M6 6l12 12M18 6L6 18',
  slow: 'M3 16h14a4 4 0 0 0 0-8h-2a6 6 0 0 0-12 4zM7 16v3M14 16v3',
  check: 'M5 12l5 5 9-10',
  micOff: 'M3 3l18 18M9 9v3a3 3 0 0 0 5 2.2M15 10V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.3M19 11a7 7 0 0 1-.6 2.8M12 18v3',
  phoneOff: 'M4 14c4-4 12-4 16 0l-2 3-3-1v-2.5a9 9 0 0 0-6 0V16l-3 1z',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  key: 'M15 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM10.5 13.5L3 21M6 18l2 2M15 7v.01',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
};

interface IconProps {
  name: string;
  size?: number;
}

const Icon: FC<IconProps> = ({ name, size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={styles.icon} aria-hidden="true">
    <path d={PATHS[name] ?? PATHS.chat} />
  </svg>
);

export default Icon;
