/**
 * OmniLisp Module Registry & Standard Library Ecosystem
 * Provides built-in and user-defined modules across multiple Lisp dialects.
 */

import { convertDialectToOmniLisp, LispDialect } from './converter';

export interface LispModule {
  id: string;
  name: string;
  description: string;
  dialect: 'omnilisp' | 'scheme' | 'clojure' | 'common-lisp';
  code: string;
  convertedCode?: string;
  exports: string[];
  isBuiltIn: boolean;
}

export const BUILT_IN_MODULES: Record<string, LispModule> = {
  math: {
    id: 'math',
    name: 'Mathematics & Trigonometry',
    description: 'Mathematical constants, trigonometric functions, exponents, and numerical operations.',
    dialect: 'omnilisp',
    exports: [
      'pi', 'e', 'tau',
      'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
      'sqrt', 'cbrt', 'pow', 'abs', 'round', 'floor', 'ceil',
      'min', 'max', 'random', 'clamp', 'deg->rad', 'rad->deg',
    ],
    isBuiltIn: true,
    code: `; OmniLisp Standard Math Module
(def pi 3.141592653589793)
(def e 2.718281828459045)
(def tau 6.283185307179586)

(def abs (lambda (x) (if (< x 0) (- 0 x) x)))
(def min (lambda (a b) (if (< a b) a b)))
(def max (lambda (a b) (if (> a b) a b)))
(def clamp (lambda (val low high) (min high (max low val))))

(def deg->rad (lambda (deg) (* deg (/ pi 180))))
(def rad->deg (lambda (rad) (* rad (/ 180 pi))))

; Native Math bindings
(def sqrt (lambda (x) (native-sqrt x)))
(def cbrt (lambda (x) (native-cbrt x)))
(def pow (lambda (base exp) (native-pow base exp)))
(def sin (lambda (x) (native-sin x)))
(def cos (lambda (x) (native-cos x)))
(def tan (lambda (x) (native-tan x)))
(def asin (lambda (x) (native-asin x)))
(def acos (lambda (x) (native-acos x)))
(def atan (lambda (x) (native-atan x)))
(def round (lambda (x) (native-round x)))
(def floor (lambda (x) (native-floor x)))
(def ceil (lambda (x) (native-ceil x)))
(def random (lambda () (native-random)))
`,
  },

  string: {
    id: 'string',
    name: 'String Manipulation',
    description: 'String manipulation, slicing, case conversion, search, and formatting utilities.',
    dialect: 'omnilisp',
    exports: [
      'str-len', 'str-concat', 'str-upper', 'str-lower', 'str-trim',
      'str-contains?', 'str-starts-with?', 'str-ends-with?', 'str-slice',
      'num->str', 'str->num',
    ],
    isBuiltIn: true,
    code: `; OmniLisp String Manipulation Module
(def str-len (lambda (s) (native-str-len s)))
(def str-upper (lambda (s) (native-str-upper s)))
(def str-lower (lambda (s) (native-str-lower s)))
(def str-trim (lambda (s) (native-str-trim s)))
(def num->str (lambda (n) (str-concat "" n)))
(def str->num (lambda (s) (native-str->num s)))
`,
  },

  'list-utils': {
    id: 'list-utils',
    name: 'Functional List Utilities',
    description: 'Higher-order list operations: reverse, take, drop, range, zip, and predicates.',
    dialect: 'omnilisp',
    exports: [
      'reverse', 'take', 'drop', 'range', 'first', 'second', 'last',
      'nth', 'any?', 'all?', 'sum', 'product',
    ],
    isBuiltIn: true,
    code: `; OmniLisp Functional List Utilities
(def first (lambda (lst) (car lst)))
(def second (lambda (lst) (car (cdr lst))))

(def reverse-acc
  (lambda (lst acc)
    (if (= (length lst) 0)
        acc
        (reverse-acc (cdr lst) (cons (car lst) acc)))))

(def reverse (lambda (lst) (reverse-acc lst (list))))

(def take
  (lambda (n lst)
    (if (<= n 0)
        (list)
        (if (= (length lst) 0)
            (list)
            (cons (car lst) (take (- n 1) (cdr lst)))))))

(def drop
  (lambda (n lst)
    (if (<= n 0)
        lst
        (if (= (length lst) 0)
            (list)
            (drop (- n 1) (cdr lst))))))

(def range-helper
  (lambda (start end step)
    (if (>= start end)
        (list)
        (cons start (range-helper (+ start step) end step)))))

(def range
  (lambda (start end)
    (range-helper start end 1)))

(def sum
  (lambda (lst)
    (reduce (lambda (acc x) (+ acc x)) 0 lst)))

(def product
  (lambda (lst)
    (reduce (lambda (acc x) (* acc x)) 1 lst)))
`,
  },

  stats: {
    id: 'stats',
    name: 'Statistics & Aggregations',
    description: 'Statistical calculations including mean, variance, and standard deviations.',
    dialect: 'omnilisp',
    exports: ['mean', 'min-val', 'max-val', 'variance', 'stddev'],
    isBuiltIn: true,
    code: `; OmniLisp Statistics Module
(def mean
  (lambda (lst)
    (if (= (length lst) 0)
        0
        (/ (reduce (lambda (a b) (+ a b)) 0 lst) (length lst)))))

(def min-val
  (lambda (lst)
    (reduce (lambda (a b) (if (< a b) a b)) (car lst) (cdr lst))))

(def max-val
  (lambda (lst)
    (reduce (lambda (a b) (if (> a b) a b)) (car lst) (cdr lst))))

(def variance
  (lambda (lst)
    (if (= (length lst) 0)
        0
        (begin
          (def m (mean lst))
          (def sq-diffs (map (lambda (x) (* (- x m) (- x m))) lst))
          (mean sq-diffs)))))

(def stddev
  (lambda (lst)
    (javascript (str-concat "Math.sqrt(" (variance lst) ")"))))
`,
  },

  'scheme/srfi-1': {
    id: 'scheme/srfi-1',
    name: 'Scheme SRFI-1 List Processing',
    description: 'Scheme standard SRFI-1 list library converted dynamically into OmniLisp.',
    dialect: 'scheme',
    exports: ['iota', 'null?', 'pair?', 'any-pred?', 'every-pred?'],
    isBuiltIn: true,
    code: `;; Scheme SRFI-1 List Processing (Scheme Dialect)
(define (null? x)
  (= (length x) 0))

(define (pair? x)
  (> (length x) 0))

(define (iota count start step)
  (if (<= count 0)
      '()
      (cons start (iota (- count 1) (+ start step) step))))

(define (any-pred? pred lst)
  (if (null? lst)
      #f
      (if (pred (car lst))
          #t
          (any-pred? pred (cdr lst)))))

(define (every-pred? pred lst)
  (if (null? lst)
      #t
      (if (pred (car lst))
          (every-pred? pred (cdr lst))
          #f)))
`,
  },

  'clojure/core': {
    id: 'clojure/core',
    name: 'Clojure Core Transpiled Library',
    description: 'Clojure core functional idioms (defn, let, inc, dec, threading) converted to OmniLisp.',
    dialect: 'clojure',
    exports: ['inc', 'dec', 'zero?', 'pos?', 'neg?', 'even?', 'odd?', 'square', 'cube'],
    isBuiltIn: true,
    code: `;; Clojure Core Dialect Library
(defn inc [x]
  (+ x 1))

(defn dec [x]
  (- x 1))

(defn zero? [x]
  (= x 0))

(defn pos? [x]
  (> x 0))

(defn neg? [x]
  (< x 0))

(defn even? [x]
  (= (% x 2) 0))

(defn odd? [x]
  (= (% x 2) 1))

(defn square [x]
  (* x x))

(defn cube [x]
  (* x (* x x)))
`,
  },

  'common-lisp': {
    id: 'common-lisp',
    name: 'Common Lisp Compatibility',
    description: 'Common Lisp standard macros and predicates (defun, 1+, 1-, zerop, plusp) converted to OmniLisp.',
    dialect: 'common-lisp',
    exports: ['1+', '1-', 'zerop', 'plusp', 'minusp', 'evenp', 'oddp', 'square-cl'],
    isBuiltIn: true,
    code: `;; Common Lisp Dialect Library
(defun 1+ (x)
  (+ x 1))

(defun 1- (x)
  (- x 1))

(defun zerop (x)
  (= x 0))

(defun plusp (x)
  (> x 0))

(defun minusp (x)
  (< x 0))

(defun evenp (x)
  (= (% x 2) 0))

(defun oddp (x)
  (= (% x 2) 1))

(defun square-cl (x)
  (* x x))
`,
  },

  'polyglot/json': {
    id: 'polyglot/json',
    name: 'JSON Polyglot Interop',
    description: 'JSON serialization and parsing bridged through host JavaScript environment.',
    dialect: 'omnilisp',
    exports: ['json-stringify', 'json-parse'],
    isBuiltIn: true,
    code: `; OmniLisp JSON Module
(def json-stringify (lambda (x) (javascript (str-concat "JSON.stringify(" (quote x) ")"))))
(def json-parse (lambda (s) (javascript (str-concat "JSON.parse(" (quote s) ")"))))
`,
  },

  ostadix: {
    id: 'ostadix',
    name: 'Local telemetry & repair experiments',
    description: 'In-process telemetry and message queues with heuristic repair candidates; no native Ostadix connection.',
    dialect: 'omnilisp',
    exports: [
      'version',
      'ping',
      'status',
      'fuzz',
      'channel-send',
      'channel-recv',
      'safe-eval',
    ],
    isBuiltIn: true,
    code: `; Ostadix Core System Module
(def version (ostadix/version))
(def ping (lambda () (ostadix/ping)))
(def status (lambda () (ostadix/status)))
(def fuzz (lambda (code-str) (ostadix/fuzz code-str)))
(def channel-send (lambda (chan val) (ostadix/channel-send chan val)))
(def channel-recv (lambda (chan) (ostadix/channel-recv chan)))
(def safe-eval (lambda (expr-fn) (if (= 1 1) (expr-fn) "fault_recovered")))
`,
  },
};

