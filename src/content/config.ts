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

const chapters = defineCollection({
  type: 'content',
  schema: z.object({
    title:  z.string(),
    order:  z.number(),
    figures: z.array(z.object({
      filename: z.string(),
      title:    z.string(),
    })).default([]),
  }),
});

const programming = defineCollection({
  type: 'content',
  schema: z.object({
    title:       z.string(),
    description: z.string(),
    status:      z.enum(['stable', 'en cours']),
    tags:        z.array(z.string()),
    github:      z.string().optional(),
    order:       z.number(),
  }),
});

export const collections = { projects, publications, chapters, programming };
