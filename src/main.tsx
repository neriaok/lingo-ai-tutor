import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { store } from './store/store';
import './styles.css';
import { stopBackgroundCall } from './services/nativeCall';

// A fresh app start never has a live call: clear any leftover call notification.
void stopBackgroundCall();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
