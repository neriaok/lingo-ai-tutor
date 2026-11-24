import { getStrings, type Strings } from '../data/strings';
import { useAppSelector } from './useAppDispatch';

export const useStrings = (): Strings => {
  const native = useAppSelector((s) => s.profile.data.native);
  return getStrings(native);
};
