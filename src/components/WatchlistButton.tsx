'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

/**
 * 하트 아이콘 형태의 관심종목 버튼.
 * 헤더 오른쪽 최상단에 위치.
 */
export default function WatchlistButton({ symbol }: { symbol: string }) {
    const [isSaved, setIsSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        async function checkStatus() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { setLoading(false); return; }

            const { data } = await supabase
                .from('watchlists')
                .select('id')
                .eq('user_id', session.user.id)
                .eq('symbol', symbol)
                .single();

            if (data) setIsSaved(true);
            setLoading(false);
        }
        checkStatus();
    }, [symbol, supabase]);

    const toggleWatchlist = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/login'); return; }

        setLoading(true);
        if (isSaved) {
            await supabase.from('watchlists').delete()
                .eq('user_id', session.user.id).eq('symbol', symbol);
            setIsSaved(false);
        } else {
            await supabase.from('watchlists').insert([{ user_id: session.user.id, symbol }]);
            setIsSaved(true);
        }
        setLoading(false);
    };

    return (
        <button
            onClick={toggleWatchlist}
            disabled={loading}
            aria-label={isSaved ? '관심종목 해제' : '관심종목 추가'}
            className={`
                w-10 h-10 flex items-center justify-center rounded-full border transition-all
                ${isSaved
                    ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                    : 'bg-white border-gray-200 text-gray-300 hover:text-red-400 hover:border-red-200'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-90'}
            `}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-5 h-5 transition-all"
                fill={isSaved ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={isSaved ? 0 : 2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                />
            </svg>
        </button>
    );
}
