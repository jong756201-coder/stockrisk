import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { SecFilingService } from '@/lib/api/sec';
import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

export const maxDuration = 60;

// Gemini 초기화
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Gemini가 반환해야 하는 정확한 JSON 스키마
const responseSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        delisting_risk: {
            type: SchemaType.OBJECT,
            properties: {
                exists: { type: SchemaType.BOOLEAN, description: "8-K 내 Item 3.01(상장폐지/규정 위반 통보) 존재 여부" },
                summary: { type: SchemaType.STRING, description: "존재 시 사유 요약 (한국어). 없으면 빈 문자열." }
            },
            required: ["exists", "summary"]
        },
        going_concern: {
            type: SchemaType.OBJECT,
            properties: {
                exists: { type: SchemaType.BOOLEAN, description: "10-K/10-Q 내 'Going concern' 또는 '계속기업 불확실성' 명시 여부" },
                summary: { type: SchemaType.STRING, description: "존재 시 사유 요약 (한국어). 없으면 빈 문자열." }
            },
            required: ["exists", "summary"]
        },
        shell_recycling: {
            type: SchemaType.OBJECT,
            properties: {
                exists: { type: SchemaType.BOOLEAN, description: "잦은 사명 변경, Item 4.01(회계법인 변경) 등 껍데기 돌려막기 징후 여부" },
                summary: { type: SchemaType.STRING, description: "징후 요약 (한국어). 없으면 빈 문자열." }
            },
            required: ["exists", "summary"]
        },
        offering_history: {
            type: SchemaType.STRING,
            description: "최근 3년 S-3, 424B5, S-1 기반 유상증자 횟수 및 총 조달 규모 Estimates 한국어 한 줄 요약"
        },
        dilution_warning: {
            type: SchemaType.OBJECT,
            properties: {
                exists: { type: SchemaType.BOOLEAN, description: "워런트·전환사채 등 잠재 희석 주식이 현재 유통주식 대비 50% 초과 여부" },
                summary: { type: SchemaType.STRING, description: "잠재 희석 규모 요약 (한국어). 없으면 빈 문자열." }
            },
            required: ["exists", "summary"]
        },
        audit_opinion: {
            type: SchemaType.OBJECT,
            properties: {
                exists: { type: SchemaType.BOOLEAN, description: "비적정 감사의견(한정/거절/의문) 또는 중요한 내부통제 취약점(material weakness) 존재 여부" },
                summary: { type: SchemaType.STRING, description: "감사의견 내용 요약 (한국어). 없으면 빈 문자열." }
            },
            required: ["exists", "summary"]
        },
        material_litigation: {
            type: SchemaType.OBJECT,
            properties: {
                exists: { type: SchemaType.BOOLEAN, description: "10-K Item 3(Legal Proceedings)에서 사업에 중대한 영향을 미칠 수 있는 계류 소송 존재 여부" },
                summary: { type: SchemaType.STRING, description: "소송 내용 및 청구 금액 요약 (한국어). 없으면 빈 문자열." }
            },
            required: ["exists", "summary"]
        }
    },
    required: ["delisting_risk", "going_concern", "shell_recycling", "offering_history", "dilution_warning", "audit_opinion", "material_litigation"]
};

