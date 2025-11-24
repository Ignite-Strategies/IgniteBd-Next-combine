'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';

interface Section {
  title: string;
  bullets: string[];
}

interface Presentation {
  id: string;
  title: string;
  slides: {
    sections: Section[];
  } | null;
  feedback: Record<string, string> | null;
}

export default function PortalReviewCLEPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState<Record<number, string>>({});

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const firebaseUser = getAuth().currentUser;
        if (!firebaseUser) {
          router.replace('/client-portal/login');
          return;
        }

        const token = await firebaseUser.getIdToken();
        if (!token) {
          router.replace('/client-portal/login');
          return;
        }

        setAuthenticated(true);

        // Fetch presentation
        const response = await fetch('/api/portal/review/presentation', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch presentation');
        }

        const data = await response.json();
        if (data.success && data.presentation) {
          setPresentation(data.presentation);
          // Initialize comments from existing feedback
          const initialComments: Record<number, string> = {};
          if (data.presentation.feedback) {
            Object.keys(data.presentation.feedback).forEach((key) => {
              initialComments[parseInt(key)] = data.presentation.feedback[key];
            });
          }
          setComments(initialComments);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading presentation:', error);
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [router]);

  const handleSaveFeedback = async (sectionIndex: number, comment: string) => {
    if (!presentation) return;

    setSaving({ ...saving, [sectionIndex]: true });
    setSaved({ ...saved, [sectionIndex]: false });

    try {
      const firebaseUser = getAuth().currentUser;
      if (!firebaseUser) return;

      const token = await firebaseUser.getIdToken();
      if (!token) return;

      const response = await fetch('/api/portal/review/cle/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          presentationId: presentation.id,
          sectionIndex,
          comment,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save feedback');
      }

      const data = await response.json();
      if (data.success) {
        // Update local state
        const updatedFeedback = {
          ...(presentation.feedback || {}),
          [sectionIndex.toString()]: comment,
        };
        setPresentation({
          ...presentation,
          feedback: updatedFeedback,
        });
        setComments({ ...comments, [sectionIndex]: comment });
        setSaved({ ...saved, [sectionIndex]: true });
        setTimeout(() => {
          setSaved((prev) => ({ ...prev, [sectionIndex]: false }));
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving feedback:', error);
      alert('Failed to save feedback. Please try again.');
    } finally {
      setSaving({ ...saving, [sectionIndex]: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4" />
          <p className="text-gray-600 text-xl">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !presentation) {
    return null;
  }

  const sections = presentation.slides?.sections || [];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            BusinessPoint Law – CLE Presentation Draft
          </h1>
          <p className="text-gray-600 text-lg">
            This is your outline. Add comments to any section.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section, sectionIndex) => {
            const comment = comments[sectionIndex] || '';

            return (
              <div
                key={sectionIndex}
                className="bg-white rounded-xl shadow-md p-6 border border-gray-200"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {section.title}
                </h2>

                {section.bullets && section.bullets.length > 0 && (
                  <ul className="list-disc list-inside mb-6 space-y-2 text-gray-700">
                    {section.bullets.map((bullet, bulletIndex) => (
                      <li key={bulletIndex}>{bullet}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Feedback
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => {
                      setComments({ ...comments, [sectionIndex]: e.target.value });
                    }}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                    placeholder="Add your comments or feedback for this section..."
                  />
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => handleSaveFeedback(sectionIndex, comment)}
                    disabled={saving[sectionIndex]}
                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving[sectionIndex] ? 'Saving...' : 'Save Feedback'}
                  </button>
                  {saved[sectionIndex] && (
                    <span className="text-green-600 font-medium">Saved!</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

