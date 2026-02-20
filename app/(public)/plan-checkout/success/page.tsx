export default function PlanCheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          Payment successful
        </h1>
        <p className="text-sm text-gray-600">
          Thank you. Your subscription is now active.
        </p>
      </div>
    </div>
  );
}
