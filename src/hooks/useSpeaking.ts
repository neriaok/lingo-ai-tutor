import { useEffect, useState } from 'react';
import { isSpeaking, subscribeSpeaking } from '../services/audio/mouth';

export const useSpeaking = (): boolean => {
  const [speaking, setSpeaking] = useState(isSpeaking());
  useEffect(() => subscribeSpeaking(setSpeaking), []);
  return speaking;
};
