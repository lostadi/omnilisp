import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  ArrowRightLeft,
  Plus,
  Copy,
  Check,
  Code2,
  FileCode,
  BookOpen,
  Play,
  Layers,
  Sparkles,
  Cpu,
  RefreshCw,
  TerminalSquare,
  FileDown,
  CheckCircle2,
  Globe,
  Search,
  Download,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { moduleManager, LispModule } from '../lisp/modules';
import { convertDialectToOmniLisp, LispDialect } from '../lisp/converter';
import { compileToTypeScript, convertTypeScriptToOmniLisp } from '../lisp/tsTranspiler';
import { compileToRust } from '../lisp/rustTranspiler';
import { parse } from '../lisp/parser';
import { npmManager, POPULAR_NPM_PACKAGES, NpmPackageInfo } from '../lisp/npmLoader';

export type ModalTab = 'npm' | 'ts' | 'rust' | 'modules' | 'dialects' | 'custom';

interface ModuleConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCode: (snippet: string) => void;
  onReplaceCode?: (snippet: string) => void;
  initialTab?: ModalTab;
  currentEditorCode?: string;
}

const PRESET_TS_SNIPPETS: Record<string, { label: string; code: string }> = {
  factorial: {
    label: 'TS: Factorial (Recursion)',
    code: `// TypeScript Recursive Factorial
function factorial(n: number): number {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

const ans: number = factorial(5);
console.log("Factorial of 5:", ans);
`,
  },
  geometry: {
    label: 'TS: Math & Geometry',
    code: `// TypeScript Math & Vector Geometry
const square = (x: number): number => x * x;

function hypotenuse(a: number, b: number): number {
  return Math.sqrt(square(a) + square(b));
}

function clampValue(val: number, minVal: number, maxVal: number): number {
  return Math.min(maxVal, Math.max(minVal, val));
}

const hyp = hypotenuse(3, 4);
console.log("Hypotenuse (3, 4):", hyp);
console.log("Clamped (150 in 0..100):", clampValue(150, 0, 100));
`,
  },
  arrayPipeline: {
    label: 'TS: Array Map & Filter',
    code: `// TypeScript Array Transformations
const numbers: number[] = [1, 2, 3, 4, 5, 6];

const doubled = numbers.map((x: number) => x * 2);
const evens = numbers.filter((x: number) => x % 2 === 0);

console.log("Original:", numbers);
console.log("Doubled:", doubled);
console.log("Evens:", evens);
`,
  },
  stringUtils: {
    label: 'TS: String Utilities',
    code: `// TypeScript String Formatting
const rawMessage: string = "   hello omnilisp polyglot world!   ";
const trimmed: string = rawMessage.trim();
const upper: string = trimmed.toUpperCase();

console.log("Trimmed:", trimmed);
console.log("Upper:", upper);
`,
  },
};

const PRESET_CONVERSIONS: Record<
  string,
  { dialect: LispDialect; code: string; label: string }
> = {
  scheme_factorial: {
    dialect: 'scheme',
    label: 'Scheme: Factorial & Display',
    code: `;; Scheme (R5RS) Recursive Factorial
(define (factorial n)
  (if (<= n 1)
      1
      (* n (factorial (- n 1)))))

(define pi-approx 3.14159)

(display "Factorial of 5 is:")
(display (factorial 5))
`,
  },
  clojure_hypot: {
    dialect: 'clojure',
    label: 'Clojure: defn, let & threading',
    code: `;; Clojure Data Pipeline & Math
(defn square [x]
  (* x x))

(defn hypotenuse [a b]
  (let [a2 (square a)
        b2 (square b)]
    (sqrt (+ a2 b2))))

(defn process-numbers [nums]
  (->> nums
       (map inc)
       (filter even?)))

(println "Hypotenuse 3, 4 is:" (hypotenuse 3 4))
`,
  },
  common_lisp_math: {
    dialect: 'common-lisp',
    label: 'Common Lisp: defun & progn',
    code: `;; Common Lisp Functions & Constants
(defparameter *gravity* 9.80665)

(defun potential-energy (mass height)
  (* mass *gravity* height))

(defun test-predicates (x)
  (progn
    (format t "Is zero? " (zerop x))
    (format t "Incremented: " (1+ x))
    (evenp x)))

(potential-energy 10 50)
`,
  },
};

