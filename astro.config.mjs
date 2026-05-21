// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katexMacros from './src/katex-macros.js';
import remarkTreesitter from './src/plugins/remark-treesitter.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://thibaultbarret.github.io',
  markdown: {
    remarkPlugins: [remarkTreesitter, remarkMath],
    rehypePlugins: [[rehypeKatex, { macros: katexMacros }]],
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
