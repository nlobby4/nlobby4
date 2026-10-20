# Example package

Private, dependency-free ESM package used to verify the organization monorepo's
impact on npm packages. It exports greet and uses Node's built-in test runner.
Private is deliberate to prevent publishing a test fixture accidentally.

## Commands

From the repository root after setup:

```sh
pnpm --filter @nlobby4/example-package check
pnpm --filter @nlobby4/example-package test
pnpm run projects:check
pnpm run test:projects
```

The package reuses root-installed Prettier and ESLint. It intentionally has no
formatter or ESLint configuration of its own, so organization defaults apply. It
owns its scripts, exports, packaging allowlist and generated-content denylists.
No compiler, build artifact or extra dependency is required.

Boundary tests copy this package into disposable repositories, deliberately
introduce failures and add local overrides there. They verify workspace/task
selection, shared formatting/lint defaults, local overrides, ignored artifacts
and tarball contents without changing this package or touching real submodules.
Root readiness verifies the environment, not whether this package's tests pass.