// 24시간 캐시로 Gemini API 비용 절약
const getCachedRiskAnalysis = unstable_cache(
    async (symbol: string) => {
        // 1. FMP API 1번 호출로 모든 SEC 공시 가져오기
        const { riskFilings, offeringFilings } = await SecFilingService.getAllFilings(symbol);

        if (riskFilings.length === 0 && offeringFilings.length === 0) {
            return {
                message: "SEC 공시를 찾을 수 없습니다.",
                analysis: null
            };
        }

        // 2. EDGAR에서 원문 텍스트 추출 (리스크 공시 최대 3건 + 오퍼링 공시 최대 3건)
        const riskDocs = riskFilings.slice(0, 3);
        const offeringDocs = offeringFilings.slice(0, 3);

        const allTextPromises = [
            ...riskDocs.map(f => SecFilingService.extractTextFromEdgarUrl(f.source_url)),
            ...offeringDocs.map(f => SecFilingService.extractTextFromEdgarUrl(f.source_url))
        ];
        const allTexts = await Promise.all(allTextPromises);

        // 3. Gemini에 넘길 통합 텍스트 조립
        let combinedText = `[SEC FILINGS FOR ${symbol}]\n\n`;

        riskDocs.forEach((meta, i) => {
            if (allTexts[i]) {
                combinedText += `--- ${meta.type} (${meta.filing_date}) ---\n${allTexts[i]}\n\n`;
            }
        });

        offeringDocs.forEach((meta, i) => {
            const textIdx = riskDocs.length + i;
            if (allTexts[textIdx]) {
                combinedText += `--- ${meta.type} (${meta.filing_date}) ---\n${allTexts[textIdx]}\n\n`;
            }
        });

        // 오퍼링 공시 목록도 메타데이터로 추가 (텍스트 미추출 건 포함)
        if (offeringFilings.length > 0) {
            combinedText += `\n[OFFERING FILING LIST - 최근 3년]\n`;
            offeringFilings.forEach(f => {
                combinedText += `- ${f.type} | ${f.filing_date}\n`;
            });
        }

        // 4. 포렌식 감사관 프롬프트 + Gemini 호출 (단일 API 호출)
        const systemInstruction = `너는 포렌식 회계 감사관이다. 제공된 SEC 공시와 변경 이력을 읽고 다음 7가지를 철저히 검증하라. 임의적인 해석은 절대 배제하고, 오직 문서에 명시적으로 기재된 사실만 근거로 판단하라.

A. delisting_risk: 8-K 문서 내에 Item 3.01(상장폐지/규정 위반 통보) 존재 여부 (true/false) 및 사유 요약.
B. going_concern: 10-K/10-Q 내에 '계속기업 불확실성(Going concern)' 또는 'substantial doubt about ability to continue as a going concern' 명시 여부 (true/false).
C. shell_recycling: 잦은 사명 변경이나 Item 4.01(회계법인 변경) 등 껍데기 회사 돌려막기 징후 요약.
D. offering_history: 제공된 문서 목록에 S-3, 424B5, S-1 공시가 **실제로 존재하는 경우에만** 횟수와 조달 규모를 한국어 한 줄로 요약하라. 해당 공시가 전혀 없다면 반드시 빈 문자열("")을 반환하고 추측하거나 추정하지 마라.
E. dilution_warning: 10-K, S-3, 424B 문서에서 워런트(warrants), 전환사채(convertible notes), 스톡옵션(stock options) 등 잠재적 희석 주식 총합이 현재 유통주식(shares outstanding) 대비 50%를 초과하는지 판단하라. 문서에 숫자가 명시된 경우에만 판단하고, 없으면 exists=false.
F. audit_opinion: 10-K 감사보고서(auditor's report)에서 다음 중 하나 이상이 명시된 경우 exists=true: "qualified opinion"(한정의견), "adverse opinion"(부적정의견), "disclaimer of opinion"(의견거절), "material weakness"(중요한 취약점), "significant deficiency". 없거나 "unqualified opinion"(적정의견)이면 exists=false.
G. material_litigation: 10-K Item 3(Legal Proceedings)에서 회사 측이 피고이고 청구 금액이 명시되거나 "material" 또는 "significant"로 표현된 소송이 있으면 exists=true. 일상적인 소액 소송이나 소송 내용이 없으면 exists=false.

반드시 지정된 JSON 스키마 규격으로만 응답하라. 한국어로 명확하게 요약할 것.`;

        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: systemInstruction + "\n\n" + combinedText }] }
            ],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1
            }
        });

        const responseText = result.response.text();
        const jsonAnalysis = JSON.parse(responseText);

        return {
            success: true,
            filings_scanned: riskDocs.length + offeringDocs.length,
            analysis: jsonAnalysis
        };
    },
    ['sec-forensic-analysis'],
    { revalidate: 86400, tags: ['sec'] }
);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: "Missing symbol parameter" }, { status: 400 });
    }

    try {
        const data = await getCachedRiskAnalysis(symbol.toUpperCase());
        return NextResponse.json(data);
    } catch (e: any) {
        console.error("SEC Risk Analysis API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
