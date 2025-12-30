'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Mail, Plug2, ArrowRight, User, Building2, Save, ChevronRight, Shield, Search, Send, Lock, Copy, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  // Direct read from localStorage for ownerId, owner, companyHQ - needed for auth/authoring
  const [ownerId, setOwnerId] = useState(null);
  const [owner, setOwner] = useState(null);
  const [companyHQ, setCompanyHQ] = useState(null);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedOwnerId = localStorage.getItem('ownerId');
    const storedOwner = localStorage.getItem('owner');
    const storedCompanyHQ = localStorage.getItem('companyHQ');
    if (storedOwnerId) {
      setOwnerId(storedOwnerId);
    }
    if (storedOwner) {
      try {
        setOwner(JSON.parse(storedOwner));
      } catch (e) {
        console.warn('Failed to parse owner', e);
      }
    }
    if (storedCompanyHQ) {
      try {
        setCompanyHQ(JSON.parse(storedCompanyHQ));
      } catch (e) {
        console.warn('Failed to parse companyHQ', e);
      }
    }
  }, []);
  
  // Refresh owner data from API (replaces refreshOwner from hook)
  const refreshOwner = useCallback(async () => {
    try {
      const response = await api.get('/api/owner/hydrate');
      if (response.data?.success) {
        const ownerData = response.data.owner;
        if (typeof window !== 'undefined') {
          localStorage.setItem('ownerId', ownerData.id);
          localStorage.setItem('owner', JSON.stringify(ownerData));
          setOwnerId(ownerData.id);
          setOwner(ownerData);
        }
      }
    } catch (error) {
      console.error('Failed to refresh owner:', error);
    }
  }, []);
  const [microsoftAuth, setMicrosoftAuth] = useState(null);
  const [sendGridConfig, setSendGridConfig] = useState(null);
  const [error, setError] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [becomingSuperAdmin, setBecomingSuperAdmin] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // 'profile' | 'company' | 'integrations' | null
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // Password reset state
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetLink, setPasswordResetLink] = useState(null);
  const [passwordResetCopied, setPasswordResetCopied] = useState(false);
  
  // Profile form state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    title: '',
    yearsAtCompany: '',
    // emailSignature: '', // TODO: Re-enable after relational model is implemented
  });
  
  // Company form state
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyData, setCompanyData] = useState({
    companyName: '',
    whatYouDo: '',
    companyStreet: '',
    companyCity: '',
    companyState: '',
    companyWebsite: '',
    companyIndustry: '',
    companyAnnualRev: '',
    yearsInBusiness: '',
    teamSize: '',
  });

  // Sender verification state (SuperAdmin only)
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [ownerIdToAssign, setOwnerIdToAssign] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownersList, setOwnersList] = useState([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [verifyingSender, setVerifyingSender] = useState(false);
  const [assigningSender, setAssigningSender] = useState(false);
  const [verifiedSender, setVerifiedSender] = useState(null);
  const [senderError, setSenderError] = useState(null);

  // Load all owners when verified sender is ready (Step 2)
  useEffect(() => {
    if (verifiedSender && isSuperAdmin) {
      loadAllOwners();
    }
  }, [verifiedSender, isSuperAdmin]);

  const loadAllOwners = async () => {
    try {
      setLoadingOwners(true);
      // Call platform-manager API (SuperAdmin routes)
      // Platform-manager sets in DB, IgniteBd-Next-combine reads from DB
      const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_MANAGER_URL || 'http://localhost:3002';
      const token = await getAuthToken();
      if (!token) {
        setSenderError('Not authenticated');
        return;
      }
      const response = await fetch(`${platformUrl}/api/platform/owners`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load owners');
      }
      
      // Map to expected format
      // Platform-manager writes to DB, IgniteBd-Next-combine reads from DB
      const owners = (data.owners || []).map(owner => ({
        id: owner.id,
        email: owner.email,
        name: owner.name || `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email,
        hasVerifiedSender: !!(owner.sendgridVerifiedEmail), // Check if verified sender is set in DB
      }));
      setOwnersList(owners);
    } catch (err) {
      console.error('Failed to load owners:', err);
      setSenderError('Failed to load owners list');
    } finally {
      setLoadingOwners(false);
    }
  };

  // Get Microsoft connection status from owner hook (no API call needed)
  // owner.microsoftAccessToken is the source of truth
  useEffect(() => {
    if (owner?.microsoftAccessToken) {
      setMicrosoftAuth({
        email: owner.microsoftEmail,
        displayName: owner.microsoftDisplayName,
        expiresAt: owner.microsoftExpiresAt,
      });
    } else {
      setMicrosoftAuth(null);
    }
  }, [owner]);

  // Fetch SendGrid configuration (non-blocking)
  const fetchSendGridConfig = useCallback(async () => {
    try {
      const response = await api.get('/api/email/config');
      if (response.data.success) {
        setSendGridConfig(response.data);
      }
    } catch (err) {
      // Not an error if not configured
      setSendGridConfig({ configured: false });
    }
  }, []);

  // Wait for Firebase auth to initialize
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log('✅ Settings: Firebase auth initialized, user:', firebaseUser.uid);
        setAuthInitialized(true);
      } else {
        console.log('⚠️ Settings: No Firebase user');
        setAuthInitialized(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load data from owner hook (uses localStorage + hydration)
  useEffect(() => {
    // Load profile data from owner
    if (owner) {
      // Use firstName/lastName directly, fallback to splitting name for backward compatibility
      let firstName = owner.firstName || '';
      let lastName = owner.lastName || '';
      
      // If firstName/lastName not set but name exists, try to split it
      if (!firstName && !lastName && owner.name) {
        const nameParts = owner.name.split(' ');
        firstName = nameParts.length > 0 ? nameParts[0] : '';
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      }
      
      setProfileData({
        firstName: firstName,
        lastName: lastName,
        email: owner.email || '',
        title: '', // TODO: Add title field to Owner model
        yearsAtCompany: '', // TODO: Add yearsAtCompany field to Owner model
        // emailSignature: owner.emailSignature || '', // TODO: Re-enable after relational model
      });
    }
    
    // Load company data from companyHQ object
    if (companyHQ) {
      setCompanyData({
        companyName: companyHQ.companyName || '',
        whatYouDo: companyHQ.whatYouDo || '',
        companyStreet: companyHQ.companyStreet || '',
        companyCity: companyHQ.companyCity || '',
        companyState: companyHQ.companyState || '',
        companyWebsite: companyHQ.companyWebsite || '',
        companyIndustry: companyHQ.companyIndustry || '',
        companyAnnualRev: companyHQ.companyAnnualRev?.toString() || '',
        yearsInBusiness: companyHQ.yearsInBusiness?.toString() || '',
        teamSize: companyHQ.teamSize || '',
      });
    }
    
    // Only make API calls after auth is initialized
    if (!authInitialized) return;
    
    // Fetch SendGrid configuration (non-blocking)
    if (ownerId) {
      fetchSendGridConfig();
    }
    // Note: Microsoft connection status now comes from owner hook (no API call needed)
    
    // CRITICAL: Owner must come from hook (already hydrated on welcome) - NO API calls to hydrate
    // SuperAdmin status should be available from owner object if needed
    // If not available, set to false (feature pages must not call hydrate)
    if (ownerId && owner) {
      // Use owner from hook - no hydrate call
      setIsSuperAdmin(owner.isSuperAdmin === true || false);
    }
  }, [owner, companyHQ, ownerId, authInitialized, fetchSendGridConfig]);

  // Handle Microsoft connection
  // IMPORTANT: OAuth login must use direct navigation, not AJAX
  // The /api/microsoft/login endpoint redirects to Microsoft OAuth
  // AJAX requests can't follow OAuth redirects due to CORS
  // Direct navigation (window.location.href) is the correct pattern
  const handleConnectMicrosoft = async () => {
    // Direct navigation to login endpoint - it will redirect to Microsoft OAuth
    window.location.href = '/api/microsoft/login';
  };

  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!ownerId || profileLoading) return;

    try {
      setProfileLoading(true);
      setError(null);

      const response = await api.put(`/api/owner/${ownerId}/profile`, {
        firstName: profileData.firstName || null,
        lastName: profileData.lastName || null,
        email: profileData.email,
        // emailSignature: profileData.emailSignature || null, // TODO: Re-enable after relational model
      });

      if (response.data.success) {
        // Refresh owner data to update localStorage
        await refreshOwner();
        alert('Profile updated successfully!');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!authInitialized || passwordResetLoading) return;

    try {
      setPasswordResetLoading(true);
      setError(null);
      setPasswordResetLink(null);
      setPasswordResetCopied(false);

      const response = await api.post('/api/owner/password/reset');

      if (response.data.success) {
        setPasswordResetLink(response.data.passwordResetLink);
      } else {
        setError(response.data.error || 'Failed to generate password reset link');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate password reset link');
    } finally {
      setPasswordResetLoading(false);
    }
  };

  // Copy password reset link to clipboard
  const copyPasswordResetLink = async () => {
    if (!passwordResetLink) return;
    
    try {
      await navigator.clipboard.writeText(passwordResetLink);
      setPasswordResetCopied(true);
      setTimeout(() => setPasswordResetCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Handle company upsert (create or update)
  const handleCompanyUpdate = async (e) => {
    e.preventDefault();
    if (companyLoading) return;

    try {
      setCompanyLoading(true);
      setError(null);
      
      const response = await api.put('/api/company/upsert', {
        companyName: companyData.companyName,
        whatYouDo: companyData.whatYouDo,
        companyStreet: companyData.companyStreet,
        companyCity: companyData.companyCity,
        companyState: companyData.companyState,
        companyWebsite: companyData.companyWebsite,
        companyIndustry: companyData.companyIndustry,
        companyAnnualRev: companyData.companyAnnualRev ? parseFloat(companyData.companyAnnualRev) : null,
        yearsInBusiness: companyData.yearsInBusiness ? parseInt(companyData.yearsInBusiness) : null,
        teamSize: companyData.teamSize || null,
      });

      if (response.data.success) {
        // Refresh owner data to update localStorage with new company
        await refreshOwner();
        const action = response.data.created ? 'created' : 'updated';
        alert(`Company ${action} successfully!`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save company');
    } finally {
      setCompanyLoading(false);
    }
  };

  // Check if token is expired
  const isTokenExpired = microsoftAuth?.expiresAt
    ? new Date(microsoftAuth.expiresAt) < new Date()
    : false;

  const isConnected = microsoftAuth && !isTokenExpired;

  // Check if user can become SuperAdmin
  // Phase 1: No email restriction - any logged-in owner can become SuperAdmin
  // TODO Phase 2: Add email restriction if needed
  // const canBecomeSuperAdmin = owner?.email === process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL || isSuperAdmin;
  const canBecomeSuperAdmin = true; // Phase 1: Allow all authenticated owners
  const showAdminTools = canBecomeSuperAdmin && !isSuperAdmin;

  // Handle becoming SuperAdmin
  const handleBecomeSuperAdmin = async () => {
    if (!authInitialized) {
      console.log('⏳ Settings: Waiting for auth initialization...');
      return;
    }

    try {
      setBecomingSuperAdmin(true);
      setError(null);
      
      console.log('🚀 Settings: Calling SuperAdmin upsert API...');
      const response = await api.post('/api/admin/superadmin/upsert');
      
      console.log('📥 Settings: API response:', response.data);
      
      if (response.data?.success) {
        setIsSuperAdmin(true);
        await refreshOwner();
        router.refresh();
      } else {
        const errorMsg = response.data?.error || 'Failed to become SuperAdmin';
        console.error('❌ Settings: API returned error:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('❌ Settings: Error becoming SuperAdmin:', err);
      console.error('❌ Settings: Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      const errorMsg = err.response?.data?.error || 
                      err.message || 
                      'Failed to become SuperAdmin';
      setError(errorMsg);
    } finally {
      setBecomingSuperAdmin(false);
    }
  };

  // Temporary test function for debugging
  const handleTestSuperAdminUpsert = async () => {
    if (!authInitialized) {
      console.log('⏳ Settings: Waiting for auth initialization...');
      alert('Waiting for authentication to initialize. Please try again in a moment.');
      return;
    }

    try {
      console.log('🧪 TEST: Calling SuperAdmin upsert via api client...');
      const response = await api.post('/api/admin/superadmin/upsert');
      console.log('🧪 TEST: SuperAdmin result:', response.data);
      alert(`Success! Result: ${JSON.stringify(response.data, null, 2)}`);
    } catch (err) {
      console.error('🧪 TEST: Error:', err);
      console.error('🧪 TEST: Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      alert(`Error: ${err.response?.data?.error || err.message}\nStatus: ${err.response?.status || 'N/A'}`);
    }
  };

  // If a section is active, show the form
  if (activeSection) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => setActiveSection(null)}
              className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
            >
              <ArrowRight className="h-4 w-4 mr-1 rotate-180" />
              Back to Settings
            </button>
            <PageHeader
              title={activeSection === 'profile' ? 'Update Profile' : activeSection === 'company' ? 'Update Company' : 'Integrations'}
              subtitle={activeSection === 'profile' ? 'Update your personal information' : activeSection === 'company' ? 'Manage your company profile' : 'Connect your accounts'}
            />
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-center">
                <XCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Profile Form */}
          {activeSection === 'profile' && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="p-6">
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        value={profileData.firstName}
                        onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                        spellCheck={true}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        value={profileData.lastName}
                        onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                        spellCheck={true}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                        Title / Role
                      </label>
                      <input
                        type="text"
                        id="title"
                        value={profileData.title}
                        onChange={(e) => setProfileData({ ...profileData, title: e.target.value })}
                        spellCheck={true}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="e.g., CEO, Founder, BD Director"
                      />
                    </div>
                    <div>
                      <label htmlFor="yearsAtCompany" className="block text-sm font-medium text-gray-700 mb-1">
                        Years at Company
                      </label>
                      <input
                        type="number"
                        id="yearsAtCompany"
                        min="0"
                        max="50"
                        value={profileData.yearsAtCompany}
                        onChange={(e) => setProfileData({ ...profileData, yearsAtCompany: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {/* Email Signature - TODO: Re-enable after relational model is implemented
                  <div>
                    <label htmlFor="emailSignature" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Signature
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      HTML signature that will be added to your outreach emails (optional). You can include your name, title, company, etc.
                    </p>
                    <textarea
                      id="emailSignature"
                      rows={6}
                      value={profileData.emailSignature}
                      onChange={(e) => setProfileData({ ...profileData, emailSignature: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 font-mono text-sm"
                      placeholder="<p>Best regards,<br>John Doe<br>CEO, Company Name</p>"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Use HTML tags like &lt;p&gt;, &lt;br&gt; for formatting
                    </p>
                  </div>
                  */}
                  
                  {/* Password Reset Section */}
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                      <Lock className="h-5 w-5 mr-2 text-gray-600" />
                      Password
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Reset your password by generating a secure reset link. Click the link to set a new password.
                    </p>
                    
                    {!passwordResetLink ? (
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={passwordResetLoading || !authInitialized}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {passwordResetLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4 mr-2" />
                            Generate Password Reset Link
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm font-medium text-green-900 mb-1">
                            Password reset link generated successfully!
                          </p>
                          <p className="text-xs text-green-700 mb-2">
                            Click the link below or copy it to reset your password. The link will expire after a set time.
                          </p>
                          <div className="flex items-center gap-2">
                            <a
                              href={passwordResetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 underline break-all"
                            >
                              {passwordResetLink}
                            </a>
                            <button
                              type="button"
                              onClick={copyPasswordResetLink}
                              className="flex-shrink-0 p-1 text-gray-600 hover:text-gray-900 rounded"
                              title="Copy link"
                            >
                              {passwordResetCopied ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordResetLink(null);
                            setPasswordResetCopied(false);
                          }}
                          className="text-sm text-gray-600 hover:text-gray-900"
                        >
                          Generate new link
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={profileLoading || !ownerId}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {profileLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Profile
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Company Form */}
          {activeSection === 'company' && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="p-6">
                <form onSubmit={handleCompanyUpdate} className="space-y-4">
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      required
                      value={companyData.companyName}
                      onChange={(e) => setCompanyData({ ...companyData, companyName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="whatYouDo" className="block text-sm font-medium text-gray-700 mb-1">
                      What You Do
                    </label>
                    <textarea
                      id="whatYouDo"
                      rows={3}
                      value={companyData.whatYouDo}
                      onChange={(e) => setCompanyData({ ...companyData, whatYouDo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      placeholder="Describe what your company does"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="companyStreet" className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        id="companyStreet"
                        value={companyData.companyStreet}
                        onChange={(e) => setCompanyData({ ...companyData, companyStreet: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyCity" className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        id="companyCity"
                        value={companyData.companyCity}
                        onChange={(e) => setCompanyData({ ...companyData, companyCity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyState" className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        id="companyState"
                        value={companyData.companyState}
                        onChange={(e) => setCompanyData({ ...companyData, companyState: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 mb-1">
                        Website
                      </label>
                      <input
                        type="url"
                        id="companyWebsite"
                        value={companyData.companyWebsite}
                        onChange={(e) => setCompanyData({ ...companyData, companyWebsite: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="https://example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyIndustry" className="block text-sm font-medium text-gray-700 mb-1">
                        Industry
                      </label>
                      <input
                        type="text"
                        id="companyIndustry"
                        value={companyData.companyIndustry}
                        onChange={(e) => setCompanyData({ ...companyData, companyIndustry: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="companyAnnualRev" className="block text-sm font-medium text-gray-700 mb-1">
                        Annual Revenue
                      </label>
                      <input
                        type="number"
                        id="companyAnnualRev"
                        value={companyData.companyAnnualRev}
                        onChange={(e) => setCompanyData({ ...companyData, companyAnnualRev: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="yearsInBusiness" className="block text-sm font-medium text-gray-700 mb-1">
                        Years in Business
                      </label>
                      <input
                        type="number"
                        id="yearsInBusiness"
                        value={companyData.yearsInBusiness}
                        onChange={(e) => setCompanyData({ ...companyData, yearsInBusiness: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="teamSize" className="block text-sm font-medium text-gray-700 mb-1">
                        Team Size
                      </label>
                      <select
                        id="teamSize"
                        value={companyData.teamSize}
                        onChange={(e) => setCompanyData({ ...companyData, teamSize: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="">Select team size</option>
                        <option value="just-me">Just me</option>
                        <option value="2-10">2-10</option>
                        <option value="11-50">11-50</option>
                        <option value="51-200">51-200</option>
                        <option value="200+">200+</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={companyLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {companyLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Company
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Integrations View */}
          {activeSection === 'integrations' && (
            <div className="space-y-6">
              {/* SendGrid Email Integration */}
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="p-6">
                  <div className="flex items-start space-x-6">
                    {/* SendGrid Logo/Icon */}
                    <div className="flex-shrink-0">
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-blue-50 border border-blue-200">
                        <Mail className="h-12 w-12 text-blue-600" />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Email Sending (SendGrid)
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Send outreach emails via SendGrid. No OAuth required - just configure your API key.
                      </p>
                      
                      <div className="space-y-3">
                        {sendGridConfig ? (
                          <div className={`p-3 border rounded-lg ${
                            sendGridConfig.configured 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-yellow-50 border-yellow-200'
                          }`}>
                            <p className={`text-sm font-medium mb-1 ${
                              sendGridConfig.configured 
                                ? 'text-green-900' 
                                : 'text-yellow-900'
                            }`}>
                              Status: {sendGridConfig.configured ? 'Configured' : 'Not Configured'}
                            </p>
                            {sendGridConfig.configured ? (
                              <p className="text-xs text-green-700">
                                Emails will be sent from: {sendGridConfig.fromName} &lt;{sendGridConfig.fromEmail}&gt;
                              </p>
                            ) : (
                              <p className="text-xs text-yellow-700">
                                Configure SENDGRID_API_KEY in your environment variables to enable email sending.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              Loading configuration...
                            </p>
                          </div>
                        )}
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>• Configure SENDGRID_API_KEY in your environment variables</p>
                          <p>• Set SENDGRID_FROM_EMAIL and SENDGRID_FROM_NAME for sender info</p>
                          <p>• No user authentication required - works immediately</p>
                          <p>• Better for outreach campaigns than personal email APIs</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Microsoft Outlook Integration (Optional) */}
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="p-6">
                  <div className="flex items-start space-x-6">
                    {/* Microsoft Logo */}
                    <div className="flex-shrink-0">
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-50 border border-gray-200">
                        <svg className="h-12 w-12" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022"/>
                          <rect x="12.5" y="0" width="10.5" height="10.5" fill="#7FBA00"/>
                          <rect x="0" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
                          <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
                        </svg>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Microsoft Outlook (Optional)
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Connect your Microsoft account to sync contacts and send emails from your Outlook inbox.
                      </p>
                      
                      {isConnected ? (
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-900">
                                Connected
                              </p>
                              <p className="text-xs text-green-700">
                                {microsoftAuth.displayName || microsoftAuth.email || 'Microsoft account connected'}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-3">
                            <button
                              onClick={() => router.push('/settings/integrations')}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              Manage Connection
                            </button>
                            <button
                              onClick={handleConnectMicrosoft}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              Reauthorize
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <button
                            onClick={handleConnectMicrosoft}
                            className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm"
                          >
                            <svg className="h-5 w-5 mr-2" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022"/>
                              <rect x="12.5" y="0" width="10.5" height="10.5" fill="#7FBA00"/>
                              <rect x="0" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
                              <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
                            </svg>
                            Connect with Microsoft
                            <ArrowRight className="h-5 w-5 ml-2" />
                          </button>
                          <p className="text-xs text-gray-500 text-center">
                            Optional: Connect to sync contacts and send from your Outlook inbox
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Future integrations */}
              <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <Plug2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600 mb-1">More integrations coming soon</p>
                <p className="text-xs text-gray-500">We're working on adding more integrations to enhance your workflow</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main settings dashboard view
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Settings"
          subtitle="Welcome to your settings. What would you like to change?"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Card */}
          <button
            onClick={() => setActiveSection('profile')}
            className="group relative rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm hover:border-red-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 group-hover:bg-red-100 transition-colors mb-4">
                  <User className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Profile
                </h3>
                <p className="text-sm text-gray-500">
                  Update your name and email address
                </p>
                {(profileData.firstName || profileData.lastName) && (
                  <p className="text-xs text-gray-400 mt-2">
                    {[profileData.firstName, profileData.lastName].filter(Boolean).join(' ') || 'No name set'}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-red-600 transition-colors" />
            </div>
          </button>

          {/* Company Card */}
          <button
            onClick={() => setActiveSection('company')}
            className="group relative rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors mb-4">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Company
                </h3>
                <p className="text-sm text-gray-500">
                  {companyHQ ? 'Update your company information' : 'Create your company profile'}
                </p>
                {companyHQ && companyData.companyName && (
                  <p className="text-xs text-gray-400 mt-2">
                    Current: {companyData.companyName}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </button>

          {/* Integrations Card */}
          <button
            onClick={() => setActiveSection('integrations')}
            className="group relative rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm hover:border-purple-300 hover:shadow-md transition-all text-left md:col-span-2"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 group-hover:bg-purple-100 transition-colors mb-4">
                  <Plug2 className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Integrations
                </h3>
                <p className="text-sm text-gray-500">
                  Connect your accounts to enhance your workflow
                </p>
                {isConnected && (
                  <div className="flex items-center mt-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                    <p className="text-xs text-gray-400">
                      Microsoft Outlook connected
                    </p>
                  </div>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
          </button>

          {/* Platform Admin Tools - Only show if can become SuperAdmin or is SuperAdmin */}
          {canBecomeSuperAdmin && (
            <div className="group relative rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm hover:border-yellow-300 hover:shadow-md transition-all text-left md:col-span-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-50 group-hover:bg-yellow-100 transition-colors mb-4">
                    <Shield className="h-6 w-6 text-yellow-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    IgniteBD Platform Admin Tools
                  </h3>
                  {isSuperAdmin ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">
                        You are a Platform SuperAdmin. Manage all tenants and access the Tenant Switchboard.
                      </p>
                      <div className="flex items-center mt-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                        <p className="text-xs text-gray-400">
                          SuperAdmin active
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => router.push('/superadmin/switchboard')}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                        >
                          Open Tenant Switchboard
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </button>
                        
                        {/* Sender Verification Section */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">SendGrid Sender Verification</h4>
                          
                          {/* Step 1: Verify Sender */}
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Step 1: Verify Sender Email
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="email"
                                  value={senderEmail}
                                  onChange={(e) => {
                                    setSenderEmail(e.target.value);
                                    setVerifiedSender(null);
                                    setSenderError(null);
                                  }}
                                  placeholder="user@example.com"
                                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                                />
                                <button
                                  onClick={async () => {
                                    if (!senderEmail) {
                                      setSenderError('Email is required');
                                      return;
                                    }
                                    try {
                                      setVerifyingSender(true);
                                      setSenderError(null);
                                      // Call platform-manager API (SuperAdmin routes)
                                      // Platform-manager sets in DB, IgniteBd-Next-combine reads from DB
                                      const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_MANAGER_URL || 'http://localhost:3002';
                                      const token = await getAuthToken();
                                      if (!token) {
                                        setSenderError('Not authenticated');
                                        return;
                                      }
                                      const response = await fetch(`${platformUrl}/api/platform/senders/verify`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${token}`,
                                        },
                                        body: JSON.stringify({ email: senderEmail }),
                                      });
                                      const data = await response.json();
                                      if (!response.ok) {
                                        throw new Error(data.error || 'Failed to verify sender');
                                      }
                                      
                                      // Use the response data
                                      if (data.success) {
                                        if (data.verified) {
                                          setVerifiedSender(data.sender);
                                          setSenderName(data.sender.name || '');
                                        } else {
                                          setSenderError('Sender found but not verified in SendGrid');
                                        }
                                      } else {
                                        setSenderError(data.error || 'Failed to verify sender');
                                      }
                                    } catch (err) {
                                      setSenderError(err.message || 'Failed to verify sender');
                                    } finally {
                                      setVerifyingSender(false);
                                    }
                                  }}
                                  disabled={verifyingSender || !senderEmail}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {verifyingSender ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Verifying...
                                    </>
                                  ) : (
                                    <>
                                      <Search className="h-4 w-4 mr-2" />
                                      Verify
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Verified Sender Display */}
                            {verifiedSender && (
                              <div className="rounded-md bg-green-50 border border-green-200 p-3">
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-green-900">
                                      {verifiedSender.name || verifiedSender.email}
                                    </p>
                                    <p className="text-xs text-green-700 mt-1">{verifiedSender.email}</p>
                                    <p className="text-xs text-green-600 mt-1">✅ Verified in SendGrid</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Step 2: Assign to Owner */}
                            {verifiedSender && (
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Step 2: Assign to Owner
                                </label>
                                <div className="space-y-2">
                                  {/* Owner Search/Select */}
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={ownerSearch}
                                      onChange={(e) => {
                                        const search = e.target.value;
                                        setOwnerSearch(search);
                                        setOwnerIdToAssign('');
                                        
                                        // Filter existing list
                                        if (search.length >= 2) {
                                          // Filter the already-loaded owners list
                                          const filtered = ownersList.filter(owner =>
                                            owner.email?.toLowerCase().includes(search.toLowerCase()) ||
                                            owner.name?.toLowerCase().includes(search.toLowerCase())
                                          );
                                          // If we have results, show them (already loaded)
                                          // Otherwise could trigger API search if needed
                                        }
                                      }}
                                      placeholder="Search owners by email or name..."
                                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                                    />
                                    {loadingOwners && (
                                      <div className="absolute right-3 top-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                      </div>
                                    )}
                                    
                                    {/* Owner Dropdown - Show all or filtered */}
                                    {ownersList.length > 0 && (
                                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                        {(ownerSearch.length >= 2
                                          ? ownersList.filter(owner =>
                                              owner.email?.toLowerCase().includes(ownerSearch.toLowerCase()) ||
                                              owner.name?.toLowerCase().includes(ownerSearch.toLowerCase())
                                            )
                                          : ownersList
                                        ).map((owner) => (
                                          <button
                                            key={owner.id}
                                            type="button"
                                            onClick={() => {
                                              setOwnerIdToAssign(owner.id);
                                              setOwnerSearch(owner.email);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                                              ownerIdToAssign === owner.id ? 'bg-yellow-50' : ''
                                            }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div>
                                                <p className="font-medium text-gray-900">{owner.name}</p>
                                                <p className="text-xs text-gray-500">{owner.email}</p>
                                              </div>
                                              {owner.hasVerifiedSender && (
                                                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" title="Has verified sender" />
                                              )}
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Display Name */}
                                  <input
                                    type="text"
                                    value={senderName}
                                    onChange={(e) => setSenderName(e.target.value)}
                                    placeholder="Display Name (optional)"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                                  />

                                  {/* Selected Owner Display */}
                                  {ownerIdToAssign && (
                                    <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-xs">
                                      <p className="text-blue-900">
                                        Selected: {ownersList.find(o => o.id === ownerIdToAssign)?.email || ownerIdToAssign}
                                      </p>
                                    </div>
                                  )}

                                  {/* Assign Button */}
                                  <button
                                    onClick={async () => {
                                      if (!ownerIdToAssign) {
                                        setSenderError('Please select an owner');
                                        return;
                                      }
                                      try {
                                        setAssigningSender(true);
                                        setSenderError(null);
                                        // Call platform-manager API (SuperAdmin routes)
                                        // Platform-manager sets in DB, IgniteBd-Next-combine reads from DB
                                        const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_MANAGER_URL || 'http://localhost:3002';
                                        const token = await getAuthToken();
                                        if (!token) {
                                          setSenderError('Not authenticated');
                                          return;
                                        }
                                        const response = await fetch(`${platformUrl}/api/platform/senders/assign`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`,
                                          },
                                          body: JSON.stringify({
                                            ownerId: ownerIdToAssign,
                                            email: verifiedSender.email,
                                            name: senderName || undefined,
                                          }),
                                        });
                                        const data = await response.json();
                                        if (!response.ok) {
                                          throw new Error(data.error || 'Failed to assign sender');
                                        }
                                        
                                        // Use the response data
                                        if (data.success) {
                                          setSenderError(null);
                                          alert(`✅ Sender assigned successfully!`);
                                          // Reload owners to refresh verified sender status
                                          await loadAllOwners();
                                          // Reset form
                                          setSenderEmail('');
                                          setSenderName('');
                                          setOwnerIdToAssign('');
                                          setOwnerSearch('');
                                          setVerifiedSender(null);
                                        } else {
                                          setSenderError(data.error || 'Failed to assign sender');
                                        }
                                        if (response.data?.success) {
                                          setSenderError(null);
                                          alert(`✅ Sender assigned successfully!`);
                                          // Reload owners to refresh verified sender status
                                          await loadAllOwners();
                                          // Reset form
                                          setSenderEmail('');
                                          setSenderName('');
                                          setOwnerIdToAssign('');
                                          setOwnerSearch('');
                                          setVerifiedSender(null);
                                        } else {
                                          setSenderError(response.data?.error || 'Failed to assign sender');
                                        }
                                      } catch (err) {
                                        setSenderError(err.response?.data?.error || err.message || 'Failed to assign sender');
                                      } finally {
                                        setAssigningSender(false);
                                      }
                                    }}
                                    disabled={assigningSender || !ownerIdToAssign}
                                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {assigningSender ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Assigning...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Assign to Owner
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Error Display */}
                            {senderError && (
                              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                                <p className="text-xs text-red-800">{senderError}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">
                        Become a Platform SuperAdmin to manage all CompanyHQs and access the Tenant Switchboard.
                      </p>
                      {error && (
                        <div className="rounded-md bg-red-50 border border-red-200 p-3">
                          <p className="text-sm text-red-800">{error}</p>
                        </div>
                      )}
                      
                      {/* Temporary test button for debugging */}
                      <div className="mt-3 space-y-2">
                        <button
                          onClick={handleTestSuperAdminUpsert}
                          className="w-full inline-flex items-center justify-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          🧪 TEST SUPERADMIN UPSERT
                        </button>
                        <button
                          onClick={handleBecomeSuperAdmin}
                          disabled={becomingSuperAdmin}
                          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {becomingSuperAdmin ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Activating...
                            </>
                          ) : (
                            <>
                              Become Platform SuperAdmin
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading settings...</p>
          </div>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
