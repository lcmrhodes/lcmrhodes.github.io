import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const projects = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
	schema: z.object({
		title: z.string(),
		summary: z.string(),
		lane: z.enum(['visualization', 'product', 'research']),
		rank: z.number(),
		featured: z.boolean().default(false),
		visibility: z.enum(['public', 'private']),
		stack: z.array(z.string()),
		repoUrl: z.string().url().optional(),
		liveUrl: z.string().url().optional(),
		year: z.number(),
		role: z.string(),
		highlights: z.array(z.string()),
		disclaimer: z.string().optional(),
	}),
});

export const collections = {
	projects,
};
