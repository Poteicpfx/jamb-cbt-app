import fs from 'node:fs';

const SUBJECT_CODES = {
  english: 'ENG',
  'english-language': 'ENG',
  mathematics: 'MTH',
  physics: 'PHY',
  chemistry: 'CHM',
  biology: 'BIO',
  economics: 'ECO',
  government: 'GOV',
  literature: 'LIT',
  'literature-in-english': 'LIT',
  commerce: 'COM',
  accounting: 'ACC',
  crk: 'CRS',
  crs: 'CRS',
  irk: 'IRS',
  irs: 'IRS',
  agric: 'AGR',
  geography: 'GEO',
};

const apiKey = process.env.ALOC_API_KEY;
const subjectArg = (process.argv[2] || '').toLowerCase();
const yearArg = process.argv[3] || '';

if (!apiKey || !SUBJECT_CODES[subjectArg]) {
  console.error('Usage: ALOC_API_KEY="..." node fetch-aloc.mjs <subject> [year]');
  process.exit(1);
}

const url = new URL('https://dev.aloc.com.ng/api/v1/questions');
url.searchParams.set('subject', subjectArg);
url.searchParams.set('examType', 'jamb');
url.searchParams.set('limit', '15');
if (yearArg) url.searchParams.set('year', yearArg);

const res = await fetch(url, {
  headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
});

if (!res.ok) {
  console.error(`API Error ${res.status}:`, await res.text());
  process.exit(1);
}

const payload = await res.json();
const items = Array.isArray(payload.data) ? payload.data : [];

const formatted = items
  .map((q) => {
    const opts = q.options || {};
    const prefix = q.section ? `[${String(q.section).trim()}] ` : '';
    const options = ['a', 'b', 'c', 'd'].map((k) => ({
      key: k.toUpperCase(),
      text: String(opts[k] ?? opts[k.toUpperCase()] ?? '').trim(),
    }));

    return {
      subject_code: SUBJECT_CODES[subjectArg],
      exam_year: q.year ?? (yearArg ? Number(yearArg) : null),
      question_type: 'past',
      stem: `${prefix}${String(q.text ?? q.question ?? '').trim()}`,
      image_url: q.image || q.imageUrl || null,
      options,
      correct_option: String(q.correctAnswer || 'a').trim().toUpperCase(),
      explanation: String(q.solution || q.explanation || '').trim(),
    };
  })
  .filter((q) => q.stem && q.options.every((o) => o.text.length > 0));

const outFile = `aloc-${SUBJECT_CODES[subjectArg]}${yearArg ? `-${yearArg}` : ''}.json`;
fs.writeFileSync(outFile, JSON.stringify(formatted, null, 2));

console.log(`Saved ${formatted.length} clean question(s) to ${outFile} (skipped ${items.length - formatted.length} incomplete).`);
console.log('Credits remaining:', res.headers.get('x-credits-remaining') ?? 'unknown');
