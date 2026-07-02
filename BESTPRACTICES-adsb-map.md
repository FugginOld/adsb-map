# adsb-map: best-practices findings (JavaScript)

- **No ESLint or Prettier configured** — `package.json` has no
  `devDependencies` for either, no config files present. This is the main
  gap for this repo.
- Codebase is small (69 lines across `src/*.js`) and already clean by hand:
  no `var` usage (all `let`/`const`), no loose `==` equality, consistent
  style. So the lack of tooling isn't currently costing you anything — but
  as the file grows, nothing will catch regressions.
- No JSDoc/type annotations (no JSDoc blocks, no `.d.ts`, no TS). Given the
  size, TypeScript conversion is probably overkill; a light JSDoc pass
  (`/** @param {string} x */`) would be enough if you want IDE-level type
  checking without adding a build step.

## Claude Code session scope

Add `eslint` + a minimal flat config as a devDependency — mechanical setup
task, no code changes needed since the existing code already passes basic
hygiene checks. Sonnet, low effort.
