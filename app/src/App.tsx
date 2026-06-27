import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { defaultState } from './defaultState';
import type { LetterState, CorrespondenceType } from './types';
import { Editor } from './components/Editor';
import { LetterPreview } from './components/LetterPreview';
import { About } from './components/About';
import { ImportDropZone } from './components/ImportDropZone';
import { Faq } from './components/Faq';
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
  const [view, setView] = useState<'editor' | 'builder' | 'features' | 'faq'>('builder');
  // The Editor tab edits a separately-imported letter, so importing never clobbers a Builder draft.
  const [importedState, setImportedState] = useState<LetterState | null>(null);

  const state = statesByType[activeType];
  const setState: Dispatch<SetStateAction<LetterState>> = (update) =>
    setStatesByType((prev) => ({
      ...prev,
      [activeType]:
        typeof update === 'function'
          ? (update as (s: LetterState) => LetterState)(prev[activeType])
          : update,
    }));

  // Which state the cards, preview, and exports operate on, by tab: Builder → the per-type draft;
  // Editor → the imported letter (null until a file is dropped, which shows the drop zone instead).
  const editingState = view === 'editor' ? importedState : view === 'builder' ? state : null;
  const setEditingState: Dispatch<SetStateAction<LetterState>> =
    view === 'editor'
      ? (update) =>
          setImportedState((prev) =>
            prev
              ? typeof update === 'function'
                ? (update as (s: LetterState) => LetterState)(prev)
                : update
              : prev,
          )
      : setState;
  const setEditingType = (t: CorrespondenceType) =>
    view === 'editor'
      ? setImportedState((prev) => (prev ? { ...prev, type: t } : prev))
      : setActiveType(t);

  useEffect(() => {
    getDownloadCount().then(setDownloads);
  }, []);

  const bump = () =>
    recordDownload().then((n) => {
      if (typeof n === 'number') setDownloads(n);
    });

  const onDocx = async () => {
    if (!editingState) return;
    // Lazy-load the .docx exporter (and the heavy `docx` library it pulls in) only when the
    // user actually exports — keeps ~all of it out of the initial page bundle.
    const { exportDocx } = await import('./export/docx');
    await exportDocx(editingState);
    void bump();
  };

  const onSignablePdf = async () => {
    if (!editingState) return;
    // pdf-lib-generated PDF with an embedded digital-signature field (lazy-loaded).
    const { exportSignablePdf } = await import('./export/signablePdf');
    await exportSignablePdf(editingState);
    void bump();
  };

  const onProjectFile = async () => {
    if (!editingState) return;
    // A separate, plain-text editable copy (.json) — the exported document itself stays clean.
    const { exportProjectFile } = await import('./export/roundtrip');
    exportProjectFile(editingState);
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
        <strong>Unofficial tool</strong> — not affiliated with or endorsed by the U.S. Navy or DoD,
        and not an official system of record. <strong>The tool sends and stores nothing</strong> —
        what you type stays in this browser tab and is erased when you close it (only an anonymous
        download count ever leaves). <strong>CUI belongs only on authorized equipment</strong> —
        Government-Furnished Equipment, or a system specifically approved for it, never a personal
        device — so use this on such a system and follow your command&rsquo;s policy. The files you
        download are yours to mark, store, transmit, and handle under the applicable CUI and
        information-handling rules.
      </div>

      <header className="toolbar">
        <div className="brand">
          the&nbsp;yeomanizer
          <span className="brand-sub">naval correspondence, formatted</span>
        </div>
        <nav
          className={`seg-toggle seg-4 ${view === 'editor' ? 'pos-0' : view === 'builder' ? 'pos-1' : view === 'features' ? 'pos-2' : 'pos-3'}`}
          role="tablist"
          aria-label="Page"
        >
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
            className={view === 'builder' ? 'seg on' : 'seg'}
            role="tab"
            aria-selected={view === 'builder'}
            onClick={() => setView('builder')}
          >
            Builder
          </button>
          <button
            className={view === 'features' ? 'seg on' : 'seg'}
            role="tab"
            aria-selected={view === 'features'}
            onClick={() => setView('features')}
          >
            Features
          </button>
          <button
            className={view === 'faq' ? 'seg on' : 'seg'}
            role="tab"
            aria-selected={view === 'faq'}
            onClick={() => setView('faq')}
          >
            FAQ
          </button>
        </nav>
        <div className="grow" />
        {editingState && editingState.type !== 'nato' && (
          <button onClick={() => void onDocx()}>Export .docx</button>
        )}
        {editingState && (
          <button
            onClick={() => void onProjectFile()}
            title="A small editable copy you can drop into the Editor tab later to keep working. The .docx/PDF you export stay clean — nothing is hidden inside them."
          >
            Export .json
          </button>
        )}
        {editingState && editingState.type === 'nato' && (
          <button className="primary" onClick={onPrint} title="Print or save the travel order as a PDF">
            Print / Save PDF
          </button>
        )}
        {editingState && editingState.type !== 'nato' && (
          <button
            className="primary"
            onClick={() => void onSignablePdf()}
            title="Pixel-accurate, searchable PDF of the full document — endorsements, enclosures, and CUI included — with a CAC-signable signature field. Open it to print, save, or CAC-sign (no Prepare-a-Form step)."
          >
            Export PDF
          </button>
        )}
      </header>

      {editingState && (
        <div className="export-help">
          {editingState.type !== 'nato' && (
            <span>
              <strong>.docx</strong> — editable Word version of the final letter; edit in Word or
              share the document.
            </span>
          )}
          <span>
            <strong>.json</strong> — a small editable copy; drop it into the <em>Editor</em> tab
            later to keep working. The .docx/PDF stay clean (nothing hidden inside them).
          </span>
          {editingState.type !== 'nato' ? (
            <span>
              <strong>PDF</strong> — pixel-accurate final letter with a CAC-signable field; print,
              save, or sign.
            </span>
          ) : (
            <span>
              <strong>Print / Save PDF</strong> — print the travel order or save it as a PDF.
            </span>
          )}
        </div>
      )}

      {view === 'features' ? (
        <About />
      ) : view === 'faq' ? (
        <Faq />
      ) : editingState ? (
        <main className="panes">
          {/* autoComplete + spellCheck off so the browser never stores or transmits entries
              (e.g. autofill history, Chrome Enhanced Spellcheck). */}
          <form
            className="editor-pane"
            autoComplete="off"
            spellCheck={false}
            onSubmit={(e) => e.preventDefault()}
          >
            <Editor state={editingState} setState={setEditingState} setType={setEditingType} />
          </form>
          <div className="paper-backdrop">
            <PreviewErrorBoundary>
              <LetterPreview state={editingState} />
            </PreviewErrorBoundary>
          </div>
        </main>
      ) : (
        <ImportDropZone onImport={setImportedState} />
      )}

      <footer className="footer">
        <span>
          Questions? <a href="mailto:info@yeomanizer.com">info@yeomanizer.com</a>
        </span>
        <span className="foot-mid">
          The tool sends nothing but an anonymous, site-wide download tally (a number — never your
          content). Your draft stays in this browser until you download it yourself.
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
