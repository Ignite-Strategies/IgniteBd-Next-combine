'use client';

import { useState } from 'react';
import { 
  Users, 
  ChevronRight, 
  BookOpen, 
  TrendingUp,
  UserCircle,
  Package,
  MessageSquare,
  GitBranch,
  Building2,
  FileText,
  Calendar,
  Settings,
  FileCode,
  Plus,
  Mail,
  ArrowRight,
} from 'lucide-react';

// Content Components
function OrientationContent({ onNavigateToContactManagement }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to Ignite BD
        </h2>
        <p className="text-lg text-gray-700 mb-6">
          This orientation serves to help you on your journey to growth.
        </p>
      </div>

      {/* The Dashboard */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-800">
          The Dashboard
        </h3>
        <p className="text-gray-700 mb-4">
          The Dashboard is your command center for business development. It provides quick
          access to your most important actions and key metrics at a glance.
        </p>

        {/* Visual Dashboard Representation */}
        <div className="mt-6 border-2 border-gray-200 rounded-xl bg-white p-6 shadow-lg">
          <div className="mb-6 rounded-2xl bg-white p-6 border border-gray-200">
            <h4 className="text-2xl font-bold text-gray-900 mb-2">
              Your Company Growth Dashboard
            </h4>
            <p className="text-gray-600">
              Your command center for business development
            </p>
          </div>

          {/* Quick Actions Visual */}
          <div className="mb-6 rounded-xl bg-white p-4 border border-gray-200">
            <h5 className="text-lg font-semibold text-gray-900 mb-2">
              Quick Actions
            </h5>
            <p className="text-sm text-gray-600 mb-4">
              Here in the middle are two user options that we have selected to be your most
              "go to" actions. <strong>When in doubt, look to the center.</strong>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Upload Contacts</div>
                  <div className="text-sm text-gray-600">
                    Choose how to add contacts: CSV, LinkedIn, Microsoft, or manual
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Send Email</div>
                  <div className="text-sm text-gray-600">
                    Compose and send emails to your contacts
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Visual */}
          <div className="rounded-xl bg-white p-4 border border-gray-200">
            <h5 className="text-lg font-semibold text-gray-900 mb-2">
              Dashboard Metrics
            </h5>
            <p className="text-sm text-gray-600 mb-4">
              We list your number of contacts so you can set goals and track your progress.
              As we develop the platform, we will provide more useful metrics based on your
              personal growth goals.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-indigo-100">
                <Users className="h-8 w-8 text-indigo-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">Total Contacts</div>
                <div className="text-3xl font-bold text-gray-900">1,234</div>
                <div className="text-xs text-gray-500 mt-1">Company-scoped count</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Left Side Nav Bar */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-800">
          Left Side Navigation Bar
        </h3>
        <p className="text-gray-700">
          The left side navigation bar contains all the important things you need to do
          and think about for business development. We've separated functionality into
          4 distinct categories to help you navigate efficiently.
        </p>

        {/* Visual Sidebar Representation */}
        <div className="mt-6 w-64 bg-white border-2 border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <span className="text-lg font-semibold text-gray-900">
                Ignite BD
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-6">
            {/* Dashboard */}
            <div>
              <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium border border-red-200 bg-red-50 text-red-700">
                <TrendingUp className="h-5 w-5" />
                <span>Growth Dashboard</span>
              </div>
            </div>

            {/* Growth Ops */}
            <div>
              <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Growth Ops
              </h6>
              <ul className="space-y-1">
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <UserCircle className="h-5 w-5" />
                  <span>Personas</span>
                </li>
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <Package className="h-5 w-5" />
                  <span>Products</span>
                </li>
              </ul>
            </div>

            {/* Engage */}
            <div>
              <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Engage
              </h6>
              <ul className="space-y-1">
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <Users className="h-5 w-5" />
                  <span>People</span>
                </li>
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <MessageSquare className="h-5 w-5" />
                  <span>Outreach</span>
                </li>
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <FileCode className="h-5 w-5" />
                  <span>Templates</span>
                </li>
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <GitBranch className="h-5 w-5" />
                  <span>Pipeline</span>
                </li>
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <Building2 className="h-5 w-5" />
                  <span>Company Hub</span>
                </li>
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <Calendar className="h-5 w-5" />
                  <span>Meetings</span>
                </li>
              </ul>
            </div>

            {/* Attract */}
            <div>
              <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Attract
              </h6>
              <ul className="space-y-1">
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <FileText className="h-5 w-5" />
                  <span>Content</span>
                </li>
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <Calendar className="h-5 w-5" />
                  <span>Events</span>
                </li>
              </ul>
            </div>

            {/* Settings */}
            <div>
              <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Settings
              </h6>
              <ul className="space-y-1">
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <Settings className="h-5 w-5" />
                  <span>Settings</span>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </div>

      {/* Four Categories Details */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-800">
          The 4 Distinct Categories
        </h3>
        <p className="text-gray-700 mb-4">
          Here's what each category is designed for:
        </p>

        <div className="space-y-4">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <h4 className="font-semibold text-blue-900 mb-2">
              1. Growth Ops
            </h4>
            <p className="text-blue-800 text-sm">
              Foundation and strategy tools. Define your personas, products, and
              build your BD intelligence. This is where you set up the core elements
              that drive your business development strategy.
            </p>
            <ul className="mt-2 text-sm text-blue-800 list-disc list-inside">
              <li>Personas - Define your target audience</li>
              <li>Products - Catalog your offerings</li>
            </ul>
          </div>

          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
            <h4 className="font-semibold text-purple-900 mb-2">
              2. Engage
            </h4>
            <p className="text-purple-800 text-sm">
              Outreach and engagement tools. Manage your contacts, send emails,
              create templates, track pipelines, and schedule meetings. This is
              where you actively engage with prospects and clients.
            </p>
            <ul className="mt-2 text-sm text-purple-800 list-disc list-inside">
              <li>People - Manage contacts and lists</li>
              <li>Outreach - Email campaigns and messaging</li>
              <li>Templates - Reusable email templates</li>
              <li>Pipeline - Deal and opportunity tracking</li>
              <li>Company Hub - Company information and insights</li>
              <li>Meetings - Schedule and manage meetings</li>
            </ul>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <h4 className="font-semibold text-green-900 mb-2">
              3. Attract
            </h4>
            <p className="text-green-800 text-sm">
              Marketing and content tools. Create content, manage events, and
              attract prospects through valuable resources and experiences.
            </p>
            <ul className="mt-2 text-sm text-green-800 list-disc list-inside">
              <li>Content - Create articles, presentations, and assets</li>
              <li>Events - Manage conferences, webinars, and networking events</li>
            </ul>
          </div>

          <div className="bg-gray-50 border-l-4 border-gray-500 p-4 rounded">
            <h4 className="font-semibold text-gray-900 mb-2">
              4. Settings
            </h4>
            <p className="text-gray-800 text-sm">
              Configure your workspace, manage integrations, and customize your
              Ignite BD experience.
            </p>
          </div>
        </div>
      </div>

      {/* Next Steps Link */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={onNavigateToContactManagement}
          className="group flex items-center gap-3 w-full md:w-auto px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-md hover:shadow-lg"
        >
          <span>Learn More About Contact Management</span>
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}

function HowToIngestContent() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        How to Ingest Contacts
      </h2>

      {/* Quick Action Reminder */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
        <p className="text-blue-900 text-sm mb-3">
          <strong>Quick Tip:</strong> Remember the <strong>"Upload Contacts"</strong> quick action
          from your Dashboard? That's one of your go-to options we discussed earlier. You can
          access contact management either through that dashboard button or via the sidebar navigation.
        </p>
        {/* Visual reminder of dashboard quick action */}
        <div className="mt-3 flex items-center gap-4 rounded-lg border-2 border-blue-200 bg-white p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
            <Plus className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">Upload Contacts</div>
            <div className="text-xs text-gray-600">
              Quick action from Dashboard
            </div>
          </div>
        </div>
      </div>

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

          {/* Visual Sidebar with People Icon Highlighted */}
          <div className="mt-4 w-64 bg-white border-2 border-gray-200 rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <span className="text-lg font-semibold text-gray-900">
                  Ignite BD
                </span>
              </div>
            </div>

            <nav className="p-4 space-y-6">
              {/* Dashboard */}
              <div>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  <TrendingUp className="h-5 w-5" />
                  <span>Growth Dashboard</span>
                </div>
              </div>

              {/* Growth Ops */}
              <div>
                <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Growth Ops
                </h6>
                <ul className="space-y-1">
                  <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                    <UserCircle className="h-5 w-5" />
                    <span>Personas</span>
                  </li>
                  <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                    <Package className="h-5 w-5" />
                    <span>Products</span>
                  </li>
                </ul>
              </div>

              {/* Engage - with People highlighted */}
              <div>
                <h6 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Engage
                </h6>
                <ul className="space-y-1">
                  <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium border-2 border-red-300 bg-red-50 text-red-700">
                    <Users className="h-5 w-5" />
                    <span>People</span>
                  </li>
                  <li className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                    <MessageSquare className="h-5 w-5" />
                    <span>Outreach</span>
                  </li>
                </ul>
              </div>
            </nav>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Step 2: Connect to Microsoft
          </h3>
          <p className="text-gray-700 mb-4">
            Once you're on the Microsoft import page, you'll first need to connect your Microsoft account.
            Look for the <strong>"Connect to Microsoft"</strong> button in the top right corner of the page.
          </p>

          {/* Visual Connect Button */}
          <div className="mt-4 mb-6 bg-white border-2 border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-500">Top Right Corner</div>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm">
                <Mail className="h-4 w-4" />
                Connect to Microsoft
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Click this button to authenticate with your Microsoft account. You'll be redirected
              to Microsoft's login page, then brought back to continue.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Step 3: Choose Your Import Source
          </h3>
          <p className="text-gray-700 mb-4">
            After connecting, you'll see two cards to choose from. These represent the two ways
            you can import contacts from Microsoft:
          </p>

          {/* Visual Two Cards */}
          <div className="mt-4 grid md:grid-cols-2 gap-6 max-w-3xl">
            {/* From Email Card */}
            <div className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">Ingest from Emails</h4>
                  <p className="text-sm text-gray-500">Extract contacts from people you email</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                <strong>From Email Messages:</strong> Scans your recent Outlook emails (up to 200 messages)
                to extract unique contacts from people you've emailed. Automatically filters out automated
                emails and business services.
              </p>
            </div>

            {/* From Contacts Card */}
            <div className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-lg bg-purple-500 flex items-center justify-center">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">Ingest from Contacts</h4>
                  <p className="text-sm text-gray-500">Import from Microsoft Contacts</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                <strong>From Contacts Address Book:</strong> Imports contacts directly from your Microsoft
                Contacts (saved in your address book). Includes company names and job titles when available.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Alternative: LinkedIn Import
          </h3>
          <p className="text-gray-700 mb-4">
            For LinkedIn, you don't need to connect an account. Simply copy and paste the URL of a
            LinkedIn profile or search results page, and the system will extract the contact information
            automatically.
          </p>
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
    id: 'orientation',
    title: 'Orientation',
    sections: [
      {
        id: 'welcome',
        title: 'Welcome & Overview',
        component: OrientationContent,
      },
    ],
  },
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

  // Navigation handler for Orientation content
  const handleNavigateToContactManagement = () => {
    setSelectedTopic('contact-management');
    setSelectedSection('how-to-ingest');
  };

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
                {selectedSection === 'welcome' ? (
                  <ContentComponent onNavigateToContactManagement={handleNavigateToContactManagement} />
                ) : (
                  <ContentComponent />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

