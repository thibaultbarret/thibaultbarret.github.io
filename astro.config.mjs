// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katexMacros from './src/katex-macros.js';

// https://astro.build/config
export default defineConfig({
  site: 'https://thibaultbarret.github.io',
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [[rehypeKatex, { macros: katexMacros }]],
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
