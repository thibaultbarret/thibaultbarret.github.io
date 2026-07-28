import assert from 'node:assert/strict';
import rehypeTableWrap from '../src/plugins/rehype-table-wrap.mjs';

const el = (tagName, children = [], properties = {}) => ({
  type: 'element', tagName, properties, children,
});

// Arbre hast : un <table> et un <p> frères sous la racine
const tree = {
  type: 'root',
  children: [
    el('table', [el('thead'), el('tbody')]),
    el('p', [{ type: 'text', value: 'x' }]),
  ],
};

// 1) enveloppe le tableau
rehypeTableWrap()(tree);
const wrap = tree.children[0];
assert.equal(wrap.tagName, 'div', 'le tableau doit être enveloppé dans un div');
assert.ok(
  Array.isArray(wrap.properties.className) &&
    wrap.properties.className.includes('table-scroll'),
  'le div doit porter la classe table-scroll'
);
assert.equal(wrap.children[0].tagName, 'table', 'le div enveloppe le tableau');
assert.equal(wrap.properties.tabIndex, 0, 'wrapper focusable (tabindex=0)');
assert.equal(wrap.properties.role, 'region', 'wrapper is a region landmark');
assert.ok(
  typeof wrap.properties.ariaLabel === 'string' && wrap.properties.ariaLabel.length > 0,
  'wrapper has an aria-label'
);

// 2) laisse les autres nœuds intacts
assert.equal(tree.children[1].tagName, 'p', 'le paragraphe reste intact');

// 3) idempotent : un 2e passage ne double pas l'enveloppe
rehypeTableWrap()(tree);
assert.equal(tree.children[0].tagName, 'div');
assert.equal(tree.children[0].children[0].tagName, 'table');
assert.notEqual(
  tree.children[0].children[0].children[0]?.tagName,
  'div',
  'pas de double enveloppe'
);

console.log('OK rehype-table-wrap');
