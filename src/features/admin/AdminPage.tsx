import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Database,
  FileJson,
  FileSpreadsheet,
  ImagePlus,
  Loader2,
  PlusCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { CsvImportPanel } from "./CsvImportPanel";
import { MathText } from '../../components/MathText';
import type { OptionKey, Question, QuestionType, Subject } from '../../types/exam.types';

const SAMPLE_BULK_JSON = "[\n  {\n    \"subject_code\": \"PHY\",\n    \"exam_year\": 2023,\n    \"question_type\": \"past\",\n    \"stem\": \"A car accelerates uniformly from rest at $2\\\\text{ m/s}^2$ for $5\\\\text{ s}$. What is its final velocity?\",\n    \"options\": [\n      {\n        \"key\": \"A\",\n        \"text\": \"$2.5\\\\text{ m/s}$\"\n      },\n      {\n        \"key\": \"B\",\n        \"text\": \"$7\\\\text{ m/s}$\"\n      },\n      {\n        \"key\": \"C\",\n        \"text\": \"$10\\\\text{ m/s}$\"\n      },\n      {\n        \"key\": \"D\",\n        \"text\": \"$25\\\\text{ m/s}$\"\n      }\n    ],\n    \"correct_option\": \"C\",\n    \"explanation\": \"Using $v = u + at$: $v = 0 + (2)(5) = 10\\\\text{ m/s}$.\"\n  },\n  {\n    \"subject_code\": \"PHY\",\n    \"exam_year\": 2022,\n    \"question_type\": \"past\",\n    \"stem\": \"Which of the following is a vector quantity?\",\n    \"options\": [\n      {\n        \"key\": \"A\",\n        \"text\": \"Mass\"\n      },\n      {\n        \"key\": \"B\",\n        \"text\": \"Speed\"\n      },\n      {\n        \"key\": \"C\",\n        \"text\": \"Momentum\"\n      },\n      {\n        \"key\": \"D\",\n        \"text\": \"Temperature\"\n      }\n    ],\n    \"correct_option\": \"C\",\n    \"explanation\": \"Momentum has both magnitude and direction, making it a vector quantity.\"\n  },\n  {\n    \"subject_code\": \"CHM\",\n    \"exam_year\": 2023,\n    \"question_type\": \"past\",\n    \"stem\": \"What is the pH of a neutral aqueous solution at $25^\\\\circ\\\\text{C}$?\",\n    \"options\": [\n      {\n        \"key\": \"A\",\n        \"text\": \"0\"\n      },\n      {\n        \"key\": \"B\",\n        \"text\": \"1\"\n      },\n      {\n        \"key\": \"C\",\n        \"text\": \"7\"\n      },\n      {\n        \"key\": \"D\",\n        \"text\": \"14\"\n      }\n    ],\n    \"correct_option\": \"C\",\n    \"explanation\": \"Pure water at $25^\\\\circ\\\\text{C}$ has $[\\\\text{H}^+] = 10^{-7}\\\\text{ mol/dm}^3$, so $\\\\text{pH} = 7$.\"\n  },\n  {\n    \"subject_code\": \"BIO\",\n    \"exam_year\": 2023,\n    \"question_type\": \"past\",\n    \"stem\": \"Which cell organelle is primarily responsible for cellular respiration (ATP production)?\",\n    \"options\": [\n      {\n        \"key\": \"A\",\n        \"text\": \"Ribosome\"\n      },\n      {\n        \"key\": \"B\",\n        \"text\": \"Mitochondrion\"\n      },\n      {\n        \"key\": \"C\",\n        \"text\": \"Golgi body\"\n      },\n      {\n        \"key\": \"D\",\n        \"text\": \"Lysosome\"\n      }\n    ],\n    \"correct_option\": \"B\",\n    \"explanation\": \"Mitochondria are the powerhouse of the cell where aerobic respiration produces ATP.\"\n  }\n]";

