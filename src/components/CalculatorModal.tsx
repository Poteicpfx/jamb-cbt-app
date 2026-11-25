import { useState } from 'react';
import { Delete, X } from 'lucide-react';

export function CalculatorModal({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);

  function inputDigit(digit: string) {
    if (resetNext) {
      setDisplay(digit === '.' ? '0.' : digit);
      setResetNext(false);
      return;
    }
    if (digit === '.' && display.includes('.')) return;
    setDisplay(display === '0' && digit !== '.' ? digit : display + digit);
  }

  function compute(a: number, b: number, op: string): number {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  }

  function handleOperator(nextOp: string) {
    const current = parseFloat(display);
    if (prevValue !== null && operator && !resetNext) {
      const result = compute(prevValue, current, operator);
      setDisplay(Number.isFinite(result) ? String(Number(result.toFixed(8))) : 'Error');
      setPrevValue(Number.isFinite(result) ? result : null);
    } else {
      setPrevValue(current);
    }
    setOperator(nextOp);
    setResetNext(true);
  }

  function handleEquals() {
    if (prevValue === null || !operator) return;
    const current = parseFloat(display);
    const result = compute(prevValue, current, operator);
    setDisplay(Number.isFinite(result) ? String(Number(result.toFixed(8))) : 'Error');
    setPrevValue(null);
    setOperator(null);
    setResetNext(true);
  }

  function handleSqrt() {
    const val = parseFloat(display);
    if (val < 0 || Number.isNaN(val)) {
      setDisplay('Error');
    } else {
      setDisplay(String(Number(Math.sqrt(val).toFixed(8))));
    }
    setResetNext(true);
  }

  function handleClear() {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setResetNext(false);
  }

  function handleBackspace() {
    if (resetNext || display.length <= 1 || display === 'Error') {
      setDisplay('0');
      setResetNext(false);
    } else {
      setDisplay(display.slice(0, -1));
    }
  }

  const btn =
    'flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-800 active:bg-slate-100 hover:bg-slate-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            JAMB CBT Calculator
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 rounded-xl bg-slate-900 px-3 py-3 text-right font-mono text-2xl font-bold text-emerald-300 overflow-x-auto">
          {display}
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={handleClear} className={`${btn} !bg-red-50 !text-red-700`}>
            C
          </button>
          <button type="button" onClick={handleBackspace} className={btn} aria-label="Backspace">
            <Delete className="h-4 w-4" />
          </button>
          <button type="button" onClick={handleSqrt} className={btn}>
            √
          </button>
          <button type="button" onClick={() => handleOperator('/')} className={`${btn} !bg-emerald-50 !text-emerald-800`}>
            ÷
          </button>

          {['7', '8', '9'].map((d) => (
            <button key={d} type="button" onClick={() => inputDigit(d)} className={btn}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => handleOperator('*')} className={`${btn} !bg-emerald-50 !text-emerald-800`}>
            ×
          </button>

          {['4', '5', '6'].map((d) => (
            <button key={d} type="button" onClick={() => inputDigit(d)} className={btn}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => handleOperator('-')} className={`${btn} !bg-emerald-50 !text-emerald-800`}>
            −
          </button>

          {['1', '2', '3'].map((d) => (
            <button key={d} type="button" onClick={() => inputDigit(d)} className={btn}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => handleOperator('+')} className={`${btn} !bg-emerald-50 !text-emerald-800`}>
            +
          </button>

          <button type="button" onClick={() => inputDigit('0')} className={`${btn} col-span-2`}>
            0
          </button>
          <button type="button" onClick={() => inputDigit('.')} className={btn}>
            .
          </button>
          <button type="button" onClick={handleEquals} className={`${btn} !bg-emerald-800 !text-white`}>
            =
          </button>
        </div>
      </div>
    </div>
  );
}
