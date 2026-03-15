import { unstable_cache } from 'next/cache';

// Translation maps
export const SECTOR_MAP: Record<string, string> = {
    'Technology': '기술', 'Consumer Cyclical': '소비재', 'Healthcare': '헬스케어',
    'Financial Services': '금융', 'Communication Services': '통신', 'Industrials': '산업재',
    'Consumer Defensive': '필수소비재', 'Energy': '에너지', 'Basic Materials': '소재',
    'Real Estate': '부동산', 'Utilities': '유틸리티'
};

// 단어 단위 한글 번역 맵 → 새로운 업종 조합도 자동 번역
const WORD_KR: Record<string, string> = {
    // 명사
    'Software': '소프트웨어', 'Semiconductors': '반도체', 'Semiconductor': '반도체', 'Electronics': '전자',
    'Biotechnology': '바이오테크', 'Insurance': '보험', 'Banks': '은행', 'Chemicals': '화학',
    'Oil': '석유', 'Gas': '가스', 'Gold': '금', 'Silver': '은', 'Copper': '구리', 'Steel': '철강', 'Uranium': '우라늄',
    'REIT': '리츠', 'Utilities': '유틸리티', 'Solar': '태양광', 'Airlines': '항공사', 'Railroads': '철도',
    'Entertainment': '엔터테인먼트', 'Broadcasting': '방송', 'Publishing': '출판', 'Restaurants': '외식',
    'Leisure': '레저', 'Gambling': '카지노', 'Trucking': '화물운송', 'Internet': '인터넷',
    'Retail': '소매', 'Auto': '자동차', 'Drug': '제약', 'Medical': '의료', 'Health': '헬스',
    'Real': '부동산', 'Estate': '', 'Services': '서비스', 'Advertising': '광고', 'Agencies': '',
    'Asset': '자산', 'Management': '운용', 'Capital': '자본', 'Markets': '시장', 'Credit': '신용',
    'Farm': '농업', 'Travel': '여행', 'Packaged': '포장', 'Foods': '식품', 'Grocery': '식료품',
    'Stores': '', 'Beverages': '음료', 'Luxury': '명품', 'Goods': '제품', 'Waste': '폐기물',
    'Building': '건축', 'Materials': '자재', 'Lumber': '목재', 'Wood': '', 'Production': '생산',
    'Textile': '섬유', 'Apparel': '의류', 'Footwear': '신발', 'Accessories': '액세서리',
    'Hardware': '하드웨어', 'Computer': '컴퓨터', 'Equipment': '장비', 'Instruments': '기기',
    'Communication': '통신', 'Information': '정보', 'Technology': '기술', 'Data': '데이터',
    'Staffing': '인력', 'Employment': '고용', 'Engineering': '엔지니어링', 'Construction': '건설',
    'Electrical': '전기', 'Industrial': '산업', 'Machinery': '기계', 'Aerospace': '항공우주',
    'Defense': '방위', 'Diagnostics': '진단', 'Research': '연구', 'Shell': '유령', 'Companies': '회사',
    'Residential': '주거용', 'Office': '오피스', 'Healthcare': '의료', 'Facilities': '시설',
    'Scientific': '과학', 'Technical': '기술', 'Devices': '기기', 'Supplies': '용품',
    'Manufacturers': '제조사', 'Manufacturing': '제조', 'Parts': '부품', 'Distribution': '유통',
    // 형용사·수식어
    'Infrastructure': '인프라', 'Application': '앱', 'General': '대형', 'Specialty': '전문',
    'Generic': '제네릭', 'Regional': '지방', 'Diversified': '다각화', 'Integrated': '종합',
    'Renewable': '신재생', 'Regulated': '규제', 'Electric': '전기', 'Midstream': '미드스트림',
    'Refining': '정제', 'Marketing': '마케팅', 'Non-Alcoholic': '비알콜', 'Alcoholic': '알콜',
    'Cyclical': '경기민감', 'Defensive': '안정', 'Personal': '생활', 'Household': '가정',
    'Property': '재산', 'Casualty': '손해', 'Life': '생명', 'Brokers': '중개',
    'Content': '콘텐츠', 'Gaming': '게임', 'Multimedia': '멀티미디어', 'Electronic': '전자',
    'Financial': '금융', 'Stock': '증권', 'Exchanges': '거래소', 'Pharmaceutical': '제약', 'Retailers': '유통',
    'Heavy': '중', 'Improvement': '인테리어', 'Home': '홈', 'Care': '케어',
    'Biggest': '', 'Gainers': '', 'Most': '', 'Active': '', 'Actives': '',
};

/**
 * 업종명을 자동으로 한국어 번역.
 * "Chemicals - Specialty" → "화학 - 전문" → "화학 전문"
 */
export function translateIndustry(raw: string | null): string | null {
    if (!raw) return null;
    // 1. 먼저 INDUSTRY_MAP에 정확히 있는지 확인
    if (INDUSTRY_MAP[raw]) return INDUSTRY_MAP[raw];
    // 2. 단어별 번역 조합
    const translated = raw
        .split(/\s*[-&]\s*|\s+/)
        .map(w => WORD_KR[w] ?? w)
        .filter(w => w.length > 0)
        .join(' ');
    // 모든 단어가 영어 그대로면 원문 반환
    return translated || raw;
}

// 자주 쓰이는 정확한 매칭 (translateIndustry에서 먼저 체크)
const INDUSTRY_MAP: Record<string, string> = {
    'Consumer Electronics': '가전', 'Internet Retail': '온라인 쇼핑',
    'Oil & Gas E&P': '석유·가스 탐사', 'Auto Manufacturers': '자동차 제조',
};

export function getCategoryEmoji(sectorK: string | null): string {
    if (!sectorK) return '🏢';
    const emojis: Record<string, string> = {
        '기술': '💻', '소비재': '🛍️', '헬스케어': '🏥',
        '금융': '🏦', '통신': '📡', '산업재': '🏭',
        '필수소비재': '🛒', '에너지': '⚡', '소재': '🧱',
        '부동산': '🏢', '유틸리티': '🚰'
    };
    return emojis[sectorK] || '🏢';
}

export const getCategoryData = unstable_cache(
    async (symbol: string) => {
        try {
            const apiKey = process.env.FMP_API_KEY;
            if (!apiKey) return { sector: null, industry: null, emoji: '🏢' };

            const res = await fetch(`https://financialmodelingprep.com/stable/profile?symbol=${symbol}&apikey=${apiKey}`, { next: { revalidate: 86400 } });

            if (!res.ok) {
                return { sector: null, industry: null, emoji: '🏢' };
            }

            const data = await res.json();
            const summary = data[0] || {};

            const rawSector = summary.sector || null;
            const rawIndustry = summary.industry || null;

            const korSector = rawSector ? (SECTOR_MAP[rawSector] || rawSector) : null;
            const korIndustry = translateIndustry(rawIndustry);

            return {
                sector: korSector,
                industry: korIndustry,
                emoji: getCategoryEmoji(korSector)
            };
        } catch (e) {
            return { sector: null, industry: null, emoji: '🏢' };
        }
    },
    ['category-data'],
    { revalidate: 86400 * 7, tags: ['category'] } // Cache for 7 days — args auto-injected into key
);
