# Publication verification — November 6, 2026

Checked in the isolated publication snapshot with Node.js 26.13.0 and npm 11.20.0.

| Check | Result |
| --- | --- |
| TypeScript check (`npm run lint`) | Passed. |
| Production web bundle (`npm run build`) | Passed. |
| Behavioral smoke suite (`npm test`) | 7 tests passed, 0 failed, 0 skipped locally. |
| CLI and browser evaluator | Both returned 720 for factorial and 42 for the closure example. |
| Generated TypeScript | Executed through `tsx`; factorial returned 720. |
| Generated Rust | Compiled with `rustc --edition=2021`; factorial returned 720. |
| Dependency audit | `npm audit` reported 0 vulnerabilities after cleanup and the compatible Vite 6.4.5 update. |
| Live browser smoke | The preset printed hypotenuse 5, factorial 720, sine approximately 0.7071, and an uppercase greeting. The call graph showed 11 calls. Step Debug paused, Step advanced under control, and Stop worked. No console errors remained in the successful page. |

The Rust test skips when `rustc` is absent. The suite checks useful behavior and
publication corrections; it is not language conformance coverage.

The publication copy removes unused AI Studio/Gemini and Express dependencies,
the unused API-key injection into the browser bundle, and the unrelated nested
checkout. It replaces template documentation with project-specific commands.
The original local project is preserved.

The browser initially saw stale optimized-dependency URLs after `npm ci` ran
while the development server was open. Restarting Vite with `--force` rebuilt
that cache and resolved the 504 responses before the successful browser check.

The legacy Ostadix diagnostic names are now labeled as local simulation.
Repair UI and CLI messages describe candidates instead of guaranteed recovery;
the repair result reports the actual local-trial boolean. Repair heuristics can
still change semantics or disable failing code.

No native Ostadix connection, complete dialect compatibility, generalized
source equivalence, WebAssembly execution, npm-registry publication, or
security isolation is established by these checks. The browser and CLI
interpreters remain separate implementations.
