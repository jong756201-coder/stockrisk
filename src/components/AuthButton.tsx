'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';

export default function AuthButton() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        // getSession()은 로컬 스토리지/쿠키에서 바로 읽음 (네트워크 검증 없음)
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // 로그인/로그아웃/토큰 갱신 이벤트 감지
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setMenuOpen(false);
    };

    if (loading) return null;

    if (!user) {
        return (
            <Link
                href="/login"
                className="text-[11px] font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:border-gray-400 transition-colors flex-shrink-0"
            >
                로그인
            </Link>
        );
    }

    // 로그인된 상태 — 아바타 + 드롭다운
    const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
    const name = (user.user_metadata?.name ?? user.email ?? '').toString();
    const initial = name.charAt(0).toUpperCase();

    return (
        <div className="relative flex-shrink-0">
            <button
                onClick={() => setMenuOpen(v => !v)}
                className="w-7 h-7 rounded-full overflow-hidden border-2 border-gray-200 hover:border-gray-400 transition-colors flex-shrink-0"
                aria-label="내 계정"
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                    <span className="w-full h-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center">
                        {initial}
                    </span>
                )}
            </button>

            {menuOpen && (
                <>
                    {/* 배경 딤 */}
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    {/* 드롭다운 */}
                    <div className="absolute right-0 top-full mt-2 z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-[12px] font-black text-gray-800 truncate">{name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                        </div>
                        <Link
                            href="/watchlist"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            ⭐ 관심 종목
                        </Link>
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100"
                        >
                            로그아웃
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
