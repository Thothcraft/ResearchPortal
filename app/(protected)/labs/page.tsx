'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Play, CheckCircle, XCircle, Clock, Filter, ChevronDown, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';

type Lab = {
  id: number;
  title: string;
  description: string;
  sensor_type: string;
  difficulty: string;
  max_score: number;
  questions: Array<{
    id: string;
    type: string;
    prompt: string;
    options?: string[];
  }>;
  my_submission?: {
    submitted: boolean;
    score: number | null;
    max_score: number;
    submitted_at: string | null;
  };
};

export default function LabsPage() {
  const { user } = useAuth();
  const { get, post } = useApi();
  const toast = useToast();

  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [sensorFilter, setSensorFilter] = useState('all');
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLabs();
  }, []);

  const loadLabs = async () => {
    setLoading(true);
    try {
      const res = await get(`/labs${sensorFilter !== 'all' ? `?sensor_type=${sensorFilter}` : ''}`);
      setLabs(res.labs || []);
    } catch (err) {
      toast.error('Error loading labs', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (lab: Lab) => {
    if (!lab.my_submission && Object.keys(answers).length === 0) {
      toast.error('No Answers', 'Please answer at least one question before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await post(`/labs/${lab.id}/submit`, { answers });
      toast.success('Submitted', `Score: ${res.score}/${res.max_score}`);
      setSelectedLab(null);
      setAnswers({});
      loadLabs();
    } catch (err) {
      toast.error('Submission failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const startLab = (lab: Lab) => {
    setSelectedLab(lab);
    setAnswers({});
  };

  const closeLab = () => {
    setSelectedLab(null);
    setAnswers({});
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Practice Labs</h1>
      <p className="text-slate-400 mb-8">Complete labs to improve your skills with Thoth sensors</p>

      {/* Filter */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm text-slate-300">Sensor Type:</label>
        <select
          value={sensorFilter}
          onChange={(e) => setSensorFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
        >
          <option value="all">All</option>
          <option value="camera">Camera</option>
          <option value="wifi_sensing">WiFi Sensing</option>
          <option value="cwmf">CWMF</option>
        </select>
      </div>

      {/* Labs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {labs.map((lab) => (
          <div key={lab.id} className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{lab.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{lab.description}</p>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">
                  {lab.sensor_type}
                </span>
                <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded">
                  {lab.difficulty}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-400">Max Score: {lab.max_score}</span>
              {lab.my_submission?.submitted && (
                <div className="flex items-center gap-1 text-sm">
                  {lab.my_submission.score !== null ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">
                        {lab.my_submission.score}/{lab.my_submission.max_score}
                      </span>
                    </>
                  ) : (
                    <span className="text-yellow-400">Grading...</span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => lab.my_submission?.submitted ? null : startLab(lab)}
              disabled={lab.my_submission?.submitted}
              className={`w-full py-2 rounded font-medium transition-colors ${
                lab.my_submission?.submitted
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {lab.my_submission?.submitted ? 'Completed' : 'Start Lab'}
            </button>
          </div>
        ))}

        {labs.length === 0 && (
          <div className="col-span-full text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-500 opacity-50" />
            <p className="text-slate-500">No labs available for this filter.</p>
          </div>
        )}
      </div>

      {/* Lab Modal */}
      {selectedLab && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">{selectedLab.title}</h2>
              <p className="text-slate-400 mt-1">{selectedLab.description}</p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                {selectedLab.questions.map((q, idx) => (
                  <div key={q.id} className="bg-slate-900 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-2">
                      Question {idx + 1}: {q.prompt}
                    </h4>

                    {q.type === 'multiple_choice' && q.options ? (
                      <div className="space-y-2">
                        {q.options.map((opt, i) => (
                          <label key={i} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={answers[q.id] === opt}
                              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                              className="w-4 h-4 text-indigo-600"
                            />
                            <span className="text-slate-300">{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={answers[q.id] || ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder="Type your answer here..."
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white resize-none"
                        rows={3}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={closeLab}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmit(selectedLab)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Lab'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
