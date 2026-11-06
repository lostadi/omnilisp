import { LispValue } from './types';

export interface Token {
  text: string;
  line: number;
  col: number;
}

export function parseToken(token: string): LispValue {
  if (!isNaN(Number(token)) && token.trim() !== '') {
    return parseFloat(token);
  }
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (token.startsWith('"') && token.endsWith('"')) {
    // Preserve surrounding quotes so AST and evaluator distinguish string literals from symbols
    return token;
  }
  return token; // symbol
}

function convertTokensToAst(tokens: Token[]): LispValue {
  if (tokens.length === 0) {
    throw new Error('Unexpected EOF');
  }

  const token = tokens.shift()!;

  if (token.text === '(') {
    const list: LispValue = [];
    // Attach source location metadata non-enumerably so JSON/compiler works normally
    Object.defineProperty(list, '__loc', {
      value: { line: token.line, col: token.col },
      enumerable: false,
      configurable: true,
      writable: true,
    });

    while (tokens.length > 0 && tokens[0].text !== ')') {
      list.push(convertTokensToAst(tokens));
    }
    if (tokens.length === 0) {
      throw new Error('Unclosed parenthesis: expected )');
    }
    tokens.shift(); // pop ')'
    return list;
  } else if (token.text === ')') {
    throw new Error('Unexpected )');
  } else {
    return parseToken(token.text);
  }
}

/**
 * Robust lexer that tracks source line and column numbers
 * for visual breakpoints and debugger inspection.
 */
export function lex(str: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = str.length;
  let line = 1;
  let col = 1;

  while (i < len) {
    const char = str[i];

    // Comments: ';' through end of line
    if (char === ';') {
      while (i < len && str[i] !== '\n') {
        i++;
        col++;
      }
      continue;
    }

    if (char === '\n') {
      line++;
      col = 1;
      i++;
      continue;
    }

    // String literals: starts with '"'
    if (char === '"') {
      const startLine = line;
      const startCol = col;
      let s = '"';
      i++;
      col++;
      while (i < len) {
        const c = str[i];
        s += c;
        if (c === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        if (c === '\\' && i + 1 < len) {
          i++;
          s += str[i];
          col++;
        } else if (c === '"') {
          break;
        }
        i++;
      }
      tokens.push({ text: s, line: startLine, col: startCol });
      i++;
      col++;
      continue;
    }

    // Parentheses
    if (char === '(' || char === ')') {
      tokens.push({ text: char, line, col });
      i++;
      col++;
      continue;
    }

    // Whitespace
    if (/\s/.test(char)) {
      i++;
      col++;
      continue;
    }

    // Symbols, numbers, keywords, and operators
    const startLine = line;
    const startCol = col;
    let sym = '';
    while (i < len && !/\s|[();"]/.test(str[i])) {
      sym += str[i];
      i++;
      col++;
    }
    if (sym) {
      tokens.push({ text: sym, line: startLine, col: startCol });
    }
  }

  return tokens;
}

export function parse(program: string): LispValue[] {
  const tokens = lex(program);
  const exprs: LispValue[] = [];
  while (tokens.length > 0) {
    exprs.push(convertTokensToAst(tokens));
  }
  return exprs;
}
