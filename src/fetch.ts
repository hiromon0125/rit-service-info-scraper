import * as cheerio from 'cheerio';

export async function fetchText(url: string) {
	const response = await fetch(url);
	if (!response.ok)
		return { error: 'Failed to fetch data', success: false } as const;

	const html = await response.text();
	const $ = cheerio.load(html);

	// Extract some example data (e.g., all headings)
	const text = $(
		'#progress-navigation--sidebar--content > div > div:nth-child(1)'
	)
		.map((_, el) => $(el).text())
		.get()
		.join('\n\n');
	return { data: text, success: true } as const;
}
