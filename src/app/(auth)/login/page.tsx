'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const supabase = createClient();

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/api/auth/callback`,
            },
        });
        if (error) {
            setError('Google 로그인 중 오류가 발생했습니다: ' + error.message);
            setLoading(false);
        }
        // 성공 시 Google 페이지로 리디렉션되므로 loading 유지
    };

    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col items-center justify-center p-6 relative">
            <Link
                href="/"
                className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
                aria-label="뒤로가기"
            >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </Link>

            <div className="w-full bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                {/* 로고/타이틀 */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black tracking-tight mb-2">시작하기</h1>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        로그인하고 관심 종목을 저장하세요.
                    </p>
                </div>

                {/* Google 로그인 버튼 */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {/* Google SVG 아이콘 */}
                    <svg width="20" height="20" viewBox="0 0 48 48" className="flex-shrink-0">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    <span className="text-[14px] font-bold text-gray-700">
                        {loading ? '연결 중...' : 'Google로 계속하기'}
                    </span>
                </button>

                {error && (
                    <div className="mt-4 p-3 text-sm rounded-lg font-medium text-center bg-red-50 text-red-700">
                        {error}
                    </div>
                )}

                <p className="mt-6 text-[11px] text-gray-400 text-center leading-relaxed">
                    로그인하면 <span className="font-bold">이용약관</span> 및 <span className="font-bold">개인정보처리방침</span>에<br />동의하는 것으로 간주됩니다.
                </p>
            </div>
        </main>
    );
}