export function AdminPage() {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [tab, setTab] = useState<'list' | 'add' | 'bulk' | 'csv'>('list');
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add single question state
  const [subjectId, setSubjectId] = useState('');
  const [examYear, setExamYear] = useState('2024');
  const [qType, setQType] = useState<QuestionType>('past');
  const [stem, setStem] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOption, setCorrectOption] = useState<OptionKey>('A');
  const [explanation, setExplanation] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Bulk JSON state
  const [bulkJson, setBulkJson] = useState(SAMPLE_BULK_JSON);

  async function loadAdminData(selectedSubId?: string) {
    setLoading(true);
    const { data: subs } = await supabase.from('subjects').select('*').order('name');
    const subList = (subs ?? []) as Subject[];
    setSubjects(subList);

    const activeFilter = selectedSubId ?? filterSubjectId;
    if (!subjectId && subList.length > 0) {
      setSubjectId(subList[0].id);
    }

    let query = supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (activeFilter) {
      query = query.eq('subject_id', activeFilter);
    }

    const { data: qs } = await query;
    setQuestions((qs ?? []) as Question[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAdminData();
  }, [filterSubjectId]);

  async function bumpManifest(targetSubjectId: string) {
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('subject_id', targetSubjectId)
      .eq('is_published', true);

    const { data: existing } = await supabase
      .from('offline_pack_manifests')
      .select('pack_version')
      .eq('subject_id', targetSubjectId)
      .maybeSingle();

    await supabase.from('offline_pack_manifests').upsert({
      subject_id: targetSubjectId,
      pack_version: (existing?.pack_version ?? 0) + 1,
      question_count: count ?? 0,
      updated_at: new Date().toISOString(),
    });
  }

  async function handleAddQuestion(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      let uploadedImageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() || 'png';
        const filePath = `${subjectId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('question-media')
          .upload(filePath, imageFile);
        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('question-media')
          .getPublicUrl(filePath);
        uploadedImageUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase.from('questions').insert({
        subject_id: subjectId,
        exam_year: examYear ? Number(examYear) : null,
        question_type: qType,
        stem: stem.trim(),
        image_url: uploadedImageUrl,
        options: [
          { key: 'A', text: optA.trim() },
          { key: 'B', text: optB.trim() },
          { key: 'C', text: optC.trim() },
          { key: 'D', text: optD.trim() },
        ],
        correct_option: correctOption,
        explanation: explanation.trim(),
        is_published: true,
      });

      if (error) throw error;

      await bumpManifest(subjectId);
      setStem('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setExplanation('');
      setImageFile(null);
      setStatusMsg('Question added and offline pack version updated!');
      setTab('list');
      await loadAdminData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save question.');
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkImport() {
    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const parsed = JSON.parse(bulkJson) as Array<{
        subject_code: string;
        exam_year?: number | null;
        question_type?: QuestionType;
        stem: string;
        options: Array<{ key: OptionKey; text: string }>;
        correct_option: OptionKey;
        explanation?: string;
      }>;

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('JSON must be a non-empty array of questions.');
      }

      const codeToId = new Map(subjects.map((s) => [s.code.toUpperCase(), s.id]));
      const touchedSubjects = new Set<string>();

      const rows = parsed.map((item, idx) => {
        const subId = codeToId.get(item.subject_code?.toUpperCase());
        if (!subId) {
          throw new Error(`Row ${idx + 1}: Unknown subject_code "${item.subject_code}".`);
        }
        touchedSubjects.add(subId);
        return {
          subject_id: subId,
          exam_year: item.exam_year ?? null,
          question_type: item.question_type ?? 'past',
          stem: item.stem,
          options: item.options,
          correct_option: item.correct_option,
          explanation: item.explanation ?? '',
          is_published: true,
        };
      });

      const { error } = await supabase.from('questions').insert(rows);
      if (error) throw error;

      for (const sId of touchedSubjects) {
        await bumpManifest(sId);
      }

      setStatusMsg(`Imported ${rows.length} questions successfully!`);
      setTab('list');
      await loadAdminData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid JSON or import failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(q: Question) {
    if (!window.confirm('Delete this question?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', q.id);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    await bumpManifest(q.subject_id);
    await loadAdminData();
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">Admin Access Only</h1>
          <p className="mt-1 text-xs text-slate-600">
            Your account does not have administrator privileges.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">Admin Question Bank</h1>
              <p className="text-xs text-slate-500">Manage JAMB past &amp; practice questions</p>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            {questions.length} loaded
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-200/70 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 ${
              tab === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Database className="h-3.5 w-3.5" /> Questions
          </button>
          <button
            type="button"
            onClick={() => setTab('add')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 ${
              tab === 'add' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" /> Add Question
          </button>
          <button
            type="button"
            onClick={() => setTab('bulk')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 ${
              tab === 'bulk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <FileJson className="h-3.5 w-3.5" /> JSON
          </button>
          <button
            type="button"
            onClick={() => setTab('csv')}
            className={`flex items-center justify-center gap-1 rounded-lg py-2.5 ${tab === 'csv' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {statusMsg && (
          <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}

        {/* TAB 1: QUESTION LIST */}
        {tab === 'list' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <select
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 p-6 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading question bank...
              </div>
            ) : questions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                No questions found for this filter. Use <strong>Add Question</strong> or{' '}
                <strong>Bulk JSON</strong> to add some!
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q) => {
                  const sub = subjectMap.get(q.subject_id);
                  return (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            {sub?.code ?? 'SUB'}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                            {q.question_type.toUpperCase()} {q.exam_year ?? ''}
                          </span>
                          <span className="rounded bg-emerald-800 px-2 py-0.5 text-white">
                            Ans: {q.correct_option}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(q)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <p className="mt-2 text-sm text-slate-900">
                        <MathText text={q.stem} />
                      </p>

                      {q.image_url && (
                        <img
                          src={q.image_url}
                          alt="Question diagram"
                          className="mt-2 max-h-40 rounded-lg border border-slate-200 object-contain"
                        />
                      )}

                      <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
                        {q.options.map((opt) => (
                          <div
                            key={opt.key}
                            className={`rounded-lg border px-2.5 py-1.5 ${
                              opt.key === q.correct_option
                                ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900'
                                : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="mr-1.5 font-bold">{opt.key}.</span>
                            <MathText text={opt.text} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: ADD SINGLE QUESTION */}
        {tab === 'add' && (
          <form
            onSubmit={handleAddQuestion}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Subject</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Type</label>
                <select
                  value={qType}
                  onChange={(e) => setQType(e.target.value as QuestionType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="past">Past Question</option>
                  <option value="practice">Practice Question</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Exam Year</label>
                <input
                  type="number"
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value)}
                  placeholder="2024"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Question Stem (use $...$ for math formulas)
              </label>
              <textarea
                required
                rows={3}
                value={stem}
                onChange={(e) => setStem(e.target.value)}
                placeholder="e.g. Calculate the kinetic energy if mass is $2\\text{ kg}$..."
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>

            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <ImagePlus className="h-4 w-4 text-emerald-700" />
                <span>{imageFile ? imageFile.name : 'Attach Diagram (Optional)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                value={optA}
                onChange={(e) => setOptA(e.target.value)}
                placeholder="Option A"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                required
                value={optB}
                onChange={(e) => setOptB(e.target.value)}
                placeholder="Option B"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                required
                value={optC}
                onChange={(e) => setOptC(e.target.value)}
                placeholder="Option C"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                required
                value={optD}
                onChange={(e) => setOptD(e.target.value)}
                placeholder="Option D"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Correct Option</label>
                <select
                  value={correctOption}
                  onChange={(e) => setCorrectOption(e.target.value as OptionKey)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">Explanation</label>
                <input
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Step-by-step explanation shown after exam"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Question to Bank
            </button>
          </form>
        )}

        {/* TAB 3: BULK JSON IMPORT */}
        {tab === 'bulk' && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Bulk Import Questions (JSON)</h2>
                <p className="text-xs text-slate-500">
                  Pre-loaded with starter Physics, Chemistry &amp; Biology JAMB questions—tap Import to load them!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkJson(SAMPLE_BULK_JSON)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset Sample JSON
              </button>
            </div>

            <textarea
              rows={12}
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-emerald-300"
            />

            <button
              type="button"
              disabled={saving}
              onClick={handleBulkImport}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Import Questions Now
            </button>
          </div>
        )}
              {tab === 'csv' && (
          <CsvImportPanel
            subjects={subjects}
            onImported={async () => {
              setStatusMsg('CSV questions imported and offline packs updated!');
              setTab('list');
              await loadAdminData();
            }}
          />
        )}
      </main>
    </div>
  );
}
