import { useState, type ChangeEvent } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { OptionKey, QuestionType, Subject } from '../../types/exam.types';

interface ParsedRow {
  subject_id: string;
  exam_year: number | null;
  question_type: QuestionType;
  stem: string;
  options: Array<{ key: OptionKey; text: string }>;
  correct_option: OptionKey;
  explanation: string;
  is_published: boolean;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const TEMPLATE_CSV = [
  'subject_code,exam_year,question_type,stem,option_a,option_b,option_c,option_d,correct_option,explanation',
  'MTH,2023,past,"Evaluate 3x + 2 when x = 4.",10,12,14,16,C,"3(4) + 2 = 12 + 2 = 14."',
  'ECO,,practice,"Scarcity in economics means:",Unlimited wants,Limited resources relative to wants,High prices,Zero supply,B,"Resources are finite while human wants are unlimited."',
].join('\n');

export function CsvImportPanel({
  subjects,
  onImported,
}: {
  subjects: Subject[];
  onImported: () => Promise<void>;
}) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [touchedSubjects, setTouchedSubjects] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jamb-questions-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setProgressMsg(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error('CSV must include a header row and at least 1 question.');

      const codeMap = new Map(subjects.map((s) => [s.code.toUpperCase(), s.id]));
      const parsed: ParsedRow[] = [];
      const subjectSet = new Set<string>();
      const seenInFile = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 9) throw new Error(`Row ${i + 1}: Expected at least 9 columns.`);

        const [code, yearStr, qTypeRaw, stem, optA, optB, optC, optD, ansRaw, explanation = ''] = cols;
        const subId = codeMap.get(code.toUpperCase());
        if (!subId) throw new Error(`Row ${i + 1}: Unknown subject_code "${code}".`);

        const ans = ansRaw.toUpperCase() as OptionKey;
        if (!['A', 'B', 'C', 'D'].includes(ans)) {
          throw new Error(`Row ${i + 1}: correct_option must be A, B, C, or D.`);
        }

        const dedupKey = `${subId}::${stem.toLowerCase()}`;
        if (seenInFile.has(dedupKey)) continue;
        seenInFile.add(dedupKey);

        subjectSet.add(subId);
        parsed.push({
          subject_id: subId,
          exam_year: yearStr ? Number(yearStr) : null,
          question_type: qTypeRaw.toLowerCase() === 'practice' ? 'practice' : 'past',
          stem,
          options: [
            { key: 'A', text: optA },
            { key: 'B', text: optB },
            { key: 'C', text: optC },
            { key: 'D', text: optD },
          ],
          correct_option: ans,
          explanation,
          is_published: true,
        });
      }

      setRows(parsed);
      setTouchedSubjects(Array.from(subjectSet));
    } catch (err) {
      setRows([]);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse CSV.');
    }
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    setErrorMsg(null);

    try {
      // Check existing stems per touched subject to avoid duplicates
      const existingStems = new Set<string>();
      for (const sId of touchedSubjects) {
        const { data } = await supabase
          .from('questions')
          .select('stem')
          .eq('subject_id', sId)
          .range(0, 1999);
        for (const item of data ?? []) {
          existingStems.add(`${sId}::${String(item.stem).trim().toLowerCase()}`);
        }
      }

      const freshRows = rows.filter(
        (r) => !existingStems.has(`${r.subject_id}::${r.stem.trim().toLowerCase()}`)
      );

      // Upload in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < freshRows.length; i += chunkSize) {
        const chunk = freshRows.slice(i, i + chunkSize);
        setProgressMsg(`Uploading ${Math.min(i + chunkSize, freshRows.length)} / ${freshRows.length}...`);
        const { error } = await supabase.from('questions').insert(chunk);
        if (error) throw error;
      }

      for (const sId of touchedSubjects) {
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('subject_id', sId)
          .eq('is_published', true);

        const { data: existing } = await supabase
          .from('offline_pack_manifests')
          .select('pack_version')
          .eq('subject_id', sId)
          .maybeSingle();

        await supabase.from('offline_pack_manifests').upsert({
          subject_id: sId,
          pack_version: (existing?.pack_version ?? 0) + 1,
          question_count: count ?? 0,
          updated_at: new Date().toISOString(),
        });
      }

      const skippedDupes = rows.length - freshRows.length;
      setProgressMsg(`Uploaded ${freshRows.length} new question(s) (${skippedDupes} duplicate(s) skipped).`);
      setRows([]);
      setFileName('');
      await onImported();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Import from CSV / Excel</h2>
          <p className="text-xs text-slate-500">
            Supports large files (500+ rows) with automatic duplicate detection.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" /> Download Template
        </button>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-emerald-600 hover:bg-emerald-50/30">
        <FileSpreadsheet className="h-8 w-8 text-emerald-700" />
        <span className="mt-2 text-xs font-bold text-slate-800">
          {fileName ? fileName : 'Tap to choose a .csv file'}
        </span>
        <span className="mt-0.5 text-[11px] text-slate-500">
          Columns: subject_code, exam_year, question_type, stem, option_a..d, correct_option, explanation
        </span>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
      </label>

      {errorMsg && (
        <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{errorMsg}</div>
      )}
      {progressMsg && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{progressMsg}</div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3">
          <span className="text-xs font-bold text-emerald-900">
            Ready: {rows.length} unique row(s) across {touchedSubjects.length} subject(s)
          </span>
          <button
            type="button"
            disabled={importing}
            onClick={handleImport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload CSV Now
          </button>
        </div>
      )}
    </div>
  );
}
