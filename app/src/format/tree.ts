import type { Paragraph } from '../types';
import { uid } from '../defaultState';

export function newPara(text = ''): Paragraph {
  return { id: uid(), text, children: [] };
}

type Tree = Paragraph[];

export function updateText(list: Tree, id: string, text: string): Tree {
  return list.map((p) =>
    p.id === id ? { ...p, text } : { ...p, children: updateText(p.children, id, text) },
  );
}

// Toggle a paragraph's CUI portion marking.
export function setCui(list: Tree, id: string, on: boolean): Tree {
  return list.map((p) =>
    p.id === id ? { ...p, cui: on } : { ...p, children: setCui(p.children, id, on) },
  );
}

// Does any paragraph (at any depth) carry a CUI portion marking?
export function anyCui(list: Tree): boolean {
  return list.some((p) => p.cui || anyCui(p.children));
}

export function addChild(list: Tree, id: string): Tree {
  return list.map((p) =>
    p.id === id
      ? { ...p, children: [...p.children, newPara()] }
      : { ...p, children: addChild(p.children, id) },
  );
}

export function addSiblingAfter(list: Tree, id: string): Tree {
  const idx = list.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const copy = [...list];
    copy.splice(idx + 1, 0, newPara());
    return copy;
  }
  return list.map((p) => ({ ...p, children: addSiblingAfter(p.children, id) }));
}

export function remove(list: Tree, id: string): Tree {
  return list
    .filter((p) => p.id !== id)
    .map((p) => ({ ...p, children: remove(p.children, id) }));
}

export function move(list: Tree, id: string, dir: -1 | 1): Tree {
  const idx = list.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return list;
    const copy = [...list];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    return copy;
  }
  return list.map((p) => ({ ...p, children: move(p.children, id, dir) }));
}
