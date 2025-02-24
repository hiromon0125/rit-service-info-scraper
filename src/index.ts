import * as cheerio from 'cheerio';
import { Hono } from 'hono';

type Bindings = {
	TARGET_URL: string;
	SECRET_KEY: string;
	NODE_ENV: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
	if (!c.env.SECRET_KEY) {
		return c.text('SECRET_KEY is not set', 500);
	}
	if (
		c.env.NODE_ENV != 'development' &&
		c.env.SECRET_KEY !== c.req.header('X-Secret-Key')
	) {
		return c.text('Unauthorized', 401);
	}
	console.log('Request received', {
		ENV: c.env.NODE_ENV,
	});

	await next();
});
app.get('/', async (c) => {
	const targetUrl = c.env.TARGET_URL;
	if (!targetUrl) {
		return c.text('TARGET_URL is not set', 500);
	}

	try {
		const response = await fetch(targetUrl);
		if (!response.ok) throw new Error('Failed to fetch the page');

		const html = await response.text();
		const $ = cheerio.load(html);

		// Extract some example data (e.g., all headings)
		const text = $('p.h1')
			.parent()
			.map((_, el) =>
				$(el)
					.text()
					.split('\n')
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
					}, [] as { title?: string; content?: string }[])
			)
			.get();

		return c.json({ targetUrl, text });
	} catch (error) {
		return c.json(
			{
				error,
				...(c.env.NODE_ENV === 'development' && error instanceof Error
					? { message: error.message }
					: {}),
			},
			500
		);
	}
});

export default app;
