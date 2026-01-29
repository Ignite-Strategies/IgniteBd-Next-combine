import Image from 'next/image';

/**
 * Loading state for bill page - shows Ignite logo while fetching bill
 * Matches invoice style with gray background
 */
export default function BillLoading() {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 flex items-center justify-center">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-2xl overflow-hidden w-full">
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="Ignite Strategies"
              width={60}
              height={60}
              className="h-12 w-12 object-contain bg-white rounded-lg p-1 animate-pulse"
              priority
            />
            <div>
              <h1 className="text-2xl font-bold text-white">Ignite Strategies LLC</h1>
              <p className="text-red-100 text-sm">Loading invoice...</p>
            </div>
          </div>
        </div>
        <div className="px-8 py-12 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
