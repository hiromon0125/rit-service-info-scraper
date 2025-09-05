import { GoogleGenAI } from '@google/genai';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { md5 } from 'hono/utils/crypto';
import aiExtraction from './aiExtraction';
import { fetchText } from './fetch';
import { CACHED_DATA_SCHEMA, CachedData } from './zodSchema';

type Bindings = {
	TARGET_URL: string;
	SECRET_KEY: string;
	GEMINI_KEY: string;
	NODE_ENV: string;
	KV: KVNamespace;
};

type Variables = {
	ai: GoogleGenAI;
};

type Env = {
	Bindings: Bindings;
	Variables: Variables;
};

const app = new Hono<Env>();

app.use(logger())
	.use('*', async (c, next) => {
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
	})
	.use(async (c, next) => {
		const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_KEY });
		c.set('ai', ai);
		await next();
	});

app.get('/', async (c) => {
	const targetUrl = c.env.TARGET_URL;
	if (!targetUrl) return c.json({ error: 'TARGET_URL is not set' }, 500);

	const response = await fetchText(targetUrl);
	if (!response.success) return c.json({ error: response.error }, 500);
	const text = response.data;
	if (text.length === 0) return c.json({ targetUrl, data: [] }); // No message found

	// Generate hashes for raw scraped text and use that to check cache
	const hash = await md5(text);
	if (hash == null) return c.json({ error: 'Failed to generate hash' }, 500);
	const rawCached = await c.env.KV.get<CachedData>(hash, 'json');
	const cached = CACHED_DATA_SCHEMA.safeParse(rawCached);
	if (!cached.success) return c.json({ error: 'Failed to parse cache' }, 500);
	if (cached.data)
		return c.json({
			targetUrl,
			data: cached.data.map((i) => ({ ...i, isNew: false })),
		});

	const aiResponse = await aiExtraction(c.get('ai'), text);
	if (!aiResponse.success)
		return c.json({
			error: aiResponse.error,
		});
	const { data } = aiResponse;
	if (data.length === 0) return c.json({ targetUrl, data: [] }); // No message found

	const finalData = data.map((d) => ({
		...d,
		hash,
		timestamp: Date.now(),
		isNew: true,
	}));

	await c.env.KV.put(hash, JSON.stringify(finalData));

	return c.json({
		targetUrl,
		data: finalData,
	});
});

export default app;
