import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import { defaultFor } from './defaultState';
import type { LetterState, CorrespondenceType } from './types';
import { Editor } from './components/Editor';
import { Checklist } from './components/Checklist';
import { Credits } from './components/Credits';
import { TEMPLATES } from './data/templates';
import { proofread } from './format/proofread';
import { detectPii } from './format/pii';
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
  const [view, setView] = useState<
    'editor' | 'builder' | 'checklist' | 'features' | 'faq' | 'guide' | 'credits'
  >('builder');
  // The Editor tab edits a separately-imported letter, so importing never clobbers a Builder draft.
  const [importedState, setImportedState] = useState<LetterState | null>(null);
  // Draggable editor/preview split — session-only (no persistence). null = the CSS default width.
  const [editorWidth, setEditorWidth] = useState<number | null>(null);
  const panesRef = useRef<HTMLElement>(null);

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
  // The Proofread tab is its own view, so remember which document was last being edited (the Builder
  // draft or the Editor import) and analyze THAT — the tab and its badge follow the active context,
  // not whichever happens to be the Builder draft.
  const lastEditedRef = useRef<'builder' | 'editor'>('builder');
  if (view === 'builder' || view === 'editor') lastEditedRef.current = view;
  const reviewSubject = lastEditedRef.current === 'editor' ? importedState : state;
  // Non-blocking nudge for the Proofread tab: how many draft warnings + sensitive-data hits to look at.
  const reviewCount = reviewSubject
    ? proofread(reviewSubject).filter((c) => c.status === 'warn').length + detectPii(reviewSubject).length
    : 0;
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

  // ---- Undo / redo — in-memory history per editing context (each Builder draft, and the Editor
  // import); nothing persists. Rapid edits within ~700ms coalesce into one step, so a typing burst
  // undoes as a unit rather than character by character. ----
  const [histories, setHistories] = useState<Record<string, { past: LetterState[]; future: LetterState[] }>>({});
  const ctxKey = view === 'editor' ? 'editor' : 'builder:' + activeType;
  const burstRef = useRef<{ key: string; t: number }>({ key: '', t: 0 });
  const applyEditing = (s: LetterState) =>
    view === 'editor' ? setImportedState(s) : setStatesByType((prev) => ({ ...prev, [activeType]: s }));

  // setEditingState, wrapped to snapshot the prior state into history before each change.
  const setEditingStateTracked: Dispatch<SetStateAction<LetterState>> = (update) => {
    const prev = editingState;
    if (prev) {
      const now = Date.now();
      const b = burstRef.current;
      const sameBurst = b.key === ctxKey && now - b.t < 700;
      burstRef.current = { key: ctxKey, t: now };
      setHistories((h) => {
        const cur = h[ctxKey] ?? { past: [], future: [] };
        // start of a burst → push the prior snapshot; mid-burst → keep past, just clear redo
        const past = sameBurst ? cur.past : [...cur.past, prev].slice(-100);
        return { ...h, [ctxKey]: { past, future: [] } };
      });
    }
    setEditingState(update);
  };

  const undo = () => {
    const cur = histories[ctxKey];
    if (!cur?.past.length || !editingState) return;
    const prev = cur.past[cur.past.length - 1];
    setHistories((h) => {
      const c = h[ctxKey]!;
      return { ...h, [ctxKey]: { past: c.past.slice(0, -1), future: [...c.future, editingState] } };
    });
    applyEditing(prev);
    burstRef.current = { key: '', t: 0 };
  };
  const redo = () => {
    const cur = histories[ctxKey];
    if (!cur?.future.length || !editingState) return;
    const next = cur.future[cur.future.length - 1];
    setHistories((h) => {
      const c = h[ctxKey]!;
      return { ...h, [ctxKey]: { past: [...c.past, editingState], future: c.future.slice(0, -1) } };
    });
    applyEditing(next);
    burstRef.current = { key: '', t: 0 };
  };
  const canUndo = !!editingState && !!histories[ctxKey]?.past.length;
  const canRedo = !!editingState && !!histories[ctxKey]?.future.length;
  // Importing a fresh file starts a new editing baseline — clear the Editor context's history.
  const onImport = (s: LetterState) => {
    setImportedState(s);
    setHistories((h) => ({ ...h, editor: { past: [], future: [] } }));
    burstRef.current = { key: '', t: 0 };
  };

  // Load a starter example into its type's Builder draft. Snapshots the prior draft into history first,
  // so it's undoable (⌘/Ctrl+Z). A different-type example fills that type's own slot — it never
  // destroys the draft you're looking at.
  const loadTemplate = (build: () => LetterState) => {
    const st = build();
    const key = 'builder:' + st.type;
    setHistories((h) => {
      const cur = h[key] ?? { past: [], future: [] };
      return { ...h, [key]: { past: [...cur.past, statesByType[st.type]].slice(-100), future: [] } };
    });
    burstRef.current = { key: '', t: 0 };
    setActiveType(st.type);
    setStatesByType((prev) => ({ ...prev, [st.type]: st }));
  };

  // Keyboard: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Ctrl+Y = redo — but defer to NATIVE undo inside a
  // focused text field, so per-character text undo still works. Refs keep the handler's closures fresh.
  const undoRef = useRef(undo);
  undoRef.current = undo;
  const redoRef = useRef(redo);
  redoRef.current = redo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) return;
      e.preventDefault();
      if (k === 'y' || (k === 'z' && e.shiftKey)) redoRef.current();
      else undoRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  // Drag the divider to resize the editor pane; the preview takes the rest. Clamped so neither pane
  // collapses. Print is unaffected — the editor + divider are display:none under @media print.
  const onDividerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const panes = panesRef.current;
    if (!panes) return;
    const rect = panes.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      setEditorWidth(Math.max(320, Math.min(rect.width - 480, ev.clientX - rect.left)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
          <span className="brand-row">
            the&nbsp;yeomanizer
            <a
              className="gh-link"
              href="https://github.com/AHMerrill/yeomanizer"
              target="_blank"
              rel="noopener noreferrer"
              title="View source on GitHub"
              aria-label="View source on GitHub"
            >
              <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
            </a>
          </span>
          <span className="brand-sub">naval correspondence, formatted</span>
        </div>
        <nav className="seg-toggle seg-7" role="tablist" aria-label="Page">
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
            className={view === 'checklist' ? 'seg on' : 'seg'}
            role="tab"
            aria-selected={view === 'checklist'}
            onClick={() => setView('checklist')}
          >
            Proofread
            {reviewCount > 0 && (
              <span className="tab-badge" title={`${reviewCount} item(s) to review`}>
                {reviewCount}
              </span>
            )}
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
          <button
            className={view === 'credits' ? 'seg on' : 'seg'}
            role="tab"
            aria-selected={view === 'credits'}
            onClick={() => setView('credits')}
          >
            Credits
          </button>
        </nav>
        <div className="grow" />
        {editingState && (
          <div className="undo-redo">
            <button onClick={undo} disabled={!canUndo} title="Undo (⌘/Ctrl+Z)" aria-label="Undo">
              ↶
            </button>
            <button onClick={redo} disabled={!canRedo} title="Redo (⌘/Ctrl+Shift+Z)" aria-label="Redo">
              ↷
            </button>
          </div>
        )}
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
      ) : view === 'credits' ? (
        <Credits />
      ) : view === 'guide' ? (
        <Guide />
      ) : view === 'checklist' ? (
        <Checklist state={reviewSubject} />
      ) : editingState ? (
        <main
          className="panes"
          ref={panesRef}
          style={editorWidth != null ? ({ '--editor-w': `${editorWidth}px` } as CSSProperties) : undefined}
        >
          {/* autoComplete + spellCheck off so the browser never stores or transmits entries
              (e.g. autofill history, Chrome Enhanced Spellcheck). */}
          <form
            className="editor-pane"
            autoComplete="off"
            spellCheck={false}
            onSubmit={(e) => e.preventDefault()}
          >
            {view === 'builder' && (
              <div className="tpl-bar">
                <span className="tpl-label">Start from an example:</span>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="tpl-btn"
                    title={`${t.blurb} — loads into the editor (undo with ⌘/Ctrl+Z).`}
                    onClick={() => loadTemplate(t.build)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            <Editor state={editingState} setState={setEditingStateTracked} setType={setEditingType} />
          </form>
          {/* Drag to resize the editor vs. the preview; double-click to reset. Desktop only. */}
          <div
            className="pane-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Drag to resize the editor"
            title="Drag to resize · double-click to reset"
            onPointerDown={onDividerDown}
            onDoubleClick={() => setEditorWidth(null)}
          />
          <div className="paper-backdrop">
            <PreviewErrorBoundary>
              <LetterPreview state={editingState} />
            </PreviewErrorBoundary>
          </div>
        </main>
      ) : (
        <ImportDropZone onImport={onImport} />
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
