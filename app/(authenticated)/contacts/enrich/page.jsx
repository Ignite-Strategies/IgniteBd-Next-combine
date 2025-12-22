'use client';

import Link from 'next/link';
import { FileSpreadsheet, Mail, User, Info } from 'lucide-react';

export default function EnrichHome() {
  const cards = [
    {
      title: 'Upload CSV',
      desc: 'Bulk enrich existing CRM contacts from a CSV file',
      icon: <FileSpreadsheet className="h-6 w-6" />,
      href: '/contacts/enrich/csv',
      iconColor: 'text-green-600',
    },
    {
      title: 'Microsoft Email',
      desc: 'Import contacts from Outlook and enrich them',
      icon: <Mail className="h-6 w-6" />,
      href: '/contacts/enrich/microsoft',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Existing CRM Contact',
      desc: 'Search your CRM and enrich a known contact',
      icon: <User className="h-6 w-6" />,
      href: '/contacts/enrich/existing',
      iconColor: 'text-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-4xl font-bold mb-4">✨ Enrich Existing Contacts</h1>
        <p className="text-gray-600 mb-8 text-lg">
          Deep dive on contacts you already have in your CRM. Get intelligence scores, company data, and more.
        </p>
        
        {/* Info banner */}
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-1">
              Looking to discover new contacts?
            </p>
            <p className="text-sm text-blue-700">
              Use <Link href="/contacts/enrich/linkedin" className="underline font-medium">Discover from LinkedIn</Link> to find people in your network and add them as contacts.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="p-6 rounded-xl shadow bg-white border hover:border-gray-300 transition group"
            >
              <div className={`${card.iconColor} mb-3`}>{card.icon}</div>
              <h3 className="font-semibold text-lg">{card.title}</h3>
              <p className="text-gray-600 text-sm">{card.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
