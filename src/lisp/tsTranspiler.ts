/**
 * Bidirectional TypeScript <-> OmniLisp Transpiler
 * Provides:
 * 1. compileToTypeScript: OmniLisp AST -> Strongly typed, idiomatic TypeScript source
 * 2. convertTypeScriptToOmniLisp: TypeScript source -> Clean, formatted OmniLisp code
 */

import { LispValue } from './types';

// ============================================================================
// PART 1: OmniLisp -> TypeScript Transpiler
// ============================================================================

export interface TSCompileOptions {
  includeHeader?: boolean;
  includeHelpers?: boolean;
  exportAll?: boolean;
}

export function compileToTypeScript(
  ast: LispValue | LispValue[],
  options: TSCompileOptions = {}
): string {
  const { includeHeader = true, includeHelpers = true, exportAll = true } = options;

  const nodes = Array.isArray(ast) && ast.length > 0 && Array.isArray(ast[0]) && typeof ast[0][0] !== 'number'
    ? (ast as LispValue[])
    : Array.isArray(ast) && (ast[0] === 'def' || ast[0] === 'import' || ast[0] === 'print' || ast[0] === 'begin')
    ? [ast]
    : Array.isArray(ast)
    ? (ast as LispValue[])
    : [ast];

  const topLevelFns: string[] = [];
  const topLevelVars: string[] = [];
  const statements: string[] = [];
  const npmImports: string[] = [];
  const npmPkgList: string[] = [];
  const usedHelpers = new Set<string>();

  function toJsIdentifier(name: string): string {
    if (typeof name !== 'string') return 'v';
    // Clean operators or special characters
    const clean = name.replace(/[?!]/g, '').replace(/-([a-z0-9])/g, (_, g) => g.toUpperCase());
    return clean || 'item';
  }

  function inferType(val: LispValue): string {
    if (typeof val === 'number') return 'number';
    if (typeof val === 'string') return 'string';
    if (typeof val === 'boolean') return 'boolean';
    if (Array.isArray(val)) {
      if (val[0] === 'list') {
        const itemType = val.length > 1 ? inferType(val[1]) : 'any';
        return `${itemType}[]`;
      }
      if (val[0] === '+' || val[0] === '-' || val[0] === '*' || val[0] === '/' || val[0] === 'sqrt' || val[0] === 'sin') {
        return 'number';
      }
    }
    return 'any';
  }

  function transpileExpr(expr: LispValue, indent = 0): string {
    if (typeof expr === 'number' || typeof expr === 'boolean') {
      return String(expr);
    }
    if (expr === null) {
      return 'null';
    }
    if (typeof expr === 'string') {
      if (expr.startsWith('"') && expr.endsWith('"')) {
        return expr;
      }
      if (expr === 'pi') return 'Math.PI';
      if (expr === 'e') return 'Math.E';
      if (expr === 'true') return 'true';
      if (expr === 'false') return 'false';
      if (expr === 'nil') return 'null';
      return toJsIdentifier(expr);
    }

    if (!Array.isArray(expr)) {
      return 'null';
    }

    if (expr.length === 0) return '[]';

    const op = expr[0];

    // Module imports
    if (op === 'import-npm') {
      const pkg = String(expr[1]).replace(/^["']|["']$/g, '');
      let alias: string | null = null;
      if (expr[2] === ':as' && typeof expr[3] === 'string') {
        alias = String(expr[3]).replace(/^["']|["']$/g, '');
      }
      const importId = alias ? toJsIdentifier(alias) : toJsIdentifier(pkg);
      npmImports.push(`import ${importId} from '${pkg}';`);
      if (!npmPkgList.includes(pkg)) npmPkgList.push(pkg);
      return `// [NPM]: Loaded '${pkg}' as ${importId}`;
    }

    if (op === 'import') {
      const pkgs = expr.slice(1).map(p => String(p).replace(/^["']|["']$/g, ''));
      for (const p of pkgs) {
        if (p.startsWith('npm:')) {
          const rawPkg = p.replace('npm:', '');
          const importId = toJsIdentifier(rawPkg);
          npmImports.push(`import ${importId} from '${rawPkg}';`);
          if (!npmPkgList.includes(rawPkg)) npmPkgList.push(rawPkg);
        }
      }
      return `// OmniLisp imported module(s): ${pkgs.join(', ')}`;
    }

    if (op === 'import-scheme' || op === 'import-clojure' || op === 'import-common-lisp') {
      return `// Inline dialect import: ${op}`;
    }

    // Definitions
    if (op === 'def') {
      const name = toJsIdentifier(String(expr[1]));
      const val = expr[2];

      // Function definition (lambda)
      if (Array.isArray(val) && (val[0] === 'lambda' || val[0] === 'fn')) {
        const paramsRaw = Array.isArray(val[1]) ? (val[1] as string[]) : [];
        const params = paramsRaw.map(p => `${toJsIdentifier(String(p))}: number`).join(', ');
        const bodyForms = val.slice(2);

        let bodyCode = '';
        if (bodyForms.length === 1) {
          const single = transpileExpr(bodyForms[0], indent + 1);
          bodyCode = `  return ${single};`;
        } else {
          const lines = bodyForms.map((b, i) => {
            const compiled = transpileExpr(b, indent + 1);
            return i === bodyForms.length - 1 ? `  return ${compiled};` : `  ${compiled};`;
          });
          bodyCode = lines.join('\n');
        }

        const expPrefix = exportAll ? 'export ' : '';
        return `${expPrefix}function ${name}(${params}): number {\n${bodyCode}\n}`;
      }

      // Variable definition
      const t = inferType(val);
      const valCode = transpileExpr(val, indent);
      const expPrefix = exportAll ? 'export ' : '';
      return `${expPrefix}const ${name}: ${t} = ${valCode};`;
    }

    // Mutation
    if (op === 'set!') {
      const name = toJsIdentifier(String(expr[1]));
      const valCode = transpileExpr(expr[2], indent);
      return `${name} = ${valCode}`;
    }

    // Lambda / Closure
    if (op === 'lambda' || op === 'fn') {
      const paramsRaw = Array.isArray(expr[1]) ? (expr[1] as string[]) : [];
      const params = paramsRaw.map(p => `${toJsIdentifier(String(p))}: any`).join(', ');
      const bodyForms = expr.slice(2);
      if (bodyForms.length === 1) {
        return `((${params}) => ${transpileExpr(bodyForms[0], indent)})`;
      }
      const lines = bodyForms.map((b, i) => {
        const compiled = transpileExpr(b, indent + 1);
        return i === bodyForms.length - 1 ? `return ${compiled};` : `${compiled};`;
      });
      return `((${params}) => {\n    ${lines.join('\n    ')}\n  })`;
    }

    // Conditionals
    if (op === 'if') {
      const test = transpileExpr(expr[1], indent);
      const conseq = transpileExpr(expr[2], indent);
      const alt = expr[3] !== undefined ? transpileExpr(expr[3], indent) : 'undefined';
      return `(${test} ? ${conseq} : ${alt})`;
    }

    // Begin / Do blocks
    if (op === 'begin' || op === 'do') {
      const forms = expr.slice(1);
      if (forms.length === 0) return 'undefined';
      if (forms.length === 1) return transpileExpr(forms[0], indent);
      const stmts = forms.map(transpileExpr);
      const last = stmts.pop();
      return `(() => {\n  ${stmts.join(';\n  ')};\n  return ${last};\n})()`;
    }

    // Arithmetic operators
    if (['+', '-', '*', '/', '%'].includes(op as string)) {
      if (expr.length === 2 && op === '-') {
        return `(-${transpileExpr(expr[1], indent)})`;
      }
      const args = expr.slice(1).map(e => transpileExpr(e, indent));
      return `(${args.join(` ${op} `)})`;
    }

    // Comparisons
    if (['=', '==', 'eq?', 'equal?'].includes(op as string)) {
      const a = transpileExpr(expr[1], indent);
      const b = transpileExpr(expr[2], indent);
      return `(${a} === ${b})`;
    }
    if (['<', '<=', '>', '>='].includes(op as string)) {
      const a = transpileExpr(expr[1], indent);
      const b = transpileExpr(expr[2], indent);
      return `(${a} ${op} ${b})`;
    }

    // Logic
    if (op === 'and') {
      const args = expr.slice(1).map(e => transpileExpr(e, indent));
      return `(${args.join(' && ')})`;
    }
    if (op === 'or') {
      const args = expr.slice(1).map(e => transpileExpr(e, indent));
      return `(${args.join(' || ')})`;
    }
    if (op === 'not') {
      return `(!${transpileExpr(expr[1], indent)})`;
    }

    // Print
    if (op === 'print' || op === 'display') {
      const args = expr.slice(1).map(e => transpileExpr(e, indent));
      return `console.log(${args.join(', ')})`;
    }

    // List primitives
    if (op === 'list') {
      const items = expr.slice(1).map(e => transpileExpr(e, indent));
      return `[${items.join(', ')}]`;
    }

    if (op === 'map') {
      const fn = transpileExpr(expr[1], indent);
      const list = transpileExpr(expr[2], indent);
      return `${list}.map(${fn})`;
    }

    if (op === 'filter') {
      const pred = transpileExpr(expr[1], indent);
      const list = transpileExpr(expr[2], indent);
      return `${list}.filter(${pred})`;
    }

    if (op === 'reduce') {
      const fn = transpileExpr(expr[1], indent);
      const initial = transpileExpr(expr[2], indent);
      const list = transpileExpr(expr[3], indent);
      return `${list}.reduce(${fn}, ${initial})`;
    }

    if (op === 'head' || op === 'car') {
      return `${transpileExpr(expr[1], indent)}[0]`;
    }

    if (op === 'tail' || op === 'cdr') {
      return `${transpileExpr(expr[1], indent)}.slice(1)`;
    }

    if (op === 'cons') {
      const head = transpileExpr(expr[1], indent);
      const tail = transpileExpr(expr[2], indent);
      return `[${head}, ...${tail}]`;
    }

    if (op === 'length') {
      return `${transpileExpr(expr[1], indent)}.length`;
    }

    // Math functions
    const math1: Record<string, string> = {
      sqrt: 'Math.sqrt',
      'native-sqrt': 'Math.sqrt',
      cbrt: 'Math.cbrt',
      sin: 'Math.sin',
      'native-sin': 'Math.sin',
      cos: 'Math.cos',
      'native-cos': 'Math.cos',
      tan: 'Math.tan',
      'native-tan': 'Math.tan',
      abs: 'Math.abs',
      floor: 'Math.floor',
      ceil: 'Math.ceil',
      round: 'Math.round',
      exp: 'Math.exp',
      log: 'Math.log',
    };
    if (typeof op === 'string' && math1[op]) {
      return `${math1[op]}(${transpileExpr(expr[1], indent)})`;
    }

    if (op === 'pow' || op === 'native-pow') {
      return `Math.pow(${transpileExpr(expr[1], indent)}, ${transpileExpr(expr[2], indent)})`;
    }

    if (op === 'min') {
      const args = expr.slice(1).map(e => transpileExpr(e, indent));
      return `Math.min(${args.join(', ')})`;
    }
    if (op === 'max') {
      const args = expr.slice(1).map(e => transpileExpr(e, indent));
      return `Math.max(${args.join(', ')})`;
    }
    if (op === 'clamp') {
      usedHelpers.add('clamp');
      const [v, low, high] = expr.slice(1).map(e => transpileExpr(e, indent));
      return `clamp(${v}, ${low}, ${high})`;
    }
    if (op === 'deg->rad') {
      usedHelpers.add('degToRad');
      return `degToRad(${transpileExpr(expr[1], indent)})`;
    }
    if (op === 'rad->deg') {
      usedHelpers.add('radToDeg');
      return `radToDeg(${transpileExpr(expr[1], indent)})`;
    }

    // String operations
    if (op === 'str-upper' || op === 'native-str-upper') {
      return `${transpileExpr(expr[1], indent)}.toUpperCase()`;
    }
    if (op === 'str-lower' || op === 'native-str-lower') {
      return `${transpileExpr(expr[1], indent)}.toLowerCase()`;
    }
    if (op === 'str-trim' || op === 'native-str-trim') {
      return `${transpileExpr(expr[1], indent)}.trim()`;
    }
    if (op === 'str-len' || op === 'native-str-len') {
      return `${transpileExpr(expr[1], indent)}.length`;
    }
    if (op === 'str-concat') {
      const args = expr.slice(1).map(e => transpileExpr(e, indent));
      return `(${args.join(' + ')})`;
    }

    // Default function call
    if (typeof op === 'string') {
      const fnName = toJsIdentifier(op);
      const args = expr.slice(1).map(e => transpileExpr(e, indent));
      return `${fnName}(${args.join(', ')})`;
    }

    // Arbitrary expression invocation ((lambda ...) arg1)
    const callee = transpileExpr(op, indent);
    const args = expr.slice(1).map(e => transpileExpr(e, indent));
    return `(${callee})(${args.join(', ')})`;
  }

  // Process all top-level statements
  for (const node of nodes) {
    if (!node || (Array.isArray(node) && node.length === 0)) continue;
    const code = transpileExpr(node);
    if (!code) continue;

    if (code.startsWith('export function') || code.startsWith('function')) {
      topLevelFns.push(code);
    } else if (code.startsWith('export const') || code.startsWith('const')) {
      topLevelVars.push(code);
    } else {
      // Expression statement or comment
      const stmt = code.endsWith(';') || code.startsWith('//') ? code : `${code};`;
      statements.push(stmt);
    }
  }

  // Build helpers section if needed
  const helperLines: string[] = [];
  if (includeHelpers) {
    if (usedHelpers.has('clamp')) {
      helperLines.push('const clamp = (val: number, min: number, max: number): number => Math.min(max, Math.max(min, val));');
    }
    if (usedHelpers.has('degToRad')) {
      helperLines.push('const degToRad = (deg: number): number => (deg * Math.PI) / 180;');
    }
    if (usedHelpers.has('radToDeg')) {
      helperLines.push('const radToDeg = (rad: number): number => (rad * 180) / Math.PI;');
    }
  }

  const sections: string[] = [];
  if (includeHeader) {
    sections.push(
      `/**\n * Auto-generated TypeScript Source Code\n * Compiled from OmniLisp VM AST\n * Target: TypeScript 5+ / ES2022\n */`
    );
  }

  if (npmImports.length > 0) {
    const pkgDeps = npmPkgList.map(p => `//   "${p}": "latest"`).join('\n');
    sections.push(
      '// --- NPM Package Imports ---\n' +
        npmImports.join('\n') +
        '\n\n// NPM Dependencies (package.json):\n' +
        pkgDeps
    );
  }

  if (helperLines.length > 0) {
    sections.push('// --- Runtime Helpers ---\n' + helperLines.join('\n'));
  }

  if (topLevelFns.length > 0) {
    sections.push('// --- Function Declarations ---\n' + topLevelFns.join('\n\n'));
  }

  if (topLevelVars.length > 0) {
    sections.push('// --- Constant Declarations ---\n' + topLevelVars.join('\n'));
  }

  if (statements.length > 0) {
    sections.push('// --- Main Execution Pipeline ---\n' + statements.join('\n'));
  }

  return sections.join('\n\n');
}

// ============================================================================
// PART 2: TypeScript -> OmniLisp Transpiler (Vice Versa)
// ============================================================================

interface TSToken {
  type: 'keyword' | 'identifier' | 'number' | 'string' | 'punct' | 'comment';
  value: string;
  line: number;
}

function tokenizeTS(code: string): TSToken[] {
  const tokens: TSToken[] = [];
  let i = 0;
  let line = 1;
  const len = code.length;

  const KEYWORDS = new Set([
    'function', 'const', 'let', 'var', 'return', 'if', 'else', 'while', 'for',
    'true', 'false', 'null', 'undefined', 'export', 'import', 'from', 'as', 'type', 'interface'
  ]);

  while (i < len) {
    const ch = code[i];

    // Newlines
    if (ch === '\n') {
      line++;
      i++;
      continue;
    }

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Single-line comment
    if (ch === '/' && code[i + 1] === '/') {
      let comment = '';
      while (i < len && code[i] !== '\n') {
        comment += code[i];
        i++;
      }
      tokens.push({ type: 'comment', value: comment, line });
      continue;
    }

    // Multi-line comment
    if (ch === '/' && code[i + 1] === '*') {
      let comment = '';
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') line++;
        comment += code[i];
        i++;
      }
      i += 2; // skip */
      tokens.push({ type: 'comment', value: comment + '*/', line });
      continue;
    }

    // Strings (double, single, template)
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let str = '"';
      i++;
      while (i < len && code[i] !== quote) {
        if (code[i] === '\\' && i + 1 < len) {
          str += code[i] + code[i + 1];
          i += 2;
        } else {
          if (code[i] === '\n') line++;
          str += code[i];
          i++;
        }
      }
      str += '"';
      if (i < len) i++; // skip closing quote
      tokens.push({ type: 'string', value: str, line });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < len && /[0-9.]/.test(code[i])) {
        num += code[i];
        i++;
      }
      tokens.push({ type: 'number', value: num, line });
      continue;
    }

    // Identifiers and Keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      let id = '';
      while (i < len && /[a-zA-Z0-9_$]/.test(code[i])) {
        id += code[i];
        i++;
      }
      if (KEYWORDS.has(id)) {
        tokens.push({ type: 'keyword', value: id, line });
      } else {
        tokens.push({ type: 'identifier', value: id, line });
      }
      continue;
    }

    // Multi-char punctuation: ===, !==, ==, !=, <=, >=, =>, &&, ||, ++, --, +=, -=
    const two = code.slice(i, i + 2);
    const three = code.slice(i, i + 3);

    if (three === '===' || three === '!==') {
      tokens.push({ type: 'punct', value: three, line });
      i += 3;
      continue;
    }

    if (['==', '!=', '<=', '>=', '=>', '&&', '||', '++', '--', '+=', '-='].includes(two)) {
      tokens.push({ type: 'punct', value: two, line });
      i += 2;
      continue;
    }

    // Single-char punctuation
    tokens.push({ type: 'punct', value: ch, line });
    i++;
  }

  return tokens;
}

/**
 * Recursive descent parser for TS statements and expressions to OmniLisp S-expression string.
 */
class TSParser {
  private tokens: TSToken[];
  private pos = 0;

  constructor(tokens: TSToken[]) {
    // Filter out comments from syntax tree parsing, or preserve them
    this.tokens = tokens;
  }

  private peek(): TSToken | undefined {
    return this.tokens[this.pos];
  }

  private next(): TSToken {
    return this.tokens[this.pos++];
  }

  private match(val: string): boolean {
    if (this.pos < this.tokens.length && this.tokens[this.pos].value === val) {
      this.pos++;
      return true;
    }
    return false;
  }

  private expect(val: string): void {
    if (!this.match(val)) {
      const got = this.peek()?.value ?? 'EOF';
      throw new Error(`Expected '${val}', but got '${got}' at line ${this.peek()?.line ?? '?'}`);
    }
  }

  // Convert JS camelCase or snake_case identifier to Lisp kebab-case
  private toLispId(name: string): string {
    return name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase();
  }

  // Skip TypeScript type annotations like `: number`, `: string[]`, `: Record<string, any>`
  private skipTypeAnnotation(): void {
    if (this.match(':')) {
      let depth = 0;
      while (this.pos < this.tokens.length) {
        const tok = this.peek()!;
        if (tok.value === '(' || tok.value === '{' || tok.value === '<' || tok.value === '[') {
          depth++;
        } else if (tok.value === ')' || tok.value === '}' || tok.value === '>' || tok.value === ']') {
          if (depth > 0) depth--;
          else break;
        } else if (depth === 0 && (tok.value === '=' || tok.value === ';' || tok.value === ',' || tok.value === '{')) {
          break;
        }
        this.next();
      }
    }
  }

  public parseProgram(): string[] {
    const lispForms: string[] = [];

    while (this.pos < this.tokens.length) {
      const tok = this.peek()!;

      // Comments
      if (tok.type === 'comment') {
        this.next();
        const commentClean = tok.value.replace(/^\/\/\s*/, '; ').replace(/^\/\*\s*/, '; ').replace(/\*\/$/, '');
        lispForms.push(commentClean);
        continue;
      }

      // Semicolons
      if (tok.value === ';') {
        this.next();
        continue;
      }

      // Export / Import
      if (tok.value === 'export') {
        this.next();
        continue;
      }

      // Type alias or interface: skip
      if (tok.value === 'type' || tok.value === 'interface') {
        while (this.pos < this.tokens.length && this.peek()!.value !== ';') {
          this.next();
        }
        if (this.peek()?.value === ';') this.next();
        continue;
      }

      // Import statements
      if (tok.value === 'import') {
        this.next();
        let alias: string | null = null;
        let modName = '';

        if (this.peek()?.value === '*') {
          this.next(); // *
          if (this.peek()?.value === 'as') {
            this.next(); // as
            if (this.peek()) alias = this.next().value;
          }
        } else if (this.peek()?.type === 'identifier') {
          alias = this.next().value;
        }

        while (this.pos < this.tokens.length && this.peek()!.value !== ';') {
          const t = this.next();
          if (t.type === 'string') modName = t.value.replace(/['"]/g, '');
        }
        if (this.peek()?.value === ';') this.next();

        if (modName) {
          if (alias) {
            lispForms.push(`(import-npm "${modName}" :as ${alias})`);
          } else {
            lispForms.push(`(import-npm "${modName}")`);
          }
        }
        continue;
      }

      // Statement
      const form = this.parseStatement();
      if (form) {
        lispForms.push(form);
      }
    }

    return lispForms;
  }

  private parseStatement(): string | null {
    const tok = this.peek();
    if (!tok) return null;

    // Function declaration: function name(p1, p2) { ... }
    if (tok.value === 'function') {
      this.next();
      const fnName = this.next().value;
      const lispName = this.toLispId(fnName);

      this.expect('(');
      const params: string[] = [];
      while (this.pos < this.tokens.length && this.peek()!.value !== ')') {
        const paramTok = this.next();
        params.push(this.toLispId(paramTok.value));
        this.skipTypeAnnotation();
        if (this.peek()!.value === ',') this.next();
      }
      this.expect(')');
      this.skipTypeAnnotation();

      const body = this.parseBlock();
      return `(def ${lispName} (lambda (${params.join(' ')})\n  ${body}))`;
    }

    // Variable declaration: const x = ... | let y = ...
    if (tok.value === 'const' || tok.value === 'let' || tok.value === 'var') {
      this.next();
      const varName = this.toLispId(this.next().value);
      this.skipTypeAnnotation();
      this.expect('=');
      const val = this.parseExpression();
      if (this.match(';')) {}
      return `(def ${varName} ${val})`;
    }

    // Return statement: return expr;
    if (tok.value === 'return') {
      this.next();
      if (this.peek()?.value === ';') {
        this.next();
        return 'null';
      }
      const expr = this.parseExpression();
      if (this.match(';')) {}
      return expr;
    }

    // If statement: if (cond) { ... } else { ... }
    if (tok.value === 'if') {
      this.next();
      this.expect('(');
      const cond = this.parseExpression();
      this.expect(')');
      const conseq = this.parseBlockOrStatement();
      let alt = 'null';
      if (this.match('else')) {
        alt = this.parseBlockOrStatement();
      }
      return `(if ${cond}\n  ${conseq}\n  ${alt})`;
    }

    // Expression statement or assignment
    const expr = this.parseExpression();
    if (this.match(';')) {}
    return expr;
  }

  private parseBlockOrStatement(): string {
    if (this.peek()?.value === '{') {
      return this.parseBlock();
    }
    const stmt = this.parseStatement();
    return stmt || 'null';
  }

  private parseBlock(): string {
    this.expect('{');
    const stmts: string[] = [];
    while (this.pos < this.tokens.length && this.peek()!.value !== '}') {
      if (this.peek()!.type === 'comment') {
        this.next();
        continue;
      }
      const s = this.parseStatement();
      if (s) stmts.push(s);
    }
    this.expect('}');

    if (stmts.length === 0) return 'null';
    if (stmts.length === 1) return stmts[0];
    return `(begin\n  ${stmts.join('\n  ')})`;
  }

  // Expression parser with operator precedence
  private parseExpression(): string {
    return this.parseAssignment();
  }

  private parseAssignment(): string {
    const left = this.parseTernary();

    if (this.match('=')) {
      const right = this.parseAssignment();
      return `(set! ${left} ${right})`;
    }

    if (this.match('+=')) {
      const right = this.parseAssignment();
      return `(set! ${left} (+ ${left} ${right}))`;
    }

    if (this.match('-=')) {
      const right = this.parseAssignment();
      return `(set! ${left} (- ${left} ${right}))`;
    }

    return left;
  }

  private parseTernary(): string {
    let expr = this.parseLogicalOr();

    if (this.match('?')) {
      const conseq = this.parseExpression();
      this.expect(':');
      const alt = this.parseExpression();
      expr = `(if ${expr} ${conseq} ${alt})`;
    }

    return expr;
  }

  private parseLogicalOr(): string {
    let left = this.parseLogicalAnd();
    while (this.match('||')) {
      const right = this.parseLogicalAnd();
      left = `(or ${left} ${right})`;
    }
    return left;
  }

  private parseLogicalAnd(): string {
    let left = this.parseEquality();
    while (this.match('&&')) {
      const right = this.parseEquality();
      left = `(and ${left} ${right})`;
    }
    return left;
  }

  private parseEquality(): string {
    let left = this.parseRelational();
    while (true) {
      if (this.match('===') || this.match('==')) {
        const right = this.parseRelational();
        left = `(= ${left} ${right})`;
      } else if (this.match('!==') || this.match('!=')) {
        const right = this.parseRelational();
        left = `(not (= ${left} ${right}))`;
      } else {
        break;
      }
    }
    return left;
  }

  private parseRelational(): string {
    let left = this.parseAdditive();
    while (true) {
      if (this.match('<')) {
        const right = this.parseAdditive();
        left = `(< ${left} ${right})`;
      } else if (this.match('<=')) {
        const right = this.parseAdditive();
        left = `(<= ${left} ${right})`;
      } else if (this.match('>')) {
        const right = this.parseAdditive();
        left = `(> ${left} ${right})`;
      } else if (this.match('>=')) {
        const right = this.parseAdditive();
        left = `(>= ${left} ${right})`;
      } else {
        break;
      }
    }
    return left;
  }

  private parseAdditive(): string {
    let left = this.parseMultiplicative();
    while (true) {
      if (this.match('+')) {
        const right = this.parseMultiplicative();
        left = `(+ ${left} ${right})`;
      } else if (this.match('-')) {
        const right = this.parseMultiplicative();
        left = `(- ${left} ${right})`;
      } else {
        break;
      }
    }
    return left;
  }

  private parseMultiplicative(): string {
    let left = this.parseUnary();
    while (true) {
      if (this.match('*')) {
        const right = this.parseUnary();
        left = `(* ${left} ${right})`;
      } else if (this.match('/')) {
        const right = this.parseUnary();
        left = `(/ ${left} ${right})`;
      } else if (this.match('%')) {
        const right = this.parseUnary();
        left = `(% ${left} ${right})`;
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): string {
    if (this.match('!')) {
      const expr = this.parseUnary();
      return `(not ${expr})`;
    }
    if (this.match('-')) {
      const expr = this.parseUnary();
      return `(- ${expr})`;
    }
    if (this.match('+')) {
      return this.parseUnary();
    }
    return this.parsePostfix();
  }

  private parsePostfix(): string {
    let expr = this.parsePrimary();

    while (this.pos < this.tokens.length) {
      // Function call: expr(arg1, arg2)
      if (this.match('(')) {
        const args: string[] = [];
        while (this.pos < this.tokens.length && this.peek()!.value !== ')') {
          args.push(this.parseExpression());
          if (this.peek()!.value === ',') this.next();
        }
        this.expect(')');

        // Map standard JS/TS library calls
        if (expr === 'console.log') {
          expr = `(print ${args.join(' ')})`;
        } else if (expr.startsWith('Math.')) {
          const mfn = expr.replace('Math.', '');
          expr = `(${mfn} ${args.join(' ')})`;
        } else {
          expr = `(${expr} ${args.join(' ')})`;
        }
        continue;
      }

      // Member access or method call: obj.prop or obj.method()
      if (this.match('.')) {
        const member = this.next().value;
        // Check if immediately followed by call
        if (this.match('(')) {
          const args: string[] = [];
          while (this.pos < this.tokens.length && this.peek()!.value !== ')') {
            args.push(this.parseExpression());
            if (this.peek()!.value === ',') this.next();
          }
          this.expect(')');

          if (member === 'toUpperCase') {
            expr = `(str-upper ${expr})`;
          } else if (member === 'toLowerCase') {
            expr = `(str-lower ${expr})`;
          } else if (member === 'trim') {
            expr = `(str-trim ${expr})`;
          } else if (member === 'map') {
            expr = `(map ${args[0]} ${expr})`;
          } else if (member === 'filter') {
            expr = `(filter ${args[0]} ${expr})`;
          } else if (member === 'reduce') {
            expr = `(reduce ${args[0]} ${args[1]} ${expr})`;
          } else {
            const lispMethod = this.toLispId(member);
            expr = `(${lispMethod} ${expr} ${args.join(' ')})`;
          }
        } else {
          // Property access: obj.length -> (length obj)
          if (member === 'length') {
            expr = `(length ${expr})`;
          } else {
            expr = `${expr}.${member}`;
          }
        }
        continue;
      }

      // Array indexing: arr[i]
      if (this.match('[')) {
        const idx = this.parseExpression();
        this.expect(']');
        expr = `(nth ${expr} ${idx})`;
        continue;
      }

      break;
    }

    return expr;
  }

  private parsePrimary(): string {
    const tok = this.peek();
    if (!tok) throw new Error('Unexpected EOF in primary expression');

    // Number
    if (tok.type === 'number') {
      this.next();
      return tok.value;
    }

    // String
    if (tok.type === 'string') {
      this.next();
      return tok.value;
    }

    // Boolean / Null / Undefined
    if (tok.value === 'true' || tok.value === 'false') {
      this.next();
      return tok.value;
    }
    if (tok.value === 'null' || tok.value === 'undefined') {
      this.next();
      return 'null';
    }

    // Array literal: [1, 2, 3] -> (list 1 2 3)
    if (tok.value === '[') {
      this.next();
      const items: string[] = [];
      while (this.pos < this.tokens.length && this.peek()!.value !== ']') {
        items.push(this.parseExpression());
        if (this.peek()!.value === ',') this.next();
      }
      this.expect(']');
      return `(list ${items.join(' ')})`;
    }

    // Parenthesized expression OR Arrow function: (a, b) => expr
    if (tok.value === '(') {
      // Lookahead to check if this is an arrow function
      const savedPos = this.pos;
      this.next(); // consume '('
      const params: string[] = [];
      let isArrow = false;

      while (this.pos < this.tokens.length && this.peek()!.value !== ')') {
        const p = this.next();
        if (p.type === 'identifier') {
          params.push(this.toLispId(p.value));
        }
        this.skipTypeAnnotation();
        if (this.peek()?.value === ',') this.next();
      }

      if (this.peek()?.value === ')') {
        this.next(); // consume ')'
        this.skipTypeAnnotation();
        if (this.peek()?.value === '=>') {
          isArrow = true;
          this.next(); // consume '=>'
        }
      }

      if (isArrow) {
        let body = '';
        if (this.peek()?.value === '{') {
          body = this.parseBlock();
        } else {
          body = this.parseExpression();
        }
        return `(lambda (${params.join(' ')}) ${body})`;
      }

      // Not an arrow function: rewind and parse as simple grouped expression
      this.pos = savedPos;
      this.expect('(');
      const inner = this.parseExpression();
      this.expect(')');
      return inner;
    }

    // Single param arrow function: x => x * 2
    if (tok.type === 'identifier') {
      const nextTok = this.tokens[this.pos + 1];
      if (nextTok && nextTok.value === '=>') {
        const param = this.toLispId(this.next().value);
        this.expect('=>');
        let body = '';
        if (this.peek()?.value === '{') {
          body = this.parseBlock();
        } else {
          body = this.parseExpression();
        }
        return `(lambda (${param}) ${body})`;
      }

      // Plain Identifier
      this.next();
      if (tok.value === 'console' && this.peek()?.value === '.' && this.tokens[this.pos + 1]?.value === 'log') {
        this.next(); // .
        this.next(); // log
        return 'console.log';
      }
      if (tok.value === 'Math' && this.peek()?.value === '.') {
        this.next(); // .
        const m = this.next().value;
        return `Math.${m}`;
      }
      return this.toLispId(tok.value);
    }

    throw new Error(`Unexpected token '${tok.value}' at line ${tok.line}`);
  }
}

/**
 * Public function to convert TypeScript source code to OmniLisp code
 */
export function convertTypeScriptToOmniLisp(tsCode: string): string {
  try {
    const tokens = tokenizeTS(tsCode);
    const parser = new TSParser(tokens);
    const forms = parser.parseProgram();
    return forms.join('\n\n');
  } catch (err: any) {
    return `; [TypeScript Conversion Error]: ${err.message}\n; Input snippet:\n${tsCode
      .split('\n')
      .map(l => `; ${l}`)
      .join('\n')}`;
  }
}
