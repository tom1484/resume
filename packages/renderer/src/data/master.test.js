// Master bullet bank contract: stable unique ids, and every `source`
// pointer actually resolves into resume.json (a renamed/removed highlight
// must break this test, not silently orphan the bullet).
import { describe, expect, it } from 'vitest';
import resume from './resume.json';
import master from './master.json';

const resolvePointer = (doc, pointer) =>
  pointer
    .split('/')
    .slice(1)
    .map((seg) => seg.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((node, seg) => (node == null ? undefined : node[seg]), doc);

describe('master.json', () => {
  it('has unique bullet ids', () => {
    const ids = master.bullets.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every source pointer resolves in resume.json', () => {
    for (const bullet of master.bullets.filter((b) => b.source)) {
      const target = resolvePointer(resume, bullet.source);
      expect(target, `${bullet.id} -> ${bullet.source}`).toBeDefined();
    }
  });

  it('covers every resume.json highlight (no rendered claim missing from the bank)', () => {
    const sources = new Set(master.bullets.map((b) => b.source));
    const expectPointer = (base, arr) =>
      arr.forEach((entry, i) =>
        (entry.highlights ?? []).forEach((_, j) => {
          expect(sources.has(`/${base}/${i}/highlights/${j}`), `/${base}/${i}/highlights/${j}`).toBe(true);
        })
      );
    expectPointer('work', resume.work);
    expectPointer('projects', resume.projects);
    expectPointer('volunteer', resume.volunteer);
  });
});
