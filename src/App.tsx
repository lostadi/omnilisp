import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Code,
  TerminalSquare,
  Cpu,
  Binary,
  RefreshCw,
  FileCode,
  Sparkles,
  BookOpen,
  Package,
  Bug,
  StepForward,
  Square,
  CircleDot,
  Network,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { parse } from './lisp/parser';
import { createGlobalEnv } from './lisp/envFactory';
import { evaluateProgram } from './lisp/evaluator';
import { STANDARD_LIBRARY } from './lisp/stdlib';
import { compileToJS, compileToWAT, compileToTypeScript, compileToRust } from './lisp/compiler';
import { Env, LispJsFunction, DebugContext, DebugFrame, DebugAction, CallGraphNode } from './lisp/types';
import { fuzzErrorIntoRunnableScript, OstadixFuzzedScriptResult } from './lisp/ostadix';
import { LispEditor } from './components/LispEditor';
import { ModuleConverterModal, ModalTab } from './components/ModuleConverterModal';
import { EnvironmentInspector } from './components/EnvironmentInspector';
import { CallGraphVisualizer } from './components/CallGraphVisualizer';
import { NpmInstallModal } from './components/NpmInstallModal';
import { OstadixFuzzerPanel } from './components/OstadixFuzzerPanel';

const EXAMPLES: Record<string, string> = {
  'Telemetry & repair experiments': `; Local telemetry simulation and repair experiments
; This module simulates telemetry and message channels inside this application.
; Repairs are heuristic candidates and may change program behavior.

(import ostadix)

(print "=== Local telemetry simulation ===")
(print "Simulation version:" (ostadix/version))
(print "Heartbeat Ping:" (ostadix/ping))
(print "System Status:" (ostadix/status))

; 1. In-memory message channel
(ostadix/channel-send "ipc/tasks" "Task #104 Completed")
(print "Channel Messages:" (ostadix/channel-recv "ipc/tasks"))

; 2. Fault Protection & Self-Healing
(print "=== Ostadix Self-Healing Demo ===")
(print "Click 'Repair experiments' tab or test with intentional faults!")
`,

  'NPM Ecosystem (Lodash & Dayjs)': `; Dynamic NPM Package Integration in OmniLisp!
; Load and execute packages directly from the NPM registry:

(import-npm "lodash" :as _)
(import-npm "dayjs" :as dayjs)

(print "=== NPM Packages Successfully Loaded ===")

; 1. Lodash utilities
(print "Lodash chunk:" (_/chunk (list 1 2 3 4 5 6) 2))
(print "Lodash shuffle:" (_/shuffle (list 10 20 30 40 50)))
(print "Lodash capitalize:" (_/capitalize "omnilisp polyglot engine"))
(print "Lodash reverse:" (_/reverse (list "react" "vite" "lisp" "rust")))

; 2. Dayjs date formatting
(print "Current Timestamp:" (dayjs/format "YYYY-MM-DD HH:mm:ss"))
(print "Unix Epoch:" (dayjs/unix))
`,

  'TypeScript & Rust Polyglot': `; TypeScript & Rust Polyglot Compilation Demo
; Click "TypeScript Target" or "Rust Target" tabs to see clean generated source code!

(import math string)

(def square (lambda (x) (* x x)))

(def hypotenuse
  (lambda (a b)
    (sqrt (+ (square a) (square b)))))

(def factorial
  (lambda (n)
    (if (<= n 1)
        1
        (* n (factorial (- n 1))))))

(print "=== Polyglot Math & Geometry Demo ===")
(print "Hypotenuse (3, 4):" (hypotenuse 3 4))
(print "Factorial of 6:" (factorial 6))
(print "Sine of 45 deg:" (sin (deg->rad 45)))

; String Module Operations
(def greeting "   hello omnilisp polyglot world!   ")
(print "Formatted greeting:" (str-upper (str-trim greeting)))
`,

  'Call Tree (Fibonacci)': `; Recursive Tree & Call Graph Visualizer Demo
; Click "Build & Run" and open the "Call Graph" tab to inspect the interactive D3 tree!
; Each recursive branch, parameter passing, and scope state is visualized.

(def fib
  (lambda (n)
    (if (<= n 1)
        n
        (+ (fib (- n 1)) (fib (- n 2))))))

(print "Calculating fib(4):")
(def res (fib 4))
(print "Fibonacci of 4 is:" res)
`,

  'Debug & Breakpoints': `; Visual Breakpoints & Stepping Demo
; Click on line numbers in the gutter to add/remove red breakpoints!
; Try setting a breakpoint on line 6 and line 10, then click "Build & Run".

(import math)

(def calculate-circle
  (lambda (radius)
    (def area (* pi (* radius radius)))
    (def circumference (* 2 (* pi radius)))
    (list area circumference)))

(print "Testing radius 5:")
(def res5 (calculate-circle 5))
(print "Result for r=5:" res5)

(print "Testing radius 10:")
(def res10 (calculate-circle 10))
(print "Result for r=10:" res10)
`,

  'Modules & Math': `; Simple Module Import Syntax: (import <module-name>)
(import math string)

(print "=== Math & String Modules Imported ===")
(print "Pi constant:" pi)
(print "Sine of 45 deg:" (sin (deg->rad 45)))
(print "Square root of 256:" (sqrt 256))
(print "Clamped value:" (clamp 150 0 100))

; Using String module functions
(def greeting "   hello omnilisp modular world!   ")
(print "Trimmed & Uppercased:" (str-upper (str-trim greeting)))
`,

  'Dialect Interop': `; Cross-Dialect Interop: Import Scheme, Clojure & Common Lisp modules!
; OmniLisp automatically converts and adapts foreign dialect libraries.
(import scheme/srfi-1 clojure/core common-lisp)

(print "=== Foreign Dialect Libraries Converted & Imported ===")

; 1. Using Clojure Core transpiled library
(print "Clojure inc 41:" (inc 41))
(print "Clojure even? 10:" (even? 10))
(print "Clojure square 9:" (square 9))

; 2. Using Common Lisp compatibility module
(print "Common Lisp 1+ 99:" (1+ 99))
(print "Common Lisp zerop 0:" (zerop 0))

; 3. Using Scheme SRFI-1 list processing
(print "Scheme SRFI-1 iota (5 10 2):" (iota 5 10 2))
`,

  'Aliased Import': `; Module Aliasing with (:as <prefix>)
; Symbols are imported with prefix to avoid naming collisions
(import math :as m)
(import string :as s)

(print "Using aliased Math (m/):")
(print "m/pi:" m/pi)
(print "m/sqrt 144:" (m/sqrt 144))
(print "m/sin 90 deg:" (m/sin (m/deg->rad 90)))

(print "Using aliased String (s/):")
(print "s/str-upper:" (s/str-upper "aliased namespace"))
`,

  'Inline Dialect': `; Inline Dialect Conversion & Import
; Write native Clojure or Scheme directly inside your OmniLisp program!

; Import native Clojure code on-the-fly
(import-clojure "(defn cube [x] (* x (* x x))) (defn is-positive? [x] (> x 0))")
(print "Clojure cube(4):" (cube 4))
(print "Clojure is-positive?(10):" (is-positive? 10))

; Import native Scheme code on-the-fly
(import-scheme "(define (triangle-area b h) (* 0.5 (* b h)))")
(print "Scheme triangle-area(6, 8):" (triangle-area 6 8))
`,

  'Polyglot VM': STANDARD_LIBRARY + '\n\n; OmniLisp Polyglot Runtime Demonstration\n; Execute multi-language logic and compile to JS/WAT\n\n(print "=== Hello from OmniLisp! ===")\n\n; 1. Define a lambda function\n(def double (lambda (x) (* x 2)))\n(print "Doubled list:" (map double (list 1 2 3 4 5)))\n\n; 2. Foreign function execution via native JavaScript host\n(print "JavaScript Math.max:" (javascript "Math.max(10, 25, 5, 42)"))\n\n; 3. Polyglot Foreign Interface calls (C & Python)\n(run-c "int main() { printf(\\"Hello from embedded C!\\\\n\\"); return 0; }")\n(run-python "import math\\nprint(math.sqrt(144))")\n',
};

