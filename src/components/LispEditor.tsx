import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { highlightLispCode } from '../lisp/syntax';
import { Sparkles, Eye, EyeOff, Hash, CircleDot } from 'lucide-react';

interface LispEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  breakpoints?: Set<number>;
  onToggleBreakpoint?: (line: number) => void;
  activePausedLine?: number | null;
}

export function LispEditor({
  value,
  onChange,
  className = '',
  breakpoints,
  onToggleBreakpoint,
  activePausedLine,
}: LispEditorProps) {
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [currentScrollTop, setCurrentScrollTop] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Tokenize code for syntax highlighting
  const tokens = useMemo(() => {
    if (!highlightEnabled) return [];
    return highlightLispCode(value);
  }, [value, highlightEnabled]);

  const lines = useMemo(() => value.split('\n'), [value]);

  // Synchronize scroll positions between textarea, syntax overlay pre, and line numbers
  const handleScroll = useCallback(() => {
    if (!textareaRef.current) return;
    const { scrollTop, scrollLeft } = textareaRef.current;

    setCurrentScrollTop(scrollTop);

    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  }, []);

  const updateCursorPos = useCallback(() => {
    if (!textareaRef.current) return;
    const sel = textareaRef.current.selectionStart;
    const textBefore = value.slice(0, sel);
    const lineList = textBefore.split('\n');
    setCursorPos({
      line: lineList.length,
      col: lineList[lineList.length - 1].length + 1,
    });
  }, [value]);

  // Handle Tab indentation and smart auto-closing parentheses and quotes
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Handle Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift-Tab: unindent 2 spaces if possible
        const before = value.substring(0, start);
        const after = value.substring(end);
        const lineStart = before.lastIndexOf('\n') + 1;
        const currentLine = before.substring(lineStart);
        if (currentLine.startsWith('  ')) {
          const newValue = before.substring(0, lineStart) + currentLine.substring(2) + after;
          onChange(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
          });
        }
      } else {
        // Tab: insert 2 spaces
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
      return;
    }

    // Auto-close '('
    if (e.key === '(' && start === end) {
      e.preventDefault();
      const newValue = value.substring(0, start) + '()' + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
      return;
    }

    // Auto-close '"'
    if (e.key === '"' && start === end) {
      // If next char is already '"', just step over it
      if (value[start] === '"') {
        e.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        return;
      }
      e.preventDefault();
      const newValue = value.substring(0, start) + '""' + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
      return;
    }

    // Skip over closing paren ')'
    if (e.key === ')' && start === end && value[start] === ')') {
      e.preventDefault();
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      return;
    }

    // Handle Backspace for paired () and ""
    if (e.key === 'Backspace' && start === end && start > 0) {
      const prevChar = value[start - 1];
      const nextChar = value[start];
      if ((prevChar === '(' && nextChar === ')') || (prevChar === '"' && nextChar === '"')) {
        e.preventDefault();
        const newValue = value.substring(0, start - 1) + value.substring(start + 1);
        onChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start - 1;
        });
      }
    }
  };

  // Sync scroll on initial render or resize
  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  return (
    <div className={`flex flex-col h-full bg-slate-950 select-text overflow-hidden ${className}`}>
      {/* Editor Main Canvas */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Interactive Line Numbers Gutter with Visual Breakpoints */}
        <div
          ref={lineNumbersRef}
          className="w-14 shrink-0 bg-slate-900/60 border-r border-slate-800/80 py-4 select-none overflow-hidden font-mono text-xs text-slate-600 z-20"
        >
          {lines.map((_, i) => {
            const lineNum = i + 1;
            const hasBreakpoint = breakpoints?.has(lineNum);
            const isPausedHere = activePausedLine === lineNum;

            return (
              <div
                key={i}
                onClick={() => onToggleBreakpoint?.(lineNum)}
                title={
                  hasBreakpoint
                    ? `Remove breakpoint at line ${lineNum}`
                    : `Click to set breakpoint at line ${lineNum}`
                }
                className={`leading-6 h-6 flex items-center justify-between px-2 cursor-pointer transition-colors group ${
                  isPausedHere
                    ? 'bg-amber-500/25 text-amber-300 font-bold'
                    : hasBreakpoint
                    ? 'bg-rose-950/40 text-rose-300 font-medium'
                    : 'hover:bg-slate-800/70 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center w-3 h-3 shrink-0">
                  {isPausedHere ? (
                    <span className="text-amber-400 text-xs font-bold leading-none animate-pulse">
                      ▶
                    </span>
                  ) : hasBreakpoint ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/90" />
                  ) : (
                    <span className="w-2 h-2 rounded-full border border-rose-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
                <span className="text-right flex-1 select-none text-[11px]">{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Code Canvas Container */}
        <div className="relative flex-1 h-full overflow-hidden bg-slate-950">
          {/* Active Paused Line Highlight Overlay */}
          {activePausedLine && (
            <div
              className="absolute left-0 right-0 h-6 bg-amber-500/15 border-y border-amber-400/40 pointer-events-none z-5 transition-all"
              style={{
                top: (activePausedLine - 1) * 24 + 16 - currentScrollTop,
              }}
            />
          )}

          {/* Syntax Highlighting Overlay (Pre-rendered spans) */}
          {highlightEnabled && (
            <pre
              ref={preRef}
              aria-hidden="true"
              className="absolute inset-0 m-0 py-4 px-4 font-mono text-sm leading-6 whitespace-pre overflow-hidden pointer-events-none select-none z-0"
              style={{
                tabSize: 2,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            >
              <code>
                {tokens.map((token, idx) => (
                  <span key={idx} className={token.className}>
                    {token.text}
                  </span>
                ))}
                {/* Prevent trailing newline collapse */}
                {value.endsWith('\n') && '\n'}
              </code>
            </pre>
          )}

          {/* Interactive Textarea Layer */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onClick={updateCursorPos}
            onKeyUp={updateCursorPos}
            onSelect={updateCursorPos}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            className={`absolute inset-0 w-full h-full m-0 py-4 px-4 font-mono text-sm leading-6 whitespace-pre resize-none bg-transparent caret-white selection:bg-indigo-600/40 focus:outline-none overflow-auto border-0 z-10 ${
              highlightEnabled ? 'text-transparent' : 'text-slate-200'
            }`}
            style={{
              tabSize: 2,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          />
        </div>
      </div>

      {/* Editor Status / Controls Bar */}
      <div className="h-7 border-t border-slate-800/80 bg-slate-900/80 px-3 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setHighlightEnabled((prev) => !prev)}
            title="Toggle Syntax Highlighting"
            className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
          >
            {highlightEnabled ? (
              <>
                <Sparkles size={12} className="text-indigo-400" />
                <span className="text-indigo-300">Highlighting: ON</span>
              </>
            ) : (
              <>
                <EyeOff size={12} className="text-slate-500" />
                <span className="text-slate-500">Highlighting: OFF</span>
              </>
            )}
          </button>

          <span className="text-slate-700">|</span>

          {breakpoints && breakpoints.size > 0 && (
            <>
              <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                <CircleDot size={11} className="text-rose-500" />
                {breakpoints.size} Breakpoint{breakpoints.size > 1 ? 's' : ''}
              </span>
              <span className="text-slate-700">|</span>
            </>
          )}

          <span className="flex items-center gap-1 text-slate-400">
            <Hash size={11} className="text-slate-500" />
            {lines.length} lines, {value.length} chars
          </span>
        </div>

        <div className="flex items-center gap-4">
          {activePausedLine && (
            <span className="text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40 text-[10px] animate-pulse">
              PAUSED @ LN {activePausedLine}
            </span>
          )}
          <span className="text-slate-400">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="text-slate-600">Spaces: 2</span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-400 text-[10px] border border-indigo-800/40">
            LISP
          </span>
        </div>
      </div>
    </div>
  );
}
