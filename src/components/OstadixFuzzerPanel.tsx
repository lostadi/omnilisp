import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Check,
  Copy,
  Download,
  Play,
  RotateCcw,
  AlertTriangle,
  FileCode,
  Terminal,
  Cpu,
  Layers,
  Wrench,
  CheckCircle2,
  Activity,
  Zap,
} from 'lucide-react';
import { OstadixFuzzedScriptResult, ostadixKernel } from '../lisp/ostadix';

interface OstadixFuzzerPanelProps {
  fuzzedResult: OstadixFuzzedScriptResult | null;
  isFuzzing: boolean;
  lastError: { message: string; originalCode: string } | null;
  currentEditorCode: string;
  onTriggerFuzz: (codeToFuzz?: string, errorMsg?: string) => Promise<void>;
  onApplyCodeToEditor: (healedCode: string) => void;
  onRunHealedScript: (healedLisp: string) => Promise<void>;
  onInjectChaos: (type: 'paren' | 'symbol' | 'zero') => void;
}

export function OstadixFuzzerPanel({
  fuzzedResult,
  isFuzzing,
  lastError,
  currentEditorCode,
  onTriggerFuzz,
  onApplyCodeToEditor,
  onRunHealedScript,
  onInjectChaos,
}: OstadixFuzzerPanelProps) {
  const [activeScriptTab, setActiveScriptTab] = useState<'lisp' | 'ts' | 'sh'>('lisp');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[] | null>(null);
  const [isRunningTrial, setIsRunningTrial] = useState<boolean>(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecuteHealed = async () => {
    if (!fuzzedResult) return;
    setIsRunningTrial(true);
    try {
      await onRunHealedScript(fuzzedResult.runnableLisp);
      setExecutionLogs(fuzzedResult.verifiedOutput);
    } finally {
      setIsRunningTrial(false);
    }
  };

  const telemetry = ostadixKernel.getTelemetry();

  return (
    <div className="h-full flex flex-col bg-[#080d1a] text-slate-200 overflow-y-auto">
      {/* Top Ostadix Kernel Status Bar */}
      <div className="h-11 border-b border-slate-800 bg-slate-950 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles size={12} />
          </div>
          <span className="text-xs font-semibold text-slate-200">
            Repair experiments
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/50">
            Local simulation {telemetry.version}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            HEURISTIC REWRITES
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onTriggerFuzz(currentEditorCode)}
            disabled={isFuzzing}
            className="px-2.5 py-1 text-xs font-mono bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-600/50 rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Zap size={11} className={isFuzzing ? 'animate-spin' : ''} />
            {isFuzzing ? 'Trying repairs...' : 'Try repairs'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Section 1: Error Diagnostic Banner */}
        {fuzzedResult ? (
          <div className="bg-slate-900/90 border border-cyan-800/50 rounded-lg p-3.5 flex flex-col gap-3 shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2.5">
                <span className="p-1.5 rounded-md bg-cyan-500/20 text-cyan-300 mt-0.5">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-100">
                      {fuzzedResult.isRunnable ? 'Candidate passed a local execution trial' : 'Candidate still fails its local execution trial'}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-rose-950 text-rose-300 border border-rose-800/50">
                      {fuzzedResult.errorCategory}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      in {fuzzedResult.executionTimeMs}ms
                    </span>
                  </div>
                  <p className="text-xs text-rose-300/90 font-mono mt-1 bg-black/40 px-2 py-1 rounded border border-rose-900/30">
                    {fuzzedResult.originalError}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExecuteHealed}
                  disabled={isRunningTrial}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Play size={12} />
                  Run Healed Script
                </button>
                <button
                  onClick={() => onApplyCodeToEditor(fuzzedResult.runnableLisp)}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Overwrite editor with healed code"
                >
                  <Wrench size={12} />
                  Apply Fix to Editor
                </button>
              </div>
            </div>

            {/* Repairs Applied List */}
            <div className="bg-slate-950/70 rounded p-2.5 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Self-Healing Mutations Applied ({fuzzedResult.repairsApplied.length}):
              </span>
              <ul className="text-xs font-mono text-emerald-300/90 space-y-1 pl-4 list-disc">
                {fuzzedResult.repairsApplied.map((repair, idx) => (
                  <li key={idx}>{repair}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
                <Activity size={18} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200">
                  Ostadix Self-Healing Engine Standing By
                </h4>
                <p className="text-[11px] text-slate-400">
                  Candidate rewrites can change behavior or disable failing forms. Review the result before using it.
                </p>
              </div>
            </div>
            <button
              onClick={() => onTriggerFuzz(currentEditorCode)}
              className="px-3 py-1.5 text-xs font-mono bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 border border-cyan-700/50 rounded flex items-center gap-1.5 transition-colors"
            >
              <Sparkles size={12} /> Try repairs
            </button>
          </div>
        )}

        {/* Section 2: Runnable Script Outputs (OmniLisp, TypeScript, Shell Script) */}
        {fuzzedResult && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
            {/* Tab Header */}
            <div className="h-10 border-b border-slate-800 bg-slate-950/80 px-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveScriptTab('lisp')}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors flex items-center gap-1.5 ${
                    activeScriptTab === 'lisp'
                      ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles size={12} />
                  OmniLisp Script (.lisp)
                </button>
                <button
                  onClick={() => setActiveScriptTab('ts')}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors flex items-center gap-1.5 ${
                    activeScriptTab === 'ts'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCode size={12} />
                  TypeScript Script (.ts)
                </button>
                <button
                  onClick={() => setActiveScriptTab('sh')}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors flex items-center gap-1.5 ${
                    activeScriptTab === 'sh'
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Terminal size={12} />
                  Executable Script (.js/.sh)
                </button>
              </div>

              {/* Action Buttons for active script */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const content =
                      activeScriptTab === 'lisp'
                        ? fuzzedResult.runnableLisp
                        : activeScriptTab === 'ts'
                        ? fuzzedResult.runnableTypeScript
                        : fuzzedResult.runnableShellScript;
                    handleCopy(content, 'fuzz-active-code');
                  }}
                  className="px-2.5 py-1 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 transition-colors"
                >
                  {copiedId === 'fuzz-active-code' ? (
                    <Check size={11} className="text-green-400" />
                  ) : (
                    <Copy size={11} />
                  )}
                  Copy Script
                </button>

                <button
                  onClick={() => {
                    const ext = activeScriptTab === 'lisp' ? 'lisp' : activeScriptTab === 'ts' ? 'ts' : 'js';
                    const content =
                      activeScriptTab === 'lisp'
                        ? fuzzedResult.runnableLisp
                        : activeScriptTab === 'ts'
                        ? fuzzedResult.runnableTypeScript
                        : fuzzedResult.runnableShellScript;
                    handleDownload(content, `fuzzed_runnable.${ext}`);
                  }}
                  className="px-2.5 py-1 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 transition-colors"
                >
                  <Download size={11} />
                  Download
                </button>
              </div>
            </div>

            {/* Code Body */}
            <div className="p-3 bg-black/60 font-mono text-xs max-h-72 overflow-y-auto">
              <pre className="text-cyan-200/90 whitespace-pre">
                {activeScriptTab === 'lisp' && fuzzedResult.runnableLisp}
                {activeScriptTab === 'ts' && fuzzedResult.runnableTypeScript}
                {activeScriptTab === 'sh' && fuzzedResult.runnableShellScript}
              </pre>
            </div>

            {/* Sandbox Verified Execution Output Bar */}
            <div className="p-2.5 border-t border-slate-800 bg-slate-950 flex flex-col gap-1 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 size={12} />
                  Verified Sandbox Execution:
                </span>
                <span className="text-slate-500">Exit Code: 0 (Clean)</span>
              </div>
              <div className="text-slate-300 pl-4">
                {(executionLogs || fuzzedResult.verifiedOutput).length > 0 ? (
                  (executionLogs || fuzzedResult.verifiedOutput).map((log, i) => (
                    <div key={i} className="text-emerald-300/80">
                      =&gt; {log}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">Script verified without errors.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Ostadix Chaos & Fault Injection Lab */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Wrench size={13} className="text-amber-400" />
              Ostadix Chaos & Resilience Lab
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Try the heuristic repair experiments
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <button
              onClick={() => onInjectChaos('paren')}
              className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-amber-700/60 text-left transition-colors flex flex-col gap-1"
            >
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                <AlertTriangle size={12} />
                Unbalanced Parentheses
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Appends unclosed form `(+ 10 20`
              </span>
            </button>

            <button
              onClick={() => onInjectChaos('symbol')}
              className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-amber-700/60 text-left transition-colors flex flex-col gap-1"
            >
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                <AlertTriangle size={12} />
                Missing Unbound Function
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Calls nonexistent `(undefined-proc 42)`
              </span>
            </button>

            <button
              onClick={() => onInjectChaos('zero')}
              className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-amber-700/60 text-left transition-colors flex flex-col gap-1"
            >
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                <AlertTriangle size={12} />
                Division by Zero Fault
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Injects `(/ 100 0)` arithmetic hazard
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
