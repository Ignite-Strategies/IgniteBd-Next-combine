'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileText, Edit, ArrowLeft, ArrowRight, Users, Zap } from 'lucide-react';
import api from '@/lib/api';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import { hydrateTemplate, extractVariables } from '@/lib/templateVariables';
import TemplateTestService from '@/lib/services/templateTestService';

const RELATIONSHIP_OPTIONS = [
  { value: 'COLD', label: 'Cold' },
  { value: 'WARM', label: 'Warm' },
  { value: 'ESTABLISHED', label: 'Established' },
  { value: 'DORMANT', label: 'Dormant' },
];

const TYPE_OF_PERSON_OPTIONS = [
  { value: 'CURRENT_CLIENT', label: 'Current Client' },
  { value: 'FORMER_CLIENT', label: 'Former Client' },
  { value: 'FORMER_COWORKER', label: 'Former Coworker' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'FRIEND_OF_FRIEND', label: 'Friend of Friend' },
];

// Predefined templates that auto-fill form fields
const PREDEFINED_TEMPLATES = [
  {
    id: 'friends-personal',
    name: 'Friends & Personal Contacts',
    description: 'For reconnecting with friends and personal contacts',
    relationship: 'WARM',
    typeOfPerson: 'FRIEND_OF_FRIEND',
    whyReachingOut: "Haven't connected in a while and wanted to check in",
    whatWantFromThem: "Would love to catch up if you're open to it",
  },
  {
    id: 'former-coworkers',
    name: 'Former Coworkers',
    description: 'Reconnect with past colleagues',
    relationship: 'DORMANT',
    typeOfPerson: 'FORMER_COWORKER',
    whyReachingOut: "Been thinking about our time working together and wanted to reconnect",
    whatWantFromThem: "Would be great to grab coffee and catch up",
  },
  {
    id: 'former-clients',
    name: 'Former Clients',
    description: 'Maintain relationships with past clients',
    relationship: 'DORMANT',
    typeOfPerson: 'FORMER_CLIENT',
    whyReachingOut: "Haven't touched base in a while and wanted to see how things are going",
    whatWantFromThem: null,
  },
  {
    id: 'warm-prospects',
    name: 'Warm Prospects',
    description: 'Follow up with warm business prospects',
    relationship: 'WARM',
    typeOfPerson: 'PROSPECT',
    whyReachingOut: "Wanted to follow up on our previous conversation",
    whatWantFromThem: "Would love to continue the conversation if you're interested",
  },
  {
    id: 'current-clients',
    name: 'Current Clients',
    description: 'Check in with existing clients',
    relationship: 'ESTABLISHED',
    typeOfPerson: 'CURRENT_CLIENT',
    whyReachingOut: "Wanted to check in and see how everything is going",
    whatWantFromThem: null,
  },
];

// Three clear paths
const TEMPLATE_PATHS = [
  {
    id: 'MANUAL',
    title: 'Manual',
    description: 'Type your own message and insert variables as needed',
    icon: Edit,
    color: 'blue',
  },
  {
    id: 'AI',
    title: 'AI Generate',
    description: 'AI creates your template - choose Quick Idea, Relationship Helper, or Use Preset',
    icon: Sparkles,
    color: 'purple',
  },
  {
    id: 'RELATIONSHIP_CONTEXT',
    title: 'Use Relationship Context',
    description: 'Choose a relationship type and we\'ll pre-fill the form for you',
    icon: Users,
    color: 'green',
  },
];

// AI sub-options (shown after selecting AI Generate)
const AI_SUB_OPTIONS = [
  {
    id: 'QUICK_IDEA',
    title: 'Quick Idea',
    description: 'Type a template idea and AI creates it quickly',
    icon: Sparkles,
    color: 'purple',
  },
  {
    id: 'RELATIONSHIP_HELPER',
    title: 'Relationship Helper',
    description: 'Relationship-aware AI template builder with full context',
    icon: Users,
    color: 'indigo',
  },
  {
    id: 'USE_PRESET',
    title: 'Use Preset',
    description: 'Choose from predefined templates as a starting point',
    icon: Zap,
    color: 'orange',
  },
];

