'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SearchResult {
    symbol: string;
    name: string;
    exchangeShortName?: string;
    koreanName?: string;
}

interface RecentSearch {
    symbol: string;
    name: string;
}

const RECENT_KEY = 'stockrisk_recent_searches';
const MAX_RECENT = 10;

// ─── 아이콘 컴포넌트 ────────────────────────────────────────
function IconSearch({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="22" y2="22" />
        </svg>
    );
}

function IconX({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function IconChevronLeft({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="15 18 9 12 15 6" />
        </svg>
    );
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────
export default function SearchPage() {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [recent, setRecent] = useState<RecentSearch[]>([]);

    // localStorage에서 최근 검색 불러오기
    useEffect(() => {
        try {
            const stored = localStorage.getItem(RECENT_KEY);
            if (stored) setRecent(JSON.parse(stored));
        } catch { /* ignore */ }
        inputRef.current?.focus();
    }, []);

    // 최근 검색 저장
    const saveRecent = useCallback((item: SearchResult) => {
        setRecent(prev => {
            const next = [
                { symbol: item.symbol, name: item.name },
                ...prev.filter(r => r.symbol !== item.symbol),
            ].slice(0, MAX_RECENT);
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    // 최근 검색 개별 삭제
    const removeRecent = useCallback((symbol: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setRecent(prev => {
            const next = prev.filter(r => r.symbol !== symbol);
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    // 전체 삭제
    const clearRecent = useCallback(() => {
        setRecent([]);
        localStorage.removeItem(RECENT_KEY);
    }, []);

    // 디바운스 검색
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!query.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
                const data = await res.json();
                setResults(Array.isArray(data) ? data : []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 280);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const isSearching = query.trim().length > 0;

    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col">

            {/* ── 상단 검색바 ── */}
            <div className="sticky top-0 z-10 bg-gray-50 px-4 pt-4 pb-3 flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 flex-shrink-0 transition"
                    aria-label="뒤로가기"
                >
                    <IconChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex-1 flex items-center bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2.5 gap-2">
                    <IconSearch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="종목명 또는 티커를 검색하세요"
                        className="flex-1 text-[14px] font-medium text-gray-900 placeholder:text-gray-400 bg-transparent outline-none"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-gray-300 transition"
                            aria-label="검색어 지우기"
                        >
                            <IconX className="w-2.5 h-2.5 text-gray-600" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── 본문 ── */}
            <div className="flex-1 px-4 pb-8">

                {/* 검색 결과 */}
                {isSearching && (
                    <section>
                        {loading ? (
                            <div className="space-y-2.5 mt-1">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-[58px] bg-white rounded-xl border border-gray-100 animate-pulse" />
                                ))}
                            </div>
                        ) : results.length > 0 ? (
                            <div className="space-y-2 mt-1">
                                {results.map(item => (
                                    <Link
                                        href={`/ticker/${item.symbol}`}
                                        key={item.symbol}
                                        onClick={() => saveRecent(item)}
                                        className="flex items-center justify-between bg-white rounded-xl shadow-sm px-4 py-3 transition border border-gray-100 hover:bg-gray-50"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <p className="font-black text-[15px] text-gray-900 leading-tight truncate">
                                                    {item.koreanName ?? item.name}
                                                </p>
                                                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded leading-tight flex-shrink-0">
                                                    {item.symbol}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-400 truncate">{item.name}</p>
                                        </div>
                                        {item.exchangeShortName && (
                                            <span className="ml-3 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
                                                {item.exchangeShortName}
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <p className="text-[13px] text-gray-400 font-medium">"{query}"에 대한 검색 결과가 없습니다.</p>
                            </div>
                        )}
                    </section>
                )}

                {/* 최근 검색 */}
                {!isSearching && recent.length > 0 && (
                    <section className="mb-7 mt-2">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-[13px] font-bold text-gray-500 tracking-tight">최근 검색</h2>
                            <button
                                onClick={clearRecent}
                                className="text-[11px] text-gray-400 hover:text-gray-600 transition font-medium"
                            >
                                전체 삭제
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {recent.map(item => (
                                <Link
                                    href={`/ticker/${item.symbol}`}
                                    key={item.symbol}
                                    onClick={() => saveRecent(item)}
                                    className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm hover:bg-gray-100 transition"
                                >
                                    <span className="text-[12px] font-black text-gray-800">{item.symbol}</span>
                                    <button
                                        onClick={e => removeRecent(item.symbol, e)}
                                        className="flex items-center justify-center text-gray-400 hover:text-gray-700 transition"
                                        aria-label={`${item.symbol} 삭제`}
                                    >
                                        <IconX className="w-2.5 h-2.5" />
                                    </button>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* 인기 주식 (플레이스홀더) */}
                {!isSearching && (
                    <section className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-black text-gray-900">인기 주식</h2>
                            <span className="text-[11px] text-gray-400 font-medium">곧 추가 예정</span>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex items-center px-4 py-3.5 border-b border-gray-50 last:border-0">
                                    <span className="text-[13px] font-black text-gray-200 w-5 flex-shrink-0 tabular-nums">{i}</span>
                                    <div className="flex-1 ml-4 space-y-1.5">
                                        <div className="h-3 bg-gray-100 rounded-full w-28 animate-pulse" />
                                        <div className="h-2.5 bg-gray-50 rounded-full w-16 animate-pulse" />
                                    </div>
                                    <div className="h-3 bg-gray-100 rounded-full w-10 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
