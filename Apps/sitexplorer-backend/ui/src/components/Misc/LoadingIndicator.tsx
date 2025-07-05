export default function LoadingIndicator({ isLoading }: { isLoading: boolean }) {
    return (
        <>
            {isLoading && (
                <div className="loading-spinner">
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-lg">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                </div>
            )}
        </>
    )
}