export function ModuleConverterModal({
  isOpen,
  onClose,
  onInsertCode,
  onReplaceCode,
  initialTab = 'npm',
  currentEditorCode = '',
}: ModuleConverterModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [selectedModule, setSelectedModule] = useState<LispModule | null>(null);

  // Sync initial tab when reopened
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // NPM Packages State
  const [selectedNpmPkg, setSelectedNpmPkg] = useState<NpmPackageInfo>(POPULAR_NPM_PACKAGES[0]);
  const [npmSearch, setNpmSearch] = useState('');
  const [customNpmName, setCustomNpmName] = useState('');
  const [customNpmAlias, setCustomNpmAlias] = useState('');
  const [npmInspectedMethods, setNpmInspectedMethods] = useState<string[]>([]);
  const [isLoadingNpm, setIsLoadingNpm] = useState(false);
  const [npmStatusMessage, setNpmStatusMessage] = useState<string | null>(null);

  // TypeScript Converter State
  const [tsDirection, setTsDirection] = useState<'ts-to-lisp' | 'lisp-to-ts'>('ts-to-lisp');
  const [tsInputCode, setTsInputCode] = useState(PRESET_TS_SNIPPETS.factorial.code);
  const [lispInputForTs, setLispInputForTs] = useState(
    currentEditorCode || `(def factorial (lambda (n) (if (<= n 1) 1 (* n (factorial (- n 1))))))\n(print "Factorial 5:" (factorial 5))`
  );
  const [tsRunOutput, setTsRunOutput] = useState<string | null>(null);

  // Rust Transpiler State
  const [lispInputForRust, setLispInputForRust] = useState(
    currentEditorCode || `(def square (lambda (x) (* x x)))\n(def hypot (lambda (a b) (sqrt (+ (square a) (square b)))))\n(print "Hypotenuse 3, 4:" (hypot 3 4))`
  );

  // Foreign Dialect Converter Studio State
  const [converterDialect, setConverterDialect] = useState<LispDialect>('auto');
  const [sourceCode, setSourceCode] = useState(PRESET_CONVERSIONS.scheme_factorial.code);
  const [customModuleName, setCustomModuleName] = useState('');
  const [copied, setCopied] = useState(false);
  const [registeredNotice, setRegisteredNotice] = useState<string | null>(null);

  // Custom Module creation state
  const [newModId, setNewModId] = useState('');
  const [newModName, setNewModName] = useState('');
  const [newModDialect, setNewModDialect] = useState<
    'omnilisp' | 'scheme' | 'clojure' | 'common-lisp'
  >('omnilisp');
  const [newModCode, setNewModCode] = useState('');

  if (!isOpen) return null;

  const allModules = moduleManager.getAllModules();

  // Dialect conversion
  const handleDialectConvert = () => {
    return convertDialectToOmniLisp(sourceCode, converterDialect);
  };
  const conversionResult = handleDialectConvert();

  // TS to OmniLisp conversion
  const convertedLispFromTs = convertTypeScriptToOmniLisp(tsInputCode);

  // OmniLisp to TS conversion
  let compiledTsFromLisp = '';
  try {
    const ast = parse(lispInputForTs);
    compiledTsFromLisp = compileToTypeScript(ast);
  } catch (err: any) {
    compiledTsFromLisp = `// Syntax error parsing Lisp code: ${err.message}`;
  }

  // OmniLisp to Rust conversion
  let compiledRustCode = '';
  try {
    const ast = parse(lispInputForRust);
    compiledRustCode = compileToRust(ast);
  } catch (err: any) {
    compiledRustCode = `// Syntax error parsing Lisp code for Rust: ${err.message}`;
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleInspectNpmPackage = async (pkgName: string) => {
    setIsLoadingNpm(true);
    setNpmStatusMessage(null);
    try {
      const mod = await npmManager.loadPackage(pkgName);
      const methods: string[] = [];
      if (typeof mod === 'function') {
        methods.push('(callable function)');
      }
      if (typeof mod === 'object' && mod !== null) {
        Object.keys(mod).forEach(k => methods.push(k));
      }
      if (typeof mod === 'function') {
        Object.getOwnPropertyNames(mod).forEach(k => {
          if (!['prototype', 'name', 'length'].includes(k)) methods.push(k);
        });
      }
      setNpmInspectedMethods(Array.from(new Set(methods)));
      setNpmStatusMessage(`Loaded '${pkgName}' successfully! Found ${methods.length} exports.`);
    } catch (err: any) {
      setNpmStatusMessage(`Error loading package: ${err.message}`);
    } finally {
      setIsLoadingNpm(false);
    }
  };

  const handleCustomNpmInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNpmName.trim()) return;
    const cleanName = customNpmName.trim();
    const alias = customNpmAlias.trim() || cleanName.replace(/[^a-zA-Z0-9]/g, '_');
    const importSnippet = `(import-npm "${cleanName}" :as ${alias})\n`;
    onInsertCode(importSnippet);
    onClose();
  };

  const filteredNpmPackages = POPULAR_NPM_PACKAGES.filter(
    p =>
      p.name.toLowerCase().includes(npmSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(npmSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(npmSearch.toLowerCase())
  );

  const handleRunTs = () => {
    setTsRunOutput(null);
    const logs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => {
        logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      },
    };

    try {
      const cleanJs = compiledTsFromLisp
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
      setTsRunOutput(logs.length > 0 ? logs.join('\n') : '[Program executed cleanly with no console output]');
    } catch (err: any) {
      setTsRunOutput(`Execution Error: ${err.message}`);
    }
  };

  const handleSaveAsModule = () => {
    if (!customModuleName.trim()) {
      alert('Please specify a module identifier name (e.g., "my-math")');
      return;
    }
    const cleanId = customModuleName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    moduleManager.registerCustomModule({
      id: cleanId,
      name: customModuleName,
      description: `User-imported ${conversionResult.detectedDialect} module`,
      dialect: (conversionResult.detectedDialect as any) || 'omnilisp',
      code: sourceCode,
      convertedCode: conversionResult.converted,
      exports: ['auto-exported'],
      isBuiltIn: false,
    });
    setRegisteredNotice(`Module '${cleanId}' registered! You can now write (import ${cleanId})`);
    setTimeout(() => setRegisteredNotice(null), 3500);
  };

  const handleCreateCustomModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModId.trim() || !newModCode.trim()) return;
    const cleanId = newModId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    moduleManager.registerCustomModule({
      id: cleanId,
      name: newModName.trim() || cleanId,
      description: 'User registered module',
      dialect: newModDialect,
      code: newModCode,
      exports: ['custom-exports'],
      isBuiltIn: false,
    });
    setRegisteredNotice(`Module '${cleanId}' saved successfully!`);
    setNewModId('');
    setNewModName('');
    setNewModCode('');
    setActiveTab('modules');
    setTimeout(() => setRegisteredNotice(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                OmniLisp Polyglot & Package Ecosystem
                <span className="text-[10px] font-mono uppercase bg-rose-950 text-rose-300 border border-rose-700/50 px-2 py-0.5 rounded-full">
                  NPM & Polyglot
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                NPM dynamic package bridge, TypeScript ⇄ Lisp, Rust compilation, and foreign dialects
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('npm')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'npm'
                  ? 'bg-rose-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package size={13} className="text-rose-300" />
              NPM Packages
            </button>
            <button
              onClick={() => setActiveTab('ts')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'ts'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode size={13} className="text-blue-300" />
              TypeScript ⇄ Lisp
            </button>
            <button
              onClick={() => setActiveTab('rust')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'rust'
                  ? 'bg-orange-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu size={13} className="text-orange-300" />
              Rust Target
            </button>
            <button
              onClick={() => setActiveTab('modules')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'modules'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen size={13} />
              Stdlib Modules
            </button>
            <button
              onClick={() => setActiveTab('dialects')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'dialects'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowRightLeft size={13} />
              Dialects
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'custom'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus size={13} />
              New Module
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors ml-2"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden p-6 bg-slate-950/60">
          {/* TAB 0: NPM PACKAGES ECOSYSTEM */}
          {activeTab === 'npm' && (
            <div className="h-full flex flex-col gap-4">
              {/* Search & Custom NPM Input Bar */}
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-3 shrink-0 gap-4">
                <div className="flex-1 flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Search size={14} className="text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search popular NPM packages (lodash, dayjs, uuid, mathjs, canvas-confetti, ramda)..."
                    value={npmSearch}
                    onChange={(e) => setNpmSearch(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-200 font-sans focus:outline-none placeholder-slate-500"
                  />
                  {npmSearch && (
                    <button onClick={() => setNpmSearch('')} className="text-slate-500 hover:text-slate-300">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Direct Custom Package Quick Importer */}
                <form onSubmit={handleCustomNpmInstall} className="flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder="Install any package (e.g. colord)"
                    value={customNpmName}
                    onChange={(e) => setCustomNpmName(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono w-48 focus:outline-none focus:border-rose-500"
                  />
                  <input
                    type="text"
                    placeholder="alias"
                    value={customNpmAlias}
                    onChange={(e) => setCustomNpmAlias(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 font-mono w-16 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <Download size={12} />
                    + Import NPM
                  </button>
                </form>
              </div>

              {/* NPM Packages Grid and Inspector Pane */}
              <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Left: Popular NPM Packages List */}
                <div className="w-1/2 flex flex-col gap-2.5 overflow-y-auto pr-1">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                    <span>Popular Packages ({filteredNpmPackages.length})</span>
                    <span className="text-rose-400">Syntax: (import-npm &quot;&lt;pkg&gt;&quot; :as &lt;alias&gt;)</span>
                  </div>

                  {filteredNpmPackages.map((pkg) => (
                    <div
                      key={pkg.name}
                      onClick={() => {
                        setSelectedNpmPkg(pkg);
                        setNpmInspectedMethods([]);
                        setNpmStatusMessage(null);
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedNpmPkg?.name === pkg.name
                          ? 'border-rose-500 bg-rose-950/20'
                          : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                              <Package size={13} className="text-rose-400" />
                              {pkg.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-slate-800 text-rose-300 border border-slate-700">
                              {pkg.category}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              alias: <strong className="text-rose-300">{pkg.suggestedAlias}</strong>
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {pkg.description}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onInsertCode(`(import-npm "${pkg.name}" :as ${pkg.suggestedAlias})\n`);
                              onClose();
                            }}
                            className="px-2 py-1 bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded text-[11px] font-mono transition-colors"
                          >
                            + Import
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {pkg.popularExports.map((exp, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.2 bg-slate-800/90 rounded text-slate-300 font-mono border border-slate-700/50"
                          >
                            {pkg.suggestedAlias}/{exp}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right: Selected Package Details & Interactive Live Inspector */}
                <div className="w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="h-10 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-950/60 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
                      <Globe size={14} className="text-rose-400" />
                      <span className="font-semibold">{selectedNpmPkg.name}</span>
                      <span className="text-slate-500">(:as {selectedNpmPkg.suggestedAlias})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleInspectNpmPackage(selectedNpmPkg.name)}
                        disabled={isLoadingNpm}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono flex items-center gap-1 transition-colors"
                      >
                        <Zap size={11} className={isLoadingNpm ? 'animate-spin text-rose-400' : 'text-amber-400'} />
                        {isLoadingNpm ? 'Fetching...' : 'Inspect Exports'}
                      </button>

                      <button
                        onClick={() => {
                          onInsertCode(`(import-npm "${selectedNpmPkg.name}" :as ${selectedNpmPkg.suggestedAlias})\n`);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition-colors"
                      >
                        Use in Editor
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 text-xs font-mono">
                    {/* Status notification */}
                    {npmStatusMessage && (
                      <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center justify-between">
                        <span>{npmStatusMessage}</span>
                        <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                      </div>
                    )}

                    {/* Import Statement Box */}
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-[11px] text-slate-500 uppercase tracking-wider block mb-1">
                        OmniLisp Import Statement
                      </span>
                      <div className="flex items-center justify-between text-rose-300">
                        <code>(import-npm &quot;{selectedNpmPkg.name}&quot; :as {selectedNpmPkg.suggestedAlias})</code>
                        <button
                          onClick={() => handleCopy(`(import-npm "${selectedNpmPkg.name}" :as ${selectedNpmPkg.suggestedAlias})`)}
                          className="hover:text-white transition-colors"
                        >
                          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Sample Code Demo */}
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col flex-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 uppercase tracking-wider mb-1">
                        <span>Ready-to-run Lisp Example</span>
                        <button
                          onClick={() => {
                            if (onReplaceCode) {
                              onReplaceCode(selectedNpmPkg.sampleCode);
                            } else {
                              onInsertCode(selectedNpmPkg.sampleCode + '\n');
                            }
                            onClose();
                          }}
                          className="text-xs text-rose-400 hover:text-rose-300 underline lowercase font-sans"
                        >
                          load example into editor
                        </button>
                      </div>
                      <pre className="text-slate-300 whitespace-pre overflow-auto flex-1 text-xs">
                        {selectedNpmPkg.sampleCode}
                      </pre>
                    </div>

                    {/* Inspected Exports Live Cloud View */}
                    {npmInspectedMethods.length > 0 && (
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-emerald-400 uppercase tracking-wider block mb-2 font-semibold">
                          Live Loaded Methods ({npmInspectedMethods.length})
                        </span>
                        <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                          {npmInspectedMethods.map((m, idx) => (
                            <span
                              key={idx}
                              onClick={() => {
                                onInsertCode(`(${selectedNpmPkg.suggestedAlias}/${m})\n`);
                                onClose();
                              }}
                              title={`Click to insert (${selectedNpmPkg.suggestedAlias}/${m})`}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: TYPESCRIPT <-> OMNILISP BIDIRECTIONAL CONVERTER */}
          {activeTab === 'ts' && (
            <div className="h-full flex flex-col gap-4">
              {/* Direction & Options Toolbar */}
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 text-xs">
                    <button
                      onClick={() => setTsDirection('ts-to-lisp')}
                      className={`px-3 py-1 rounded font-medium transition-all ${
                        tsDirection === 'ts-to-lisp'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      TypeScript ➔ OmniLisp
                    </button>
                    <button
                      onClick={() => setTsDirection('lisp-to-ts')}
                      className={`px-3 py-1 rounded font-medium transition-all ${
                        tsDirection === 'lisp-to-ts'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      OmniLisp ➔ TypeScript
                    </button>
                  </div>

                  {tsDirection === 'ts-to-lisp' ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="text-slate-500">TS Presets:</span>
                      {Object.keys(PRESET_TS_SNIPPETS).map(key => (
                        <button
                          key={key}
                          onClick={() => setTsInputCode(PRESET_TS_SNIPPETS[key].code)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                        >
                          {PRESET_TS_SNIPPETS[key].label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (currentEditorCode) {
                          setLispInputForTs(currentEditorCode);
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw size={12} />
                      Load Current Editor Lisp Code
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800/40">
                    {tsDirection === 'ts-to-lisp'
                      ? 'TypeScript AST Lexer & Parser'
                      : 'OmniLisp Strongly-Typed Transpiler'}
                  </span>
                </div>
              </div>

              {/* Side by Side Converter Panels */}
              <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Left Panel */}
                <div className="w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="h-9 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-950/50 text-xs font-mono text-slate-400 shrink-0">
                    <span className="text-blue-400 font-semibold">
                      {tsDirection === 'ts-to-lisp' ? 'TypeScript Input Code' : 'OmniLisp Input Code'}
                    </span>
                    <span className="text-slate-500">Editable</span>
                  </div>
                  <textarea
                    value={tsDirection === 'ts-to-lisp' ? tsInputCode : lispInputForTs}
                    onChange={(e) => {
                      if (tsDirection === 'ts-to-lisp') {
                        setTsInputCode(e.target.value);
                      } else {
                        setLispInputForTs(e.target.value);
                      }
                    }}
                    className="flex-1 w-full bg-slate-950 p-3 font-mono text-xs text-slate-200 resize-none focus:outline-none whitespace-pre"
                    placeholder={
                      tsDirection === 'ts-to-lisp'
                        ? 'Paste TypeScript / JavaScript code here...'
                        : 'Paste OmniLisp code here...'
                    }
                  />
                </div>

                {/* Right Panel */}
                <div className="w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="h-9 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-950/50 text-xs font-mono text-slate-400 shrink-0">
                    <span className="text-emerald-400 font-semibold">
                      {tsDirection === 'ts-to-lisp'
                        ? 'Converted OmniLisp Code'
                        : 'Generated TypeScript Source (Typed)'}
                    </span>
                    <div className="flex items-center gap-2">
                      {tsDirection === 'lisp-to-ts' && (
                        <button
                          onClick={handleRunTs}
                          className="px-2 py-0.5 rounded bg-blue-900/60 hover:bg-blue-800 text-blue-300 text-[11px] flex items-center gap-1 border border-blue-700/50 transition-colors"
                        >
                          <Play size={11} />
                          Run in Browser
                        </button>
                      )}
                      <button
                        onClick={() =>
                          handleCopy(
                            tsDirection === 'ts-to-lisp' ? convertedLispFromTs : compiledTsFromLisp
                          )
                        }
                        className="hover:text-white flex items-center gap-1 transition-colors text-slate-400 text-xs"
                      >
                        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <pre className="flex-1 overflow-auto p-3 font-mono text-xs text-slate-200 bg-slate-950 whitespace-pre">
                    {tsDirection === 'ts-to-lisp' ? convertedLispFromTs : compiledTsFromLisp}
                  </pre>

                  {/* Browser Execution Feedback */}
                  {tsDirection === 'lisp-to-ts' && tsRunOutput !== null && (
                    <div className="h-28 border-t border-slate-800 bg-[#080d1a] p-3 flex flex-col shrink-0">
                      <div className="flex items-center justify-between text-[11px] font-mono text-blue-400 mb-1">
                        <span className="flex items-center gap-1">
                          <TerminalSquare size={12} />
                          Browser Execution Preview
                        </span>
                        <button
                          onClick={() => setTsRunOutput(null)}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          Clear
                        </button>
                      </div>
                      <pre className="flex-1 overflow-auto text-xs font-mono text-emerald-400 whitespace-pre">
                        {tsRunOutput}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-400">
                  {tsDirection === 'ts-to-lisp'
                    ? 'Seamlessly convert TypeScript functions, variables, arrays, math, and operations into native OmniLisp.'
                    : 'Export strongly-typed TypeScript code complete with function signatures, types, and runtime helpers.'}
                </span>

                <div className="flex items-center gap-2">
                  {tsDirection === 'ts-to-lisp' ? (
                    <>
                      <button
                        onClick={() => {
                          onInsertCode(convertedLispFromTs + '\n');
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors"
                      >
                        Insert into Editor
                      </button>
                      <button
                        onClick={() => {
                          if (onReplaceCode) {
                            onReplaceCode(convertedLispFromTs);
                          } else {
                            onInsertCode(convertedLispFromTs);
                          }
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium shadow-sm transition-colors"
                      >
                        Load as Active Program
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleCopy(compiledTsFromLisp)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <Copy size={13} />
                      Copy TypeScript Code
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OMNILISP -> RUST TRANSPILER */}
          {activeTab === 'rust' && (
            <div className="h-full flex flex-col gap-4">
              {/* Toolbar */}
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-3 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">Rust Target Edition:</span>
                    <span className="px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-700/50 text-xs font-mono font-medium">
                      Rust 2021 / 2024 (cargo run)
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (currentEditorCode) {
                        setLispInputForRust(currentEditorCode);
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw size={12} />
                    Load Current Editor Lisp Code
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-orange-400 bg-orange-950/60 px-2 py-1 rounded border border-orange-800/40">
                    Compilable Native Binary Target
                  </span>
                </div>
              </div>

              {/* Side by Side Rust Panels */}
              <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Lisp Input */}
                <div className="w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="h-9 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-950/50 text-xs font-mono text-slate-400 shrink-0">
                    <span className="text-indigo-400 font-semibold">OmniLisp Source</span>
                    <span>Editable</span>
                  </div>
                  <textarea
                    value={lispInputForRust}
                    onChange={(e) => setLispInputForRust(e.target.value)}
                    className="flex-1 w-full bg-slate-950 p-3 font-mono text-xs text-slate-200 resize-none focus:outline-none whitespace-pre"
                    placeholder="Enter OmniLisp code to convert to Rust..."
                  />
                </div>

                {/* Rust Generated Output */}
                <div className="w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="h-9 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-950/50 text-xs font-mono text-slate-400 shrink-0">
                    <span className="text-orange-400 font-semibold">Generated Rust Code (main.rs)</span>
                    <button
                      onClick={() => handleCopy(compiledRustCode)}
                      className="hover:text-white flex items-center gap-1 transition-colors text-xs text-slate-400"
                    >
                      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="flex-1 overflow-auto p-3 font-mono text-xs text-slate-200 bg-slate-950 whitespace-pre">
                    {compiledRustCode}
                  </pre>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-orange-400">Cargo Tip:</span>
                  <span>Save as <code className="text-slate-300 font-mono">src/main.rs</code> and run <code className="text-slate-300 font-mono">cargo run</code>.</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const cargoToml = `[package]\nname = "omnilisp_program"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`;
                      handleCopy(cargoToml);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition-colors"
                  >
                    Copy Cargo.toml
                  </button>
                  <button
                    onClick={() => handleCopy(compiledRustCode)}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-medium shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Copy size={13} />
                    Copy main.rs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STDLIB MODULE REGISTRY */}
          {activeTab === 'modules' && (
            <div className="h-full flex gap-6 overflow-hidden">
              {/* Modules List */}
              <div className="w-1/2 flex flex-col gap-3 overflow-y-auto pr-2">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Available Modules ({allModules.length})</span>
                  <span className="text-[11px] text-indigo-400">Simple (import &lt;name&gt;)</span>
                </div>

                {allModules.map((mod) => (
                  <div
                    key={mod.id}
                    onClick={() => setSelectedModule(mod)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      selectedModule?.id === mod.id
                        ? 'border-indigo-500 bg-indigo-950/20'
                        : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-100">
                            {mod.id}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-mono font-medium ${
                              mod.dialect === 'scheme'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                                : mod.dialect === 'clojure'
                                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/40'
                                : mod.dialect === 'common-lisp'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                                : 'bg-indigo-950 text-indigo-400 border border-indigo-800/40'
                            }`}
                          >
                            {mod.dialect}
                          </span>
                          {!mod.isBuiltIn && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800/40">
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {mod.description}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInsertCode(`(import ${mod.id})\n`);
                          onClose();
                        }}
                        title={`Insert (import ${mod.id})`}
                        className="shrink-0 px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded text-[11px] font-mono transition-colors"
                      >
                        + Import
                      </button>
                    </div>

                    {mod.exports.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {mod.exports.slice(0, 8).map((exp, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.2 bg-slate-800/80 rounded text-slate-300 font-mono"
                          >
                            {exp}
                          </span>
                        ))}
                        {mod.exports.length > 8 && (
                          <span className="text-[10px] px-1.5 py-0.2 text-slate-500 font-mono">
                            +{mod.exports.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Module Code Preview */}
              <div className="w-1/2 flex flex-col bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
                <div className="h-10 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-950/60 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                    <FileCode size={14} className="text-indigo-400" />
                    <span>
                      {selectedModule ? `${selectedModule.id}.lisp` : 'Select a module to view'}
                    </span>
                  </div>
                  {selectedModule && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(selectedModule.code)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => {
                          onInsertCode(`(import ${selectedModule.id})\n`);
                          onClose();
                        }}
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded transition-colors"
                      >
                        Use in Editor
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 bg-slate-950 whitespace-pre">
                  {selectedModule ? (
                    selectedModule.code
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                      <Package size={32} className="mb-2 opacity-50" />
                      <span>Select a module from the left to inspect its definitions.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FOREIGN DIALECT CONVERTER STUDIO */}
          {activeTab === 'dialects' && (
            <div className="h-full flex flex-col gap-4">
              {/* Toolbar */}
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">Source Dialect:</span>
                    <select
                      value={converterDialect}
                      onChange={(e) => setConverterDialect(e.target.value as LispDialect)}
                      className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    >
                      <option value="auto">Auto-Detect</option>
                      <option value="scheme">Scheme (R5RS / R6RS)</option>
                      <option value="clojure">Clojure</option>
                      <option value="common-lisp">Common Lisp</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="text-slate-500">Presets:</span>
                    {Object.keys(PRESET_CONVERSIONS).map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          const p = PRESET_CONVERSIONS[key];
                          setConverterDialect(p.dialect);
                          setSourceCode(p.code);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                      >
                        {PRESET_CONVERSIONS[key].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 px-2 py-1 rounded border border-indigo-800/40">
                    Detected: {conversionResult.detectedDialect}
                  </span>
                </div>
              </div>

              {/* Side-by-Side Editor Panels */}
              <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Source Input */}
                <div className="w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="h-9 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-950/50 text-xs font-mono text-slate-400 shrink-0">
                    <span>Source Code ({conversionResult.detectedDialect})</span>
                    <span>Editable</span>
                  </div>
                  <textarea
                    value={sourceCode}
                    onChange={(e) => setSourceCode(e.target.value)}
                    className="flex-1 w-full bg-slate-950 p-3 font-mono text-xs text-slate-300 resize-none focus:outline-none whitespace-pre"
                    placeholder="Paste Scheme, Clojure, or Common Lisp code here..."
                  />
                </div>

                {/* Converted OmniLisp Output */}
                <div className="w-1/2 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <div className="h-9 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-950/50 text-xs font-mono text-slate-400 shrink-0">
                    <span className="text-emerald-400 font-semibold">Converted OmniLisp AST</span>
                    <button
                      onClick={() => handleCopy(conversionResult.converted)}
                      className="hover:text-white flex items-center gap-1 transition-colors"
                    >
                      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="flex-1 overflow-auto p-3 font-mono text-xs text-slate-200 bg-slate-950 whitespace-pre">
                    {conversionResult.converted || (
                      <span className="text-slate-600 italic">No output</span>
                    )}
                  </pre>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Register module name (e.g. my-lib)"
                    value={customModuleName}
                    onChange={(e) => setCustomModuleName(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 font-mono w-60 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSaveAsModule}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700 transition-colors"
                  >
                    Save as OmniLisp Module
                  </button>
                  {registeredNotice && (
                    <span className="text-xs text-green-400 font-mono animate-in fade-in">
                      {registeredNotice}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onInsertCode(conversionResult.converted + '\n');
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
                  >
                    Insert into Editor
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CREATE CUSTOM MODULE */}
          {activeTab === 'custom' && (
            <form onSubmit={handleCreateCustomModule} className="h-full flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Module Identifier (Unique ID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. my-math-helpers"
                    value={newModId}
                    onChange={(e) => setNewModId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My Math Helpers"
                    value={newModName}
                    onChange={(e) => setNewModName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Source Dialect
                  </label>
                  <select
                    value={newModDialect}
                    onChange={(e) => setNewModDialect(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  >
                    <option value="omnilisp">OmniLisp</option>
                    <option value="scheme">Scheme</option>
                    <option value="clojure">Clojure</option>
                    <option value="common-lisp">Common Lisp</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="h-9 border-b border-slate-800 px-3 flex items-center justify-between bg-slate-950/50 text-xs font-mono text-slate-400 shrink-0">
                  <span>Module Source Code</span>
                  <span>Will be available via (import {newModId || '<identifier>'})</span>
                </div>
                <textarea
                  required
                  value={newModCode}
                  onChange={(e) => setNewModCode(e.target.value)}
                  placeholder=";; Define functions and variables here
(def pi 3.14159)
(def circle-area (lambda (r) (* pi (* r r))))"
                  className="flex-1 w-full bg-slate-950 p-4 font-mono text-xs text-slate-200 resize-none focus:outline-none whitespace-pre"
                />
              </div>

              <div className="flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('modules')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
                >
                  Register Module
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
