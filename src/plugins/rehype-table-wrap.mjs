import { visit, SKIP } from 'unist-util-visit';

/**
 * Enveloppe chaque <table> dans <div class="table-scroll"> (défilement
 * horizontal responsive, sémantique du tableau préservée). Idempotent.
 */
export default function rehypeTableWrap() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === null) return;

      // déjà enveloppé ? on ne retouche pas
      const cls = parent.properties?.className;
      if (
        parent.tagName === 'div' &&
        Array.isArray(cls) &&
        cls.includes('table-scroll')
      ) {
        return;
      }

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['table-scroll'],
          tabIndex: 0,
          role: 'region',
          ariaLabel: 'Tableau',
        },
        children: [node],
      };
      return SKIP; // ne pas redescendre dans le tableau déplacé
    });
  };
}
