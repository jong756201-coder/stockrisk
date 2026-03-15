import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

// Define the structured output format for our evidence extractor
const EvidenceSchema = z.object({
    category: z.enum(['clinical_trial', 'partnership', 'delisting_notice', 'delisting_cancelled', 'earnings', 'rumor', 'other']),
    headline: z.string().describe("A concise ONE-LINE objective summary of what happened. MUST BE IN KOREAN (한국어)."),
    missing_or_risk_factors: z.array(z.string()).max(3).describe("Up to 3 objective risk factors or missing facts. MUST BE IN KOREAN (한국어). e.g. '임상 모수 3명에 불과함', '재무제표상 현금 고갈 임박'"),
    similarity_reason: z.string().describe("Why this stock popped today. Used to match with historical past events. MUST BE IN KOREAN (한국어). e.g. '소형 바이오주 임상 1상 성공'"),
});

export type EvidenceExtractionResult = z.infer<typeof EvidenceSchema>;

export class LLMService {
    /**
     * Extract structured risk factors and evidence from raw text utilizing Gemini.
     */
    static async extractEvidence(rawText: string, contextSource: string): Promise<EvidenceExtractionResult | null> {
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set.");
        }

        try {
            const { object } = await generateObject({
                model: google('gemini-3.1-pro-preview'),
                schema: EvidenceSchema,
                system: `You are a strict, objective financial fact-checker analyzing stock market news or SEC filings. 
The user will provide you with raw text about a stock that is currently popping (experiencing high momentum). 
Your job is NOT to give investment advice. Your job is to extract the objective facts and find the "catch".
Many speculative stocks pop on hype but have underlying risks (e.g. microscopic sample sizes in trials, unknown partners, high risk of offering/dilution).
Read the text and extract up to 3 objective risk factors or missing context. Be extremely concise.
IMPORTANT: You MUST write the headline, missing_or_risk_factors, and similarity_reason strictly in KOREAN (한국어). The ticker symbol and company name can stay in English.`,
                prompt: `Analyze the following text from ${contextSource}.\n\nText:\n${rawText}`,
            });

            return object;
        } catch (error) {
            console.error("LLM Extraction failed:", error);
            return null;
        }
    }
}
