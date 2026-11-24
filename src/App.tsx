import { Suspense, lazy, useEffect, type FC } from 'react';
import { langInfo } from './data/catalog';
import { useAppSelector } from './hooks/useAppDispatch';
import History from './components/History';
import Home from './components/Home';
import Onboarding from './components/Onboarding';
import Settings from './components/Settings';
import Summary from './components/Summary';
import Vocab from './components/Vocab';

// The live call screen pulls in the Gemini SDK, so it is code-split.
const Call = lazy(() => import('./components/Call'));

const App: FC = () => {
  const onboarded = useAppSelector((s) => s.profile.onboarded);
  const native = useAppSelector((s) => s.profile.data.native);
  const view = useAppSelector((s) => s.session.view);

  useEffect(() => {
    const info = langInfo(native);
    document.documentElement.dir = info.rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = native;
  }, [native]);

  if (!onboarded) return <Onboarding />;
  switch (view) {
    case 'call': return <Suspense fallback={null}><Call /></Suspense>;
    case 'vocab': return <Vocab />;
    case 'history': return <History />;
    case 'summary': return <Summary />;
    case 'settings': return <Settings />;
    default: return <Home />;
  }
};

export default App;
