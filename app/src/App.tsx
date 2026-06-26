import { useEffect, useState } from 'react';
import { defaultState } from './defaultState';
import type { LetterState } from './types';
import { Editor } from './components/Editor';
import { LetterPreview } from './components/LetterPreview';
import { printLetter } from './export/print';
import { exportDocx } from './export/docx';
import { getDownloadCount, recordDownload } from './api/counter';
import './App.css';

export default function App() {
  const [state, setState] = useState<LetterState>(defaultState);
  const [downloads, setDownloads] = useState<number | null>(null);

  useEffect(() => {
    getDownloadCount().then(setDownloads);
  }, []);

  const bump = () =>
    recordDownload().then((n) => {
      if (typeof n === 'number') setDownloads(n);
    });

  const onDocx = async () => {
    await exportDocx(state);
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
        <div className="grow" />
        <button onClick={() => void onDocx()}>Export .docx</button>
        <button className="primary" onClick={onPrint}>
          Print / Save PDF
        </button>
      </header>

      <main className="panes">
        {/* autoComplete + spellCheck off so the browser never stores or transmits entries
            (e.g. autofill history, Chrome Enhanced Spellcheck). */}
        <form
          className="editor-pane"
          autoComplete="off"
          spellCheck={false}
          onSubmit={(e) => e.preventDefault()}
        >
          <Editor state={state} setState={setState} />
        </form>
        <div className="paper-backdrop">
          <LetterPreview state={state} />
        </div>
      </main>

      <footer className="footer">
        <span>
          Questions? <a href="mailto:info@yeomanizer.com">info@yeomanizer.com</a>
        </span>
        <span className="foot-mid">
          Your draft never leaves this browser. We log only an anonymous count of completed
          downloads — never any document content or personal data.
        </span>
        <span
          className="foot-count"
          title="We record that a download happened — a running number only. No document content, no personal data, no identifiers are ever stored."
        >
          {downloads === null ? '' : `${downloads.toLocaleString()} documents created`}
        </span>
      </footer>
    </div>
  );
}
