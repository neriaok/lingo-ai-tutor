import { useState, type FC } from 'react';
import { tutorInfo } from '../../data/catalog';
import { useAppSelector } from '../../hooks/useAppDispatch';
import type { Mood, TutorId } from '../../types';
import Avatar from '../Avatar';
import VideoAvatar from '../VideoAvatar';

interface TutorPortraitProps {
  tutor: TutorId;
  /** In a live call the video lip-syncs to the voice; elsewhere it plays the idle loop. */
  live?: boolean;
  mood?: Mood;
  size?: number;
  className?: string;
}

/** Shows the animated video tutor when clips exist (and the learner wants it), else the drawn SVG tutor. */
const TutorPortrait: FC<TutorPortraitProps> = ({ tutor, mood, size, live = false, className }) => {
  const videoAvatar = useAppSelector((s) => s.profile.data.videoAvatar);
  const [failed, setFailed] = useState(false);
  const hasClips = (tutorInfo(tutor).clips?.length ?? 0) > 0;

  if (videoAvatar && hasClips && !failed) {
    return <VideoAvatar tutor={tutor} mode={live ? 'lipsync' : 'loop'} className={className} onFail={() => setFailed(true)} />;
  }
  return <Avatar tutor={tutor} mood={mood} size={size} live={live} className={className} />;
};

export default TutorPortrait;
