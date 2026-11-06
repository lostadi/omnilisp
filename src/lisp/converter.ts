/**
 * LISP Dialect Converter
 * Translates Scheme, Clojure, and Common Lisp source code
 * into standardized OmniLisp AST and code.
 */

export type LispDialect = 'scheme' | 'clojure' | 'common-lisp' | 'auto' | 'omnilisp';

/**
 * Tokenize foreign dialect code, preserving string literals and comments
 * while normalizing brackets and special forms.
 */
function tokenizeDialect(code: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    const ch = code[i];

    // Comments: ';' to newline
    if (ch === ';') {
      while (i < len && code[i] !== '\n') i++;
      continue;
    }

    // Strings
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < len) {
        str += code[i];
        if (code[i] === '\\' && i + 1 < len) {
          i++;
          str += code[i];
        } else if (code[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      tokens.push(str);
      continue;
    }

    // Delimiters
    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
      continue;
    }

    // Clojure vector delimiters: treat [ as (list or [
    if (ch === '[' || ch === ']') {
      tokens.push(ch);
      i++;
      continue;
    }

    // Clojure map curly braces: treat { and } as delimiters
    if (ch === '{' || ch === '}') {
      tokens.push(ch);
      i++;
      continue;
    }

    // Whitespace and commas (Clojure treats comma as whitespace)
    if (/\s|,/.test(ch)) {
      i++;
      continue;
    }

    // Symbols / numbers
    let sym = '';
    while (i < len && !/\s|,|[()[\]{}]/.test(code[i])) {
      sym += code[i];
      i++;
    }
    if (sym) {
      tokens.push(sym);
    }
  }

  return tokens;
}

type SExpr = string | SExpr[];

function parseSExprTokens(tokens: string[]): SExpr[] {
  const results: SExpr[] = [];

  function parseOne(): SExpr {
    if (tokens.length === 0) throw new Error('Unexpected EOF in LISP parser');
    const token = tokens.shift()!;

    if (token === '(' || token === '[' || token === '{') {
      const closing = token === '(' ? ')' : token === '[' ? ']' : '}';
      const list: SExpr = [];
      while (tokens.length > 0 && tokens[0] !== closing) {
        list.push(parseOne());
      }
      if (tokens.length > 0 && tokens[0] === closing) {
        tokens.shift(); // consume closing
      }
      return list;
    } else if (token === ')' || token === ']' || token === '}') {
      throw new Error(`Unexpected closing '${token}'`);
    } else {
      return token;
    }
  }

  while (tokens.length > 0) {
    results.push(parseOne());
  }

  return results;
}

/**
 * Pretty-prints an S-expression into clean OmniLisp code
 */
export function stringifySExpr(expr: SExpr, indent = 0): string {
  if (!Array.isArray(expr)) {
    return expr;
  }
  if (expr.length === 0) {
    return '()';
  }

  const op = expr[0];
  const isTopForm = op === 'def' || op === 'begin' || op === 'if' || op === 'import';

  if (!isTopForm && expr.length <= 4) {
    const inline = '(' + expr.map(e => stringifySExpr(e, 0)).join(' ') + ')';
    if (inline.length <= 60) return inline;
  }

  const pad = '  '.repeat(indent);
  const nextPad = '  '.repeat(indent + 1);

  if (op === 'def') {
    const name = stringifySExpr(expr[1], 0);
    const val = stringifySExpr(expr[2], indent + 1);
    return `(${op} ${name}\n${nextPad}${val})`;
  }

  if (op === 'lambda' || op === 'fn') {
    const params = Array.isArray(expr[1]) ? '(' + expr[1].join(' ') + ')' : stringifySExpr(expr[1], 0);
    const bodyForms = expr.slice(2).map(b => stringifySExpr(b, indent + 1)).join(`\n${nextPad}`);
    return `(lambda ${params}\n${nextPad}${bodyForms})`;
  }

  if (op === 'begin') {
    const forms = expr.slice(1).map(f => stringifySExpr(f, indent + 1)).join(`\n${nextPad}`);
    return `(begin\n${nextPad}${forms})`;
  }

  const items = expr.map(e => stringifySExpr(e, indent + 1));
  return `(${items.join(' ')})`;
}

