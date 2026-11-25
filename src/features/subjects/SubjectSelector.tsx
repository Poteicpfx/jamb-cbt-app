import { useEffect, useState } from 'react';
import { Check, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Subject } from '../../types/exam.types';
import { useAuth } from '../auth/AuthContext';

export function SubjectSelector({ onSaved }: { onSaved?: () => void }) {
  const { profile, refreshProfile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetScore, setTargetScore] = useState<number>(profile?.target_score ?? 280);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubjects() {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('is_active', true)
        .order('is_mandatory', { ascending: false })
        .order('name');

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        const list = data as Subject[];
        setSubjects(list);

        const mandatory = list.find((s) => s.is_mandatory);
        const existing = profile?.selected_subjects ?? [];
        if (existing.length === 4) {
          setSelectedIds(existing);
        } else if (mandatory) {
          setSelectedIds([mandatory.id]);
        }
      }
      setLoading(false);
    }

    fetchSubjects();
  }, [profile]);

  function toggleSubject(subject: Subject) {
    if (subject.is_mandatory) return;

    setErrorMsg(null);
    setSelectedIds((prev) => {
      if (prev.includes(subject.id)) {
        return prev.filter((id) => id !== subject.id);
      }
      if (prev.length >= 4) {
        setErrorMsg('JAMB requires Use of English plus 3 elective subjects (4 total).');
        return prev;
      }
      return [...prev, subject.id];
    });
  }

  async function handleSave() {
    if (!profile) return;
    if (selectedIds.length !== 4) {
      setErrorMsg('Please select exactly 4 subjects (Use of English + 3 electives).');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        selected_subjects: selectedIds,
        target_score: targetScore,
      })
      .eq('id', profile.id);

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    await refreshProfile();
    onSaved?.();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading JAMB subjects...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Select Your 4 JAMB Subjects</h2>
          <p className="text-xs text-slate-500">
            Use of English is compulsory. Choose 3 more subjects ({selectedIds.length}/4 selected).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700">Target Score:</label>
          <input
            type="number"
            min={100}
            max={400}
            value={targetScore}
            onChange={(e) => setTargetScore(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-semibold text-slate-900"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
        {subjects.map((subject) => {
          const isSelected = selectedIds.includes(subject.id);
          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => toggleSubject(subject)}
              className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm transition ${
                isSelected
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div>
                <p className="font-semibold">{subject.name}</p>
                <p className="text-[11px] text-slate-500">
                  {subject.code} • {subject.default_exam_count} questions
                </p>
              </div>
              {subject.is_mandatory ? (
                <Lock className="h-4 w-4 shrink-0 text-emerald-700" />
              ) : isSelected ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-700" />
              ) : null}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || selectedIds.length !== 4}
          className="flex items-center gap-2 rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Subject Combination
        </button>
      </div>
    </div>
  );
}
