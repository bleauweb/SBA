import { hydrateRoot } from 'react-dom/client';
import type { PageData } from '../shared/types';
import { App } from './App';
import './styles.css';

declare global {
  interface Window {
    __DATA__: PageData;
  }
}

hydrateRoot(document.getElementById('root')!, <App data={window.__DATA__} />);
