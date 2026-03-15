import Link from 'next/link';
import { getNewsForActiveSymbols } from '@/lib/newsCache';

export const dynamic = 'force-dynamic';

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
}

export default async function NewsPage() {
    const news = await getNewsForActiveSymbols(80);

    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col p-4">
            <header className="mb-6 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-black">마이크로캡 뉴스</h1>
                    <p className="text-sm text-gray-500 mt-1">급등주·거래량 상위 종목 최신 뉴스 (15분 갱신)</p>
                </div>
                <Link
                    href="/"
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition mt-1 shrink-0"
                    aria-label="뒤로가기"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </Link>
            </header>

            <section className="space-y-3">
                {news.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">뉴스를 불러오는 중입니다...</p>
                ) : (
                    news.map((item, i) => {
                        const href = item.url || item.link || '#';
                        return (
                            <a
                                key={`${item.symbol}-${i}`}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:bg-gray-50 transition"
                            >
                                {/* 심볼 태그 + 시간 */}
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded ${item.symbolSource === 'gainer' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {item.symbol}
                                        </span>
                                        {item.site && (
                                            <span className="text-[10px] text-gray-400">{item.site}</span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 tabular-nums">
                                        {timeAgo(item.publishedDate)}
                                    </span>
                                </div>

                                {/* 제목 */}
                                <p className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-2">
                                    {item.title}
                                </p>

                                {/* 본문 미리보기 */}
                                {item.text && (
                                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                                        {item.text}
                                    </p>
                                )}
                            </a>
                        );
                    })
                )}
            </section>
        </main>
    );
}
