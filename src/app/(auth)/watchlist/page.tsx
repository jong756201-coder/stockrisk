import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function WatchlistPage() {
    const supabase = await createClient();

    // Get Session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    // Fetch Watchlist with JOIN to get latest ticker info
    const { data: watchlist, error } = await supabase
        .from('watchlists')
        .select(`
      id,
      symbol,
      added_at,
      tickers!inner (
        company_name,
        last_price
      )
    `)
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col p-4">
            <header className="mb-6 mt-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">내 관심종목</h1>
                    <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <Link href="/" className="text-xs bg-gray-200 px-3 py-1.5 rounded-full font-bold">홈으로</Link>
            </header>

            <div className="flex-1">
                {error && <p className="text-red-500 text-sm">데이터를 불러오는 중 오류가 발생했습니다.</p>}

                {!watchlist || watchlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-20">
                        <p className="text-gray-400 text-sm mb-4">등록된 관심종목이 없습니다.</p>
                        <Link href="/" className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold">인기 모멘텀주 구경하기</Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {watchlist.map((item: any) => (
                            <Link href={`/ticker/${item.symbol}`} key={item.id} className="block">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center hover:bg-gray-50 transition">
                                    <div>
                                        <h3 className="font-bold text-lg">{item.symbol}</h3>
                                        <p className="text-xs text-gray-500">
                                            {Array.isArray(item.tickers) ? item.tickers[0]?.company_name : item.tickers?.company_name}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">
                                            ${Array.isArray(item.tickers) ? item.tickers[0]?.last_price : item.tickers?.last_price}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {new Date(item.added_at).toISOString().split('T')[0]} 저장됨
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main >
    );
}
