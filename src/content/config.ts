// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title:       z.string(),
    description: z.string(),
    figure:      z.string().optional(),  // nom du fichier dans public/figures/
    tags:        z.array(z.string()),
    order:       z.number(),
  }),
});

const publications = defineCollection({
  type: 'content',
  schema: z.object({
    title:   z.string(),
    authors: z.array(z.string()),
    journal: z.string(),
    year:    z.number(),
    doi:     z.string().optional(),
    pdf:     z.string().optional(),
  }),
});

export const collections = { projects, publications };
