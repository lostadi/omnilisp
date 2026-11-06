export type LispValue =
  | string
  | number
  | boolean
  | null
  | LispList
  | LispLambda
  | LispJsFunction;

export type LispList = LispValue[];

export interface LispLambda {
  type: 'lambda';
  params: string[];
  body: LispValue;
  env: Env;
}

export interface LispJsFunction {
  type: 'js_function';
  fn: (...args: any[]) => any;
}

export interface SourceLocation {
  line: number;
  col: number;
}

export interface CallGraphNode {
  id: string;
  name: string;
  type: 'program' | 'lambda' | 'builtin' | 'function' | 'scope';
  args: string[];
  returnValue?: string;
  line?: number;
  durationMs: number;
  scopeVars?: Record<string, string>;
  children: CallGraphNode[];
  _children?: CallGraphNode[]; // Collapsed children for D3 interaction
  depth: number;
}

export interface DebugFrame {
  exp: LispValue;
  line: number;
  env: Env;
  name?: string;
  depth: number;
}

export type DebugAction = 'continue' | 'step' | 'stop';

export interface DebugContext {
  breakpoints: Set<number>;
  isStepping: boolean;
  isPaused: boolean;
  callStack: DebugFrame[];
  onPause?: (frame: DebugFrame) => Promise<DebugAction>;
  shouldStop?: () => boolean;
  callGraphRoot?: CallGraphNode;
  activeCallNode?: CallGraphNode;
  nodeIdCounter?: number;
}

export class Env {
  constructor(
    public outer: Env | null = null,
    public binds: Record<string, LispValue> = {}
  ) {}

  get(name: string): LispValue {
    if (name in this.binds) {
      return this.binds[name];
    }
    if (this.outer) {
      return this.outer.get(name);
    }
    throw new Error(`Undefined symbol '${name}'`);
  }

  set(name: string, value: LispValue) {
    this.binds[name] = value;
  }

  define(name: string, value: LispValue) {
    this.binds[name] = value;
  }

  getAllBinds(): Record<string, LispValue> {
    const parentBinds = this.outer ? this.outer.getAllBinds() : {};
    return { ...parentBinds, ...this.binds };
  }
}
