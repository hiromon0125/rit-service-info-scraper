import * as cheerio from 'cheerio';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { md5 } from 'hono/utils/crypto';

type Bindings = {
	TARGET_URL: string;
	SECRET_KEY: string;
	NODE_ENV: string;
	KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(logger()).use('*', async (c, next) => {
	if (!c.env.SECRET_KEY) {
		return c.text('SECRET_KEY is not set', 500);
	}
	if (
		c.env.NODE_ENV != 'development' &&
		c.env.SECRET_KEY !== c.req.header('X-Secret-Key')
	) {
		return c.text('Unauthorized', 401);
	}

	await next();
});
app.get('/', async (c) => {
	const targetUrl = c.env.TARGET_URL;
	if (!targetUrl) {
		return c.text('TARGET_URL is not set', 500);
	}

	const response = await fetch(targetUrl);
	if (!response.ok) return c.json({ error: 'Failed to fetch data' }, 500);

	const html = await response.text();
	const $ = cheerio.load(html);

	// Extract some example data (e.g., all headings)
	const text = $('p.h1')
		.parent()
		.map((_, el) => $(el).text().split('\n'))
		.get()
		.filter((text) => text.trim() !== '')
		.slice(1)
		.reduce((acc, text, index) => {
			if (index % 2 !== 1) {
				const sanitizedText = text.trim().split(':');
				const title = sanitizedText[0];
				const buses = sanitizedText[1]
					.split(',')
					.map((bus) => bus.trim());
				const newAcc = [...acc, { title, buses }];
				return newAcc;
			} else {
				acc[acc.length - 1].content = text.trim();
				return acc;
			}
		}, [] as { title?: string; content?: string; buses: string[] }[]);
	if (text.filter((item) => item.title || item.content).length === 0) {
		return c.json({ error: 'No valid data found' }, 500);
	}
	// Generate hashes for each object stringified
	const hashes = await Promise.allSettled(
		text.map(async (item) => {
			const jsonText = JSON.stringify(item);
			return { hash: await md5(jsonText), data: item };
		})
	);
	if (
		!hashes.every((hash) => hash.status != 'rejected') ||
		hashes.map((hash) => hash.value.hash).includes(null)
	) {
		return c.json({ error: 'Failed to generate hashes' }, 500);
	}

	// Check if the hashes are already in the cache
	// If not, store the new values in the cache with the current timestamp
	// If yes, return the cached values
	const finalValues = await Promise.allSettled(
		(
			hashes as PromiseFulfilledResult<{
				hash: string;
				data: { title: string; content: string; buses: string[] };
			}>[]
		).map(async (hash) => {
			const cached = await c.env.KV.get<{
				title?: string;
				content?: string;
				buses: string[];
				hash: string;
				timestamp: number;
			}>(hash.value.hash, 'json');

			if (cached) return { ...cached, isNew: false };
			const newValue = {
				...hash.value.data,
				hash: hash.value.hash,
				timestamp: Date.now(),
			};
			await c.env.KV.put(hash.value.hash, JSON.stringify(newValue));
			return {
				...newValue,
				isNew: true,
			};
		})
	);
	console.log('Final values:', finalValues);

	let errorList;
	if (
		(errorList = finalValues.filter((value) => value.status == 'rejected'))
			.length > 0
	) {
		return c.json(
			{
				error: 'Failed to generate final values',
				...(c.env.NODE_ENV == 'development'
					? { error_objects: errorList }
					: {}),
			},
			500
		);
	}
	const finalValuesResolved = finalValues as PromiseFulfilledResult<{
		title: string;
		content: string;
		buses: string[];
		hash: string;
		timestamp: number;
		isNew: boolean;
	}>[];
	console.log('Final values:', finalValuesResolved);

	return c.json({
		targetUrl,
		data: finalValuesResolved.map((value) => value.value),
	});
});

export default app;
