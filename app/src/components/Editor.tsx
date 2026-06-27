import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { shrinkImage } from '../format/image';
import type { Dispatch, SetStateAction, ReactNode } from 'react';
import type {
  LetterState,
  ListEntry,
  Paragraph,
  Letterhead,
  CorrespondenceType,
  SignatureAuthority,
  EndorsementEntry,
  EnclosureEntry,
  AttachedFile,
} from '../types';
import { uid, syncViaEndorsements } from '../defaultState';
import * as tree from '../format/tree';
import { paragraphMarker, markerText, MAX_DEPTH } from '../format/paragraphs';
import { ENDORSE_ORD } from '../format/identification';
import { COMMON_SSIC } from '../data/ssic';
import { CUI_CATEGORIES } from '../data/cui';
import { NAVY_RANKS } from '../data/ranks';

type SetState = Dispatch<SetStateAction<LetterState>>;

const sectionId = (title: string): string =>
  'sec-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card" id={sectionId(title)}>
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

// Hover "Jump to…" menu — reads the currently visible cards (re-read whenever `dep` changes,
// e.g. the correspondence type) so the list always matches what's on screen.
function JumpNav({ dep }: { dep: unknown }) {
  const [sections, setSections] = useState<{ id: string; title: string }[]>([]);
  const [hovering, setHovering] = useState(false); // pointer is over the button or the menu
  const [locked, setLocked] = useState(false); // clicked open — persists until another click
  const ref = useRef<HTMLDivElement>(null);
  const open = hovering || locked;
  useLayoutEffect(() => {
    setSections(
      [...document.querySelectorAll<HTMLElement>('.editor .card')].map((c) => ({
        id: c.id,
        title: c.querySelector('h2')?.textContent ?? '',
      })),
    );
  }, [dep]);
  // While click-locked, a click anywhere outside the menu collapses it.
  useEffect(() => {
    if (!locked) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setLocked(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [locked]);
  return (
    <div
      className="jump"
      ref={ref}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        className="jump-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setLocked((v) => !v)}
      >
        Jump to a section ▾
      </button>
      {open && (
        <div className="jump-menu" role="menu">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitem"
              className="jump-item"
              onClick={() => {
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setLocked(false);
                setHovering(false); // jump + collapse
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={on ? 'pill on' : 'pill'} onClick={onClick}>
      {children}
    </button>
  );
}

function EntryList({
  items,
  onChange,
  placeholder,
}: {
  items: ListEntry[];
  onChange: (items: ListEntry[]) => void;
  placeholder: string;
}) {
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= items.length) return;
    const c = [...items];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };
  return (
    <div className="entry-list">
      {items.map((it, i) => (
        <div className="entry-row" key={it.id}>
          <span className="entry-idx">{i + 1}</span>
          <input
            value={it.text}
            placeholder={placeholder}
            aria-label={`${placeholder} ${i + 1}`}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))
            }
          />
          <button title="Move up" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
          <button title="Move down" disabled={i === items.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
          <button title="Remove" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>✕</button>
        </div>
      ))}
      <button className="add-btn" onClick={() => onChange([...items, { id: uid(), text: '' }])}>
        + Add
      </button>
    </div>
  );
}

function ParaEditor({
  root,
  list,
  depth,
  onChange,
  onCuiToggle,
}: {
  root: Paragraph[];
  list: Paragraph[];
  depth: number;
  onChange: (root: Paragraph[]) => void;
  onCuiToggle?: (id: string, on: boolean) => void;
}) {
  const mut = (fn: (r: Paragraph[]) => Paragraph[]) => onChange(fn(root));
  return (
    <div className="para-tree" style={{ marginLeft: depth ? 14 : 0 }}>
      {list.map((p, i) => (
        <div className="para-node" key={p.id}>
          <div className="para-head">
            <span className="para-marker">{markerText(paragraphMarker(depth, i))}</span>
            <div className="para-btns">
              <button
                title="Add subparagraph"
                disabled={depth + 1 >= MAX_DEPTH}
                onClick={() => mut((r) => tree.addChild(r, p.id))}
              >
                ↳¶
              </button>
              <button title="Add paragraph after" onClick={() => mut((r) => tree.addSiblingAfter(r, p.id))}>
                ¶+
              </button>
              <button title="Move up" onClick={() => mut((r) => tree.move(r, p.id, -1))}>↑</button>
              <button title="Move down" onClick={() => mut((r) => tree.move(r, p.id, 1))}>↓</button>
              <button title="Delete" onClick={() => mut((r) => tree.remove(r, p.id))}>✕</button>
              {onCuiToggle && (
                <button
                  className={p.cui ? 'cui-tog on' : 'cui-tog'}
                  title="Toggle (CUI) portion marking for this paragraph"
                  onClick={() => onCuiToggle(p.id, !p.cui)}
                >
                  (CUI)
                </button>
              )}
            </div>
          </div>
          <input
            className="para-title"
            value={p.title ?? ''}
            placeholder="Section title (optional — underlined, e.g. Purpose)"
            aria-label="Section title (optional)"
            onChange={(e) => mut((r) => tree.updateTitle(r, p.id, e.target.value))}
          />
          <textarea
            value={p.text}
            rows={2}
            placeholder="Paragraph text…"
            aria-label={`Paragraph ${markerText(paragraphMarker(depth, i))} text`}
            onChange={(e) => mut((r) => tree.updateText(r, p.id, e.target.value))}
          />
          {p.children.length > 0 && (
            <ParaEditor
              root={root}
              list={p.children}
              depth={depth + 1}
              onChange={onChange}
              onCuiToggle={onCuiToggle}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Per-enclosure cards: name it, choose embed-in-document vs attach-separately, and drag an
// image/PDF onto it. Files are read into memory (data URL) only — never persisted.
function EnclosureCards({
  encls,
  onChange,
}: {
  encls: EnclosureEntry[];
  onChange: (e: EnclosureEntry[]) => void;
}) {
  const [shrink, setShrink] = useState(true);
  const update = (id: string, patch: Partial<EnclosureEntry>) =>
    onChange(encls.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  // Shrink images on import when the toggle is on; Infinity disables it (keep the original).
  const attach = async (id: string, file: File) => {
    if (file.size > 50 * 1024 * 1024) return; // guard against a browser-choking enclosure (~50MB)
    update(id, { file: await shrinkImage(file, shrink ? 2000 : Infinity) });
  };
  return (
    <div className="encl-cards">
      {encls.length > 0 && (
        <label className="encl-shrink">
          <input type="checkbox" checked={shrink} onChange={(e) => setShrink(e.target.checked)} />
          Shrink large images on import — smaller file, keeps print resolution (PDFs unchanged)
        </label>
      )}
      {encls.map((e, i) => (
        <div className="encl-card" key={e.id}>
          <div className="endo-head">
            <span>Enclosure ({i + 1})</span>
            <button onClick={() => onChange(encls.filter((x) => x.id !== e.id))} title="Remove enclosure">
              ✕
            </button>
          </div>
          <Field label="Title">
            <input
              value={e.text}
              placeholder="Enclosure title"
              onChange={(ev) => update(e.id, { text: ev.target.value })}
            />
          </Field>
          {e.text.trim() && (
            <>
              <div className="pills">
                <Pill on={!e.inDocument} onClick={() => update(e.id, { inDocument: false })}>
                  Attach separately
                </Pill>
                <Pill on={!!e.inDocument} onClick={() => update(e.id, { inDocument: true })}>
                  Add in document
                </Pill>
              </div>
              <FileDrop
                file={e.file}
                inDocument={!!e.inDocument}
                onFile={(f) => attach(e.id, f)}
                onClear={() => update(e.id, { file: undefined })}
              />
            </>
          )}
        </div>
      ))}
      <button
        className="add-btn"
        onClick={() => onChange([...encls, { id: uid(), text: '', inDocument: false }])}
      >
        + Add enclosure
      </button>
    </div>
  );
}

function FileDrop({
  file,
  inDocument,
  onFile,
  onClear,
}: {
  file?: AttachedFile;
  inDocument: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const ok = (f: File) => f.type.startsWith('image/') || f.type === 'application/pdf';
  const pick = (list: FileList | null) => {
    const f = list && list[0];
    if (f && ok(f)) onFile(f);
  };
  if (file)
    return (
      <div className="encl-file">
        {file.type.startsWith('image/') ? (
          <img src={file.dataUrl} alt="" className="encl-thumb" />
        ) : (
          <span className="encl-pdf-badge">PDF</span>
        )}
        <span className="file-name">{file.name}</span>
        <button onClick={onClear} title="Remove file">
          ✕
        </button>
      </div>
    );
  return (
    <div
      className={dragging ? 'file-drop dragging' : 'file-drop'}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files);
      }}
    >
      <label className="file-btn">
        {inDocument ? '+ Drop image/PDF to embed' : '+ Drop image/PDF to attach'}
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(ev) => {
            pick(ev.target.files);
            ev.target.value = '';
          }}
        />
      </label>
      <span className="file-drop-hint">or click to choose</span>
    </div>
  );
}

export function Editor({
  state,
  setState,
  setType,
}: {
  state: LetterState;
  setState: SetState;
  setType: (t: CorrespondenceType) => void;
}) {
  const patch = (p: Partial<LetterState>) => setState((s) => ({ ...s, ...p }));
  const patchLH = (p: Partial<Letterhead>) =>
    setState((s) => ({ ...s, letterhead: { ...s.letterhead, ...p } }));
  const patchSig = (p: Partial<LetterState['signature']>) =>
    setState((s) => ({ ...s, signature: { ...s.signature, ...p } }));
  const patchCui = (p: Partial<LetterState['cui']>) =>
    setState((s) => ({ ...s, cui: { ...s.cui, ...p } }));
  const patchNato = (p: Partial<LetterState['nato']>) =>
    setState((s) => ({ ...s, nato: { ...s.nato, ...p } }));

  // Each Via addressee auto-creates its endorsement (see syncViaEndorsements). This button adds
  // an EXTRA endorsement not tied to a Via (e.g. an additional endorser). Both append as pages.
  const addEndorsement = () =>
    setState((s) => ({
      ...s,
      endorsements: [
        ...s.endorsements,
        { id: uid(), endorser: '', serial: '', body: [{ id: uid(), text: '', children: [] }], sigName: '', sigTitle: '', authority: 'none' },
      ],
    }));
  const updateEndorsement = (id: string, p: Partial<EndorsementEntry>) =>
    setState((s) => ({
      ...s,
      endorsements: s.endorsements.map((e) => (e.id === id ? { ...e, ...p } : e)),
    }));
  const removeEndorsement = (id: string) =>
    setState((s) => ({ ...s, endorsements: s.endorsements.filter((e) => e.id !== id) }));

  return (
    <div className="editor">
      <JumpNav dep={state.type} />
      <Card title="Correspondence Type">
        <select
          value={state.type}
          aria-label="Correspondence type"
          onChange={(e) => setType(e.target.value as CorrespondenceType)}
        >
          <option value="standard-letter">Standard Naval Letter</option>
          <option value="memo-from-to">Memorandum (plain-paper / letterhead)</option>
          <option value="endorsement">Endorsement</option>
          <option value="nato">NATO Travel Order</option>
          <option value="business-letter" disabled>Business Letter — soon</option>
        </select>
      </Card>

      <Card
        title="CUI Marking"
        hint="Controlled Unclassified Information. The banner prints at the very top (and bottom) of every page, so it lives here near the top. Per DON guidance, PII uses a plain 'CUI' banner. Sourced from DoDI 5200.48 + the ISOO handbook + DON PII guidance."
      >
        <label className="check">
          <input
            type="checkbox"
            checked={state.cui.enabled}
            onChange={(e) => patchCui({ enabled: e.target.checked })}
          />
          This document contains CUI (marks "CUI" top &amp; bottom of every page)
        </label>
        {state.cui.enabled && (
          <>
            <Field label="Banner text">
              <input
                value={state.cui.banner}
                placeholder="CUI"
                onChange={(e) => patchCui({ banner: e.target.value })}
              />
            </Field>
            <div className="sub-label">Designation indicator block (first page, lower-right)</div>
            <Field label="Controlled by">
              <input
                value={state.cui.controlledBy1}
                onChange={(e) => patchCui({ controlledBy1: e.target.value })}
              />
            </Field>
            <Field label="Controlled by (your office)">
              <input
                value={state.cui.controlledBy2}
                placeholder="e.g. OJAG Code 13"
                onChange={(e) => patchCui({ controlledBy2: e.target.value })}
              />
            </Field>
            <Field label="CUI Category">
              <select
                value={state.cui.category}
                onChange={(e) => patchCui({ category: e.target.value })}
              >
                {CUI_CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Limited Dissemination Control">
              <input
                value={state.cui.dissemination}
                placeholder="FEDCON"
                onChange={(e) => patchCui({ dissemination: e.target.value })}
              />
            </Field>
            <Field label="POC">
              <input
                value={state.cui.poc}
                placeholder="CDR Jane Doe, jane.doe@navy.mil, 703-555-5555"
                onChange={(e) => patchCui({ poc: e.target.value })}
              />
            </Field>
            <p className="hint">
              Portion markings are <strong>per paragraph</strong> — use the (CUI) toggle on any
              paragraph in the Body section. Marking one turns this on; once any portion is marked,
              every paragraph shows (CUI) or (U). DON recommends against portion marking for PII.
            </p>
          </>
        )}
      </Card>

      {state.type === 'endorsement' && (
        <Card
          title="Endorsement"
          hint="A Via addressee forwards the basic letter (Ch 9). From: is your command; To:/Via: are the remaining chain; add only NEW refs/encls (continue the letters/numbers)."
        >
          <Field label="Endorsement number">
            <select
              value={state.endorsementNumber}
              onChange={(e) => patch({ endorsementNumber: e.target.value })}
            >
              {ENDORSE_ORD.map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Endorsing (the basic letter)">
            <input
              value={state.endorsementOf}
              placeholder="USS SCRANTON ltr 3000 Ser SSN 756/001 of 5 May 15"
              onChange={(e) => patch({ endorsementOf: e.target.value })}
            />
          </Field>
        </Card>
      )}

      <Card title="Letterhead" hint="No abbreviations or punctuation in the address (2-12).">
        <div className="pills">
          <Pill on={state.letterhead.mode === 'on'} onClick={() => patchLH({ mode: 'on' })}>
            Print letterhead
          </Pill>
          <Pill on={state.letterhead.mode === 'off'} onClick={() => patchLH({ mode: 'off' })}>
            Plain paper
          </Pill>
          <Pill
            on={state.letterhead.mode === 'preprinted'}
            onClick={() => patchLH({ mode: 'preprinted' })}
          >
            Pre-printed paper
          </Pill>
        </div>
        {state.letterhead.mode === 'preprinted' && (
          <p className="hint">
            Leaves the top of the page blank so your pre-printed letterhead shows through — the
            date and body start below where the letterhead sits.
          </p>
        )}
        {state.letterhead.mode === 'on' && (
          <>
            <p className="hint">
              Need the command&rsquo;s address?{' '}
              <a
                href="https://flankspeed.sharepoint-mil.us/sites/OPNAV/DNS/DNS1/DNS12/SitePages/Home.aspx"
                target="_blank"
                rel="noopener noreferrer"
              >
                Look it up in the Standard Navy Distribution List
              </a>{' '}
              <strong>(CAC required)</strong>.
            </p>
            <Field label="Activity name">
              <input
                value={state.letterhead.activityName}
                placeholder="NAME OF ACTIVITY"
                onChange={(e) => patchLH({ activityName: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Address">
              <input
                value={state.letterhead.addressLine}
                placeholder="STREET ADDRESS"
                onChange={(e) => patchLH({ addressLine: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="City State ZIP+4">
              <input
                value={state.letterhead.cityStateZip}
                placeholder="CITY STATE ZIP+4"
                onChange={(e) => patchLH({ cityStateZip: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Seal">
              <select
                value={state.letterhead.seal}
                onChange={(e) => patchLH({ seal: e.target.value as Letterhead['seal'] })}
              >
                <option value="dod">DoD seal (letterhead blue)</option>
                <option value="dod-color">DoD seal (full color)</option>
                <option value="don">DON seal</option>
                <option value="none">None</option>
              </select>
            </Field>
          </>
        )}
      </Card>

      {state.type === 'nato' && (
        <Card
          title="NATO Travel Order"
          hint="Bilingual NATO travel order. Pick your US rank and the NATO OF/OR code fills in automatically. Set the command in the Letterhead card."
        >
          <Field label="Order number">
            <input value={state.nato.orderNumber} onChange={(e) => patchNato({ orderNumber: e.target.value })} />
          </Field>
          <Field label="Rank (US → NATO code auto-fills)">
            <select value={state.nato.rankGrade} onChange={(e) => patchNato({ rankGrade: e.target.value })}>
              {NAVY_RANKS.map((r) => (
                <option key={r.grade} value={r.grade}>
                  {r.abbr} ({r.grade}) → {r.nato}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Full name">
            <input value={state.nato.name} placeholder="Last, First MI" onChange={(e) => patchNato({ name: e.target.value })} />
          </Field>
          <Field label="DoD ID number">
            <input value={state.nato.dodId} onChange={(e) => patchNato({ dodId: e.target.value })} />
          </Field>
          <Field label="Travel from">
            <input value={state.nato.from} placeholder="San Diego, California, USA" onChange={(e) => patchNato({ from: e.target.value })} />
          </Field>
          <Field label="Travel to">
            <input value={state.nato.to} placeholder="Ramstein, DE" onChange={(e) => patchNato({ to: e.target.value })} />
          </Field>
          <Field label="Via (countries traveled to / through)">
            <textarea value={state.nato.via} rows={2} placeholder="Belgium, Germany, Italy, …" onChange={(e) => patchNato({ via: e.target.value })} />
          </Field>
          <Field label="Date of departure">
            <input value={state.nato.departureDate} placeholder="24 May 2025" onChange={(e) => patchNato({ departureDate: e.target.value })} />
          </Field>
          <Field label="Expected return date">
            <input value={state.nato.returnDate} placeholder="3 June 2025" onChange={(e) => patchNato({ returnDate: e.target.value })} />
          </Field>
          <div className="sub-label">Para 3 — authority to possess &amp; carry arms</div>
          <div className="pills">
            <Pill on={state.nato.armsGranted} onClick={() => patchNato({ armsGranted: true })}>
              is granted
            </Pill>
            <Pill on={!state.nato.armsGranted} onClick={() => patchNato({ armsGranted: false })}>
              is not granted
            </Pill>
          </div>
          <Field label="Para 4: authorized to carry">
            <input value={state.nato.dispatchQty} placeholder="no/none" onChange={(e) => patchNato({ dispatchQty: e.target.value })} />
          </Field>
          <Field label="Para 4: sealed dispatches numbered">
            <input value={state.nato.dispatchNumbers} placeholder="N/A" onChange={(e) => patchNato({ dispatchNumbers: e.target.value })} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={state.nato.includeSofa} onChange={(e) => patchNato({ includeSofa: e.target.checked })} />
            Para 5: include NATO SOFA certification
          </label>
          <Field label="Officer authorizing movement">
            <input value={state.nato.authorizingOfficer} onChange={(e) => patchNato({ authorizingOfficer: e.target.value })} />
          </Field>
          <Field label="Date of issue">
            <input value={state.nato.dateOfIssue} placeholder="12 May 2025" onChange={(e) => patchNato({ dateOfIssue: e.target.value })} />
          </Field>
        </Card>
      )}

      {state.type !== 'nato' && (
        <>
      <Card
        title="Identification"
        hint={
          state.type === 'memo-from-to'
            ? "A memo's only identification symbol is the date (10-2)."
            : 'Usually added by a yeoman. Not sure? Leave blank — most people only set the date.'
        }
      >
        {state.type !== 'memo-from-to' && (
          <>
            <div className="pills">
              <Pill on={state.includeSsic} onClick={() => patch({ includeSsic: !state.includeSsic })}>
                SSIC line
              </Pill>
              <Pill on={state.includeCode} onClick={() => patch({ includeCode: !state.includeCode })}>
                Code / Ser line
              </Pill>
            </div>
            <p className="hint">A kept line shows a grey placeholder until filled; toggle it off to drop the line entirely.</p>
            {state.includeSsic && (
              <>
                <Field label="SSIC (subject code)">
                  <input
                    value={state.ssic}
                    placeholder="e.g. 5216"
                    onChange={(e) => patch({ ssic: e.target.value })}
                  />
                </Field>
                <Field label="↳ look up a common SSIC">
                  <select value="" onChange={(e) => e.target.value && patch({ ssic: e.target.value })}>
                    <option value="">— pick to fill SSIC —</option>
                    {COMMON_SSIC.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} — {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {state.includeCode && (
              <>
                <Field label="Originator's code">
                  <input
                    value={state.originatorCode}
                    placeholder="office code or hull no. — e.g. Code 13 or N00J"
                    onChange={(e) => patch({ originatorCode: e.target.value })}
                  />
                </Field>
                <Field label="Serial (optional)">
                  <input
                    value={state.serial}
                    placeholder="optional — usually blank for routine correspondence"
                    onChange={(e) => patch({ serial: e.target.value })}
                  />
                </Field>
              </>
            )}
          </>
        )}
        <Field label="Date">
          <select
            value={state.dateMode}
            onChange={(e) => patch({ dateMode: e.target.value as LetterState['dateMode'] })}
          >
            <option value="auto">Today (auto)</option>
            <option value="manual">Manual</option>
            <option value="none">Leave blank (sign later)</option>
          </select>
        </Field>
        {state.dateMode === 'manual' && (
          <Field label="Date text">
            <input
              value={state.dateManual}
              placeholder="7 Sep 06"
              onChange={(e) => patch({ dateManual: e.target.value })}
            />
          </Field>
        )}
      </Card>

      <Card title="Routing">
        <Field label="From">
          <input
            value={state.from}
            placeholder="Commanding Officer, [your command]"
            onChange={(e) => patch({ from: e.target.value })}
          />
        </Field>
        <Field label="To">
          <input
            value={state.to}
            placeholder="e.g., Chief of Naval Operations (N1)"
            onChange={(e) => patch({ to: e.target.value })}
          />
        </Field>
        <div className="sub-label">Via (numbered automatically when 2+)</div>
        <EntryList
          items={state.via}
          placeholder="Via addressee"
          onChange={(via) => setState((s) => syncViaEndorsements({ ...s, via }))}
        />
        {state.via.some((v) => v.text.trim()) && (
          <p className="hint">
            Each Via addressee automatically gets an endorsement page (appended below) — fill in
            its text in the Endorsements section.
          </p>
        )}
      </Card>

      <Card title="Subject" hint="Rendered in ALL CAPS, no punctuation (7-2.9).">
        <textarea
          value={state.subj}
          rows={2}
          placeholder="Subject in all caps, no punctuation"
          aria-label="Subject"
          onChange={(e) => patch({ subj: e.target.value })}
        />
      </Card>

      <Card title="References" hint="Lettered (a), (b)… — cite each in the text.">
        <EntryList
          items={state.refs}
          placeholder="e.g. SECNAV M-5216.5 of June 2015"
          onChange={(refs) => patch({ refs })}
        />
      </Card>

      <Card
        title="Enclosures"
        hint="Numbered (1), (2)… Name one, choose to embed its file in the document or attach it separately, then drag an image or PDF onto it."
      >
        <EnclosureCards encls={state.encls} onChange={(encls) => patch({ encls })} />
      </Card>

      <Card title="Body" hint="Add paragraphs and subparagraphs; numbering is automatic.">
        <ParaEditor
          root={state.body}
          list={state.body}
          depth={0}
          onChange={(body) => patch({ body })}
          onCuiToggle={(id, on) =>
            setState((s) => ({
              ...s,
              body: tree.setCui(s.body, id, on),
              // Marking any paragraph turns on the overall CUI marking (banner + designation).
              cui: on ? { ...s.cui, enabled: true } : s.cui,
            }))
          }
        />
        <button
          className="add-btn"
          onClick={() => patch({ body: [...state.body, { id: uid(), text: '', children: [] }] })}
        >
          + Add paragraph
        </button>
      </Card>

      <Card title="Signature" hint="Last name in CAPS; no rank or complimentary close (7-2.14).">
        <Field label="Name">
          <input
            value={state.signature.name}
            placeholder="I. M. LASTNAME (last name in caps)"
            onChange={(e) => patchSig({ name: e.target.value })}
          />
        </Field>
        <Field label="Title (optional)">
          <input value={state.signature.title} onChange={(e) => patchSig({ title: e.target.value })} />
        </Field>
        <Field label="Authority">
          <select
            value={state.signature.authority}
            onChange={(e) => patchSig({ authority: e.target.value as SignatureAuthority })}
          >
            <option value="none">None</option>
            <option value="by-direction">By direction</option>
            <option value="acting">Acting</option>
          </select>
        </Field>
        <p className="hint">
          The export leaves the signature space blank so you can sign for real: print and
          wet-sign, or open the PDF in Adobe Acrobat/Reader and use{' '}
          <em>Tools → Certificates → Digitally Sign</em> to draw a box over the signature space
          and CAC-sign. A pre-placed click-to-sign field is in progress — see Features.
        </p>
      </Card>

      <Card title="Copy to" hint="One addressee per line.">
        <textarea
          value={state.copyTo.join('\n')}
          rows={3}
          placeholder="COMNAVSURFPAC (N1)"
          aria-label="Copy to addressees, one per line"
          onChange={(e) => patch({ copyTo: e.target.value.split('\n') })}
        />
      </Card>

      {(state.type === 'standard-letter' || state.type === 'memo-from-to') && (
        <Card
          title="Endorsements"
          hint="Each Via addressee automatically gets an endorsement here, appended as extra page(s) after the document (Ch 9). You can also add a standalone one."
        >
          {state.endorsements.length === 0 && (
            <p className="hint">None yet — add a Via addressee above, or “+ Add endorsement” below.</p>
          )}
          {state.endorsements.map((e, i) => (
            <div className="endo-block" key={e.id}>
              <div className="endo-head">
                <span>
                  {ENDORSE_ORD[i] ??
                    `${i + 1}`}{' '}
                  ENDORSEMENT
                </span>
                {!e.viaId && (
                  <button onClick={() => removeEndorsement(e.id)} title="Remove endorsement">
                    ✕
                  </button>
                )}
              </div>
              <Field label={e.viaId ? 'From (endorser — set by the Via addressee)' : 'From (endorser)'}>
                <input
                  value={e.endorser}
                  placeholder="Commander, Carrier Strike Group ONE"
                  readOnly={!!e.viaId}
                  aria-label="Endorser"
                  title={e.viaId ? 'From the Via addressee above — edit it there' : undefined}
                  onChange={(ev) => !e.viaId && updateEndorsement(e.id, { endorser: ev.target.value })}
                />
              </Field>
              <Field label="Serial (optional)">
                <input
                  value={e.serial}
                  placeholder="e.g. N1/123"
                  onChange={(ev) => updateEndorsement(e.id, { serial: ev.target.value })}
                />
              </Field>
              <div className="sub-label">Endorsement text</div>
              <ParaEditor
                root={e.body}
                list={e.body}
                depth={0}
                onChange={(body) => updateEndorsement(e.id, { body })}
              />
              <button
                className="add-btn"
                onClick={() =>
                  updateEndorsement(e.id, { body: [...e.body, { id: uid(), text: '', children: [] }] })
                }
              >
                + Add paragraph
              </button>
              <Field label="Signature name">
                <input
                  value={e.sigName}
                  placeholder="I. M. LASTNAME"
                  onChange={(ev) => updateEndorsement(e.id, { sigName: ev.target.value })}
                />
              </Field>
              <Field label="Signature title (optional)">
                <input
                  value={e.sigTitle}
                  onChange={(ev) => updateEndorsement(e.id, { sigTitle: ev.target.value })}
                />
              </Field>
              <Field label="Authority">
                <select
                  value={e.authority ?? 'none'}
                  onChange={(ev) =>
                    updateEndorsement(e.id, { authority: ev.target.value as SignatureAuthority })
                  }
                >
                  <option value="none">None</option>
                  <option value="by-direction">By direction</option>
                  <option value="acting">Acting</option>
                </select>
              </Field>
            </div>
          ))}
          <button className="add-btn" onClick={addEndorsement}>
            + Add a standalone endorsement
          </button>
        </Card>
      )}
        </>
      )}
    </div>
  );
}
