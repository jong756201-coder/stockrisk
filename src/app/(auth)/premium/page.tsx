export default function PremiumPage() {
    return (
        <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 w-full">
                <h1 className="text-xl font-bold mb-2">프리미엄 통계 언락</h1>
                <p className="text-sm text-gray-500 mb-6">
                    기관 매집 시그널 및 상세 SEC 공시 AI 심층 요약본은 프리미엄 멤버에게 향후 제공될 예정입니다.
                </p>
                <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg cursor-not-allowed opacity-50">
                    Coming Soon
                </button>
            </div>
        </main>
    );
}
