import { useEffect, useRef, useState, type FC } from 'react';
import clsx from 'clsx';
import { useStrings } from '../../hooks/useStrings';
import Icon from '../Icon';
import ui from '../ui.module.css';
import styles from './KeyGuide.module.css';

interface KeyGuideProps {
  url: string;
  onClose: () => void;
}

/** Step-by-step picture guide for creating a free Gemini key in Google AI Studio. */
const KeyGuide: FC<KeyGuideProps> = ({ url, onClose }) => {
  const s = useStrings();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const slides = [
    { img: './guide/step1.jpg', title: s.guide1Title, text: s.guide1Text },
    { img: './guide/step2.jpg', title: s.guide2Title, text: s.guide2Text },
    { img: './guide/step3.jpg', title: s.guide3Title, text: s.guide3Text },
    { img: null, title: s.guide4Title, text: s.guide4Text },
  ];

  const goTo = (i: number): void => {
    setIndex(i);
    const track = trackRef.current;
    const slide = track?.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const onScroll = (): void => {
      const w = track.clientWidth || 1;
      setIndex(Math.round(Math.abs(track.scrollLeft) / w));
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const last = index === slides.length - 1;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={s.guideTitle} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <strong>{s.guideTitle}</strong>
          <button type="button" className={styles.close} onClick={onClose} aria-label={s.closeChat}>
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className={styles.track} ref={trackRef}>
          {slides.map((sl, i) => (
            <section key={sl.title} className={styles.slide} aria-label={`${i + 1}/${slides.length}`}>
              {sl.img ? (
                <img className={styles.shot} src={sl.img} alt={sl.title} loading={i === 0 ? 'eager' : 'lazy'} />
              ) : (
                <div className={styles.final}>
                  <div className={styles.mockInput} dir="ltr">AQ.••••••••••••••</div>
                  <div className={styles.mockBtn}>{s.checkKey}</div>
                </div>
              )}
              <p className={styles.caption}>
                <b>{i + 1}. {sl.title}</b>
                <span>{sl.text}</span>
              </p>
            </section>
          ))}
        </div>

        <div className={styles.dots} aria-hidden="true">
          {slides.map((sl, i) => (
            <span key={sl.title} className={clsx(styles.dot, i === index && styles.dotOn)} />
          ))}
        </div>

        <footer className={styles.nav}>
          <button type="button" className={clsx(ui.btn, ui.ghost)} onClick={() => goTo(index - 1)} disabled={index === 0}>
            {s.back}
          </button>
          {last ? (
            <a className={clsx(ui.btn, ui.pink)} href={url} target="_blank" rel="noreferrer" onClick={onClose}>
              {s.getKey} ↗
            </a>
          ) : (
            <button type="button" className={ui.btn} onClick={() => goTo(index + 1)}>
              {s.next}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default KeyGuide;
