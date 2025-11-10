'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function CompanyCreateOrChoosePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <Image
            src="/logo.png"
            alt="Ignite Strategies"
            width={80}
            height={80}
            className="mx-auto mb-6 h-20 w-20 object-contain"
            priority
          />
          <h1 className="text-4xl font-bold text-white mb-4">Create Your Company</h1>
          <p className="text-white/80 text-lg">
            Set up your company profile to get started
          </p>
        </div>

        <div
          className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-6 border-2 border-white/30 hover:bg-white/15 transition-all cursor-pointer group mb-6 max-w-2xl mx-auto"
          onClick={() => router.push('/company/profile')}
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <span className="text-3xl">🏢</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">Create Your Company</h2>
            <p className="text-white/80 mb-6">
              We need to get your company set up in order to maximize the customer relationships possible that are driven by and through your company.
            </p>

            <button className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg transition-all hover:scale-105">
              Create Company →
            </button>
          </div>
        </div>

        <div className="text-center mb-6">
          <p className="text-white/60 text-sm mb-4">Already have a company invite?</p>
          <button
            onClick={() => router.push('/joincompany')}
            className="text-white/80 hover:text-white transition underline text-sm"
          >
            Join existing company with invite code
          </button>
          <p className="text-white/50 text-xs mt-2">
            Team members receive a link with invite code via email
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push('/growth-dashboard')}
            className="text-white/60 hover:text-white transition text-sm underline"
          >
            Go straight to dashboard
          </button>
          <p className="text-white/40 text-xs mt-1 italic">
            (You&apos;ll need to set up your company to start using the tools and services of the platform)
          </p>
        </div>
      </div>
    </div>
  );
}

