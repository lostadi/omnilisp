export interface HighlightToken {
  text: string;
  className: string;
}

const KEYWORDS = new Set([
  'def',
  'lambda',
  'fn',
  'if',
  'let',
  'quote',
  'set!',
  'cond',
  'begin',
  'do',
  'eval',
  'import',
  'import-scheme',
  'import-clojure',
  'import-common-lisp',
  'convert',
  'define',
  'defn',
  'defun',
  ':as',
]);

const BUILTINS = new Set([
  'print',
  'map',
  'filter',
  'reduce',
  'cons',
  'car',
  'cdr',
  'list',
  'length',
  'javascript',
  'run-js',
  'run-c',
  'run-python',
  'str-concat',
  'str-len',
  'str-upper',
  'str-lower',
  'str-trim',
  'sin',
  'cos',
  'tan',
  'sqrt',
  'pow',
  'abs',
  'min',
  'max',
  'pi',
  'e',
  'tau',
  'reverse',
  'range',
  'take',
  'drop',
  'sum',
  'mean',
  'median',
  'variance',
  'stddev',
  'inc',
  'dec',
  '1+',
  '1-',
  'zerop',
  'plusp',
  'null?',
  'pair?',
  'list?',
  'number?',
  'string?',
  '+',
  '-',
  '*',
  '/',
  '=',
  '<',
  '>',
  '<=',
  '>=',
  '%',
  'not',
  'and',
  'or',
]);

const PAREN_COLORS = [
  'text-amber-400 font-semibold',
  'text-purple-400 font-semibold',
  'text-cyan-400 font-semibold',
  'text-pink-400 font-semibold',
  'text-emerald-400 font-semibold',
];

/**
 * Tokenizes LISP source code for syntax highlighting.
 * Preserves 100% of characters (including whitespaces and newlines)
 * so that overlay positioning precisely mirrors a standard textarea.
 */
export function highlightLispCode(code: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  const len = code.length;
  let i = 0;
  let parenDepth = 0;

  while (i < len) {
    const ch = code[i];

    // 1. Comments: ';' through end of line
    if (ch === ';') {
      let comment = '';
      while (i < len && code[i] !== '\n') {
        comment += code[i];
        i++;
      }
      tokens.push({ text: comment, className: 'text-slate-500 italic' });
      continue;
    }

    // 2. Strings: starts with '"'
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < len) {
        const c = code[i];
        str += c;
        if (c === '\\' && i + 1 < len) {
          i++;
          str += code[i];
        } else if (c === '"') {
          i++;
          break;
        }
        i++;
      }
      tokens.push({ text: str, className: 'text-emerald-400' });
      continue;
    }

    // 3. Parentheses with rainbow depth tracking
    if (ch === '(') {
      const colorClass = PAREN_COLORS[parenDepth % PAREN_COLORS.length];
      parenDepth++;
      tokens.push({ text: '(', className: colorClass });
      i++;
      continue;
    }

    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      const colorClass = PAREN_COLORS[parenDepth % PAREN_COLORS.length];
      tokens.push({ text: ')', className: colorClass });
      i++;
      continue;
    }

    // 4. Whitespaces and Newlines (must be preserved verbatim)
    if (/\s/.test(ch)) {
      let ws = '';
      while (i < len && /\s/.test(code[i])) {
        ws += code[i];
        i++;
      }
      tokens.push({ text: ws, className: '' });
      continue;
    }

    // 5. Symbols, numbers, keywords, and operators
    let sym = '';
    while (i < len && !/\s|[();"]/.test(code[i])) {
      sym += code[i];
      i++;
    }

    if (sym) {
      // Check for numeric literal (including negatives and floats)
      if (/^-?\d+(\.\d+)?$/.test(sym)) {
        tokens.push({ text: sym, className: 'text-amber-300' });
      } else if (sym === 'true' || sym === 'false' || sym === 'nil') {
        tokens.push({ text: sym, className: 'text-rose-400 font-medium' });
      } else if (KEYWORDS.has(sym)) {
        tokens.push({ text: sym, className: 'text-indigo-400 font-semibold' });
      } else if (BUILTINS.has(sym)) {
        tokens.push({ text: sym, className: 'text-cyan-400 font-medium' });
      } else {
        tokens.push({ text: sym, className: 'text-slate-200' });
      }
    }
  }

  return tokens;
}
