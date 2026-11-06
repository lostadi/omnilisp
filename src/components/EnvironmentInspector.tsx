import React, { useState } from 'react';
import {
  Play,
  StepForward,
  Square,
  Bug,
  List,
  Variable,
  Layers,
  Search,
  ChevronDown,
  ChevronRight,
  CircleDot,
  CheckCircle2,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { DebugFrame, DebugAction, LispValue, Env } from '../lisp/types';

interface EnvironmentInspectorProps {
  isPaused: boolean;
  pausedFrame: DebugFrame | null;
  breakpoints: Set<number>;
  onContinue: () => void;
  onStep: () => void;
  onStop: () => void;
  onClearBreakpoints: () => void;
  onRemoveBreakpoint: (line: number) => void;
}

export function EnvironmentInspector({
  isPaused,
  pausedFrame,
  breakpoints,
  onContinue,
  onStep,
  onStop,
  onClearBreakpoints,
  onRemoveBreakpoint,
}: EnvironmentInspectorProps) {
  const [activeScopeTab, setActiveScopeTab] = useState<'local' | 'global' | 'stack'>('local');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Extract bindings from paused frame
  const localBinds: Record<string, LispValue> = pausedFrame?.env.binds || {};
  const globalBinds: Record<string, LispValue> = pausedFrame ? pausedFrame.env.getAllBinds() : {};

  // Filter bindings based on search
  const filteredLocal = Object.entries(localBinds).filter(([k]) =>
    k.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGlobal = Object.entries(globalBinds).filter(
    ([k]) => !localBinds[k] && k.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-200 select-text overflow-hidden">
      {/* Debugger Control Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug size={16} className={isPaused ? 'text-amber-400 animate-pulse' : 'text-slate-500'} />
            <span className="font-semibold text-xs tracking-wide">
              {isPaused ? (
                <span className="text-amber-300 font-mono">
                  PAUSED at Line {pausedFrame?.line}
                </span>
              ) : (
                <span className="text-slate-400">Debugger Ready</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onContinue}
              disabled={!isPaused}
              title="Continue Execution (F5)"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-medium transition-colors shadow-xs"
            >
              <Play size={12} className="fill-current" />
              <span>Resume</span>
            </button>

            <button
              onClick={onStep}
              disabled={!isPaused}
              title="Step Next Expression (F10)"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <StepForward size={12} />
              <span>Step</span>
            </button>

            <button
              onClick={onStop}
              disabled={!isPaused}
              title="Stop Debugger"
              className="p-1 rounded bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 disabled:opacity-40 transition-colors"
            >
              <Square size={13} className="fill-current" />
            </button>
          </div>
        </div>

        {/* Current Paused Expression Snippet */}
        {isPaused && pausedFrame && (
          <div className="bg-slate-900 border border-amber-500/30 rounded p-2 text-xs font-mono">
            <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Evaluating Expression (Line {pausedFrame.line}):</span>
              <span className="text-slate-500">Depth {pausedFrame.depth}</span>
            </div>
            <pre className="text-slate-200 whitespace-pre-wrap break-all overflow-x-auto text-[11px] leading-relaxed">
              {formatLispValue(pausedFrame.exp)}
            </pre>
          </div>
        )}
      </div>

      {/* Breakpoint Status & Tabs */}
      <div className="h-9 border-b border-slate-800 bg-slate-950/40 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveScopeTab('local')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeScopeTab === 'local'
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Variable size={12} />
            <span>Local Scope ({Object.keys(localBinds).length})</span>
          </button>

          <button
            onClick={() => setActiveScopeTab('global')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeScopeTab === 'global'
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers size={12} />
            <span>Global / Outer ({Object.keys(globalBinds).length})</span>
          </button>

          <button
            onClick={() => setActiveScopeTab('stack')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeScopeTab === 'stack'
                ? 'bg-slate-800 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CircleDot size={12} className="text-rose-400" />
            <span>Breakpoints ({breakpoints.size})</span>
          </button>
        </div>
      </div>

      {/* Search Input for variables */}
      {activeScopeTab !== 'stack' && (
        <div className="p-2 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search variables by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-3 py-1 text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-3 bg-slate-950/40">
        {/* TAB 1: LOCAL VARIABLES */}
        {activeScopeTab === 'local' && (
          <div className="flex flex-col gap-1.5">
            {filteredLocal.length > 0 ? (
              filteredLocal.map(([key, val]) => (
                <VariableRow
                  key={key}
                  name={key}
                  value={val}
                  isExpanded={!!expandedKeys[key]}
                  onToggleExpand={() => toggleExpand(key)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-500 italic">
                {isPaused
                  ? 'No local variables in current stack frame.'
                  : 'Start execution or hit a breakpoint to inspect variables.'}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GLOBAL / OUTER VARIABLES */}
        {activeScopeTab === 'global' && (
          <div className="flex flex-col gap-1.5">
            {filteredGlobal.length > 0 ? (
              filteredGlobal.map(([key, val]) => (
                <VariableRow
                  key={key}
                  name={key}
                  value={val}
                  isExpanded={!!expandedKeys[key]}
                  onToggleExpand={() => toggleExpand(key)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-500 italic">
                No matching variables found.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BREAKPOINTS LIST */}
        {activeScopeTab === 'stack' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Active Breakpoints ({breakpoints.size})</span>
              {breakpoints.size > 0 && (
                <button
                  onClick={onClearBreakpoints}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {breakpoints.size > 0 ? (
              Array.from(breakpoints)
                .sort((a, b) => a - b)
                .map((line) => (
                  <div
                    key={line}
                    className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/80 shrink-0" />
                      <span className="text-slate-200">Line {line}</span>
                    </div>

                    <button
                      onClick={() => onRemoveBreakpoint(line)}
                      className="text-slate-500 hover:text-rose-400 px-1.5 py-0.5 rounded transition-colors text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-xs text-slate-500 italic">
                No breakpoints set. Click any line number in the code editor to add a visual breakpoint.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="h-6 border-t border-slate-800 bg-slate-950 px-3 flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0">
        <span>F5: Resume | F10: Step</span>
        <span>{breakpoints.size} Breakpoints Active</span>
      </div>
    </div>
  );
}

interface VariableRowProps {
  key?: string;
  name: string;
  value: LispValue;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function VariableRow({
  name,
  value,
  isExpanded,
  onToggleExpand,
}: VariableRowProps) {
  const typeStr = getValueType(value);
  const isExpandable = Array.isArray(value) && value.length > 0;

  return (
    <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80 text-xs font-mono flex flex-col gap-1 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {isExpandable ? (
            <button
              onClick={onToggleExpand}
              className="text-slate-500 hover:text-slate-300 p-0.5"
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-4" />
          )}

          <span className="font-semibold text-indigo-300 truncate">{name}</span>
        </div>

        <span
          className={`text-[9px] px-1.5 py-0.2 rounded font-sans uppercase font-medium ${
            typeStr === 'number'
              ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
              : typeStr === 'string'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
              : typeStr === 'list'
              ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/40'
              : typeStr === 'lambda'
              ? 'bg-purple-950 text-purple-400 border border-purple-800/40'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {typeStr}
        </span>
      </div>

      {/* Formatted Value Preview */}
      <div className="pl-5 text-slate-300 break-all text-[11px]">
        {formatLispValue(value)}
      </div>

      {/* Expanded List Items */}
      {isExpandable && isExpanded && Array.isArray(value) && (
        <div className="pl-6 pt-1 flex flex-col gap-1 border-l border-slate-800 ml-2 mt-1">
          {value.map((item, idx) => (
            <div key={idx} className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="text-slate-600 font-mono text-[10px]">[{idx}]:</span>
              <span className="text-slate-300">{formatLispValue(item)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getValueType(val: LispValue): string {
  if (val === null) return 'null';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'string') return 'string';
  if (typeof val === 'boolean') return 'boolean';
  if (Array.isArray(val)) return 'list';
  if (typeof val === 'object' && val !== null) {
    if ('type' in val) {
      if (val.type === 'lambda') return 'lambda';
      if (val.type === 'js_function') return 'builtin';
    }
  }
  return typeof val;
}

function formatLispValue(val: LispValue): string {
  if (val === null) return 'null';
  if (typeof val === 'string') return JSON.stringify(val);
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '()';
    const items = val.map(formatLispValue).join(' ');
    return `(${items})`;
  }
  if (typeof val === 'object' && val !== null) {
    if ('type' in val) {
      if (val.type === 'lambda') {
        return `(lambda (${val.params.join(' ')}) ...)`;
      }
      if (val.type === 'js_function') {
        return '<native-procedure>';
      }
    }
  }
  return JSON.stringify(val);
}
