const norm = (w: string): string => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

/**
 * Live speech transcription sometimes "loops" and emits the same phrase dozens of times
 * ("what is what is what is …"). Collapses any phrase of up to 8 words repeated 3+ times in a
 * row to a single occurrence and caps the length, so captions, history and rescue turns stay sane.
 */
export const cleanTranscript = (text: string, maxChars = 600): string => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let collapsed = false;
    for (let n = 1; n <= Math.min(8, Math.floor((words.length - i) / 3)); n += 1) {
      const block = words.slice(i, i + n).map(norm).join(' ');
      if (!block) continue;
      let reps = 1;
      while (words.slice(i + reps * n, i + (reps + 1) * n).map(norm).join(' ') === block) reps += 1;
      if (reps >= 3) {
        out.push(...words.slice(i, i + n));
        i += reps * n;
        collapsed = true;
        break;
      }
    }
    if (!collapsed) {
      out.push(words[i]);
      i += 1;
    }
  }
  const result = out.join(' ');
  return result.length > maxChars ? `…${result.slice(-maxChars)}` : result;
};
