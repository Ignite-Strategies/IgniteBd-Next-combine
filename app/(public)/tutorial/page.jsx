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
  Sparkles,
  FileSpreadsheet,
  User,
  Upload,
  List,
  Edit2,
  Trash2,
  Phone,
  Save,
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
            Step 2: Choose Your Ingestion Method
          </h3>
          <p className="text-gray-700 mb-6">
            Here are all the ways you can add contacts to Ignite BD. Each method has its own benefits
            depending on your needs:
          </p>

          {/* All Methods Overview */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* Microsoft */}
            <div className="p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 bg-[#F25022]"></div>
                  <div className="w-3 h-3 bg-[#7FBA00]"></div>
                  <div className="w-3 h-3 bg-[#00A4EF]"></div>
                  <div className="w-3 h-3 bg-[#FFB900]"></div>
                </div>
                <h4 className="font-semibold text-gray-900">Import from Microsoft</h4>
              </div>
              <p className="text-sm text-gray-700">From emails or contacts address book</p>
            </div>

            {/* LinkedIn */}
            <div className="p-4 border-2 border-purple-200 rounded-lg bg-purple-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-6 h-6 bg-[#0077B5] rounded flex items-center justify-center">
                  <span className="text-white font-bold text-xs">in</span>
                </div>
                <h4 className="font-semibold text-gray-900">Enrich with LinkedIn</h4>
              </div>
              <p className="text-sm text-gray-700">Copy and paste LinkedIn URLs</p>
            </div>

            {/* CSV */}
            <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
              <div className="flex items-center gap-3 mb-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Upload CSV</h4>
              </div>
              <p className="text-sm text-gray-700">Bulk import from spreadsheet</p>
            </div>

            {/* Manual */}
            <div className="p-4 border-2 border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center gap-3 mb-2">
                <User className="h-5 w-5 text-gray-600" />
                <h4 className="font-semibold text-gray-900">Add Manually</h4>
              </div>
              <p className="text-sm text-gray-700">Enter one contact at a time</p>
            </div>
          </div>
        </div>

        {/* Microsoft Details */}
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Microsoft Import
          </h3>
          <p className="text-gray-700 mb-4">
            First, connect your Microsoft account using the <strong>"Connect to Microsoft"</strong> button
            in the top right corner. After connecting, you'll see two options:
          </p>

          {/* Connect Button Visual */}
          <div className="mb-6 bg-white border-2 border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-500">Top Right Corner</div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg font-medium text-sm">
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 bg-[#F25022]"></div>
                  <div className="w-3 h-3 bg-[#7FBA00]"></div>
                  <div className="w-3 h-3 bg-[#00A4EF]"></div>
                  <div className="w-3 h-3 bg-[#FFB900]"></div>
                </div>
                <span>Connect to Microsoft</span>
              </button>
            </div>
          </div>

          {/* Two Source Options */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="p-4 border-2 border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Mail className="h-6 w-6 text-blue-600" />
                <h4 className="font-semibold text-gray-900">From Emails</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Scans your recent Outlook emails (up to 200) to extract unique contacts from people you've emailed.
              </p>
            </div>

            <div className="p-4 border-2 border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Users className="h-6 w-6 text-purple-600" />
                <h4 className="font-semibold text-gray-900">From Contacts</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Imports directly from your Microsoft Contacts address book with company names and job titles.
              </p>
            </div>
          </div>

          {/* Selection Example */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-4">
            <p className="text-sm text-blue-900 font-semibold mb-2">
              ⚠️ Important: You Choose What to Save
            </p>
            <p className="text-sm text-blue-800">
              After selecting a source, you'll see a preview list of all available contacts. 
              <strong> It's up to you to select which contacts are relevant to save.</strong> Use the checkboxes
              to choose individual contacts or "Select All" to choose everything.
            </p>
          </div>

          {/* Email Selection Example */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-800 mb-3">Example: Email Selection</h4>
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 border border-gray-200 rounded hover:bg-blue-50">
                  <input type="checkbox" checked className="h-4 w-4 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">John Doe</div>
                    <div className="text-xs text-gray-500">john.doe@example.com</div>
                  </div>
                  <div className="text-xs text-gray-500">Dec 15</div>
                </div>
                <div className="flex items-center gap-3 p-2 border border-gray-200 rounded hover:bg-blue-50">
                  <input type="checkbox" className="h-4 w-4 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Jane Smith</div>
                    <div className="text-xs text-gray-500">jane@company.com</div>
                  </div>
                  <div className="text-xs text-gray-500">Nov 28</div>
                </div>
                <div className="flex items-center gap-3 p-2 border border-gray-200 rounded hover:bg-blue-50">
                  <input type="checkbox" checked className="h-4 w-4 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Bob Johnson</div>
                    <div className="text-xs text-gray-500">bob@client.com</div>
                  </div>
                  <div className="text-xs text-gray-500">Dec 10</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-600">2 of 3 selected</span>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                  Save Selected Contacts
                </button>
              </div>
            </div>
          </div>

          {/* Contacts Selection Example */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-800 mb-3">Example: Contacts Selection</h4>
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 border border-gray-200 rounded hover:bg-purple-50">
                  <input type="checkbox" checked className="h-4 w-4 text-purple-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Sarah Williams</div>
                    <div className="text-xs text-gray-500">sarah@partner.com • VP of Sales</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 border border-gray-200 rounded hover:bg-purple-50">
                  <input type="checkbox" className="h-4 w-4 text-purple-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Mike Chen</div>
                    <div className="text-xs text-gray-500">mike@vendor.com • Director</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm text-gray-600">1 of 2 selected</span>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium">
                  Save Selected Contacts
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* LinkedIn Details */}
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            LinkedIn Enrichment
          </h3>
          <p className="text-gray-700 mb-4">
            No account connection needed! Here's how it works step by step:
          </p>

          {/* Step-by-step LinkedIn Flow */}
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Step 1: Paste the LinkedIn URL</h4>
              <p className="text-sm text-gray-700 mb-3">
                Copy and paste a LinkedIn profile URL or search results page URL into the input field.
              </p>
              <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value="https://linkedin.com/in/john-doe"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                    disabled
                  />
                  <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium">
                    Get Contact Info
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Step 2: Review Extracted Information</h4>
              <p className="text-sm text-gray-700 mb-3">
                The system will extract the contact's name, email, title, company, and other information.
                Review the information to confirm it's correct.
              </p>
              <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                <div className="mb-4">
                  <h5 className="font-semibold text-gray-900 mb-3">Contact Info</h5>
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-900 text-lg">John Doe</p>
                    <p className="text-sm text-gray-700"><strong>Title:</strong> VP of Sales</p>
                    <p className="text-sm text-gray-700"><strong>Email:</strong> john.doe@example.com</p>
                    <p className="text-sm text-gray-700"><strong>Company:</strong> Acme Corp</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Step 3: Save the Contact</h4>
              <p className="text-sm text-gray-700 mb-3">
                Once you've confirmed the information is correct, click the <strong>"Save Contact"</strong> button
                to add them to your database.
              </p>
              <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                <button className="w-full bg-green-600 text-white px-6 py-4 rounded-lg flex items-center justify-center gap-2 font-semibold">
                  <Save className="h-5 w-5" />
                  Save Contact
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CSV Details */}
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            CSV Upload
          </h3>
          <p className="text-gray-700 mb-4">
            Perfect for bulk imports. Export your contacts from any system (Excel, Google Sheets, CRM, etc.)
            as a CSV file, then upload it directly.
          </p>
          <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50 max-w-md">
            <div className="flex items-center gap-3 mb-2">
              <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              <h4 className="font-semibold text-gray-900">Upload CSV</h4>
            </div>
            <p className="text-sm text-gray-700">
              Bulk import contacts from a CSV file. Make sure your CSV has columns for name, email, company, etc.
            </p>
          </div>
        </div>

        {/* Manual Details */}
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Manual Entry
          </h3>
          <p className="text-gray-700 mb-4">
            Need to add just one contact quickly? Use manual entry for a simple, straightforward form.
          </p>
          <div className="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 max-w-md">
            <div className="flex items-center gap-3 mb-2">
              <User className="h-6 w-6 text-gray-600" />
              <h4 className="font-semibold text-gray-900">Add Manually</h4>
            </div>
            <p className="text-sm text-gray-700">
              Enter a single contact one at a time (name, email, company, etc.)
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

function ManagingContactsContent() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Managing Your Contacts
      </h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Accessing Your Contacts
          </h3>
          <p className="text-gray-700 mb-4">
            After importing your contacts, you can view and manage them by going
            back to <strong>"People"</strong> and clicking the <strong>"Manage"</strong> button.
            This will show you all your imported contacts in one place.
          </p>

          {/* Visual People Hub with Manage button */}
          <div className="mt-4 bg-white border-2 border-gray-200 rounded-lg p-6">
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">👥 People Hub</h4>
              <p className="text-sm text-gray-600 mb-4">Manage your contacts and prepare for outreach.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center gap-3 mb-2">
                  <Upload className="h-6 w-6 text-blue-600" />
                  <h5 className="font-semibold text-gray-900">Load Up</h5>
                </div>
                <p className="text-sm text-gray-700">Get people into Ignite BD</p>
              </div>
              <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50 border-green-300">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-6 w-6 text-green-600" />
                  <h5 className="font-semibold text-gray-900">Manage</h5>
                </div>
                <p className="text-sm text-gray-700">View all contacts and filter by deal stage</p>
              </div>
              <div className="p-4 border-2 border-purple-200 rounded-lg bg-purple-50">
                <div className="flex items-center gap-3 mb-2">
                  <List className="h-6 w-6 text-purple-600" />
                  <h5 className="font-semibold text-gray-900">Outreach Prep</h5>
                </div>
                <p className="text-sm text-gray-700">Build or select contact lists for outreach</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            The Contacts List
          </h3>
          <p className="text-gray-700 mb-4">
            The Manage page shows all your contacts in a searchable, filterable list. You can
            search by name, email, or company, and filter by pipeline stage.
          </p>

          {/* Visual Contacts List */}
          <div className="mt-4 bg-white border-2 border-gray-200 rounded-lg p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">👥 All Contacts</h4>
                <p className="text-sm text-gray-600">12 contacts • 10 total</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search contacts..."
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  disabled
                />
                <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" disabled>
                  <option>All Pipelines</option>
                  <option>Prospect</option>
                  <option>Client</option>
                </select>
              </div>
            </div>

            {/* Contact List Items */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">John Doe</div>
                  <div className="text-sm text-gray-500">john.doe@example.com</div>
                </div>
                <div className="text-sm text-gray-600">Acme Corp</div>
                <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-xs font-semibold">
                  Prospect
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Jane Smith</div>
                  <div className="text-sm text-gray-500">jane@company.com</div>
                </div>
                <div className="text-sm text-gray-600">Tech Solutions</div>
                <span className="rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold">
                  Client
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Bob Johnson</div>
                  <div className="text-sm text-gray-500">bob@client.com</div>
                </div>
                <div className="text-sm text-gray-600">Global Inc</div>
                <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-xs font-semibold">
                  Prospect
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Contact Detail View
          </h3>
          <p className="text-gray-700 mb-4">
            Click on any contact to view their full profile. Here you can see all their information,
            add notes, associate them with a company, and view their pipeline status.
          </p>

          {/* Visual Contact Detail */}
          <div className="mt-4 bg-white border-2 border-gray-200 rounded-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-2xl font-bold text-gray-900">John Doe</h4>
                <p className="text-sm text-gray-600">Full profile, pipeline status, and relationship notes.</p>
              </div>
              <button className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg">
                ← Back
              </button>
            </div>

            {/* Contact Info */}
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-gray-700">john.doe@example.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <span className="text-gray-700">(555) 123-4567</span>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-gray-400" />
                <span className="text-gray-700">Acme Corp</span>
                <button className="text-sm text-blue-600 hover:underline">Change</button>
              </div>
            </div>

            {/* Pipeline Status */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-600">
                  Prospect
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                  Initial Contact
                </span>
                <button className="text-gray-400 hover:text-gray-600">
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notes Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-lg font-semibold text-gray-900">Notes</h5>
                <button className="text-gray-400 hover:text-gray-600">
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                  rows="4"
                  placeholder="Add notes from meetings, emails, and relationship updates."
                  disabled
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                    Save
                  </button>
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            {/* Company Association */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-lg font-semibold text-gray-900">Company</h5>
                <button className="text-sm text-blue-600 hover:underline">Associate Company</button>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">Acme Corp</div>
                    <div className="text-sm text-gray-600">Technology • 50-100 employees</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Key Management Actions
          </h3>
          <p className="text-gray-700 mb-4">
            From the contact detail page, you have three main ways to work with your contacts:
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
              <div className="flex items-center gap-3 mb-2">
                <Edit2 className="h-6 w-6 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Add Notes</h4>
              </div>
              <p className="text-sm text-gray-700">
                Click the edit icon next to Notes to add relationship updates, meeting notes,
                or any important information about your interactions.
              </p>
            </div>

            <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="h-6 w-6 text-green-600" />
                <h4 className="font-semibold text-gray-900">Associate Company</h4>
              </div>
              <p className="text-sm text-gray-700">
                Link the contact to a company in your database. This helps organize contacts
                and provides company-level insights.
              </p>
            </div>

            <div className="p-4 border-2 border-purple-200 rounded-lg bg-purple-50">
              <div className="flex items-center gap-3 mb-2">
                <GitBranch className="h-6 w-6 text-purple-600" />
                <h4 className="font-semibold text-gray-900">View Pipeline</h4>
              </div>
              <p className="text-sm text-gray-700">
                See where this contact is in your sales process. Edit the pipeline and stage
                to track their progress through your funnel.
              </p>
            </div>
          </div>
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
  {
    id: 'managing-contacts',
    title: 'Managing Contacts',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        component: ManagingContactsContent,
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

