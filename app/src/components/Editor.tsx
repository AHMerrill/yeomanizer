import type { Dispatch, SetStateAction, ReactNode } from 'react';
import type {
  LetterState,
  ListEntry,
  Paragraph,
  Letterhead,
  CorrespondenceType,
  SignatureAuthority,
} from '../types';
import { uid } from '../defaultState';
import * as tree from '../format/tree';
import { paragraphMarker, markerText, MAX_DEPTH } from '../format/paragraphs';
import { COMMON_SSIC } from '../data/ssic';
import { CUI_CATEGORIES } from '../data/cui';
import { NAVY_RANKS } from '../data/ranks';
import { buildIdent } from '../format/identification';

type SetState = Dispatch<SetStateAction<LetterState>>;

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
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
  list,
  depth,
  setState,
}: {
  list: Paragraph[];
  depth: number;
  setState: SetState;
}) {
  const mutate = (fn: (body: Paragraph[]) => Paragraph[]) =>
    setState((s) => ({ ...s, body: fn(s.body) }));
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
                onClick={() => mutate((b) => tree.addChild(b, p.id))}
              >
                ↳¶
              </button>
              <button title="Add paragraph after" onClick={() => mutate((b) => tree.addSiblingAfter(b, p.id))}>
                ¶+
              </button>
              <button title="Move up" onClick={() => mutate((b) => tree.move(b, p.id, -1))}>↑</button>
              <button title="Move down" onClick={() => mutate((b) => tree.move(b, p.id, 1))}>↓</button>
              <button title="Delete" onClick={() => mutate((b) => tree.remove(b, p.id))}>✕</button>
            </div>
          </div>
          <textarea
            value={p.text}
            rows={2}
            placeholder="Paragraph text…"
            onChange={(e) => mutate((b) => tree.updateText(b, p.id, e.target.value))}
          />
          {p.children.length > 0 && <ParaEditor list={p.children} depth={depth + 1} setState={setState} />}
        </div>
      ))}
    </div>
  );
}

export function Editor({ state, setState }: { state: LetterState; setState: SetState }) {
  const patch = (p: Partial<LetterState>) => setState((s) => ({ ...s, ...p }));
  const patchLH = (p: Partial<Letterhead>) =>
    setState((s) => ({ ...s, letterhead: { ...s.letterhead, ...p } }));
  const patchSig = (p: Partial<LetterState['signature']>) =>
    setState((s) => ({ ...s, signature: { ...s.signature, ...p } }));
  const patchCui = (p: Partial<LetterState['cui']>) =>
    setState((s) => ({ ...s, cui: { ...s.cui, ...p } }));
  const patchNato = (p: Partial<LetterState['nato']>) =>
    setState((s) => ({ ...s, nato: { ...s.nato, ...p } }));

  // Turn the current letter into a FIRST endorsement: the first Via addressee becomes the
  // endorser (From), the rest stay as Via, To/Subj/refs/encls carry forward, and the
  // "FIRST ENDORSEMENT on <basic letter>" line is derived from this letter (Ch 9).
  const createEndorsement = () => {
    const vias = state.via.filter((v) => v.text.trim());
    if (!vias.length) return;
    const date = buildIdent(state).date;
    const basicId = `${state.from} ltr ${state.ssic}${
      state.serial ? ` Ser ${state.originatorCode}/${state.serial}` : ''
    }${date ? ` of ${date}` : ''}`
      .replace(/\s+/g, ' ')
      .trim();
    setState((s) => ({
      ...s,
      type: 'endorsement',
      endorsementNumber: 'FIRST',
      endorsementOf: basicId,
      from: vias[0].text,
      via: vias.slice(1).map((v) => ({ ...v })),
      body: [{ id: uid(), text: '', children: [] }],
    }));
  };

  return (
    <div className="editor">
      <Card title="Correspondence Type">
        <select
          value={state.type}
          onChange={(e) => patch({ type: e.target.value as CorrespondenceType })}
        >
          <option value="standard-letter">Standard Naval Letter</option>
          <option value="memo-from-to">Memorandum (plain-paper / letterhead)</option>
          <option value="endorsement">Endorsement</option>
          <option value="nato">NATO Travel Order</option>
          <option value="business-letter" disabled>Business Letter — soon</option>
        </select>
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
              {['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH'].map(
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
            <input value={state.nato.name} placeholder="Alexander H. Merrill" onChange={(e) => patchNato({ name: e.target.value })} />
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
                <option value="dod">DoD seal</option>
                <option value="don">DON seal</option>
                <option value="none">None</option>
              </select>
            </Field>
          </>
        )}
      </Card>

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
        <EntryList items={state.via} placeholder="Via addressee" onChange={(via) => patch({ via })} />
        {state.type === 'standard-letter' && state.via.some((v) => v.text.trim()) && (
          <button className="add-btn" onClick={createEndorsement}>
            ↪ Create endorsement (you're the first Via addressee)
          </button>
        )}
      </Card>

      <Card title="Subject" hint="Rendered in ALL CAPS, no punctuation (7-2.9).">
        <textarea
          value={state.subj}
          rows={2}
          placeholder="Subject in all caps, no punctuation"
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

      <Card title="Enclosures" hint="Numbered (1), (2)…">
        <EntryList items={state.encls} placeholder="Enclosure title" onChange={(encls) => patch({ encls })} />
      </Card>

      <Card title="Body" hint="Add paragraphs and subparagraphs; numbering is automatic.">
        <ParaEditor list={state.body} depth={0} setState={setState} />
        <button
          className="add-btn"
          onClick={() =>
            setState((s) => ({ ...s, body: [...s.body, { id: uid(), text: '', children: [] }] }))
          }
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
        <label className="check">
          <input
            type="checkbox"
            checked={state.signature.electronic}
            onChange={(e) => patchSig({ electronic: e.target.checked })}
          />
          Electronic signature (renders your name in script on export; you can still print &amp;
          wet-sign)
        </label>
      </Card>

      <Card title="Copy to" hint="One addressee per line.">
        <textarea
          value={state.copyTo.join('\n')}
          rows={3}
          placeholder="COMNAVSURFPAC (N1)"
          onChange={(e) => patch({ copyTo: e.target.value.split('\n') })}
        />
      </Card>
        </>
      )}

      <Card
        title="CUI Marking"
        hint="Controlled Unclassified Information. Per DON guidance, PII uses a plain 'CUI' banner — no 'CUI-Privacy' modifiers. Sourced from DoDI 5200.48 + the ISOO handbook + DON PII guidance."
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
            <Field label="Distribution / Dissemination">
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
            <label className="check">
              <input
                type="checkbox"
                checked={state.cui.portionMarkings}
                onChange={(e) => patchCui({ portionMarkings: e.target.checked })}
              />
              Add (CUI) portion markings (optional; DON recommends against for PII)
            </label>
          </>
        )}
      </Card>
    </div>
  );
}
