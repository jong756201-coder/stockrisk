// ─── 이벤트 분류 체계 (Taxonomy) ────────────────────────────────────────────
// Gemini가 코드로 분류 → 프론트에서 label + description 매핑

// ─── 1. 이벤트 하위 유형 ────────────────────────────────────────────────────

export interface SubTypeInfo {
    label: string;       // 짧은 한국어 이름 (스티커용)
    description: string; // ? 버튼 클릭 시 보여줄 설명
    parent: 'OFFERING' | 'CONTRACT' | 'CLINICAL' | 'EARNINGS' | 'REGULATORY' | 'MA' | 'OTHER';
}

export const EVENT_SUB_TYPES: Record<string, SubTypeInfo> = {
    // ── OFFERING ──
    ATM: {
        label: 'ATM (시장가 매각)',
        description: 'ATM(At-the-Market)은 증권사를 통해 거래소에서 시장가로 수시 매각하는 방식입니다. 별도 사전 공지 없이 회사가 원할 때 주식을 팔 수 있어, 기존 주주는 희석 시점을 알기 어렵습니다.',
        parent: 'OFFERING',
    },
    DIRECT_OFFERING: {
        label: '직접 공모',
        description: '증권사 인수 없이 투자자에게 직접 주식을 판매하는 방식입니다. 보통 현 시장가 대비 할인된 가격에 발행되며, 기존 주주에게 즉각적인 희석 효과를 줍니다.',
        parent: 'OFFERING',
    },
    PIPE: {
        label: 'PIPE (사모 투자)',
        description: '소수 기관투자자에게 비공개로 주식을 판매하는 방식입니다. 빠르게 자금을 조달할 수 있지만 할인율이 높고 워런트가 동반되는 경우가 많아 추가 희석 위험이 있습니다.',
        parent: 'OFFERING',
    },
    SHELF: {
        label: '선반등록 (S-3)',
        description: 'S-3 등록신고서를 사전 제출해두고, 향후 필요할 때 빠르게 주식을 발행할 수 있는 체계입니다. 당장 발행은 아니지만 "언제든 찍어낼 수 있다"는 신호입니다.',
        parent: 'OFFERING',
    },
    WARRANT_EXERCISE: {
        label: '워런트 행사',
        description: '미리 정해진 가격에 신주를 살 수 있는 권리(워런트)가 실제로 행사된 것입니다. 행사 가격이 현재 주가보다 낮으면 즉시 희석이 발생합니다.',
        parent: 'OFFERING',
    },
    CONVERTIBLE: {
        label: '전환사채',
        description: '채권(빚)을 주식으로 바꿀 수 있는 증권입니다. 전환 시 주주 지분이 희석되며, 전환 가격이 시장가보다 낮게 설정되는 경우가 많습니다.',
        parent: 'OFFERING',
    },
    RDO: {
        label: '등록직접공모 (RDO)',
        description: 'Registered Direct Offering. 사전 등록된 주식을 소수 투자자에게 직접 판매합니다. PIPE와 유사하지만 SEC 등록을 거쳐 유통 제한이 없습니다.',
        parent: 'OFFERING',
    },
    OTHER_OFFERING: {
        label: '기타 주식 발행',
        description: '위 유형에 해당하지 않는 기타 주식 발행 또는 자금 조달 방식입니다.',
        parent: 'OFFERING',
    },

    // ── CONTRACT ──
    LICENSE: {
        label: '라이선스 계약',
        description: '기술, 특허, 지적재산의 사용 권리를 부여하거나 받는 계약입니다. 선급금, 마일스톤 지급 조건, 로열티 비율이 핵심입니다.',
        parent: 'CONTRACT',
    },
    PARTNERSHIP: {
        label: '파트너십 / 공동개발',
        description: '두 회사가 공동으로 R&D, 상업화 등을 진행하는 협약입니다. 비용 분담 비율, 수익 배분 조건, 독점권 범위가 중요합니다.',
        parent: 'CONTRACT',
    },
    SUPPLY: {
        label: '공급 / 유통 계약',
        description: '제품의 공급, 유통, 판매에 관한 계약입니다. 계약 기간, 독점 여부, 최소 구매량, 해지 조건이 핵심입니다.',
        parent: 'CONTRACT',
    },
    SALES_AGENT: {
        label: '판매 대행 계약',
        description: '증권사 등이 회사를 대신해 주식이나 제품을 판매하는 대행 계약입니다. 수수료율, 배타적 여부, 해지 조건이 중요합니다.',
        parent: 'CONTRACT',
    },
    GOVERNMENT: {
        label: '정부 / 공공기관 계약',
        description: '정부, 군, 공공기관과의 납품·서비스 계약입니다. 계약 규모, 기간, 갱신 조건이 핵심입니다.',
        parent: 'CONTRACT',
    },
    OTHER_CONTRACT: {
        label: '기타 계약',
        description: '위 유형에 해당하지 않는 기타 계약·협약입니다.',
        parent: 'CONTRACT',
    },

    // ── CLINICAL ──
    TOPLINE: {
        label: '탑라인 결과',
        description: '임상시험의 주요 결과만 먼저 발표하는 것입니다. 전체 데이터가 아닌 핵심 지표만 공개하므로, 세부 데이터(부작용, 하위그룹 분석 등)는 추후 확인이 필요합니다.',
        parent: 'CLINICAL',
    },
    PHASE1: {
        label: '임상 1상',
        description: '소규모(보통 20~80명) 인체 대상 첫 안전성 시험입니다. 약효보다 안전성·용량 확인이 주목적으로, 성공해도 상용화까지 아직 먼 단계입니다.',
        parent: 'CLINICAL',
    },
    PHASE2: {
        label: '임상 2상',
        description: '중규모(보통 100~300명) 대상 효능 및 부작용을 검증합니다. 2상 성공이 대규모 3상 진입의 근거가 되며, 바이오주 주가 변동의 핵심 단계입니다.',
        parent: 'CLINICAL',
    },
    PHASE3: {
        label: '임상 3상',
        description: '대규모(수백~수천 명) 대상 최종 효능 검증입니다. 성공 시 FDA 승인 신청이 가능하고, 실패 시 보통 가장 큰 주가 하락을 유발합니다.',
        parent: 'CLINICAL',
    },
    FDA_DECISION: {
        label: 'FDA 결정',
        description: 'FDA의 약물·의료기기 시판 허가 결정입니다. 승인 시 상업화가 가능하고, 거부(CRL 포함) 시 큰 주가 하락이 일반적입니다.',
        parent: 'CLINICAL',
    },
    IND: {
        label: 'IND 신청',
        description: 'FDA에 신약 임상시험 허가를 신청하는 절차입니다. 승인되면 인체 대상 임상을 시작할 수 있습니다.',
        parent: 'CLINICAL',
    },
    OTHER_CLINICAL: {
        label: '기타 임상/규제',
        description: '위 유형에 해당하지 않는 기타 임상시험 또는 규제 관련 이벤트입니다.',
        parent: 'CLINICAL',
    },

    // ── EARNINGS ──
    QUARTERLY_RESULTS: {
        label: '분기 실적',
        description: '분기별 매출, 순이익 등 재무 실적을 발표한 것입니다. 시장 기대치(컨센서스) 대비 상회/하회 여부가 주가에 직접 영향을 줍니다.',
        parent: 'EARNINGS',
    },
    ANNUAL_RESULTS: {
        label: '연간 실적',
        description: '연간 재무 실적(매출, 순이익, EPS 등)을 발표한 것입니다.',
        parent: 'EARNINGS',
    },
    REVENUE_UPDATE: {
        label: '매출/사업 현황',
        description: '정기 실적 발표 외에 매출 성장률, 주요 제품 실적, 사업 현황 등을 중간 업데이트한 것입니다.',
        parent: 'EARNINGS',
    },
    GUIDANCE: {
        label: '실적 가이던스',
        description: '회사가 향후 분기/연간 실적 전망치를 제시하거나 수정한 것입니다. 가이던스 하향은 큰 주가 하락을 유발할 수 있습니다.',
        parent: 'EARNINGS',
    },
    COST_RESTRUCTURING: {
        label: '비용 구조조정',
        description: '인력 감축, 사업부 폐지, 비용 절감 계획 등 비용 구조를 재편하는 것입니다.',
        parent: 'EARNINGS',
    },
    OTHER_EARNINGS: {
        label: '기타 실적/재무',
        description: '위 유형에 해당하지 않는 기타 실적 또는 재무 관련 이벤트입니다.',
        parent: 'EARNINGS',
    },

    // ── REGULATORY ──
    PATENT_GRANT: {
        label: '특허 취득',
        description: '특허청으로부터 신규 특허를 취득한 것입니다. 핵심 기술의 독점적 보호 기간, 특허 범위가 중요합니다.',
        parent: 'REGULATORY',
    },
    PATENT_APPLICATION: {
        label: '특허 출원',
        description: '특허를 새로 출원한 것입니다. 아직 승인된 것이 아니며 심사에 수개월~수년이 소요될 수 있습니다.',
        parent: 'REGULATORY',
    },
    GOVT_APPROVAL: {
        label: '정부/기관 승인',
        description: 'FDA 외 정부 기관(EPA, FCC, USDA, EMA 등)의 제품·서비스 승인 또는 인허가입니다.',
        parent: 'REGULATORY',
    },
    CERTIFICATION: {
        label: '인증 취득',
        description: 'ISO, CE, GMP 등 산업 표준 인증을 취득한 것입니다. 해당 시장 진출의 전제 조건인 경우가 많습니다.',
        parent: 'REGULATORY',
    },
    PATENT_LITIGATION: {
        label: '특허 소송',
        description: '특허 침해 소송을 제기하거나 피소된 것입니다. 소송 결과에 따라 제품 판매 금지나 거액의 배상이 발생할 수 있습니다.',
        parent: 'REGULATORY',
    },
    OTHER_REGULATORY: {
        label: '기타 규제/인허가',
        description: '위 유형에 해당하지 않는 기타 규제, 인허가, 지적재산 관련 이벤트입니다.',
        parent: 'REGULATORY',
    },

    // ── MA ──
    ACQUISITION: {
        label: '인수',
        description: '다른 회사나 사업부를 매입하는 것입니다. 인수 가격, 자금 조달 방식(현금/주식), 시너지 효과가 핵심입니다.',
        parent: 'MA',
    },
    MERGER: {
        label: '합병',
        description: '두 회사가 하나로 합쳐지는 것입니다. 합병 비율, 존속 회사, 주주 승인 여부가 중요합니다.',
        parent: 'MA',
    },
    DIVESTITURE: {
        label: '사업부 매각',
        description: '회사의 일부 사업부나 자산을 다른 회사에 매각하는 것입니다. 매각 대금, 남은 사업의 집중도가 핵심입니다.',
        parent: 'MA',
    },
    JV: {
        label: '합작법인 설립',
        description: '두 회사가 공동으로 새 법인을 설립하는 것입니다. 지분 비율, 투자금, 운영 구조가 중요합니다.',
        parent: 'MA',
    },

    // ── OTHER ──
    LEADERSHIP_CHANGE: {
        label: '경영진 변경',
        description: 'CEO, CFO 등 핵심 경영진의 선임 또는 사임입니다. 빈번한 경영진 교체는 내부 불안의 신호일 수 있습니다.',
        parent: 'OTHER',
    },
    BANKRUPTCY: {
        label: '파산 / 구조조정',
        description: '회사가 파산보호를 신청하거나 구조조정을 진행하는 것입니다.',
        parent: 'OTHER',
    },
    RESTATEMENT: {
        label: '재무제표 정정',
        description: '이전에 발표한 재무제표의 수치를 수정하는 것입니다. 회계 신뢰도에 심각한 의문을 제기합니다.',
        parent: 'OTHER',
    },
    DELISTING_NOTICE: {
        label: '상장폐지 통보',
        description: '거래소로부터 상장 유지 기준 미달 통보를 받은 것입니다.',
        parent: 'OTHER',
    },
    OTHER_EVENT: {
        label: '기타',
        description: '위 어떤 유형에도 해당하지 않는 기타 이벤트입니다.',
        parent: 'OTHER',
    },
};

