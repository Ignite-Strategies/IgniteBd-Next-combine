'use client';

import { useState } from 'react';
import { hydrateTemplate, getDefaultVariableValues } from '@/lib/templateVariables';

/**
 * Demo component showing how to hydrate templates with contact data
 * This can be used in the UI when sending emails to contacts
 */
export default function TemplateHydrationDemo({ template }) {
  const [contactData, setContactData] = useState({
    firstName: 'Sarah',
    lastName: 'Johnson',
    companyName: 'TechCorp',
    title: 'VP of Engineering',
    lastContactDate: '2022-06-15',
  });

  const [metadata, setMetadata] = useState({
    myBusinessName: 'Ignite Growth Partners',
    myRole: 'Joel',
    timeHorizon: '2026',
    desiredOutcome: 'see if we can collaborate and get some NDA work',
    knowledgeOfBusiness: false,
  });

  const [hydratedContent, setHydratedContent] = useState('');

  const handleHydrate = () => {
    const result = hydrateTemplate(template, contactData, metadata);
    setHydratedContent(result);
  };

  const handleReset = () => {
    const defaults = getDefaultVariableValues();
    setContactData({
      firstName: defaults.firstName,
      lastName: defaults.lastName,
      companyName: defaults.companyName,
      title: defaults.title,
      lastContactDate: '2022-06-15',
    });
    setMetadata({
      myBusinessName: defaults.myBusinessName,
      myRole: defaults.myRole,
      timeHorizon: defaults.timeHorizon,
      desiredOutcome: defaults.desiredOutcome,
      knowledgeOfBusiness: false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Template Preview */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Template</h3>
        <div className="rounded-md bg-gray-50 p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap">
          {template}
        </div>
      </div>

      {/* Contact Data Inputs */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Contact Data</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">First Name</label>
            <input
              type="text"
              value={contactData.firstName}
              onChange={(e) => setContactData({ ...contactData, firstName: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Name</label>
            <input
              type="text"
              value={contactData.lastName}
              onChange={(e) => setContactData({ ...contactData, lastName: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Company Name</label>
            <input
              type="text"
              value={contactData.companyName}
              onChange={(e) => setContactData({ ...contactData, companyName: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={contactData.title}
              onChange={(e) => setContactData({ ...contactData, title: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Contact Date</label>
            <input
              type="date"
              value={contactData.lastContactDate}
              onChange={(e) => setContactData({ ...contactData, lastContactDate: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Metadata Inputs */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Context & Metadata</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">My Business Name</label>
            <input
              type="text"
              value={metadata.myBusinessName}
              onChange={(e) => setMetadata({ ...metadata, myBusinessName: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">My Role/Name</label>
            <input
              type="text"
              value={metadata.myRole}
              onChange={(e) => setMetadata({ ...metadata, myRole: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Time Horizon</label>
            <input
              type="text"
              value={metadata.timeHorizon}
              onChange={(e) => setMetadata({ ...metadata, timeHorizon: e.target.value })}
              placeholder="e.g., 2026, Q1 2025"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Desired Outcome</label>
            <input
              type="text"
              value={metadata.desiredOutcome}
              onChange={(e) => setMetadata({ ...metadata, desiredOutcome: e.target.value })}
              placeholder="e.g., see if we can collaborate"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={metadata.knowledgeOfBusiness}
                onChange={(e) => setMetadata({ ...metadata, knowledgeOfBusiness: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">They know about my business</span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleHydrate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          Hydrate Template
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Hydrated Output */}
      {hydratedContent && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-green-900">Hydrated Email</h3>
          <div className="rounded-md bg-white p-4 text-sm text-gray-800 whitespace-pre-wrap">
            {hydratedContent}
          </div>
        </div>
      )}
    </div>
  );
}
