'use client';

import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FmpChartPoint } from '@/lib/api/fmp';

export default function NativeChart({ data }: { data: FmpChartPoint[] }) {
    if (!data || data.length === 0) {
        return <div className="h-[250px] flex items-center justify-center text-gray-400 text-xs bg-gray-50 rounded-xl border border-gray-100">차트 데이터를 불러올 수 없습니다.</div>;
    }

    // FMP returns newest data first. Reverse it for chronological order (left to right).
    const chronologicalData = [...data].reverse();

    // Determine color based on first vs last point in this window
    const startPrice = chronologicalData[0]?.close || 0;
    const endPrice = chronologicalData[chronologicalData.length - 1]?.close || 0;

    // Korean market style: Red = Up, Blue = Down
    const isPositive = endPrice >= startPrice;
    const strokeColor = isPositive ? '#ef4444' : '#3b82f6'; // red-500 : blue-500

    const chartData = chronologicalData.map((d) => {
        // 일봉: "YYYY-MM-DD" → "MM/DD" 표시
        const parts = d.date.split('-');
        const shortDate = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : d.date;

        return {
            time: shortDate,
            price: d.close,
        };
    });

    const minPrice = Math.min(...chartData.map(d => d.price));
    const maxPrice = Math.max(...chartData.map(d => d.price));
    // Add 10% vertical padding so the line doesn't hit the very top/bottom perfectly
    const padding = (maxPrice - minPrice) * 0.1 || minPrice * 0.05;

    return (
        <div className="h-[280px] w-full" style={{ WebkitUserSelect: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <YAxis
                        domain={[minPrice - padding, maxPrice + padding]}
                        hide={true}
                    />
                    <Tooltip
                        contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #f3f4f6',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                            padding: '10px 14px'
                        }}
                        itemStyle={{ color: '#111827', fontWeight: '900', fontSize: '16px' }}
                        labelStyle={{ color: '#9ca3af', fontSize: '11px', fontWeight: 'bold', marginBottom: '2px' }}
                        formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Price']}
                        labelFormatter={(label) => `${label}`}
                        isAnimationActive={false}
                    />
                    <Area
                        type="monotone"
                        dataKey="price"
                        stroke={strokeColor}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                        isAnimationActive={true}
                        animationDuration={800}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