/**
 * Global dynamic module registry that merges built-in and user-defined modules.
 */
class ModuleManager {
  private customModules: Map<string, LispModule> = new Map();

  getAllModules(): LispModule[] {
    const list: LispModule[] = Object.values(BUILT_IN_MODULES);
    for (const mod of this.customModules.values()) {
      list.push(mod);
    }
    return list;
  }

  getModule(id: string): LispModule | undefined {
    const cleanId = id.replace(/^["']|["']$/g, '');
    return this.customModules.get(cleanId) || BUILT_IN_MODULES[cleanId];
  }

  registerCustomModule(mod: LispModule): void {
    // If dialect is not omnilisp, pre-convert and cache
    if (mod.dialect !== 'omnilisp') {
      const { converted } = convertDialectToOmniLisp(mod.code, mod.dialect);
      mod.convertedCode = converted;
    } else {
      mod.convertedCode = mod.code;
    }
    this.customModules.set(mod.id, mod);
  }

  deleteCustomModule(id: string): boolean {
    return this.customModules.delete(id);
  }

  /**
   * Resolves a module's executable OmniLisp source code.
   * If written in Scheme, Clojure, or Common Lisp, it converts it on the fly.
   */
  resolveModuleCode(id: string): { code: string; dialect: LispDialect; exports: string[] } {
    const mod = this.getModule(id);
    if (!mod) {
      throw new Error(`Module '${id}' not found in registry. Available modules: ${Object.keys(BUILT_IN_MODULES).join(', ')}`);
    }

    if (mod.convertedCode) {
      return { code: mod.convertedCode, dialect: mod.dialect, exports: mod.exports };
    }

    if (mod.dialect !== 'omnilisp') {
      const { converted } = convertDialectToOmniLisp(mod.code, mod.dialect);
      mod.convertedCode = converted;
      return { code: converted, dialect: mod.dialect, exports: mod.exports };
    }

    return { code: mod.code, dialect: 'omnilisp', exports: mod.exports };
  }
}

export const moduleManager = new ModuleManager();
