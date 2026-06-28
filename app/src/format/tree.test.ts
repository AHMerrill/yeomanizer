import { describe, it, expect } from 'vitest';
import { newPara, addChild, addSiblingAfter, remove, move, reorder, updateText } from './tree';
import type { Paragraph } from '../types';

const ids = (list: Paragraph[]) => list.map((p) => p.id);

describe('tree operations are pure (return new arrays, never mutate the input)', () => {
  it('updateText sets text on the matching node at any depth, immutably', () => {
    const child = newPara('child');
    const root: Paragraph[] = [{ ...newPara('root'), children: [child] }];
    const next = updateText(root, child.id, 'changed');
    expect(next[0].children[0].text).toBe('changed');
    expect(root[0].children[0].text).toBe('child'); // original untouched
    expect(next).not.toBe(root);
  });

  it('addChild appends a child to the target node only', () => {
    const root = [newPara('a')];
    const next = addChild(root, root[0].id);
    expect(next[0].children).toHaveLength(1);
    expect(root[0].children).toHaveLength(0);
  });

  it('addSiblingAfter inserts immediately after the target', () => {
    const a = newPara('a');
    const b = newPara('b');
    const next = addSiblingAfter([a, b], a.id);
    expect(next).toHaveLength(3);
    expect(next[0].id).toBe(a.id);
    expect(next[2].id).toBe(b.id); // the new node landed between a and b
  });

  it('remove deletes the node, leaving its siblings', () => {
    const a = newPara('a');
    const b = newPara('b');
    expect(ids(remove([a, b], a.id))).toEqual([b.id]);
  });

  it('remove also deletes a nested node', () => {
    const grandchild = newPara('gc');
    const root: Paragraph[] = [{ ...newPara('p'), children: [grandchild] }];
    const next = remove(root, grandchild.id);
    expect(next[0].children).toHaveLength(0);
  });

  it('move swaps with the neighbor, clamping at both ends', () => {
    const a = newPara('a');
    const b = newPara('b');
    const c = newPara('c');
    expect(ids(move([a, b, c], b.id, -1))).toEqual([b.id, a.id, c.id]);
    expect(ids(move([a, b, c], b.id, 1))).toEqual([a.id, c.id, b.id]);
    expect(ids(move([a, b, c], a.id, -1))).toEqual([a.id, b.id, c.id]); // first: no-op
    expect(ids(move([a, b, c], c.id, 1))).toEqual([a.id, b.id, c.id]); // last: no-op
  });

  it('reorder drops a node before/after a sibling (drag-to-reorder)', () => {
    const a = newPara('a');
    const b = newPara('b');
    const c = newPara('c');
    expect(ids(reorder([a, b, c], a.id, c.id, 'after'))).toEqual([b.id, c.id, a.id]); // a → end
    expect(ids(reorder([a, b, c], c.id, a.id, 'before'))).toEqual([c.id, a.id, b.id]); // c → start
    expect(ids(reorder([a, b, c], a.id, c.id, 'before'))).toEqual([b.id, a.id, c.id]); // a → before c
    const orig = [a, b, c];
    reorder(orig, a.id, c.id, 'after');
    expect(ids(orig)).toEqual([a.id, b.id, c.id]); // input untouched
  });

  it('reorder works among nested siblings, immutably', () => {
    const x = newPara('x');
    const y = newPara('y');
    const root: Paragraph[] = [{ ...newPara('p'), children: [x, y] }];
    const next = reorder(root, y.id, x.id, 'before');
    expect(ids(next[0].children)).toEqual([y.id, x.id]);
    expect(ids(root[0].children)).toEqual([x.id, y.id]); // original untouched
  });

  it('reorder is a no-op across levels (sibling-only — use Add subparagraph for that)', () => {
    const a = newPara('a');
    const child = newPara('child');
    const b: Paragraph = { ...newPara('b'), children: [child] };
    const next = reorder([a, b], a.id, child.id, 'after'); // depth-0 a onto depth-1 child
    expect(ids(next)).toEqual([a.id, b.id]);
    expect(ids(next[1].children)).toEqual([child.id]);
  });
});
