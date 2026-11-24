import { useEffect, useRef, type FC } from 'react';
import { useStrings } from '../../hooks/useStrings';
import type { ChatMessage, Level, NewWord } from '../../types';
import Composer from '../Composer';
import Icon from '../Icon';
import MessageBubble from '../MessageBubble';
import ui from '../ui.module.css';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
  messages: ChatMessage[];
  busy: boolean;
  targetRtl: boolean;
  nativeRtl: boolean;
  savedWords: string[];
  suggestions: string[];
  closable: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  onSpeak: (text: string, slow?: boolean) => void;
  onSaveWord: (word: NewWord) => void;
  onApplyLevel: (level: Level) => void;
}

/** Bottom sheet with the full transcript (voice + typed) and a composer. */
const ChatPanel: FC<ChatPanelProps> = ({
  messages, busy, targetRtl, nativeRtl, savedWords, suggestions, closable, onClose, onSend, onSpeak, onSaveWord, onApplyLevel,
}) => {
  const s = useStrings();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  return (
    <section className={styles.sheet} aria-label={s.openChat}>
      {closable && (
        <header className={styles.head}>
          <span className={styles.grip} aria-hidden="true" />
          <button type="button" className={ui.iconBtn} onClick={onClose} aria-label={s.closeChat}>
            <Icon name="close" />
          </button>
        </header>
      )}
      <div className={styles.list} ref={listRef}>
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            targetRtl={targetRtl}
            nativeRtl={nativeRtl}
            savedWords={savedWords}
            onSpeak={onSpeak}
            onSaveWord={onSaveWord}
            onApplyLevel={onApplyLevel}
          />
        ))}
      </div>
      <Composer suggestions={suggestions} disabled={busy} targetRtl={targetRtl} onSend={onSend} />
    </section>
  );
};

export default ChatPanel;