// ─── 2. 누락 항목 카테고리 ──────────────────────────────────────────────────

export interface MissingCategoryInfo {
    label: string;
    description: string;
}

export const MISSING_CATEGORIES: Record<string, MissingCategoryInfo> = {
    // 공통
    FUND_PURPOSE: {
        label: '자금 사용 목적 불분명',
        description: '조달 자금의 구체적 사용 계획(R&D, 부채 상환, 운영비 등)이 명시되지 않았습니다. 투자자는 돈이 어디에 쓰이는지 알 수 없습니다.',
    },
    DILUTION_SCALE: {
        label: '희석 규모 미공개',
        description: '발행 가능한 최대 주식 수나 기존 주주 지분 희석 비율이 명시되지 않았습니다.',
    },
    OFFERING_PRICE: {
        label: '발행 가격 미공개',
        description: '주식 발행 가격(또는 할인율)이 명시되지 않았습니다. 시장가 대비 얼마에 발행되는지 알 수 없습니다.',
    },

    // 계약
    CONTRACT_VALUE: {
        label: '계약 금액 미공개',
        description: '계약의 총 금액, 마일스톤 지급 조건, 또는 로열티 비율이 공시되지 않았습니다.',
    },
    CONTRACT_DURATION: {
        label: '계약 기간 미공개',
        description: '계약의 유효 기간, 갱신 조건, 또는 종료 기한이 명시되지 않았습니다.',
    },
    COUNTERPARTY_INFO: {
        label: '상대방 정보 부족',
        description: '계약 상대방의 재무 상태, 사업 규모, 업력 등 신뢰도를 판단할 수 있는 정보가 부족합니다.',
    },
    EXCLUSIVITY: {
        label: '독점 여부 미공개',
        description: '계약이 독점인지 비독점인지 명시되지 않았습니다. 비독점 계약은 경쟁사에도 같은 권리가 부여될 수 있습니다.',
    },

    // 임상
    SAMPLE_SIZE: {
        label: '임상 모수(참가자 수) 미공개',
        description: '임상시험 참가자 수가 명시되지 않았습니다. 모수가 작을수록 결과의 통계적 신뢰도가 낮습니다.',
    },
    PRIMARY_ENDPOINT: {
        label: '1차 평가변수 미공개',
        description: '임상시험의 주요 성공 기준(1차 평가변수, primary endpoint)이 명시되지 않았습니다.',
    },
    P_VALUE: {
        label: '통계적 유의성 미공개',
        description: '결과의 통계적 유의성(p-value, 신뢰구간 등)이 공개되지 않아 결과의 신뢰도를 판단하기 어렵습니다.',
    },
    CONTROL_GROUP: {
        label: '대조군 설정 미공개',
        description: '위약군이나 비교 대조군 설정 방식이 명시되지 않았습니다. 대조군 없는 결과는 신뢰도가 크게 낮습니다.',
    },
    FULL_DATA: {
        label: '전체 데이터 미공개 (탑라인만)',
        description: '핵심 수치만 발표하고 전체 데이터(부작용, 하위그룹, 장기추적 등)가 공개되지 않았습니다.',
    },

    // 비용/재무
    EXPENSE_DETAILS: {
        label: '비용 세부사항 미공개',
        description: '수수료, 비용 구조, 또는 경비 한도 등의 세부 사항이 명시되지 않았습니다.',
    },
    TIMELINE: {
        label: '일정/기한 미공개',
        description: '주요 마일스톤, 완료 시점, 또는 향후 일정 계획이 공시되지 않았습니다.',
    },

    // 실적/규제
    ABSOLUTE_FIGURES: {
        label: '절대 금액 미공개',
        description: '증감률(%)만 공개하고 실제 매출액·이익 등 절대 금액을 공시하지 않았습니다. 기저 효과에 의해 성장률이 과대 표현될 수 있습니다.',
    },
    COMPARISON_BASIS: {
        label: '비교 기준 미공개',
        description: '전년 동기 수치나 비교 기준이 명시되지 않아 증감률의 실질적 의미를 판단하기 어렵습니다.',
    },
    PATENT_SCOPE: {
        label: '특허 범위 미공개',
        description: '취득한 특허의 보호 범위, 청구항 수, 보호 기간 등이 명시되지 않았습니다.',
    },
    APPROVAL_CONDITIONS: {
        label: '승인 조건 미공개',
        description: '승인에 부과된 제한 사항, 조건, 사후 모니터링 요구사항 등이 명시되지 않았습니다.',
    },

    // 기타
    OTHER_MISSING: {
        label: '기타 누락',
        description: '위 카테고리에 해당하지 않는 기타 중요 정보가 누락되었습니다.',
    },
};

// ─── 3. 상위 이벤트 타입 색상 설정 ─────────────────────────────────────────────
export const EVENT_TYPE_CONFIG: Record<string, { label: string; bg: string }> = {
    OFFERING:   { label: '오퍼링',    bg: 'bg-orange-500'  },
    CONTRACT:   { label: '계약',      bg: 'bg-blue-500'    },
    CLINICAL:   { label: '임상',      bg: 'bg-emerald-500' },
    EARNINGS:   { label: '실적',      bg: 'bg-cyan-600'    },
    REGULATORY: { label: '규제/인허가', bg: 'bg-teal-500'  },
    MA:         { label: '인수합병',  bg: 'bg-purple-500'  },
    OTHER:      { label: '기타',      bg: 'bg-gray-500'    },
};

// ─── 헬퍼: 모든 sub_type 코드 목록 ─────────────────────────────────────────────
export const ALL_SUB_TYPE_CODES = Object.keys(EVENT_SUB_TYPES);
export const ALL_MISSING_CODES = Object.keys(MISSING_CATEGORIES);
