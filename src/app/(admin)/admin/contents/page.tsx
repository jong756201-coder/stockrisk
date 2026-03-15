export default function AdminContentsPage() {
    return (
        <main className="min-h-screen max-w-4xl mx-auto p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Evidence 검수 (Contents Moderation)</h1>
                <button className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold">모두 승인</button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-sm">
                        <tr>
                            <th className="p-4 font-normal">종목</th>
                            <th className="p-4 font-normal">카테고리</th>
                            <th className="p-4 font-normal">헤드라인 및 리스크 팩터</th>
                            <th className="p-4 font-normal">액션</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        <tr>
                            <td className="p-4 font-bold">NKLA</td>
                            <td className="p-4 text-sm"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">Rumor</span></td>
                            <td className="p-4">
                                <p className="font-bold text-sm mb-1">X발 루머 찌라시 확산</p>
                                <p className="text-xs text-gray-500 line-clamp-2">출처 불분명한 익명 계정의 공급계약 체결 루머. 교차 검증된 공시 없음.</p>
                            </td>
                            <td className="p-4 text-sm font-medium">
                                <button className="text-blue-600 hover:text-blue-800 mr-3">승인</button>
                                <button className="text-red-500 hover:text-red-700">Hide</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </main>
    );
}
