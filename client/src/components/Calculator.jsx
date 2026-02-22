import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Delete } from 'lucide-react';

const Calculator = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [memory, setMemory] = useState(null);     // stored first operand
  const [op, setOp] = useState(null);              // pending operator
  const [lastVal, setLastVal] = useState(null);    // for repeat-equal
  const [lastOp, setLastOp] = useState(null);      // for repeat-equal
  const [fresh, setFresh] = useState(true);        // next digit replaces display
  const containerRef = useRef(null);

  // --- core math ---
  const calc = (a, operator, b) => {
    const x = parseFloat(a);
    const y = parseFloat(b);
    switch (operator) {
      case '+': return x + y;
      case '-': return x - y;
      case '×': return x * y;
      case '÷': return y === 0 ? 'Error' : x / y;
      default: return y;
    }
  };

  const fmt = (v) => {
    if (v === 'Error') return 'Error';
    const n = parseFloat(parseFloat(v).toFixed(10));
    return String(n);
  };

  // --- handlers ---
  const handleNum = useCallback((d) => {
    setDisplay(prev => {
      if (fresh || prev === '0' || prev === 'Error') return String(d);
      return prev + d;
    });
    setFresh(false);
  }, [fresh]);

  const handleDot = useCallback(() => {
    setDisplay(prev => {
      if (fresh) return '0.';
      if (prev.includes('.')) return prev;
      return prev + '.';
    });
    setFresh(false);
  }, [fresh]);

  const handleOperator = useCallback((nextOp) => {
    setDisplay(prev => {
      const currentVal = prev;
      if (op && !fresh) {
        // chain: compute pending operation first
        const result = fmt(calc(memory, op, currentVal));
        setMemory(result);
        setOp(nextOp);
        setFresh(true);
        setLastVal(null);
        setLastOp(null);
        return result;
      }
      // no pending op or just pressed an operator — store current value
      setMemory(currentVal);
      setOp(nextOp);
      setFresh(true);
      setLastVal(null);
      setLastOp(null);
      return prev;
    });
  }, [op, memory, fresh]);

  const handleEqual = useCallback(() => {
    setDisplay(prev => {
      if (op && memory !== null) {
        // normal: first press of =
        const currentVal = fresh ? memory : prev;
        const result = fmt(calc(memory, op, currentVal));
        setLastVal(currentVal);
        setLastOp(op);
        setMemory(null);
        setOp(null);
        setFresh(true);
        return result;
      }
      if (lastOp && lastVal !== null) {
        // repeat: pressing = again repeats the last operation
        const result = fmt(calc(prev, lastOp, lastVal));
        setFresh(true);
        return result;
      }
      return prev;
    });
  }, [op, memory, fresh, lastOp, lastVal]);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setMemory(null);
    setOp(null);
    setLastVal(null);
    setLastOp(null);
    setFresh(true);
  }, []);

  const handleBackspace = useCallback(() => {
    setDisplay(prev => {
      if (fresh || prev === 'Error') return '0';
      if (prev.length <= 1 || (prev.length === 2 && prev.startsWith('-'))) {
        setFresh(true);
        return '0';
      }
      return prev.slice(0, -1);
    });
  }, [fresh]);

  const handleToggleSign = useCallback(() => {
    setDisplay(prev => {
      if (prev === '0' || prev === 'Error') return prev;
      return prev.startsWith('-') ? prev.slice(1) : '-' + prev;
    });
  }, []);

  const handlePercent = useCallback(() => {
    setDisplay(prev => fmt(parseFloat(prev) / 100));
    setFresh(true);
  }, []);

  // --- keyboard support ---
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key >= '0' && e.key <= '9') { handleNum(e.key); return; }
      if (e.key === '.') { handleDot(); return; }
      if (e.key === '+') { handleOperator('+'); return; }
      if (e.key === '-') { handleOperator('-'); return; }
      if (e.key === '*') { handleOperator('×'); return; }
      if (e.key === '/') { e.preventDefault(); handleOperator('÷'); return; }
      if (e.key === 'Enter' || e.key === '=') { handleEqual(); return; }
      if (e.key === 'Backspace') { handleBackspace(); return; }
      if (e.key === 'Delete' || e.key === 'c' || e.key === 'C') { handleClear(); return; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, handleNum, handleDot, handleOperator, handleEqual, handleBackspace, handleClear]);

  if (!isOpen) return null;

  // determine which operator button is "active"
  const activeOp = (fresh && op) ? op : null;

  return (
    <div dir="ltr" ref={containerRef} className="fixed bottom-24 left-8 z-50 w-[240px] origin-bottom-left animate-in fade-in zoom-in-95 duration-200 font-sans">
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[1.5rem] overflow-hidden p-3">

        {/* Window dots */}
        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex gap-1.5">
            <button onClick={onClose} className="w-2.5 h-2.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
        </div>

        {/* Display */}
        <div className="text-right mb-2 px-2 h-16 flex flex-col justify-end">
          <span className="text-zinc-500 text-xs h-4 font-light truncate">
            {memory !== null ? `${memory} ${op || ''}` : '\u00A0'}
          </span>
          <div className={`font-light text-white tracking-tight overflow-hidden text-ellipsis whitespace-nowrap ${display.length > 10 ? 'text-xl' : display.length > 7 ? 'text-2xl' : 'text-3xl'}`}>
            {display}
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          <CalcBtn onClick={handleClear} color="gray">AC</CalcBtn>
          <CalcBtn onClick={handleToggleSign} color="gray">±</CalcBtn>
          <CalcBtn onClick={handlePercent} color="gray">%</CalcBtn>
          <CalcBtn onClick={() => handleOperator('÷')} color="orange" active={activeOp === '÷'}>÷</CalcBtn>

          <CalcBtn onClick={() => handleNum(7)}>7</CalcBtn>
          <CalcBtn onClick={() => handleNum(8)}>8</CalcBtn>
          <CalcBtn onClick={() => handleNum(9)}>9</CalcBtn>
          <CalcBtn onClick={() => handleOperator('×')} color="orange" active={activeOp === '×'}>×</CalcBtn>

          <CalcBtn onClick={() => handleNum(4)}>4</CalcBtn>
          <CalcBtn onClick={() => handleNum(5)}>5</CalcBtn>
          <CalcBtn onClick={() => handleNum(6)}>6</CalcBtn>
          <CalcBtn onClick={() => handleOperator('-')} color="orange" active={activeOp === '-'}>−</CalcBtn>

          <CalcBtn onClick={() => handleNum(1)}>1</CalcBtn>
          <CalcBtn onClick={() => handleNum(2)}>2</CalcBtn>
          <CalcBtn onClick={() => handleNum(3)}>3</CalcBtn>
          <CalcBtn onClick={() => handleOperator('+')} color="orange" active={activeOp === '+'}>+</CalcBtn>

          {/* Bottom row */}
          <CalcBtn onClick={() => handleNum(0)} className="col-span-1">0</CalcBtn>
          <CalcBtn onClick={handleDot}>.</CalcBtn>
          <CalcBtn onClick={handleBackspace} color="gray"><Delete size={16} /></CalcBtn>
          <CalcBtn onClick={handleEqual} color="orange">=</CalcBtn>
        </div>
      </div>
    </div>
  );
};

const CalcBtn = ({ children, onClick, color = "dark", active = false, className = '' }) => {
  const base = "h-11 rounded-full flex items-center justify-center text-lg font-normal transition-all active:scale-90 select-none cursor-pointer";

  const colors = {
    dark: "bg-zinc-700 text-white hover:bg-zinc-600",
    gray: "bg-zinc-400/80 text-black hover:bg-zinc-300 font-medium text-base",
    orange: active
      ? "bg-white text-amber-500 hover:bg-zinc-100 text-xl"
      : "bg-amber-500 text-white hover:bg-amber-400 text-xl",
  };

  return (
    <button onClick={onClick} className={`${base} ${colors[color]} ${className}`}>
      {children}
    </button>
  );
};

export default Calculator;