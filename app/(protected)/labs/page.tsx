'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, Upload, CheckCircle, Clock, AlertCircle, FlaskConical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';

type Submission = {
  id: number;
  status: 'pending' | 'queued' | 'graded' | 'failed';
  execution_status: string;
  score: number | null;
  max_score: number;
  passed: boolean | null;
  feedback: string[];
  artifacts: string[];
  submitted_at: string | null;
  graded_at: string | null;
};

type Lab = {
  id: number;
  slug: string;
  title: string;
  description: string;
  track: string;
  track_title?: string;
  level: string;
  objectives: string[];
  required_artifacts: string[];
  has_template: boolean;
  max_score: number;
  my_submission?: Submission | null;
};

type Track = {
  id: string;
  title: string;
  description: string;
  lab_count: number;
  completed: number;
};

export default function LabsPage() {
  const { user, entitlements } = useAuth();
  const { get } = useApi();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackFilter, setTrackFilter] = useState('all');
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [t, l] = await Promise.all([
        get('/labs/tracks'),
        get('/labs'),
      ]);
      setTracks(t.tracks || []);
      setLabs(l.labs || []);
    } catch (err) {
      toast.error('Error loading labs', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const filteredLabs = trackFilter === 'all' ? labs : labs.filter(l => l.track === trackFilter);

  const downloadTemplate = async (lab: Lab) => {
    try {
      const res = await fetch(`/api/proxy/labs/${lab.id}/template`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lab.slug}.ipynb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Template download failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const submitNotebook = async (lab: Lab, file: File) => {
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('notebook', file);
      const res = await fetch(`/api/proxy/labs/${lab.id}/submit`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      const sub = data.submission;
      toast.success(
        sub?.passed ? 'Lab passed' : 'Submission received',
        sub?.score != null ? `Score: ${sub.score}/${sub.max_score}` : 'Grading queued'
      );
      setSelectedLab(null);
      loadAll();
    } catch (err) {
      toast.error('Submission failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  // Labs are a Research-plan entitlement.
  if (entitlements && !entitlements.labs) {
    return (
      <div className="p-8 text-center">
        <FlaskConical className="w-12 h-12 mx-auto mb-4 text-slate-500" />
        <h1 className="text-2xl font-bold text-white mb-2">Research Labs</h1>
        <p className="text-slate-400">Labs are available on the Research plan.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Research Labs</h1>
      <p className="text-slate-400 mb-8">
        Reproducible computational experiments — download a notebook template, work through it
        with thothcraft-sdk, and submit your completed .ipynb for grading.
      </p>

      {/* Track filter */}
      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <button
          onClick={() => setTrackFilter('all')}
          className={`px-3 py-1.5 rounded text-sm ${trackFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
        >All tracks</button>
        {tracks.map(t => (
          <button
            key={t.id}
            onClick={() => setTrackFilter(t.id)}
            className={`px-3 py-1.5 rounded text-sm ${trackFilter === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            {t.title} ({t.completed}/{t.lab_count})
          </button>
        ))}
      </div>

      {/* Labs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLabs.map((lab) => {
          const sub = lab.my_submission;
          return (
            <div key={lab.id} className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{lab.title}</h3>
                  <p className="text-sm text-slate-400 mt-1">{lab.description}</p>
                </div>
                <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs whitespace-nowrap">
                  {lab.level}
                </span>
              </div>

              {lab.objectives?.length > 0 && (
                <ul className="text-xs text-slate-400 mb-3 space-y-1">
                  {lab.objectives.slice(0, 3).map((o, i) => <li key={i}>• {o}</li>)}
                </ul>
              )}

              <div className="mt-auto">
                <div className="flex items-center justify-between mb-3 text-sm">
                  <span className="text-slate-400">Max {lab.max_score} pts</span>
                  {sub && (
                    <span className="flex items-center gap-1">
                      {sub.status === 'graded' ? (
                        <>
                          <CheckCircle className={`w-4 h-4 ${sub.passed ? 'text-green-400' : 'text-red-400'}`} />
                          <span className={sub.passed ? 'text-green-400' : 'text-red-400'}>
                            {sub.score}/{sub.max_score}
                          </span>
                        </>
                      ) : sub.status === 'failed' ? (
                        <span className="text-red-400">Failed</span>
                      ) : (
                        <><Clock className="w-4 h-4 text-yellow-400" /><span className="text-yellow-400">{sub.status}</span></>
                      )}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {lab.has_template && (
                    <button
                      onClick={() => downloadTemplate(lab)}
                      className="flex-1 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center gap-1"
                    >
                      <Download className="w-4 h-4" /> Template
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedLab(lab)}
                    className="flex-1 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm flex items-center justify-center gap-1"
                  >
                    <Upload className="w-4 h-4" /> {sub ? 'Resubmit' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredLabs.length === 0 && (
          <div className="col-span-full text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-500 opacity-50" />
            <p className="text-slate-500">No labs in this track yet.</p>
          </div>
        )}
      </div>

      {/* Submit modal */}
      {selectedLab && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">{selectedLab.title}</h2>
              <p className="text-slate-400 mt-1 text-sm">{selectedLab.description}</p>
              {selectedLab.required_artifacts?.length > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  Required artifacts: {selectedLab.required_artifacts.join(', ')}
                </p>
              )}
            </div>
            <div className="p-6">
              <label className="block text-sm text-slate-300 mb-2">
                Completed notebook (.ipynb)
              </label>
              <input
                ref={fileInput}
                type="file"
                accept=".ipynb"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) submitNotebook(selectedLab, f);
                }}
                className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
              <p className="text-xs text-slate-500 mt-3">
                Your notebook is validated and graded structurally — it is never executed on our servers.
              </p>
            </div>
            <div className="p-6 border-t border-slate-700">
              <button
                onClick={() => setSelectedLab(null)}
                disabled={submitting}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
