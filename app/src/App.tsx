import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { defaultState } from './defaultState';
import type { LetterState, CorrespondenceType } from './types';
import { Editor } from './components/Editor';
import { LetterPreview } from './components/LetterPreview';
import { About } from './components/About';
import { PreviewErrorBoundary } from './components/PreviewErrorBoundary';
import { printLetter } from './export/print';
import { getDownloadCount, recordDownload } from './api/counter';
import './App.css';

const ALL_TYPES: CorrespondenceType[] = [
  'standard-letter',
  'memo-from-to',
  'business-letter',
  'endorsement',
  'nato',
];
const makeStates = (): Record<CorrespondenceType, LetterState> =>
  Object.fromEntries(ALL_TYPES.map((t) => [t, { ...defaultState, type: t }])) as Record<
    CorrespondenceType,
    LetterState
  >;

export default function App() {
  // Each correspondence type keeps its own draft for the session — switch types freely and pick
  // up where you left off. All in memory; nothing persists once the tab closes.
  const [statesByType, setStatesByType] =
    useState<Record<CorrespondenceType, LetterState>>(makeStates);
  const [activeType, setActiveType] = useState<CorrespondenceType>('standard-letter');
  const [downloads, setDownloads] = useState<number | null>(null);
  const [view, setView] = useState<'editor' | 'about'>('editor');

  const state = statesByType[activeType];
  const setState: Dispatch<SetStateAction<LetterState>> = (update) =>
    setStatesByType((prev) => ({
      ...prev,
      [activeType]:
        typeof update === 'function'
          ? (update as (s: LetterState) => LetterState)(prev[activeType])
          : update,
    }));

  useEffect(() => {
    getDownloadCount().then(setDownloads);
  }, []);

  const bump = () =>
    recordDownload().then((n) => {
      if (typeof n === 'number') setDownloads(n);
    });

  const onDocx = async () => {
    // Lazy-load the .docx exporter (and the heavy `docx` library it pulls in) only when the
    // user actually exports — keeps ~all of it out of the initial page bundle.
    const { exportDocx } = await import('./export/docx');
    await exportDocx(state);
    void bump();
  };

  const onSignablePdf = async () => {
    // pdf-lib-generated PDF with an embedded digital-signature field (lazy-loaded).
    const { exportSignablePdf } = await import('./export/signablePdf');
    await exportSignablePdf(state);
    void bump();
  };

  const onPrint = () => {
    const after = () => {
      void bump();
      window.removeEventListener('afterprint', after);
    };
    window.addEventListener('afterprint', after);
    printLetter();
  };

  return (
    <div className="app">
      <div className="disclaimer">
        <strong>Unofficial tool</strong> — not affiliated with or endorsed by the U.S. Navy or
        DoD, and not an official system of record. You are responsible for following CUI and all
        other information-handling rules. Nothing you type is saved or transmitted — it lives only
        in this browser tab and is erased when you close it.
      </div>

      <header className="toolbar">
        <div className="brand">
          the&nbsp;yeomanizer
          <span className="brand-sub">naval correspondence, formatted</span>
        </div>
        <nav className={`seg-toggle ${view === 'about' ? 'pos-1' : 'pos-0'}`} role="tablist" aria-label="Page">
          <span className="seg-thumb" aria-hidden="true" />
          <button
            className={view === 'editor' ? 'seg on' : 'seg'}
            role="tab"
            aria-selected={view === 'editor'}
            onClick={() => setView('editor')}
          >
            Editor
          </button>
          <button
            className={view === 'about' ? 'seg on' : 'seg'}
            role="tab"
            aria-selected={view === 'about'}
            onClick={() => setView('about')}
          >
            Features
          </button>
        </nav>
        <div className="grow" />
        {view === 'editor' && state.type !== 'nato' && (
          <button onClick={() => void onDocx()}>Export .docx</button>
        )}
        {view === 'editor' && state.type !== 'nato' && (
          <button
            onClick={() => void onSignablePdf()}
            title="PDF with a clickable digital-signature field — open in Adobe and CAC/certificate-sign it (no Prepare-a-Form step)"
          >
            Signable PDF
          </button>
        )}
        {view === 'editor' && (
          <button className="primary" onClick={onPrint}>
            Print / Save PDF
          </button>
        )}
      </header>

      {view === 'editor' ? (
        <main className="panes">
          {/* autoComplete + spellCheck off so the browser never stores or transmits entries
              (e.g. autofill history, Chrome Enhanced Spellcheck). */}
          <form
            className="editor-pane"
            autoComplete="off"
            spellCheck={false}
            onSubmit={(e) => e.preventDefault()}
          >
            <Editor state={state} setState={setState} setType={setActiveType} />
          </form>
          <div className="paper-backdrop">
            <PreviewErrorBoundary>
              <LetterPreview state={state} />
            </PreviewErrorBoundary>
          </div>
        </main>
      ) : (
        <About />
      )}

      <footer className="footer">
        <span>
          Questions? <a href="mailto:info@yeomanizer.com">info@yeomanizer.com</a>
        </span>
        <span className="foot-mid">
          Your draft never leaves this browser — only an anonymous, site-wide download tally (a
          number, never any content) is recorded.
        </span>
        <span
          className="foot-count"
          title="A site-wide count of completed downloads across all users. No document content, personal data, or identifiers are ever sent or stored — only an integer is incremented."
        >
          Downloads: {downloads === null ? '—' : downloads.toLocaleString()}
        </span>
      </footer>
    </div>
  );
}
