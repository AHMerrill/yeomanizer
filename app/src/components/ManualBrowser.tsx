// Full-text browser for SECNAV M-5216.5. The manual text is bundled (src/data/manual.json) and
// LAZY-loaded (dynamic import → its own chunk) the first time this mounts, so it never weighs on the
// initial page load. Search and reading happen entirely in the browser — nothing is fetched from a
// third party and nothing the user does here is transmitted. Pure reference; no authorization claim.
import { useEffect, useMemo, useRef, useState } from 'react';

interface Section {
  id: string;
  title: string;
  paras: string[];
}
interface Chapter {
  id: string;
  num: string;
  title: string;
  sections: Section[];
}
interface SearchDoc {
  id: string;
  ref: string;
  title: string;
  chapter: string;
  chapterId: string;
  text: string;
}
interface Manual {
  meta: { title: string; subtitle: string; date: string; url: string };
  chapters: Chapter[];
  figures: { id: string; title: string; chapterNum: string; chapterTitle: string }[];
  searchDocs: SearchDoc[];
}

const PUB_URL = 'https://www.secnav.navy.mil/doni/manuals-secnav.aspx';
const chapterLabel = (num: string) => (Number.isNaN(Number(num)) ? `Appendix ${num}` : `Chapter ${num}`);

export function ManualBrowser() {
  const [data, setData] = useState<Manual | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const readRef = useRef<HTMLElement>(null);

  // Lazy-load the bundled manual once. The import is same-origin (a build chunk), never a network call
  // to a third party; the dynamic form keeps the ~150 KB gzip out of the initial bundle.
  useEffect(() => {
    let live = true;
    import('../data/manual.json')
      .then((m) => live && setData(((m as { default?: Manual }).default ?? (m as unknown)) as Manual))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  // Flat id → {section, chapter} index for lookups from the TOC and search results.
  const index = useMemo(() => {
    const map = new Map<string, { sec: Section; chapter: Chapter }>();
    data?.chapters.forEach((c) => c.sections.forEach((s) => map.set(s.id, { sec: s, chapter: c })));
    return map;
  }, [data]);

  // Simple, dependency-free ranked search over the pre-built docs (44 of them — no library needed).
  // Title hits weigh more than body hits; every term must appear somewhere (AND), ranked by total score.
  const results = useMemo(() => {
    if (!data || !query.trim()) return [];
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return data.searchDocs
      .map((d) => {
        const title = d.title.toLowerCase();
        const hay = `${d.title} ${d.ref} ${d.chapter} ${d.text}`.toLowerCase();
        let score = 0;
        let everyTerm = true;
        for (const t of terms) {
          if (hay.includes(t)) score += title.includes(t) ? 3 : 1;
          else everyTerm = false;
        }
        return { d, score: everyTerm ? score : 0 };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [data, query]);

  const open = (id: string) => {
    setActiveId(id);
    readRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  if (failed)
    return (
      <p className="manual-note">
        Couldn’t load the bundled manual text.{' '}
        <a href={PUB_URL} target="_blank" rel="noopener noreferrer">
          Read it at the DON Issuances site
        </a>
        .
      </p>
    );
  if (!data) return <p className="manual-note">Loading the manual…</p>;

  const active = activeId ? index.get(activeId) : null;

  return (
    <div className="manual">
      <input
        className="manual-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the manual — e.g. “enclosure”, “SSIC”, “via”, “signature”"
        aria-label="Search the correspondence manual"
      />
      {query.trim() && (
        <ul className="manual-results">
          {results.length === 0 ? (
            <li className="manual-note">No matches in the manual for “{query.trim()}”.</li>
          ) : (
            results.map(({ d }) => (
              <li key={d.id}>
                <button type="button" onClick={() => open(d.ref)}>
                  <span className="manual-result-ref">{d.ref}</span>
                  <span className="manual-result-title">{d.title}</span>
                  <span className="manual-result-chapter">{d.chapter}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <div className="manual-cols">
        <nav className="manual-toc" aria-label="Manual contents">
          {data.chapters.map((c) => (
            <details key={c.id} className="manual-ch">
              <summary>
                <span className="manual-ch-num">{chapterLabel(c.num)}</span> {c.title}
              </summary>
              <ul>
                {c.sections.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={activeId === s.id ? 'on' : ''}
                      onClick={() => open(s.id)}
                    >
                      <span className="manual-sec-ref">{s.id}</span> {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </nav>
        <article className="manual-read" ref={readRef} aria-live="polite">
          {active ? (
            <>
              {/* Sticky header keeps the section ref/title visible while a long section scrolls. */}
              <div className="manual-read-head">
                <div className="manual-read-crumb">
                  {chapterLabel(active.chapter.num)} · {active.chapter.title}
                </div>
                <h3>
                  <span className="manual-sec-ref">{active.sec.id}</span> {active.sec.title}
                </h3>
              </div>
              <div className="manual-read-body">
                {active.sec.paras
                  // Drop ingestion artifacts (bare page numbers like "B-1", "7-2", "12") and blanks.
                  .filter((p) => {
                    const t = p.trim();
                    return t && !/^([A-Z]|\d{1,2})-\d{1,3}$/.test(t) && !/^\d{1,3}$/.test(t);
                  })
                  // A leading "1." / "a." / "(1)" marker starts a new top-level point — give it air.
                  .map((p, i) => (
                    <p key={i} className={/^(\d{1,2}\.|[a-z]\.|\(\d+\)|\([a-z]\))\s/.test(p.trim()) ? 'mr-point' : undefined}>
                      {p}
                    </p>
                  ))}
              </div>
            </>
          ) : (
            <p className="manual-read-empty">
              Pick a section from the contents on the left, or search above. The full {data.meta.title} (
              {data.meta.date}) is bundled and read entirely in your browser — nothing you do here is
              sent anywhere.
            </p>
          )}
        </article>
      </div>
    </div>
  );
}
