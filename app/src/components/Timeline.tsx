// A horizontal, scrollable timeline of open-source naval-correspondence projects, by repo start date.
// The ~11-year gap between the 2014 original and the 2025–26 burst is real (and the quiet joke). Each
// node links to its repo. Scroll with the wheel while hovering, the arrows, a trackpad, or a swipe.
import { useEffect, useRef } from 'react';

interface TLNode {
  name: string;
  who: string;
  url: string;
  date: string;
  license: string;
  blurb: string;
  x: number; // px along the track, at the dot
  side: 'up' | 'down';
  us?: boolean;
}

const TRACK_W = 1340;
const AXIS_Y = 132; // from the top of the track

const NODES: TLNode[] = [
  {
    name: 'Naval Letter Format',
    who: 'wilselby',
    url: 'https://github.com/wilselby/NavalLetterFormat',
    date: 'Sep 2014',
    license: 'no license',
    side: 'down',
    x: 80,
    blurb: 'The original — a naval-letter formatter online before most of us thought to build one.',
  },
  {
    name: 'navalletterformat',
    who: 'jeranaias',
    url: 'https://github.com/jeranaias/navalletterformat',
    date: 'Dec 2025',
    license: 'MIT',
    side: 'up',
    x: 470,
    blurb: '37 starter templates and a 2,240-code SSIC list.',
  },
  {
    name: 'dondocs',
    who: 'marinecoders',
    url: 'https://github.com/marinecoders/dondocs',
    date: 'Jan 2026',
    license: 'MIT (app)',
    side: 'down',
    x: 612,
    blurb: '20 document types and embedded reference data.',
  },
  {
    name: 'mildoc-lint',
    who: 'cjchanh',
    url: 'https://github.com/cjchanh/mildoc-lint',
    date: 'May 2026',
    license: 'Apache-2.0',
    side: 'up',
    x: 930,
    blurb: 'A local-first correspondence/document linter.',
  },
  {
    name: 'SemperScribe',
    who: 'SemperAdmin',
    url: 'https://github.com/SemperAdmin/SemperScribe',
    date: 'Jun 2026',
    license: 'MIT',
    side: 'down',
    x: 1022,
    blurb: 'A Marine Corps–leaning letter generator.',
  },
  {
    name: 'the yeomanizer',
    who: 'AHMerrill',
    url: 'https://github.com/AHMerrill/yeomanizer',
    date: 'Jun 2026',
    license: 'Apache-2.0',
    side: 'up',
    x: 1138,
    blurb: 'This one. Pixel-faithful, private, and a little obsessive.',
    us: true,
  },
];

export function Timeline() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Translate vertical wheel into horizontal scroll while hovering — but pass the event through at the
  // ends so the page can still scroll vertically past the timeline.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already a horizontal gesture
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return; // let the page scroll
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const nudge = (dir: -1 | 1) => scrollRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' });

  return (
    <section className="tl">
      <h2>A quiet lineage</h2>
      <p className="credits-note tl-lede">
        The format has always been public — the tools just never came down through official channels.
        Each project below was built by a Sailor, a Marine, or a stubborn civilian who read the manual,
        found the gap, and decided the fix didn’t need a program of record or a four-year wait. One
        person started in 2014; the rest of us turned up about eleven years later.
      </p>

      <div className="tl-wrap">
        <button className="tl-arrow tl-arrow-l" onClick={() => nudge(-1)} aria-label="Scroll timeline left">
          ‹
        </button>
        <div className="tl-scroll" ref={scrollRef}>
          <div className="tl-track" style={{ width: TRACK_W }}>
            {/* the axis, with the long quiet stretch dashed */}
            <div className="tl-axis" style={{ top: AXIS_Y }} />
            <div className="tl-axis-gap" style={{ top: AXIS_Y, left: 96, width: 360 }} />
            <span className="tl-gap-label" style={{ top: AXIS_Y - 30, left: 150 }}>
              · the quiet years ·
            </span>
            <span className="tl-era" style={{ top: AXIS_Y - 28, left: 64 }}>
              2014
            </span>
            <span className="tl-era" style={{ top: AXIS_Y + 16, left: 452 }}>
              2025–26
            </span>

            {NODES.map((n) => (
              <div key={n.who}>
                <span
                  className={n.us ? 'tl-dot tl-dot-us' : 'tl-dot'}
                  style={{ left: n.x - 6, top: AXIS_Y - 6 }}
                />
                <span
                  className="tl-stem"
                  style={
                    n.side === 'up'
                      ? { left: n.x, top: AXIS_Y - 16, height: 16 }
                      : { left: n.x, top: AXIS_Y, height: 16 }
                  }
                />
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={n.us ? 'tl-card tl-card-us' : 'tl-card'}
                  style={n.side === 'up' ? { left: n.x, bottom: 148 } : { left: n.x, top: 148 }}
                >
                  <span className="tl-date">{n.date}</span>
                  <span className="tl-name">
                    {n.name}
                    {n.us && <span className="tl-here"> ← you are here</span>}
                  </span>
                  <span className="tl-who">{n.who}</span>
                  <span className="tl-blurb">{n.blurb}</span>
                  <span className="tl-lic">{n.license}</span>
                </a>
              </div>
            ))}
          </div>
        </div>
        <button className="tl-arrow tl-arrow-r" onClick={() => nudge(1)} aria-label="Scroll timeline right">
          ›
        </button>
      </div>
      <p className="tl-hint">Scroll, drag, or swipe across a decade →</p>
    </section>
  );
}