/**
 * Detect dialect automatically by scanning keywords
 */
export function detectDialect(code: string): 'scheme' | 'clojure' | 'common-lisp' | 'omnilisp' {
  if (/\b(defn|->>|->|\binc\b|\bdec\b|\[.*\])\b/.test(code)) {
    return 'clojure';
  }
  if (/\b(defun|defparameter|defvar|progn|1\+|1-|zerop|plusp|evenp|oddp)\b/.test(code)) {
    return 'common-lisp';
  }
  if (/\b(define\s*\(|#t|#f|'\(|\bdisplay\b|\bnull\?\b|\bpair\?\b|\bequal\?\b)\b/.test(code)) {
    return 'scheme';
  }
  return 'omnilisp';
}

/**
 * Transforms Scheme AST to OmniLisp AST
 */
function transformScheme(node: SExpr): SExpr {
  if (!Array.isArray(node)) {
    if (node === '#t') return 'true';
    if (node === '#f') return 'false';
    if (node === "'()") return ['list'];
    return node;
  }
  if (node.length === 0) return ['list'];

  const op = node[0];

  // (define (func p1 p2 ...) body...)
  if (op === 'define' && Array.isArray(node[1])) {
    const fnSignature = node[1] as string[];
    const fnName = fnSignature[0];
    const params = fnSignature.slice(1);
    const body = node.slice(2).map(transformScheme);
    const bodyExpr: SExpr = body.length === 1 ? body[0] : ['begin', ...body];
    return ['def', fnName, ['lambda', params, bodyExpr]];
  }

  // (define var val)
  if (op === 'define' && typeof node[1] === 'string') {
    return ['def', node[1], transformScheme(node[2])];
  }

  // (display x) -> (print x)
  if (op === 'display') {
    return ['print', ...node.slice(1).map(transformScheme)];
  }

  // (newline) -> (print "")
  if (op === 'newline') {
    return ['print', '""'];
  }

  // (null? x) -> (= (length x) 0)
  if (op === 'null?' && node.length === 2) {
    return ['=', ['length', transformScheme(node[1])], '0'];
  }

  // (pair? x) -> (> (length x) 0)
  if (op === 'pair?' && node.length === 2) {
    return ['>', ['length', transformScheme(node[1])], '0'];
  }

  // (equal? a b) -> (= a b)
  if (op === 'equal?' || op === 'eq?' || op === 'eqv?') {
    return ['=', transformScheme(node[1]), transformScheme(node[2])];
  }

  // (let ((v1 e1) (v2 e2)) body...) -> ((lambda (v1 v2) (begin body...)) e1 e2)
  if (op === 'let' && Array.isArray(node[1])) {
    const bindings = node[1] as SExpr[];
    const vars: string[] = [];
    const vals: SExpr[] = [];
    for (const b of bindings) {
      if (Array.isArray(b) && typeof b[0] === 'string') {
        vars.push(b[0]);
        vals.push(transformScheme(b[1]));
      }
    }
    const body = node.slice(2).map(transformScheme);
    const bodyExpr: SExpr = body.length === 1 ? body[0] : ['begin', ...body];
    return [['lambda', vars, bodyExpr], ...vals];
  }

  // (cond (test1 e1) (test2 e2) ... (else en))
  if (op === 'cond') {
    const clauses = node.slice(1);
    let currentIf: SExpr = 'null';
    for (let i = clauses.length - 1; i >= 0; i--) {
      const clause = clauses[i];
      if (Array.isArray(clause)) {
        const test = clause[0];
        const val = transformScheme(clause[1]);
        if (test === 'else') {
          currentIf = val;
        } else {
          currentIf = ['if', transformScheme(test), val, currentIf];
        }
      }
    }
    return currentIf;
  }

  return node.map(transformScheme);
}

/**
 * Transforms Clojure AST to OmniLisp AST
 */
function transformClojure(node: SExpr): SExpr {
  if (!Array.isArray(node)) {
    if (node === 'nil') return 'null';
    if (node === 'true') return 'true';
    if (node === 'false') return 'false';
    return node;
  }
  if (node.length === 0) return ['list'];

  const op = node[0];

  // (defn name [p1 p2 ...] body...) or (defn name "doc" [p1 p2 ...] body...)
  if (op === 'defn') {
    const name = node[1] as string;
    let paramIndex = 2;
    if (typeof node[2] === 'string' && (node[2].startsWith('"') || node[2].startsWith(';'))) {
      paramIndex = 3; // skip docstring
    }
    const rawParams = node[paramIndex];
    const params = Array.isArray(rawParams) ? (rawParams as string[]) : [];
    const body = node.slice(paramIndex + 1).map(transformClojure);
    const bodyExpr: SExpr = body.length === 1 ? body[0] : ['begin', ...body];
    return ['def', name, ['lambda', params, bodyExpr]];
  }

  // (def name val)
  if (op === 'def' && typeof node[1] === 'string') {
    return ['def', node[1], transformClojure(node[2])];
  }

  // (fn [p1 p2] body...)
  if (op === 'fn') {
    const params = Array.isArray(node[1]) ? (node[1] as string[]) : [];
    const body = node.slice(2).map(transformClojure);
    const bodyExpr: SExpr = body.length === 1 ? body[0] : ['begin', ...body];
    return ['lambda', params, bodyExpr];
  }

  // (let [v1 e1 v2 e2] body...) -> ((lambda (v1 v2) body) e1 e2)
  if (op === 'let' && Array.isArray(node[1])) {
    const flat = node[1] as SExpr[];
    const vars: string[] = [];
    const vals: SExpr[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      if (typeof flat[i] === 'string') {
        vars.push(flat[i] as string);
        vals.push(transformClojure(flat[i + 1]));
      }
    }
    const body = node.slice(2).map(transformClojure);
    const bodyExpr: SExpr = body.length === 1 ? body[0] : ['begin', ...body];
    return [['lambda', vars, bodyExpr], ...vals];
  }

  // Threading First: (-> x (f a) (g b)) -> (g (f x a) b)
  if (op === '->' && node.length >= 2) {
    let current = transformClojure(node[1]);
    for (let i = 2; i < node.length; i++) {
      const step = node[i];
      if (Array.isArray(step)) {
        const fnName = step[0];
        const args = step.slice(1).map(transformClojure);
        current = [fnName, current, ...args];
      } else {
        current = [step, current];
      }
    }
    return current;
  }

  // Threading Last: (->> x (f a) (g b)) -> (g b (f a x))
  if (op === '->>' && node.length >= 2) {
    let current = transformClojure(node[1]);
    for (let i = 2; i < node.length; i++) {
      const step = node[i];
      if (Array.isArray(step)) {
        const fnName = step[0];
        const args = step.slice(1).map(transformClojure);
        current = [fnName, ...args, current];
      } else {
        current = [step, current];
      }
    }
    return current;
  }

  // Standard Clojure renames
  if (op === 'println' || op === 'prn') {
    return ['print', ...node.slice(1).map(transformClojure)];
  }
  if (op === 'inc' && node.length === 2) {
    return ['+', transformClojure(node[1]), '1'];
  }
  if (op === 'dec' && node.length === 2) {
    return ['-', transformClojure(node[1]), '1'];
  }
  if (op === 'first' && node.length === 2) {
    return ['car', transformClojure(node[1])];
  }
  if (op === 'rest' && node.length === 2) {
    return ['cdr', transformClojure(node[1])];
  }
  if (op === 'count' && node.length === 2) {
    return ['length', transformClojure(node[1])];
  }
  if (op === 'zero?' && node.length === 2) {
    return ['=', transformClojure(node[1]), '0'];
  }
  if (op === 'pos?' && node.length === 2) {
    return ['>', transformClojure(node[1]), '0'];
  }
  if (op === 'neg?' && node.length === 2) {
    return ['<', transformClojure(node[1]), '0'];
  }
  if (op === 'even?' && node.length === 2) {
    return ['=', ['%', transformClojure(node[1]), '2'], '0'];
  }
  if (op === 'odd?' && node.length === 2) {
    return ['=', ['%', transformClojure(node[1]), '2'], '1'];
  }
  if (op === 'str') {
    return ['str-concat', ...node.slice(1).map(transformClojure)];
  }

  return node.map(transformClojure);
}

/**
 * Transforms Common Lisp AST to OmniLisp AST
 */
function transformCommonLisp(node: SExpr): SExpr {
  if (!Array.isArray(node)) {
    if (node === 't') return 'true';
    if (node === 'nil') return 'false';
    return node;
  }
  if (node.length === 0) return ['list'];

  const op = node[0];

  // (defun name (p1 p2 ...) body...)
  if (op === 'defun') {
    const name = node[1] as string;
    const rawParams = node[2];
    const params = Array.isArray(rawParams) ? (rawParams as string[]) : [];
    const body = node.slice(3).map(transformCommonLisp);
    const bodyExpr: SExpr = body.length === 1 ? body[0] : ['begin', ...body];
    return ['def', name, ['lambda', params, bodyExpr]];
  }

  // (defvar name val) or (defparameter name val) or (defconstant name val)
  if (op === 'defvar' || op === 'defparameter' || op === 'defconstant') {
    return ['def', node[1], transformCommonLisp(node[2])];
  }

  // (progn body...) -> (begin body...)
  if (op === 'progn') {
    return ['begin', ...node.slice(1).map(transformCommonLisp)];
  }

  // (1+ x) -> (+ x 1)
  if (op === '1+' && node.length === 2) {
    return ['+', transformCommonLisp(node[1]), '1'];
  }

  // (1- x) -> (- x 1)
  if (op === '1-' && node.length === 2) {
    return ['-', transformCommonLisp(node[1]), '1'];
  }

  // (zerop x) -> (= x 0)
  if (op === 'zerop' && node.length === 2) {
    return ['=', transformCommonLisp(node[1]), '0'];
  }

  // (plusp x) -> (> x 0)
  if (op === 'plusp' && node.length === 2) {
    return ['>', transformCommonLisp(node[1]), '0'];
  }

  // (minusp x) -> (< x 0)
  if (op === 'minusp' && node.length === 2) {
    return ['<', transformCommonLisp(node[1]), '0'];
  }

  // (evenp x) -> (= (% x 2) 0)
  if (op === 'evenp' && node.length === 2) {
    return ['=', ['%', transformCommonLisp(node[1]), '2'], '0'];
  }

  // (oddp x) -> (= (% x 2) 1)
  if (op === 'oddp' && node.length === 2) {
    return ['=', ['%', transformCommonLisp(node[1]), '2'], '1'];
  }

  // (princ x) or (format t ...) -> (print ...)
  if (op === 'princ') {
    return ['print', ...node.slice(1).map(transformCommonLisp)];
  }
  if (op === 'format') {
    // (format t "str" ...) -> ignore first arg 't'
    const args = node.slice(2).map(transformCommonLisp);
    return ['print', ...args];
  }

  return node.map(transformCommonLisp);
}

/**
 * Main conversion dispatcher
 */
export function convertDialectToOmniLisp(
  code: string,
  targetDialect: LispDialect = 'auto'
): { converted: string; detectedDialect: string; ast: SExpr[] } {
  const chosenDialect = targetDialect === 'auto' ? detectDialect(code) : targetDialect;
  const tokens = tokenizeDialect(code);
  const astList = parseSExprTokens(tokens);

  let transformedAst: SExpr[];

  switch (chosenDialect) {
    case 'scheme':
      transformedAst = astList.map(transformScheme);
      break;
    case 'clojure':
      transformedAst = astList.map(transformClojure);
      break;
    case 'common-lisp':
      transformedAst = astList.map(transformCommonLisp);
      break;
    default:
      transformedAst = astList;
      break;
  }

  const convertedCode = transformedAst.map(ast => stringifySExpr(ast, 0)).join('\n\n');

  return {
    converted: convertedCode,
    detectedDialect: chosenDialect,
    ast: transformedAst,
  };
}
