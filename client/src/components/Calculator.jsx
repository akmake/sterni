import React, { useState, useEffect } from 'react';
import { Delete } from 'lucide-react';

const Calculator = ({ isOpen, onClose }) => {
  const [input, setInput] = useState('0');
  const [prevInput, setPrevInput] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForNewInput, setWaitingForNewInput] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleNum = (num) => {
    if (waitingForNewInput) {
      setInput(String(num));
      setWaitingForNewInput(false);
    } else {
      setInput(input === '0' ? String(num) : input + num);
    }
  };

  const handleDot = () => {
    if (waitingForNewInput) {
      setInput('0.');
      setWaitingForNewInput(false);
      return;
    }
    if (!input.includes('.')) {
      setInput(input + '.');
    }
  };

  const handleOperator = (op) => {
    if (operator && !waitingForNewInput) {
      handleEqual();
    }
    setPrevInput(input);
    setOperator(op);
    setWaitingForNewInput(true);
  };

  const handleEqual = () => {
    if (!operator || !prevInput) return;

    const current = parseFloat(input);
    const previous = parseFloat(prevInput);
    let result = 0;

    switch (operator) {
      case '+': result = previous + current; break;
      case '-': result = previous - current; break;
      case '×': result = previous * current; break;
      case '÷': result = previous / current; break;
      default: return;
    }

    const formatted = parseFloat(result.toFixed(6)).toString();
    setInput(formatted);
    setPrevInput(null);
    setOperator(null);
    setWaitingForNewInput(true);
  };

  const handleClear = () => {
    setInput('0');
    setPrevInput(null);
    setOperator(null);
    setWaitingForNewInput(false);
  };

  if (!isOpen) return null;

  return (
    <div dir="ltr" className="fixed bottom-24 left-8 z-50 w-[220px] origin-bottom-left animate-in fade-in zoom-in-95 duration-200 font-sans">
      
      {/* Container: רקע כהה מאוד, קטן ומהודק */}
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[1.5rem] overflow-hidden p-3">
        
        {/* כפתורי חלון קטנטנים */}
        <div className="flex justify-between items-center mb-2 px-1">
           <div className="flex gap-1.5">
              <button onClick={onClose} className="w-2.5 h-2.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
           </div>
        </div>

        {/* מסך תצוגה מוקטן */}
        <div className="text-right mb-2 px-1 h-14 flex flex-col justify-end">
          <span className="text-zinc-400 text-xs h-4 font-light">
            {prevInput} {operator}
          </span>
          <div className="text-3xl font-light text-white tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
            {input}
          </div>
        </div>

        {/* גריד כפתורים צפוף יותר */}
        <div className="grid grid-cols-4 gap-2">
          
          {/* Row 1 */}
          <CalcBtn onClick={handleClear} color="gray">AC</CalcBtn>
          <CalcBtn onClick={() => setInput(String(parseFloat(input) * -1))} color="gray">±</CalcBtn>
          <CalcBtn onClick={() => setInput(String(parseFloat(input) / 100))} color="gray">%</CalcBtn>
          <CalcBtn onClick={() => handleOperator('÷')} color="orange">÷</CalcBtn>

          {/* Row 2 */}
          <CalcBtn onClick={() => handleNum(7)}>7</CalcBtn>
          <CalcBtn onClick={() => handleNum(8)}>8</CalcBtn>
          <CalcBtn onClick={() => handleNum(9)}>9</CalcBtn>
          <CalcBtn onClick={() => handleOperator('×')} color="orange">×</CalcBtn>

          {/* Row 3 */}
          <CalcBtn onClick={() => handleNum(4)}>4</CalcBtn>
          <CalcBtn onClick={() => handleNum(5)}>5</CalcBtn>
          <CalcBtn onClick={() => handleNum(6)}>6</CalcBtn>
          <CalcBtn onClick={() => handleOperator('-')} color="orange">−</CalcBtn>

          {/* Row 4 */}
          <CalcBtn onClick={() => handleNum(1)}>1</CalcBtn>
          <CalcBtn onClick={() => handleNum(2)}>2</CalcBtn>
          <CalcBtn onClick={() => handleNum(3)}>3</CalcBtn>
          <CalcBtn onClick={() => handleOperator('+')} color="orange">+</CalcBtn>

          {/* Row 5 */}
          <CalcBtn onClick={() => handleNum(0)} className="col-span-2 aspect-auto rounded-full pl-5 text-left">0</CalcBtn>
          <CalcBtn onClick={handleDot}>.</CalcBtn>
          <CalcBtn onClick={handleEqual} color="orange">=</CalcBtn>
        </div>

      </div>
    </div>
  );
};

// כפתור מעוצב בסגנון iOS Mini
const CalcBtn = ({ children, onClick, color = "dark", className = '' }) => {
  // הקטנתי את הגודל ל- h-10 w-10 (היה h-14 w-14)
  const baseStyle = "h-10 w-10 rounded-full flex items-center justify-center text-lg font-normal transition-all active:scale-95 select-none";
  
  const colors = {
    dark: "bg-zinc-700 text-white hover:bg-zinc-600",
    gray: "bg-zinc-300 text-black hover:bg-zinc-200 font-medium text-base", 
    orange: "bg-amber-500 text-white hover:bg-amber-400 text-xl pb-1",
  };

  return (
    <button onClick={onClick} className={`${baseStyle} ${colors[color]} ${className}`}>
      {children}
    </button>
  );
};

export default Calculator;