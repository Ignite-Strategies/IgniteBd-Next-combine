'use client';

import { useState } from 'react';
import { Users, ChevronRight, BookOpen } from 'lucide-react';

// Content Components
function HowToIngestContent() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        How to Ingest Contacts
      </h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Step 1: Navigate to People
          </h3>
          <p className="text-gray-700 mb-4">
            First, hit the <strong>"People"</strong> icon in the sidebar
            navigation. This will take you to the People Hub where you can
            manage all your contacts.
          </p>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Step 2: Choose Your Ingestion Method
          </h3>
          <p className="text-gray-700 mb-4">
            Once you're on the People Hub, you'll see several options for
            importing contacts. For now, we'll review these two methods:
          </p>

          <div className="space-y-4 mt-4">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <h4 className="font-semibold text-blue-900 mb-2">
                Microsoft
              </h4>
              <p className="text-blue-800">
                Connect first, then you'll see the following import options
                available. Simply follow the prompts to sync your contacts from
                Microsoft.
              </p>
            </div>

            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
              <h4 className="font-semibold text-purple-900 mb-2">
                LinkedIn
              </h4>
              <p className="text-purple-800">
                Literally copy and paste the URL of a LinkedIn profile or search
                results page. The system will extract the contact information
                automatically.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Where Your Contacts Are Saved
          </h3>
          <p className="text-gray-700 mb-4">
            After importing your contacts, you can view and manage them by going
            back to <strong>"People"</strong> and hitting <strong>"Manage"</strong>. This will show you all your
            imported contacts in one place.
          </p>
        </div>
      </div>
    </div>
  );
}

const TUTORIAL_TOPICS = [
  {
    id: 'contact-management',
    title: 'Contact Management',
    sections: [
      {
        id: 'how-to-ingest',
        title: 'How to Ingest',
        component: HowToIngestContent,
      },
    ],
  },
];

export default function TutorialPage() {
  const [selectedTopic, setSelectedTopic] = useState(TUTORIAL_TOPICS[0].id);
  const [selectedSection, setSelectedSection] = useState(
    TUTORIAL_TOPICS[0].sections[0].id
  );

  const currentTopic = TUTORIAL_TOPICS.find((t) => t.id === selectedTopic);
  const currentSection = currentTopic?.sections.find(
    (s) => s.id === selectedSection
  );
  const ContentComponent = currentSection?.component;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Knowledge Hub
              </h1>
              <p className="text-sm text-gray-600">
                Learn how to get the most out of Ignite BD
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Left Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 sticky top-0 self-start max-h-screen overflow-y-auto">
          <nav className="p-4 space-y-2">
            {TUTORIAL_TOPICS.map((topic) => (
              <div key={topic.id} className="space-y-1">
                <button
                  onClick={() => {
                    setSelectedTopic(topic.id);
                    setSelectedSection(topic.sections[0].id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                    selectedTopic === topic.id
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{topic.title}</span>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        selectedTopic === topic.id ? 'rotate-90' : ''
                      }`}
                    />
                  </div>
                </button>

                {selectedTopic === topic.id && (
                  <div className="ml-4 space-y-1 mt-1">
                    {topic.sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setSelectedSection(section.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedSection === section.id
                            ? 'bg-red-100 text-red-800 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="max-w-4xl">
            {ContentComponent && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <ContentComponent />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

