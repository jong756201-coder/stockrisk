export default function AdminDashboardPage() {
    return (
        <main className="min-h-screen max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-gray-500 text-sm font-semibold mb-2">오늘 수집된 이벤트</h2>
                    <p className="text-3xl font-black">1,245</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-gray-500 text-sm font-semibold mb-2">파싱된 리스크 카드</h2>
                    <p className="text-3xl font-black">84</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-gray-500 text-sm font-semibold mb-2">보류중인 검수</h2>
                    <p className="text-3xl font-black text-red-500">12</p>
                </div>
            </div>
        </main>
    );
}
