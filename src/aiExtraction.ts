import { GoogleGenAI, Type } from '@google/genai';
import { AI_EXTRACTED_DATA_SCHEMA } from './zodSchema';

export default async function aiExtraction(ai: GoogleGenAI, text: string) {
	const response = await ai.models.generateContent({
		model: 'gemini-2.5-flash',
		contents:
			`Instruction:
        Extract the title, bus number, and content from the following text.
        If there is multiple sections, extract all of them as separate objects.
        The title should be a concise summary of the content.
        Do not rephrase or edit the content unless grammatically incorrect.\nText:\n` +
			text.slice(0, 5000),
		config: {
			responseMimeType: 'application/json',
			responseSchema: {
				type: Type.ARRAY,
				items: {
					type: Type.OBJECT,
					properties: {
						title: { type: Type.STRING, description: 'Title' },
						content: { type: Type.STRING, description: 'Content' },
						buses: {
							type: Type.ARRAY,
							items: { type: Type.STRING },
							description:
								'List of bus numbers mentioned in the content. If none, return an empty array.',
						},
					},
				},
			},
		},
	});
	const res = response.text;
	const parsed = AI_EXTRACTED_DATA_SCHEMA.safeParse(JSON.parse(res ?? '[]'));
	if (!parsed.success) {
		return {
			success: false,
			error: 'Failed to parse AI response',
			details: parsed.error,
		} as const;
	}
	return { success: true, data: parsed.data } as const;
}
