import Image from 'next/image';

/**
 * Loading state for bill page - shows Ignite logo while fetching bill
 */
export default function BillLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <Image
          src="/logo.png"
          alt="Ignite Strategies"
          width={100}
          height={100}
          className="mx-auto h-24 w-24 object-contain animate-pulse"
          priority
        />
        <h1 className="text-2xl font-bold text-white">Getting your bill...</h1>
      </div>
    </div>
  );
}