export default function App() {
  const [code, setCode] = useState(EXAMPLES['TypeScript & Rust Polyglot']);
  const [output, setOutput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'console' | 'callgraph' | 'debug' | 'ts' | 'rust' | 'wasm' | 'ast' | 'fuzzer'>('console');
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleModalInitialTab, setModuleModalInitialTab] = useState<ModalTab>('ts');
  const [callGraphRoot, setCallGraphRoot] = useState<CallGraphNode | null>(null);

  // Ostadix Fuzzer State
  const [fuzzedResult, setFuzzedResult] = useState<OstadixFuzzedScriptResult | null>(null);
  const [isFuzzing, setIsFuzzing] = useState<boolean>(false);
  const [lastError, setLastError] = useState<{ message: string; originalCode: string } | null>(null);

  // Breakpoints & Debugger State
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set([8, 14]));
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [pausedFrame, setPausedFrame] = useState<DebugFrame | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [astView, setAstView] = useState<string>('');
  const [tsCompiled, setTsCompiled] = useState<string>('');
  const [rustCompiled, setRustCompiled] = useState<string>('');
  const [wasmCompiled, setWasmCompiled] = useState<string>('');
  const [tsBrowserRunOutput, setTsBrowserRunOutput] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [isNpmInstallModalOpen, setIsNpmInstallModalOpen] = useState<boolean>(false);

  const envRef = useRef<Env | null>(null);
  const breakpointsRef = useRef<Set<number>>(breakpoints);
  breakpointsRef.current = breakpoints;

  const resolverRef = useRef<((action: DebugAction) => void) | null>(null);
  const stopRequestedRef = useRef<boolean>(false);

  // Auto-transpile TypeScript and Rust live whenever code changes
  useEffect(() => {
    try {
      const ast = parse(code);
      setAstView(JSON.stringify(ast, null, 2));
      setTsCompiled(compileToTypeScript(ast));
      setRustCompiled(compileToRust(ast));
      const watCode = ast.map(node => compileToWAT(node)).join('\n\n');
      setWasmCompiled('(module\n' + watCode + '\n)');
    } catch {
      // Ignore intermediate syntax parsing errors while typing
    }
  }, [code]);

  // Initialize or re-init global environment with print sink
  const initEnv = useCallback(() => {
    const env = createGlobalEnv();
    env.define('print', {
      type: 'js_function',
      fn: (...args: any[]) => {
        const parts = args.map(a => {
          if (typeof a === 'object' && a !== null && !(a instanceof Array) && 'type' in a) {
            return '<' + a.type + '>';
          }
          return typeof a === 'string' ? JSON.stringify(a) : String(a);
        });
        setOutput(prev => prev + parts.join(' ') + '\n');
        return null;
      },
    } as LispJsFunction);
    envRef.current = env;
    return env;
  }, []);

  useEffect(() => {
    initEnv();
  }, [initEnv]);

  // Toggle visual breakpoint on a line
  const handleToggleBreakpoint = (line: number) => {
    setBreakpoints(prev => {
      const next = new Set(prev);
      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }
      return next;
    });
  };

  const handleClearBreakpoints = () => {
    setBreakpoints(new Set());
  };

  // Run or start step debugging
  const handleRun = async (startStepping = false) => {
    // If currently paused, clicking Run acts as Continue
    if (isPaused && resolverRef.current) {
      handleContinue();
      return;
    }

    setOutput('');
    setAstView('');
    setTsBrowserRunOutput(null);
    setIsRunning(true);
    setIsPaused(false);
    setPausedFrame(null);
    stopRequestedRef.current = false;

    const env = initEnv();

    try {
      const ast = parse(code);
      setAstView(JSON.stringify(ast, null, 2));

      const tsCode = compileToTypeScript(ast);
      setTsCompiled(tsCode);

      const rustCode = compileToRust(ast);
      setRustCompiled(rustCode);

      const watCode = ast.map(node => compileToWAT(node)).join('\n\n');
      setWasmCompiled('(module\n' + watCode + '\n)');

      const debugContext: DebugContext = {
        breakpoints: breakpointsRef.current,
        isStepping: startStepping,
        isPaused: false,
        callStack: [],
        shouldStop: () => stopRequestedRef.current,
        onPause: async (frame: DebugFrame) => {
          setPausedFrame(frame);
          setIsPaused(true);
          setActiveTab('debug');

          return new Promise<DebugAction>((resolve) => {
            resolverRef.current = resolve;
          });
        },
      };

      const result = await evaluateProgram(code, env, debugContext);
      if (debugContext.callGraphRoot) {
        setCallGraphRoot(debugContext.callGraphRoot);
      }
      if (result !== undefined && result !== null) {
        let printOut: any = result;
        if (typeof result === 'object' && result !== null && !(result instanceof Array) && 'type' in result) {
          printOut = '<' + result.type + '>';
        } else if (Array.isArray(result) || typeof result === 'string') {
          printOut = JSON.stringify(result);
        }
        setOutput(prev => prev + '=> ' + printOut + '\n');
      }
      setLastError(null);
    } catch (e: any) {
      const errMsg = e.message || String(e);
      if (errMsg !== 'Execution stopped by user' && errMsg !== 'Execution halted by debugger') {
        setOutput(prev => prev + 'Error: ' + errMsg + '\n');
        setLastError({ message: errMsg, originalCode: code });
        // Automatically perform background error fuzzing so the healed runnable script is ready instantly!
        fuzzErrorIntoRunnableScript(code, errMsg)
          .then(res => setFuzzedResult(res))
          .catch(() => {});
      } else {
        setOutput(prev => prev + '[Execution terminated by debugger]\n');
      }
    } finally {
      setIsRunning(false);
      setIsPaused(false);
      setPausedFrame(null);
      stopRequestedRef.current = false;
      resolverRef.current = null;
    }
  };

  // Manual trigger for Ostadix Error Fuzzing
  const handleTriggerFuzz = async (targetCode = code, knownError?: string) => {
    setIsFuzzing(true);
    try {
      const res = await fuzzErrorIntoRunnableScript(targetCode, knownError || lastError?.message);
      setFuzzedResult(res);
      setActiveTab('fuzzer');
    } finally {
      setIsFuzzing(false);
    }
  };

  // Inject chaos/fault to test the resilience engine
  const handleInjectChaos = (type: 'paren' | 'symbol' | 'zero') => {
    let faulty = code;
    if (type === 'paren') faulty = code + '\n(print (+ 10 20';
    else if (type === 'symbol') faulty = code + '\n(print (undefined-ostadix-fn 42))';
    else if (type === 'zero') faulty = code + '\n(print (/ 100 0))';
    setCode(faulty);
    handleTriggerFuzz(faulty);
  };

  // Run the healed Lisp script from the Fuzzer panel
  const handleRunHealedScript = async (healedLisp: string) => {
    setOutput(prev => prev + '\n[Running Ostadix Auto-Healed Script]:\n');
    const env = initEnv();
    try {
      const res = await evaluateProgram(healedLisp, env);
      if (res !== undefined && res !== null) {
        setOutput(prev => prev + '=> ' + JSON.stringify(res) + '\n');
      }
    } catch (err: any) {
      setOutput(prev => prev + 'Healed Run Error: ' + err.message + '\n');
    }
  };

  const handleContinue = () => {
    if (resolverRef.current) {
      setIsPaused(false);
      setPausedFrame(null);
      const resolve = resolverRef.current;
      resolverRef.current = null;
      resolve('continue');
    }
  };

  const handleStep = () => {
    if (resolverRef.current) {
      setIsPaused(false);
      setPausedFrame(null);
      const resolve = resolverRef.current;
      resolverRef.current = null;
      resolve('step');
    } else if (!isRunning) {
      handleRun(true);
    }
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
    if (resolverRef.current) {
      setIsPaused(false);
      setPausedFrame(null);
      const resolve = resolverRef.current;
      resolverRef.current = null;
      resolve('stop');
    }
  };

  const handleClearConsole = () => {
    setOutput('');
    initEnv();
  };

  const handleCopyText = (text: string, targetKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTarget(targetKey);
    setTimeout(() => setCopiedTarget(null), 1800);
  };

  const handleRunBrowserTs = () => {
    setTsBrowserRunOutput(null);
    const logs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => {
        logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      },
    };

    try {
      const cleanJs = tsCompiled
        .replace(/export\s+/g, '')
        .replace(/:\s*number\b/g, '')
        .replace(/:\s*string\b/g, '')
        .replace(/:\s*boolean\b/g, '')
        .replace(/:\s*any\b/g, '')
        .replace(/:\s*any\[\]/g, '')
        .replace(/:\s*number\[\]/g, '')
        .replace(/:\s*string\[\]/g, '')
        .replace(/<[A-Za-z0-9_]+>/g, '');

      const runFn = new Function('console', cleanJs);
      runFn(customConsole);
      setTsBrowserRunOutput(logs.length > 0 ? logs.join('\n') : '[Program executed cleanly with no console output]');
    } catch (err: any) {
      setTsBrowserRunOutput(`Execution Error: ${err.message}`);
    }
  };

  // Keyboard shortcut listener (F5 Resume, F10 Step)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        if (isPaused) {
          handleContinue();
        } else {
          handleRun(false);
        }
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleStep();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPaused, isRunning]);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-300 font-sans">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-900/50">
            <Cpu size={18} />
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 tracking-tight leading-none text-lg">
              Omni<span className="text-indigo-400">Lisp</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">
              Experimental Lisp workbench · source generation
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Debugger Active Paused Controls in Header */}
          {isPaused ? (
            <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/50 px-2.5 py-1 rounded-md animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping mr-1" />
              <span className="text-xs text-amber-300 font-mono mr-2">
                Paused @ Ln {pausedFrame?.line}
              </span>
              <button
                onClick={handleContinue}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                title="Continue Execution (F5)"
              >
                <Play size={12} className="fill-current" />
                Resume
              </button>
              <button
                onClick={handleStep}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-amber-200 px-2.5 py-1 rounded text-xs font-medium border border-slate-700 transition-colors"
                title="Step Next (F10)"
              >
                <StepForward size={12} />
                Step
              </button>
              <button
                onClick={handleStop}
                className="p-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors"
                title="Stop Debugger"
              >
                <Square size={12} className="fill-current" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleRun(true)}
                disabled={isRunning}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                title="Start with Step-by-Step Debugger (F10)"
              >
                <Bug size={14} className="text-amber-400" />
                Step Debug
              </button>

              <button
                onClick={() => handleRun(false)}
                disabled={isRunning}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                title="Build & Run (F5)"
              >
                <Play size={14} className="fill-current" />
                Build & Run
              </button>
            </>
          )}

          <div className="w-px h-5 bg-slate-800 mx-1" />

          {/* Install via NPM / Run via NPX */}
          <button
            onClick={() => setIsNpmInstallModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-red-950/80 to-rose-950/80 hover:from-red-900/90 hover:to-rose-900/90 text-rose-200 border border-rose-500/50 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all shadow-sm"
            title="Commands for the local checkout"
          >
            <Terminal size={13} className="text-rose-400" />
            <span>Local CLI</span>
          </button>

          {/* Ostadix Auto-Healer Fuzzer Header Action */}
          <button
            onClick={() => {
              setActiveTab('fuzzer');
              if (!fuzzedResult) {
                handleTriggerFuzz();
              }
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-950/90 to-cyan-950/90 hover:from-purple-900/90 hover:to-cyan-900/90 text-cyan-200 border border-cyan-500/50 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all shadow-sm"
            title="Try heuristic repairs; candidates may change program behavior"
          >
            <Sparkles size={13} className="text-cyan-400" />
            <span>Repair experiments</span>
          </button>

          {/* NPM Packages Action */}
          <button
            onClick={() => {
              setModuleModalInitialTab('npm');
              setIsModuleModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border border-rose-700/60 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors shadow-sm"
            title="Browse, install, and import NPM packages into OmniLisp"
          >
            <Package size={13} className="text-rose-400" />
            NPM
          </button>

          {/* TS <-> Lisp Converter Action */}
          <button
            onClick={() => {
              setModuleModalInitialTab('ts');
              setIsModuleModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-blue-950/80 hover:bg-blue-900/80 text-blue-300 border border-blue-700/60 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors shadow-sm"
            title="Convert TypeScript to OmniLisp and vice-versa"
          >
            <FileCode size={13} className="text-blue-400" />
            TS ⇄ Lisp
          </button>

          {/* Rust Target Action */}
          <button
            onClick={() => {
              setModuleModalInitialTab('rust');
              setIsModuleModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-orange-950/80 hover:bg-orange-900/80 text-orange-300 border border-orange-700/60 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors shadow-sm"
            title="Generate Rust Target (cargo run)"
          >
            <Cpu size={13} className="text-orange-400" />
            Rust Target
          </button>

          {/* Modules Action */}
          <button
            onClick={() => {
              setModuleModalInitialTab('modules');
              setIsModuleModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700/80 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            title="Browse, convert, and import Lisp modules"
          >
            <Package size={13} className="text-indigo-400" />
            Modules
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Pane */}
        <div className="w-1/2 border-r border-slate-800 flex flex-col bg-slate-950 overflow-hidden">
          <div className="h-10 border-b border-slate-800 flex items-center px-4 shrink-0 bg-slate-900/50 justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 shrink-0">
              <FileCode size={14} className="text-indigo-400" />
              <span>main.lisp</span>
              <span className="text-[10px] text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded">
                OmniLisp Core
              </span>
            </div>

            {/* Quick Actions in Editor Header */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleTriggerFuzz()}
                className="flex items-center gap-1 text-[11px] font-mono text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/40 px-2 py-0.5 rounded transition-colors"
                title="Ostadix Auto-Healer: Fuzz current script into a runnable script"
              >
                <Zap size={11} className="text-cyan-400" />
                <span>⚡ Fuzz Code</span>
              </button>

              <button
                onClick={() => {
                  setModuleModalInitialTab('npm');
                  setIsModuleModalOpen(true);
                }}
                className="flex items-center gap-1 text-[11px] font-mono text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 px-2 py-0.5 rounded transition-colors"
                title="Browse and import NPM packages"
              >
                <Package size={11} className="text-rose-400" />
                <span>+ NPM</span>
              </button>

              <button
                onClick={() => {
                  setModuleModalInitialTab('ts');
                  setIsModuleModalOpen(true);
                }}
                className="flex items-center gap-1 text-[11px] font-mono text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/40 px-2 py-0.5 rounded transition-colors"
                title="Convert TypeScript source code to OmniLisp"
              >
                <Sparkles size={11} className="text-blue-400" />
                <span>TS Converter</span>
              </button>

              <button
                onClick={() => {
                  setModuleModalInitialTab('modules');
                  setIsModuleModalOpen(true);
                }}
                className="flex items-center gap-1 text-[11px] font-mono text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/40 px-2 py-0.5 rounded transition-colors"
                title="Browse and insert modules"
              >
                <Package size={11} className="text-indigo-400" />
                <span>+ Import Module</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <BookOpen size={12} className="text-slate-500" />
                <span className="text-slate-500">Presets:</span>
                <div className="flex items-center gap-1 overflow-x-auto max-w-[280px]">
                  {Object.keys(EXAMPLES).map((key) => (
                    <button
                      key={key}
                      onClick={() => setCode(EXAMPLES[key])}
                      className={`text-[11px] px-2 py-0.5 rounded font-mono transition-colors whitespace-nowrap ${
                        code === EXAMPLES[key]
                          ? 'bg-indigo-600/30 text-indigo-300 font-medium'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Syntax-Highlighted Code Editor with Visual Breakpoints */}
          <LispEditor
            value={code}
            onChange={setCode}
            breakpoints={breakpoints}
            onToggleBreakpoint={handleToggleBreakpoint}
            activePausedLine={pausedFrame?.line ?? null}
            className="flex-1"
          />
        </div>

        {/* Console / Output / Debugger / Target Pane */}
        <div className="w-1/2 flex flex-col bg-slate-900">
          <div className="h-10 border-b border-slate-800 flex items-center px-2 shrink-0 bg-slate-900 gap-1 overflow-x-auto">
            <TabButton
              active={activeTab === 'console'}
              onClick={() => setActiveTab('console')}
              icon={<TerminalSquare size={14} />}
              label="Console"
            />
            <TabButton
              active={activeTab === 'fuzzer'}
              onClick={() => setActiveTab('fuzzer')}
              icon={<Sparkles size={14} className={fuzzedResult ? 'text-cyan-400' : 'text-purple-400'} />}
              label="Repair experiments"
              badge={fuzzedResult ? 'HEALED' : undefined}
              badgeColor="cyan"
            />
            <TabButton
              active={activeTab === 'callgraph'}
              onClick={() => setActiveTab('callgraph')}
              icon={<Network size={14} />}
              label="Call Graph"
              badge={callGraphRoot ? (callGraphRoot.children.length > 0 ? `${callGraphRoot.children.length}` : 'Ready') : undefined}
              badgeColor="indigo"
            />
            <TabButton
              active={activeTab === 'debug'}
              onClick={() => setActiveTab('debug')}
              icon={<Bug size={14} className={isPaused ? 'text-amber-400 animate-pulse' : ''} />}
              label={isPaused ? `Debug (@ Ln ${pausedFrame?.line})` : 'Environment & Debug'}
              badge={isPaused ? 'PAUSED' : breakpoints.size > 0 ? String(breakpoints.size) : undefined}
              badgeColor={isPaused ? 'amber' : 'rose'}
            />
            <TabButton
              active={activeTab === 'ts'}
              onClick={() => setActiveTab('ts')}
              icon={<FileCode size={14} className="text-blue-400" />}
              label="TypeScript Target"
              badge="TS 5+"
              badgeColor="indigo"
            />
            <TabButton
              active={activeTab === 'rust'}
              onClick={() => setActiveTab('rust')}
              icon={<Cpu size={14} className="text-orange-400" />}
              label="Rust Target"
              badge="2024"
              badgeColor="amber"
            />
            <TabButton
              active={activeTab === 'wasm'}
              onClick={() => setActiveTab('wasm')}
              icon={<Binary size={14} />}
              label="WAT sketch"
            />
            <TabButton
              active={activeTab === 'ast'}
              onClick={() => setActiveTab('ast')}
              icon={<Code size={14} />}
              label="AST View"
            />
            <div className="flex-1" />
            <button
              onClick={handleClearConsole}
              title="Clear Console & Reset Environment"
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors mr-2"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-[#0b0f19] text-sm font-mono relative">
            {/* CONSOLE TAB */}
            {activeTab === 'console' && (
              <div className="p-4 flex flex-col gap-3">
                {/* Ostadix Error Auto-Healer Notice Banner */}
                {lastError && (
                  <div className="p-3 bg-gradient-to-r from-rose-950/80 via-purple-950/80 to-slate-900 border border-rose-600/70 rounded-lg flex items-center justify-between shadow-lg animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                      <span className="p-1.5 rounded bg-rose-500/20 text-rose-300">
                        <Sparkles size={16} />
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-rose-200 flex items-center gap-2">
                          <span>Ostadix Auto-Healer: Fault Intercepted</span>
                          <span className="text-[10px] bg-rose-900/60 text-rose-300 px-1.5 py-0.2 rounded font-mono uppercase">
                            1 Runnable Script Synthesized
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 font-mono mt-0.5 line-clamp-1">
                          {lastError.message}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setActiveTab('fuzzer')}
                        className="px-2.5 py-1 text-xs font-mono font-medium bg-purple-600 hover:bg-purple-500 text-white rounded flex items-center gap-1 transition-colors"
                      >
                        <Sparkles size={11} />
                        View Runnable Script
                      </button>
                      {fuzzedResult && (
                        <button
                          onClick={() => {
                            setCode(fuzzedResult.runnableLisp);
                            setLastError(null);
                            setTimeout(() => handleRun(), 50);
                          }}
                          className="px-2.5 py-1 text-xs font-mono font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1 transition-colors"
                        >
                          <Play size={11} />
                          Auto-Heal & Run
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-green-400 whitespace-pre-wrap">
                  {output || (
                    <div className="text-slate-600 italic flex flex-col gap-2">
                      <span>No output yet. Click 'Build & Run' or 'Step Debug'.</span>
                      <span className="text-slate-700 text-xs">
                        Tip: Click any line number in the editor gutter to toggle visual breakpoints.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CALL GRAPH TAB */}
            {activeTab === 'callgraph' && (
              <CallGraphVisualizer
                rootNode={callGraphRoot}
                onSelectLine={(line) => handleToggleBreakpoint(line)}
              />
            )}

            {/* DEBUG TAB */}
            {activeTab === 'debug' && (
              <EnvironmentInspector
                isPaused={isPaused}
                pausedFrame={pausedFrame}
                breakpoints={breakpoints}
                onContinue={handleContinue}
                onStep={handleStep}
                onStop={handleStop}
                onClearBreakpoints={handleClearBreakpoints}
                onRemoveBreakpoint={handleToggleBreakpoint}
              />
            )}

            {/* TYPESCRIPT TARGET TAB */}
            {activeTab === 'ts' && (
              <div className="h-full flex flex-col">
                <div className="h-9 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-900/60 text-xs font-mono text-slate-400 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-semibold">TypeScript 5+ Source Target</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400">Strictly Typed & Runnable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRunBrowserTs}
                      className="px-2 py-0.5 rounded bg-blue-900/60 hover:bg-blue-800 text-blue-300 text-[11px] flex items-center gap-1 border border-blue-700/50 transition-colors"
                    >
                      <Play size={11} />
                      Run in Browser
                    </button>
                    <button
                      onClick={() => handleCopyText(tsCompiled, 'ts')}
                      className="hover:text-white flex items-center gap-1 transition-colors text-slate-400 text-xs"
                    >
                      {copiedTarget === 'ts' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copiedTarget === 'ts' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                  <pre className="flex-1 overflow-auto p-4 text-blue-200/90 whitespace-pre">
                    {tsCompiled || (
                      <span className="text-slate-600 italic">TypeScript compilation will appear here.</span>
                    )}
                  </pre>

                  {tsBrowserRunOutput !== null && (
                    <div className="h-32 border-t border-slate-800 bg-[#080d1a] p-3 flex flex-col shrink-0">
                      <div className="flex items-center justify-between text-[11px] font-mono text-blue-400 mb-1">
                        <span className="flex items-center gap-1">
                          <TerminalSquare size={12} />
                          Browser TS Execution Result
                        </span>
                        <button
                          onClick={() => setTsBrowserRunOutput(null)}
                          className="text-slate-500 hover:text-slate-300 text-xs"
                        >
                          Clear
                        </button>
                      </div>
                      <pre className="flex-1 overflow-auto text-xs font-mono text-emerald-400 whitespace-pre">
                        {tsBrowserRunOutput}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RUST TARGET TAB */}
            {activeTab === 'rust' && (
              <div className="h-full flex flex-col">
                <div className="h-9 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-900/60 text-xs font-mono text-slate-400 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 font-semibold">Rust 2021/2024 Source Target</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400">Compilable via cargo run</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const cargoToml = `[package]\nname = "omnilisp_program"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`;
                        handleCopyText(cargoToml, 'cargo');
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                    >
                      {copiedTarget === 'cargo' ? 'Copied Cargo.toml' : 'Copy Cargo.toml'}
                    </button>
                    <button
                      onClick={() => handleCopyText(rustCompiled, 'rust')}
                      className="hover:text-white flex items-center gap-1 transition-colors text-slate-400 text-xs"
                    >
                      {copiedTarget === 'rust' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copiedTarget === 'rust' ? 'Copied' : 'Copy main.rs'}
                    </button>
                  </div>
                </div>

                <pre className="flex-1 overflow-auto p-4 text-orange-200/90 whitespace-pre">
                  {rustCompiled || (
                    <span className="text-slate-600 italic">Rust compilation will appear here.</span>
                  )}
                </pre>
              </div>
            )}

            {/* AST VIEW TAB */}
            {activeTab === 'ast' && (
              <pre className="p-4 text-yellow-300/80 whitespace-pre-wrap">
                {astView || (
                  <span className="text-slate-600 italic">AST goes here. Build & Run first.</span>
                )}
              </pre>
            )}

            {/* WASM/WAT TARGET TAB */}
            {activeTab === 'wasm' && (
              <pre className="p-4 text-purple-400 whitespace-pre-wrap">
                {wasmCompiled && wasmCompiled !== '(module\n\n)' ? ';; Experimental WAT sketch; not assembled or executed\n\n' + wasmCompiled : (
                  <span className="text-slate-600 italic">An experimental WAT sketch will appear here.</span>
                )}
              </pre>
            )}

            {/* OSTADIX FUZZER TAB */}
            {activeTab === 'fuzzer' && (
              <OstadixFuzzerPanel
                fuzzedResult={fuzzedResult}
                isFuzzing={isFuzzing}
                lastError={lastError}
                currentEditorCode={code}
                onTriggerFuzz={handleTriggerFuzz}
                onApplyCodeToEditor={(healedCode) => setCode(healedCode)}
                onRunHealedScript={handleRunHealedScript}
                onInjectChaos={handleInjectChaos}
              />
            )}
          </div>
        </div>
      </main>

      <ModuleConverterModal
        isOpen={isModuleModalOpen}
        onClose={() => setIsModuleModalOpen(false)}
        initialTab={moduleModalInitialTab}
        currentEditorCode={code}
        onInsertCode={(snippet) => setCode(prev => snippet + '\n' + prev)}
        onReplaceCode={(snippet) => setCode(snippet)}
      />

      <NpmInstallModal
        isOpen={isNpmInstallModalOpen}
        onClose={() => setIsNpmInstallModalOpen(false)}
        currentEditorCode={code}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor = 'rose',
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeColor?: 'rose' | 'amber' | 'indigo' | 'cyan' | 'emerald';
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ' +
        (active
          ? 'bg-indigo-600/20 text-indigo-400 shrink-0'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 shrink-0')
      }
    >
      {icon} {label}
      {badge && (
        <span
          className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono uppercase font-bold border ${
            badgeColor === 'amber'
              ? 'bg-amber-950 text-amber-300 border-amber-500/50 animate-pulse'
              : badgeColor === 'indigo'
              ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/50'
              : badgeColor === 'cyan'
              ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
              : badgeColor === 'emerald'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
              : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
