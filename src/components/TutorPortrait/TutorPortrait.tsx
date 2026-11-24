import { useState, type FC } from 'react';
import { tutorInfo } from '../../data/catalog';
import { useAppSelector } from '../../hooks/useAppDispatch';
import type { Mood, TutorId } from '../../types';
import Avatar from '../Avatar';
import VideoAvatar, { type AvatarClip } from '../VideoAvatar';

interface TutorPortraitProps {
  tutor: TutorId;
  clip?: AvatarClip;
  mood?: Mood;
  size?: number;
  live?: boolean;
  className?: string;
}

/** Shows the animated video tutor when clips exist (and the learner wants it), else the drawn SVG tutor. */
const TutorPortrait: FC<TutorPortraitProps> = ({ tutor, clip = 'idle', mood, size, live, className }) => {
  const videoAvatar = useAppSelector((s) => s.profile.data.videoAvatar);
  const [failed, setFailed] = useState(false);
  const hasClips = (tutorInfo(tutor).clips?.length ?? 0) > 0;

  if (videoAvatar && hasClips && !failed) {
    return <VideoAvatar tutor={tutor} clip={clip} className={className} onFail={() => setFailed(true)} />;
  }
  return <Avatar tutor={tutor} mood={mood} size={size} live={live} className={className} />;
};

export default TutorPortrait;
