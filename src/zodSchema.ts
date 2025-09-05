import z from 'zod';

export const AI_EXTRACTED_DATA_SCHEMA = z.array(
	z.object({
		title: z.string(),
		content: z.string(),
		buses: z.array(z.string()),
	})
);

export const CACHED_DATA_SCHEMA = z.array(
	z.object({
		title: z.string(),
		content: z.string(),
		buses: z.array(z.string()),
		hash: z.string(),
		timestamp: z.number(),
		isNew: z.boolean(),
	})
);

export type AIExtractedData = z.infer<typeof AI_EXTRACTED_DATA_SCHEMA>;
export type CachedData = z.infer<typeof CACHED_DATA_SCHEMA>;
