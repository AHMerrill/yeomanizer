// Build-time INGEST: parse the extracted SECNAV M-5216.5 text into clean structured JSON for the
// Guide tab's in-app manual browser + keyword search. Runs locally (npm run ingest); not part of the
// app build. Reads ../research/manual_raw.txt (gitignored) and writes src/data/manual.json, which IS
// shipped — the manual is a U.S. Government work (public domain). This is pure text processing: no
// network, no model, nothing that ever touches what a user types.
//
// To ingest a FUTURE publication: drop its extracted text in research/, copy this script, and adjust
// INPUT + META + the chapter/section regexes to that pub's structure.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const INPUT = fileURLToPath(new URL('../../research/manual_raw.txt', import.meta.url));
const OUTPUT = fileURLToPath(new URL('../src/data/manual.json', import.meta.url));

const META = {
  title: 'SECNAV M-5216.5',
  subtitle: 'Department of the Navy Correspondence Manual',
  date: 'June 2015',
  url: 'https://www.secnav.navy.mil/doni/manuals-secnav.aspx',
};

const lines = readFileSync(INPUT, 'utf8').split('\n').map((l) => l.replace(/\s+$/, ''));

// Repeated page headers/footers + standalone page numbers + extraction artifacts → drop.
const isNoise = (t) => {
  if (!t) return true;
  return (
    /^SECNAV M-5216\.5/i.test(t) ||
    /^JUNE 2015$/i.test(t) ||
    /^June$/.test(t) ||
    /^(TITLE|PAGE)$/.test(t) ||
    /^[ivxlcdm]+$/i.test(t) || // roman-numeral page number
    /^\d+-\d+$/.test(t) || // standalone page number e.g. "7-1"
    /^\d{1,3}$/.test(t) // standalone page number
  );
};

const PARA_START = /^(\d+\.|[a-z]\.|\(\d+\)|\([a-z]\))\s/; // 1.  a.  (1)  (a)
const SECTION = /^(\d+-\d+)\s+(\S.*)$/; // "7-2 Format" or "3-1 General. text…"
const FIGURE = /^FIGURE (\d+-\d+)\.\s+(.+)$/; // all-caps only — avoids inline "see figure 7-1." text
const CHAPTER = /^CHAPTER (\d+)$/;
const APPENDIX = /^APPENDIX ([A-E])\b(.*)$/;

// Body starts at the first real "CHAPTER 1" (after the ~800-line front matter / TOC).
const bodyStart = lines.findIndex((l, i) => i > 800 && CHAPTER.test(l.trim()));

const chapters = [];
let chapter = null;
let section = null;
let para = ''; // current paragraph being assembled from wrapped lines

const flushPara = () => {
  const p = para.replace(/\s+/g, ' ').trim();
  if (p && section) section.paras.push(p);
  para = '';
};
const startSection = (id, title) => {
  flushPara();
  section = { id, title, paras: [] };
  if (chapter) chapter.sections.push(section);
};

for (let i = bodyStart; i < lines.length; i++) {
  const t = lines[i].trim();

  let m;
  if ((m = t.match(CHAPTER))) {
    flushPara();
    // chapter title = next non-noise line
    let title = '';
    for (let j = i + 1; j < lines.length; j++) {
      const tj = lines[j].trim();
      if (!isNoise(tj)) { title = tj; break; }
    }
    chapter = { id: `ch${m[1]}`, kind: 'chapter', num: m[1], title, sections: [], figures: [] };
    chapters.push(chapter);
    section = null;
    continue;
  }
  if ((m = t.match(APPENDIX))) {
    flushPara();
    let title = m[2].replace(/^\s*[–-]\s*/, '').trim();
    if (!title) {
      for (let j = i + 1; j < lines.length; j++) {
        const tj = lines[j].trim();
        if (!isNoise(tj)) { title = tj; break; }
      }
    }
    chapter = { id: `app${m[1]}`, kind: 'appendix', num: m[1], title, sections: [], figures: [] };
    chapters.push(chapter);
    section = null;
    continue;
  }
  if (!chapter) continue;
  if (isNoise(t)) { flushPara(); continue; }

  if ((m = t.match(FIGURE))) {
    flushPara();
    const fig = { id: `Figure ${m[1]}`, title: m[2].replace(/\s+/g, ' ').trim() };
    chapter.figures.push(fig);
    continue;
  }
  if ((m = t.match(SECTION))) {
    // "7-1 Requirements"  |  "3-1 General. An electronic record is…"
    const rest = m[2];
    const split = rest.match(/^([A-Z][\w &/,'-]{1,48}?)\.\s+(.+)$/);
    if (split) {
      startSection(m[1], split[1].trim());
      para = split[2];
    } else {
      startSection(m[1], rest.replace(/\.\s*$/, '').trim());
    }
    continue;
  }

  // body text: a new numbered/lettered marker starts a new paragraph; otherwise it's a wrap.
  if (!section) startSection(chapter.num + '-0', 'Overview');
  if (PARA_START.test(t)) { flushPara(); para = t; }
  else para = para ? `${para} ${t}` : t;
}
flushPara();

// Drop synthetic empty "Overview" sections + Appendix E (the index — not readable content), then
// keep only chapters/appendices that still carry content.
for (const c of chapters) c.sections = c.sections.filter((s) => s.paras.length > 0);
const docChapters = chapters.filter(
  (c) => c.id !== 'appE' && (c.sections.length > 0 || c.figures.length > 0),
);

const figures = docChapters.flatMap((c) =>
  c.figures.map((f) => ({ ...f, chapterId: c.id, chapterNum: c.num, chapterTitle: c.title })),
);

const searchDocs = [];
for (const c of docChapters) {
  for (const s of c.sections) {
    searchDocs.push({
      id: `${c.id}:${s.id}`,
      ref: s.id,
      title: s.title,
      chapter: `${c.kind === 'appendix' ? 'Appendix ' : 'Chapter '}${c.num} — ${c.title}`,
      chapterId: c.id,
      text: s.paras.join(' '),
    });
  }
}

const out = { meta: META, chapters: docChapters, figures, searchDocs };
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(out, null, 2));

const secCount = docChapters.reduce((n, c) => n + c.sections.length, 0);
console.log(
  `ingested: ${docChapters.length} chapters/appendices, ${secCount} sections, ${figures.length} figures, ${searchDocs.length} search docs → ${OUTPUT}`,
);