export default function TemplateBuildPage() {
  const router = useRouter();
  const { companyHQId } = useCompanyHQ();
  
  // Step management
  const [step, setStep] = useState('landing'); // 'landing' | 'form' | 'preview'
  const [path, setPath] = useState(null); // 'MANUAL' | 'QUICK_IDEA' | 'RELATIONSHIP_HELPER' | 'TEMPLATES'
  
  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [idea, setIdea] = useState('');
  const [generating, setGenerating] = useState(false);
  const [manualContent, setManualContent] = useState('');
  const [form, setForm] = useState({
    title: '',
    relationship: '',
    typeOfPerson: '',
    whyReachingOut: '',
    whatWantFromThem: '',
    timeSinceConnected: '',
    timeHorizon: '',
    knowledgeOfBusiness: false,
    myBusinessDescription: '',
    desiredOutcome: '',
  });
  
  // Preview state
  const [preview, setPreview] = useState({
    content: '',
    subjectLine: '',
    sections: {
      opening: '',
      context: '',
      releaseValve: '',
      close: '',
    },
  });
  const [templateContent, setTemplateContent] = useState('');
  const [extractedVariables, setExtractedVariables] = useState([]);

  // Available variables for manual insertion
  const AVAILABLE_VARIABLES = [
    { name: 'firstName', description: "Contact's first name" },
    { name: 'lastName', description: "Contact's last name" },
    { name: 'companyName', description: "Contact's current company" },
    { name: 'title', description: "Contact's job title" },
    { name: 'timeSinceConnected', description: "Time since last connected" },
    { name: 'myBusinessName', description: "Your business name" },
    { name: 'myRole', description: "Your name/role" },
  ];
  
  // Save state
  const [templateBaseId, setTemplateBaseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Generate title from form fields
  const generateTitle = (typeOfPerson) => {
    const typeLabels = {
      CURRENT_CLIENT: 'Current Client',
      FORMER_CLIENT: 'Former Client',
      FORMER_COWORKER: 'Former Co-worker',
      PROSPECT: 'Prospect',
      PARTNER: 'Partner',
      FRIEND_OF_FRIEND: 'Friend',
    };
    const typeLabel = typeLabels[typeOfPerson] || 'Contact';
    return `Outreach to ${typeLabel}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  // Step 1: Choose path
  const handlePathSelect = async (pathId) => {
    setPath(pathId);
    setStep('form');
    
    // Load existing templates if TEMPLATES path
    if (pathId === 'TEMPLATES' && companyHQId) {
      await loadExistingTemplates();
    }
  };


  // Insert variable into manual content
  const insertVariable = (variableName) => {
    const textarea = document.querySelector('[name="manualContent"]');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = manualContent;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const variable = `{{${variableName}}}`;
      setManualContent(before + variable + after);
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setManualContent(prev => prev + `{{${variableName}}}`);
    }
  };

  // Step 2: Handle relationship context selection (for RELATIONSHIP_CONTEXT path)
  const handleRelationshipContextSelect = (preset) => {
    setSelectedTemplate(preset.id);
    const autoTitle = generateTitle(preset.typeOfPerson);
    setForm({
      title: autoTitle,
      relationship: preset.relationship,
      typeOfPerson: preset.typeOfPerson,
      whyReachingOut: preset.whyReachingOut,
      whatWantFromThem: preset.whatWantFromThem || '',
      timeSinceConnected: '',
      timeHorizon: '',
      knowledgeOfBusiness: false,
      myBusinessDescription: '',
      desiredOutcome: '',
    });
    // Clear preview - user will generate after tweaking form
    setPreview({
      content: '',
      subjectLine: '',
      sections: {},
    });
  };

  // Step 2: Generate quick template (for QUICK_IDEA path - infers and generates in one step)
  const handleGenerateQuick = async () => {
    if (!idea.trim()) {
      setError('Please enter an idea first');
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      // Generate directly from idea - inference happens internally
      const response = await api.post('/api/template/generate-quick', {
        idea: idea.trim(),
      });

        if (response.data?.success) {
          // Set preview with generated template
          setPreview({
            content: response.data.template,
            subjectLine: '',
            sections: {},
            variables: response.data.variables || [],
          });
        
        // Store inferred data for later use in template base creation
        if (response.data.inferred) {
          const inferred = response.data.inferred;
          // Auto-generate a simple title from the inferred relationship
          const relationshipLabels = {
            COLD: 'Cold Outreach',
            WARM: 'Warm Outreach',
            ESTABLISHED: 'Friend/Contact',
            DORMANT: 'Reconnection',
          };
          const title = relationshipLabels[inferred.relationship] || 'Quick Note';
          
          setForm({
            title,
            relationship: inferred.relationship || 'WARM',
            typeOfPerson: 'FRIEND_OF_FRIEND', // Default for quick notes
            whyReachingOut: inferred.intent || idea.trim(),
            whatWantFromThem: inferred.ask || '',
            timeSinceConnected: '',
            timeHorizon: '',
            knowledgeOfBusiness: false,
            myBusinessDescription: '',
            desiredOutcome: inferred.ask || '',
          });
        }
        
        setStep('preview');
      } else {
        throw new Error('Failed to generate template');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate template');
    } finally {
      setGenerating(false);
    }
  };

  // Step 2: Generate template (for RELATIONSHIP_HELPER path)
  const handleGenerate = async () => {
    if (!form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      // RELATIONSHIP_HELPER uses relationship-aware endpoint with logic rules
      if (path === 'RELATIONSHIP_HELPER') {
        const response = await api.post('/api/template/generate-relationship-aware', {
          relationship: form.relationship,
          typeOfPerson: form.typeOfPerson,
          whyReachingOut: form.whyReachingOut.trim(),
          whatWantFromThem: form.whatWantFromThem?.trim() || null,
          // Template context fields for relationship-aware generation
          timeSinceConnected: form.timeSinceConnected?.trim() || null,
          timeHorizon: form.timeHorizon?.trim() || null,
          knowledgeOfBusiness: form.knowledgeOfBusiness || false,
          myBusinessDescription: form.myBusinessDescription?.trim() || null,
          desiredOutcome: form.desiredOutcome?.trim() || null,
        });

        if (response.data?.success) {
          setPreview({
            content: response.data.template,
            subjectLine: '',
            sections: {},
            variables: response.data.variables || [],
          });
          setStep('preview');
        } else {
          throw new Error('Failed to generate template');
        }
      } else {
        // For other paths (shouldn't reach here, but fallback)
        throw new Error('Invalid path for generation');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate template');
    } finally {
      setGenerating(false);
    }
  };

  // Step 3: Build template base
  const handleBuild = async () => {
    if (!companyHQId) {
      setError('Company context is required. Please refresh the page.');
      return;
    }

    if (!form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (!preview.content?.trim()) {
      setError('Please generate a template first');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const response = await api.post('/api/template/build', {
        companyHQId,
        title: form.title?.trim() || generateTitle(form.typeOfPerson),
        relationship: form.relationship,
        typeOfPerson: form.typeOfPerson,
        whyReachingOut: form.whyReachingOut.trim(),
        whatWantFromThem: form.whatWantFromThem?.trim() || null,
        timeSinceConnected: form.timeSinceConnected?.trim() || null,
        timeHorizon: form.timeHorizon?.trim() || null,
        knowledgeOfBusiness: form.knowledgeOfBusiness || false,
        myBusinessDescription: form.myBusinessDescription?.trim() || null,
        desiredOutcome: form.desiredOutcome?.trim() || null,
      });

      if (response.data?.success && response.data?.templateBase) {
        setTemplateBaseId(response.data.templateBase.id);
        await handleSave(response.data.templateBase.id);
      } else {
        throw new Error('Failed to create template base');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to build template');
      setSaving(false);
    }
  };

  // Step 3: Save template
  const handleSave = async (baseId = null) => {
    const idToUse = baseId || templateBaseId;
    if (!idToUse) {
      await handleBuild();
      return;
    }

    if (!preview.content || !preview.content.trim()) {
      setError('No content to save');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      // Determine mode based on path
      let finalMode = 'MANUAL';
      if (path === 'QUICK_IDEA' || path === 'RELATIONSHIP_HELPER') {
        finalMode = 'AI';
      }
      const response = await api.post('/api/template/save', {
        templateBaseId: idToUse,
        content: preview.content.trim(),
        subjectLine: preview.subjectLine?.trim() || null,
        mode: finalMode,
        companyHQId,
        companyHQId,
      });

      if (response.data?.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/template/saved');
        }, 1500);
      } else {
        throw new Error('Failed to save template');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save template');
      setSaving(false);
    }
  };

  // Auto-generate title when typeOfPerson changes
  useEffect(() => {
    if (form.typeOfPerson && (!form.title || form.title.startsWith('Outreach to'))) {
      const autoTitle = generateTitle(form.typeOfPerson);
      if (!form.title || form.title === autoTitle || form.title.startsWith('Outreach to')) {
        setForm((prev) => ({ ...prev, title: autoTitle }));
      }
    }
  }, [form.typeOfPerson]);

  // Update extracted variables when manual content changes
  useEffect(() => {
    if (path === 'MANUAL' && manualContent) {
      const vars = extractVariables(manualContent);
      setExtractedVariables(vars);
    }
  }, [manualContent, path]);


  // Handle preset template selection (for USE_PRESET)
  const handlePresetSelect = async (preset) => {
    setSelectedTemplate(preset.id);
    const autoTitle = generateTitle(preset.typeOfPerson);
    setForm({
      title: autoTitle,
      relationship: preset.relationship,
      typeOfPerson: preset.typeOfPerson,
      whyReachingOut: preset.whyReachingOut,
      whatWantFromThem: preset.whatWantFromThem || '',
      timeSinceConnected: '',
      timeHorizon: '',
      knowledgeOfBusiness: false,
      myBusinessDescription: '',
      desiredOutcome: '',
    });
    
    // Auto-generate after selecting preset
    setGenerating(true);
    try {
      const response = await api.post('/api/template/generate', {
        relationship: preset.relationship,
        typeOfPerson: preset.typeOfPerson,
        whyReachingOut: preset.whyReachingOut,
        whatWantFromThem: preset.whatWantFromThem || null,
      });

      if (response.data?.success) {
        setPreview({
          content: response.data.message,
          sections: response.data.sections || {},
        });
        setStep('preview');
      } else {
        throw new Error('Failed to generate template');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate template');
    } finally {
      setGenerating(false);
    }
  };

  // LANDING PAGE - Step 1
  if (step === 'landing') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Build Outreach Template</h1>
            <p className="text-lg text-gray-600">
              Choose how you want to create your outreach template
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {TEMPLATE_PATHS.map((templatePath) => {
              const Icon = templatePath.icon;
              const getIconBgClass = (color) => {
                if (color === 'blue') return 'bg-blue-100';
                if (color === 'purple') return 'bg-purple-100';
                if (color === 'green') return 'bg-green-100';
                if (color === 'indigo') return 'bg-indigo-100';
                if (color === 'orange') return 'bg-orange-100';
                return 'bg-gray-100';
              };
              const getIconColorClass = (color) => {
                if (color === 'blue') return 'text-blue-600';
                if (color === 'purple') return 'text-purple-600';
                if (color === 'green') return 'text-green-600';
                if (color === 'indigo') return 'text-indigo-600';
                if (color === 'orange') return 'text-orange-600';
                return 'text-gray-600';
              };
              return (
                <button
                  key={templatePath.id}
                  onClick={() => handlePathSelect(templatePath.id)}
                  className="group relative rounded-lg border-2 border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-red-500 hover:shadow-md"
                >
                  <div className={`mb-4 inline-flex rounded-lg p-3 ${getIconBgClass(templatePath.color)}`}>
                    <Icon className={`h-6 w-6 ${getIconColorClass(templatePath.color)}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {templatePath.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {templatePath.description}
                  </p>
                  <div className="mt-4 flex items-center text-sm font-medium text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // AI SUB-OPTIONS STEP - Step 1.5 (when AI Generate is selected)
  if (step === 'ai-choose') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => {
                setStep('landing');
                setPath(null);
                setAiSubPath(null);
                setError(null);
              }}
              className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to choices
            </button>
            <h1 className="text-3xl font-semibold text-gray-900">AI Generate Options</h1>
            <p className="mt-2 text-sm text-gray-600">
              Choose how you want AI to create your template
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {AI_SUB_OPTIONS.map((option) => {
              const Icon = option.icon;
              const getIconBgClass = (color) => {
                if (color === 'purple') return 'bg-purple-100';
                if (color === 'indigo') return 'bg-indigo-100';
                if (color === 'orange') return 'bg-orange-100';
                return 'bg-gray-100';
              };
              const getIconColorClass = (color) => {
                if (color === 'purple') return 'text-purple-600';
                if (color === 'indigo') return 'text-indigo-600';
                if (color === 'orange') return 'text-orange-600';
                return 'text-gray-600';
              };
              return (
                <button
                  key={option.id}
                  onClick={() => handleAiSubPathSelect(option.id)}
                  className="group relative rounded-lg border-2 border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-red-500 hover:shadow-md"
                >
                  <div className={`mb-4 inline-flex rounded-lg p-3 ${getIconBgClass(option.color)}`}>
                    <Icon className={`h-6 w-6 ${getIconColorClass(option.color)}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {option.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {option.description}
                  </p>
                  <div className="mt-4 flex items-center text-sm font-medium text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // FORM STEP - Step 2
  if (step === 'form') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => {
                setStep('landing');
                setPath(null);
                setError(null);
              }}
              className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to choices
            </button>
            <h1 className="text-3xl font-semibold text-gray-900">
              {path === 'MANUAL' && 'Type Your Message'}
              {path === 'QUICK_IDEA' && 'Type Your Template Idea'}
              {path === 'RELATIONSHIP_HELPER' && 'Relationship-Aware Template Builder'}
              {path === 'TEMPLATES' && 'Choose Existing Template'}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {path === 'MANUAL' && 'Type your message and insert variables as needed'}
              {path === 'QUICK_IDEA' && 'Describe your idea and AI will create the template quickly'}
              {path === 'RELATIONSHIP_HELPER' && 'Build a relationship-aware template with full context'}
              {path === 'TEMPLATES' && 'Select a template you\'ve already built'}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            {path === 'MANUAL' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="manualContent"
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder="Type your message here. Use the buttons below to insert variables like {{firstName}} or {{companyName}}."
                    rows={10}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">Insert variables:</p>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_VARIABLES.map((variable) => (
                        <button
                          key={variable.name}
                          type="button"
                          onClick={() => insertVariable(variable.name)}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-mono text-gray-700 hover:bg-gray-50"
                          title={variable.description}
                        >
                          {`{{${variable.name}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {manualContent && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Detected variables:</p>
                      <div className="flex flex-wrap gap-2">
                        {extractVariables(manualContent).map((variable) => (
                          <span
                            key={variable.name}
                            className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-mono text-blue-800"
                          >
                            {`{{${variable.name}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {path === 'RELATIONSHIP_CONTEXT' && (
              <div className="space-y-4">
                <div className="rounded-md border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-700">
                    <strong>Relationship Context:</strong> Choose a relationship type below. We'll pre-fill the form fields to make it easier - you can tweak them, then generate your template.
                  </p>
                </div>
                <div className="space-y-3">
                  {PREDEFINED_TEMPLATES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleRelationshipContextSelect(preset)}
                      className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                        selectedTemplate === preset.id
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{preset.name}</div>
                      <div className="mt-1 text-sm text-gray-600">{preset.description}</div>
                    </button>
                  ))}
                </div>
                {selectedTemplate && (
                  <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm text-blue-700">
                      ✓ Relationship context selected. The form below is pre-filled. Review and tweak as needed, then click "Generate & Preview".
                    </p>
                  </div>
                )}
              </div>
            )}

            {false && ( // USE_PRESET path removed
              <div className="space-y-4">
                <div className="rounded-md border border-orange-200 bg-orange-50 p-4">
                  <p className="text-sm text-orange-700">
                    <strong>Preset Templates:</strong> Choose a template below. It will auto-fill the form and generate a template you can customize.
                  </p>
                </div>
                <div className="space-y-3">
                  {PREDEFINED_TEMPLATES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      disabled={generating}
                      className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                        selectedTemplate === preset.id
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      } ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-semibold text-gray-900">{preset.name}</div>
                      <div className="mt-1 text-sm text-gray-600">{preset.description}</div>
                    </button>
                  ))}
                </div>
                {generating && (
                  <div className="text-center py-4 text-sm text-gray-500">
                    Generating template...
                  </div>
                )}
              </div>
            )}

            {path === 'QUICK_IDEA' && (
              <div className="space-y-4">
                <div className="rounded-md border border-purple-200 bg-purple-50 p-4">
                  <p className="text-sm text-purple-700">
                    <strong>Quick Note Builder:</strong> Describe what you want to say and we'll create a warm, friendly note with variables.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your idea
                  </label>
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="e.g., build me a quick note to a friend and tell him I want to meet"
                    rows={6}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    The AI will infer the relationship, what you want, and create a warm note with variables like {{firstName}}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateQuick}
                  disabled={generating || !idea.trim()}
                  className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {generating ? 'Generating...' : 'Generate Quick Note'}
                </button>
              </div>
            )}

            {path === 'RELATIONSHIP_HELPER' && (
              <div className="space-y-6">
                <div className="rounded-md border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-sm text-indigo-700">
                    <strong>Relationship-Aware Builder:</strong> Fill in the relationship context below. The AI will use this information to create a personalized template with proper variables.
                  </p>
                </div>
                
                {/* Relationship context fields will be shown below in the shared form section */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time Since Connected
                      </label>
                      <input
                        type="text"
                        name="timeSinceConnected"
                        value={form.timeSinceConnected}
                        onChange={handleChange}
                        placeholder="e.g., a long time, 2 years, a while"
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time Horizon
                      </label>
                      <input
                        type="text"
                        name="timeHorizon"
                        value={form.timeHorizon}
                        onChange={handleChange}
                        placeholder="e.g., 2026, Q1 2025, soon"
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      My Business Description
                    </label>
                    <textarea
                      name="myBusinessDescription"
                      value={form.myBusinessDescription}
                      onChange={handleChange}
                      placeholder="e.g., my own NDA house, a consulting firm, a design agency"
                      rows={2}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Desired Outcome
                    </label>
                    <textarea
                      name="desiredOutcome"
                      value={form.desiredOutcome}
                      onChange={handleChange}
                      placeholder="e.g., see if we can collaborate, catch up over coffee, explore partnership opportunities"
                      rows={2}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="knowledgeOfBusiness"
                      checked={form.knowledgeOfBusiness}
                      onChange={(e) => handleChange({ target: { name: 'knowledgeOfBusiness', value: e.target.checked } })}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <label className="ml-2 block text-sm text-gray-700">
                      They already know about your business
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Shared form fields - shown for RELATIONSHIP_HELPER, MANUAL, RELATIONSHIP_CONTEXT, USE_PRESET */}
            {(path === 'RELATIONSHIP_HELPER' || path === 'MANUAL' || path === 'TEMPLATES') && (
              <div className="mt-6 space-y-4 border-t border-gray-200 pt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="e.g., Outreach to Former Co-worker"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Relationship <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="relationship"
                    value={form.relationship}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                  >
                    <option value="">Select relationship</option>
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Type of Person <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="typeOfPerson"
                    value={form.typeOfPerson}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                  >
                    <option value="">Select type</option>
                    {TYPE_OF_PERSON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Why Reaching Out <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="whyReachingOut"
                    value={form.whyReachingOut}
                    onChange={handleChange}
                    placeholder="e.g., Saw you moved to a new firm, Haven't connected in a while"
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    What Want From Them (Optional)
                  </label>
                  <textarea
                    name="whatWantFromThem"
                    value={form.whatWantFromThem}
                    onChange={handleChange}
                    placeholder="e.g., I'd love to grab coffee"
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>
              </div>
            )}


            {/* Action buttons - different for each path */}
            {path !== 'QUICK_IDEA' && (
              <div className="flex gap-3 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setStep('landing');
                    setPath(null);
                    setError(null);
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                {path === 'RELATIONSHIP_HELPER' && (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={
                      generating || 
                      !form.relationship || 
                      !form.typeOfPerson || 
                      !form.whyReachingOut.trim()
                    }
                    className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {generating ? 'Generating...' : 'Generate & Preview'}
                  </button>
                )}
                {false && ( // USE_PRESET path removed
                  <button
                    type="button"
                    onClick={() => setStep('preview')}
                    disabled={!preview.content}
                    className="flex-1 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Continue to Preview
                  </button>
                )}
                {path === 'MANUAL' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreview({ content: manualContent, subjectLine: '', sections: {} });
                      const vars = extractVariables(manualContent);
                      setExtractedVariables(vars);
                      setStep('preview');
                    }}
                    disabled={!manualContent.trim()}
                    className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Continue to Preview
                  </button>
                )}
                {path === 'RELATIONSHIP_CONTEXT' && (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating || !selectedTemplate || !form.relationship || !form.typeOfPerson || !form.whyReachingOut.trim()}
                    className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {generating ? 'Generating...' : 'Generate & Preview'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PREVIEW STEP - Step 3
  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => {
                setStep('form');
                setError(null);
              }}
              className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to form
            </button>
            <h1 className="text-3xl font-semibold text-gray-900">Preview Template</h1>
            <p className="mt-2 text-sm text-gray-600">
              Review your template and make any final edits before saving
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              Template saved successfully! Redirecting...
            </div>
          )}

          <div className="space-y-6">
            {/* Subject Line Field */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject Line (Optional)
              </label>
              <input
                type="text"
                value={preview.subjectLine || ''}
                onChange={(e) => setPreview({ ...preview, subjectLine: e.target.value })}
                placeholder="e.g., Quick check-in, Catching up, etc."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Add a subject line for this template. You can use variables like {{firstName}}.
              </p>
            </div>

            {(path === 'MANUAL' || path === 'RELATIONSHIP_CONTEXT') && extractedVariables.length > 0 && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 text-xs font-semibold uppercase text-blue-700">Detected Variables</div>
                <div className="space-y-2">
                  {extractedVariables.map((variable) => (
                    <div key={variable.name} className="flex items-start gap-2 text-sm">
                      <span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-mono text-xs text-blue-800">
                        {`{{${variable.name}}}`}
                      </span>
                      <span className="text-gray-600">{variable.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {path === 'MANUAL' ? (
              <>
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Your Template</h2>
                  <textarea
                    value={preview.content}
                    onChange={(e) => {
                      setPreview({ content: e.target.value, sections: {} });
                      const vars = extractVariables(e.target.value);
                      setExtractedVariables(vars);
                    }}
                    rows={12}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Template content with {{variableName}} tags..."
                  />
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">Insert variables:</p>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_VARIABLES.map((variable) => (
                        <button
                          key={variable.name}
                          type="button"
                          onClick={() => {
                            const textarea = document.querySelector('textarea');
                            if (textarea) {
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const text = preview.content;
                              const before = text.substring(0, start);
                              const after = text.substring(end);
                              const variable = `{{${variable.name}}}`;
                              const newContent = before + variable + after;
                              setPreview({ content: newContent, sections: {} });
                              const vars = extractVariables(newContent);
                              setExtractedVariables(vars);
                              setTimeout(() => {
                                textarea.focus();
                                textarea.setSelectionRange(start + variable.length, start + variable.length);
                              }, 0);
                            }
                          }}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-mono text-gray-700 hover:bg-gray-50"
                          title={variable.description}
                        >
                          {`{{${variable.name}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {preview.content && (() => {
                  const previewData = TemplateTestService.generatePreview(preview.content, { formData: form });
                  return (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-6">
                      <h2 className="mb-4 text-lg font-semibold text-gray-900">Preview (with sample data)</h2>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">
                        {previewData.hydratedContent}
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        Sample: {previewData.testData?.contactData?.firstName} {previewData.testData?.contactData?.lastName} at {previewData.testData?.contactData?.companyName}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : path === 'RELATIONSHIP_CONTEXT' ? (
              <>
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Template Content</h2>
                  <textarea
                    value={preview.content}
                    onChange={(e) => {
                      setPreview({ content: e.target.value, sections: {} });
                      const vars = extractVariables(e.target.value);
                      setExtractedVariables(vars);
                    }}
                    rows={12}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                </div>
                {preview.content && (() => {
                  const previewData = TemplateTestService.generatePreview(preview.content, { formData: form });
                  return (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-6">
                      <h2 className="mb-4 text-lg font-semibold text-gray-900">Preview (with sample data)</h2>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">
                        {previewData.hydratedContent}
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        Sample: {previewData.testData?.contactData?.firstName} {previewData.testData?.contactData?.lastName} at {previewData.testData?.contactData?.companyName}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    {path === 'QUICK_IDEA' ? 'Quick Note Template' : 'Generated Template'}
                  </h2>
                  <textarea
                    value={preview.content}
                    onChange={(e) => {
                      setPreview({ content: e.target.value, sections: {} });
                      const vars = extractVariables(e.target.value);
                      setExtractedVariables(vars);
                    }}
                    rows={12}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Template content with {{variableName}} tags..."
                  />
                </div>
                {preview.content && (() => {
                  const previewData = TemplateTestService.generatePreview(preview.content, { formData: form });
                  return (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-6">
                      <h2 className="mb-4 text-lg font-semibold text-gray-900">Preview (with sample data)</h2>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">
                        {previewData.hydratedContent}
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        Sample: {previewData.testData?.contactData?.firstName} {previewData.testData?.contactData?.lastName} at {previewData.testData?.contactData?.companyName}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setError(null);
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleBuild}
                disabled={saving}
                className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
