export default async function CommunityPage({
    params,
}: {
    params: Promise<{ symbol: string }>;
}) {
    const { symbol } = await params;

    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col p-4">
            <header className="mb-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-xl font-bold">{symbol.toUpperCase()} 실시간 토론장</h1>
                <p className="text-xs text-gray-500">이 기능은 현재 MVP에서 활성화되지 않았습니다.</p>
            </header>

            <div className="flex-1 flex flex-col justify-end bg-gray-100 rounded-xl p-4 opacity-50 relative pointer-events-none">
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full">Coming Soon</span>
                </div>
                <div className="bg-white p-3 rounded-lg mb-2 mr-10 shadow-sm text-sm">여기에 실시간 유저 채팅이 표시됩니다.</div>
                <div className="bg-blue-100 p-3 rounded-lg self-end ml-10 shadow-sm text-sm">상폐 빔 가즈아!</div>
            </div>
        </main>
    );
}
