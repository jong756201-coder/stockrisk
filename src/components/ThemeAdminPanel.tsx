'use client';

import { useState, useTransition } from 'react';
import { addThemeTicker, removeThemeTicker } from '@/app/(public)/themes/[id]/actions';

type PinnedTicker = {
  symbol: string;
  added_at: string;
};

type Props = {
  themeId: string;
  themeName: string;
  pinnedTickers: PinnedTicker[];
};

export default function ThemeAdminPanel({ themeId, themeName, pinnedTickers }: Props) {
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!input.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await addThemeTicker(themeId, input.trim());
      if (res.success) {
        setFeedback({ type: 'ok', msg: `${input.trim().toUpperCase()} 추가 완료` });
        setInput('');
      } else {
        setFeedback({ type: 'err', msg: res.error ?? '오류가 발생했습니다.' });
      }
    });
  };

  const handleRemove = (symbol: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await removeThemeTicker(themeId, symbol);
      if (res.success) {
        setFeedback({ type: 'ok', msg: `${symbol} 제거 완료` });
      } else {
        setFeedback({ type: 'err', msg: res.error ?? '오류가 발생했습니다.' });
      }
    });
  };

  return (
    <div className="mx-4 mb-5 bg-white border border-orange-200 rounded-2xl overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="bg-orange-50 px-4 py-3 flex items-center gap-2 border-b border-orange-100">
        <span className="text-[11px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full tracking-wider">ADMIN</span>
        <p className="text-[13px] font-bold text-gray-700">{themeName} 테마 종목 관리</p>
      </div>

      <div className="px-4 py-4">
        {/* 티커 추가 */}
        <p className="text-[11px] font-bold text-gray-400 mb-2 tracking-wider uppercase">종목 추가</p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="티커 입력 (예: AAPL)"
            className="flex-1 text-[13px] font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-orange-400 transition placeholder:font-normal placeholder:text-gray-300 tracking-widest"
            disabled={isPending}
          />
          <button
            onClick={handleAdd}
            disabled={isPending || !input.trim()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-[13px] font-black rounded-xl transition"
          >
            {isPending ? '...' : '추가'}
          </button>
        </div>

        {/* 피드백 메시지 */}
        {feedback && (
          <div className={`text-[12px] font-bold px-3 py-2 rounded-lg mb-3 ${feedback.type === 'ok' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {feedback.type === 'ok' ? '✓ ' : '✗ '}{feedback.msg}
          </div>
        )}

        {/* 고정된 종목 리스트 */}
        <p className="text-[11px] font-bold text-gray-400 mb-2 tracking-wider uppercase">
          고정된 종목 {pinnedTickers.length > 0 ? `(${pinnedTickers.length})` : ''}
        </p>
        {pinnedTickers.length > 0 ? (
          <div className="space-y-1.5">
            {pinnedTickers.map(t => (
              <div key={t.symbol} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded tracking-wide">{t.symbol}</span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(t.added_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 추가
                  </span>
                </div>
                <button
                  onClick={() => handleRemove(t.symbol)}
                  disabled={isPending}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 text-gray-400 transition text-[14px] leading-none"
                  aria-label={`${t.symbol} 제거`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-gray-300 py-2 text-center">수동 추가된 종목 없음</p>
        )}
      </div>
    </div>
  );
}
