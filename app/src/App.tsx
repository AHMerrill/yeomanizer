import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { defaultFor } from './defaultState';
import type { LetterState, CorrespondenceType } from './types';
import { Editor } from './components/Editor';
import { LetterPreview } from './components/LetterPreview';
import { About } from './components/About';
import { ImportDropZone } from './components/ImportDropZone';
import { Faq } from './components/Faq';
import Guide from './components/Guide';
import { PreviewErrorBoundary } from './components/PreviewErrorBoundary';
import { printLetter } from './export/print';
import { recordVisit, recordDownload, type Counts } from './api/counter';
import './App.css';

const ALL_TYPES: CorrespondenceType[] = [
  'standard-letter',
  'memo-from-to',
  'mfr',
  'business-letter',
  'endorsement',
  'nato',
];
const makeStates = (): Record<CorrespondenceType, LetterState> =>
  Object.fromEntries(ALL_TYPES.map((t) => [t, defaultFor(t)])) as Record<
    CorrespondenceType,
    LetterState
  >;

export default function App() {
  // Each correspondence type keeps its own draft for the session — switch types freely and pick
  // up where you left off. All in memory; nothing persists once the tab closes.
  const [statesByType, setStatesByType] =
    useState<Record<CorrespondenceType, LetterState>>(makeStates);
  const [activeType, setActiveType] = useState<CorrespondenceType>('standard-letter');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [view, setView] = useState<'editor' | 'builder' | 'features' | 'faq' | 'guide'>('builder');
  // The Editor tab edits a separately-imported letter, so importing never clobbers a Builder draft.
  const [importedState, setImportedState] = useState<LetterState | null>(null);

  // Slide the tab "thumb" by MEASURING the active tab — the pill hugs its content, so the tabs are
  // variable-width per label; a fixed 1/N thumb drifts on the wider/narrower ones (the FAQ/Features
  // jank). Measuring fits it exactly, in every browser, at any tab count.
  const navRef = useRef<HTMLElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const thumb = thumbRef.current;
    const active = nav?.querySelector<HTMLElement>('.seg.on');
    if (!nav || !thumb || !active) return;
    const place = () => {
      thumb.style.width = `${active.offsetWidth}px`;
      thumb.style.transform = `translateX(${active.offsetLeft - thumb.offsetLeft}px)`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [view]);

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

  // Record one anonymous page view on load — a content-free POST (no body, no IP, no region; the
  // server stores only an integer) — and show both running totals. In local dev the endpoint isn't
  // present, so this fails silently and the counts simply stay hidden.
  useEffect(() => {
    recordVisit().then(setCounts);
  }, []);

  const bump = () => recordDownload().then((c) => c && setCounts(c));

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
        page-load and download-click count ever leaves — two integers, never any cookies, IP, region,
        or content). <strong>CUI belongs only on authorized equipment</strong> —
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
          ref={navRef}
          className="seg-toggle seg-5"
          role="tablist"
          aria-label="Page"
        >
          <span ref={thumbRef} className="seg-thumb" aria-hidden="true" />
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
            className={view === 'guide' ? 'seg on' : 'seg'}
            role="tab"
            aria-selected={view === 'guide'}
            onClick={() => setView('guide')}
          >
            Guide
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
      ) : view === 'guide' ? (
        <Guide />
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
          The tool sends nothing but two anonymous, site-wide counters — page loads and
          download-button clicks (raw numbers; no cookies, no IP, no region, no memory of who). Your
          draft stays in this browser until you download it.
        </span>
        <span
          className="foot-count"
          title="Two raw site-wide counters: page loads (a refresh counts again) and download-button clicks (counts even if you cancel the save). No cookies, no per-visitor memory, no IP, no region — just two integers shared by everyone."
        >
          {counts === null
            ? 'Page Loads — · Download Clicks —'
            : `Page Loads ${counts.visits.toLocaleString()} · Download Clicks ${counts.downloads.toLocaleString()}`}
        </span>
      </footer>
    </div>
  );
}
