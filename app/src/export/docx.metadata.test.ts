import { describe, it, expect } from 'vitest';
import { neutralizeCoreXml } from './docx';

// The .docx export must be "silent": the docx library stamps real created/modified timestamps into
// docProps/core.xml no matter what core-property options we pass, so neutralizeCoreXml blanks them.
describe('docx metadata — silent export', () => {
  it('neutralizes both created + modified timestamps to a fixed epoch', () => {
    const xml =
      '<?xml version="1.0"?><cp:coreProperties xmlns:dcterms="http://purl.org/dc/terms/">' +
      '<cp:revision>1</cp:revision>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">2026-06-27T19:00:00.000Z</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-27T19:00:00.000Z</dcterms:modified>' +
      '</cp:coreProperties>';
    const out = neutralizeCoreXml(xml);
    expect(out).not.toContain('2026'); // no real timestamp survives
    expect(out.match(/1970-01-01T00:00:00Z/g)?.length).toBe(2); // both dates epoched
    expect(out).toContain('xsi:type="dcterms:W3CDTF"'); // element structure + attrs preserved
  });

  it('is a no-op when there are no date elements', () => {
    const xml = '<cp:coreProperties><cp:revision>1</cp:revision></cp:coreProperties>';
    expect(neutralizeCoreXml(xml)).toBe(xml);
  });
});
