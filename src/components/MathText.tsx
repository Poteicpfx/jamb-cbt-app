import katex from 'katex';

function formatHtmlSuperscripts(raw: string): string {
  const supMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ',
  };
  const subMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  };

  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<sup>(.*?)<\/sup>/gi, (_, inner: string) =>
      inner.split('').map((c) => supMap[c] ?? `^${c}`).join('')
    )
    .replace(/<sub>(.*?)<\/sub>/gi, (_, inner: string) =>
      inner.split('').map((c) => subMap[c] ?? `_${c}`).join('')
    )
    .replace(/<\/?(p|div|span|b|strong|i|em)>/gi, '');
}

export function MathText({ text, className = '' }: { text: string; className?: string }) {
  const cleaned = formatHtmlSuperscripts(text || '');
  const parts = cleaned.split(/(\$[^$]+\$)/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const expr = part.slice(1, -1);
          try {
            const html = katex.renderToString(expr, { throwOnError: false });
            return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={idx}>{part}</span>;
          }
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}
