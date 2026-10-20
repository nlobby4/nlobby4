# Internal Node scripts

`@nlobby4/workflow-scripts` is a private pnpm workspace package. It is
repository automation, not a published library. Install it with
`pnpm install --frozen-lockfile` from the repository root. The root toolchain
declarations and `pnpm-lock.yaml` remain authoritative. There is no separate
lockfile or build step.

## Layout

- `bin/` contains executable entry points used by Bash commands and root tasks.
- `lib/` contains shared implementation and the custom markdownlint rule.
- `tests/` contains tests for these scripts and the Bash utilities they support.
- `tests/fixtures/` contains disposable integration-test assets.

ES modules are explicit through `type: module`. Keep dependency-free bootstrap
recovery dependency-free so it can run before the workspace installation
succeeds. Runtime dependencies belong in this package. Formatting, linting and
hook tooling remain in the root package because they serve the whole repository.

## Commands

Run these from the repository root:

```sh
pnpm test
pnpm run test:markdown
pnpm run test:devcontainer:inputs
pnpm run test:git:ssh
pnpm run test:devcontainer:user
```

The default suite does not start Docker containers. The last two commands are
explicit Docker-backed integration suites. Bash/Git tests require Bash 4+, Git
and GNU timeout. Input maintenance tests also require the locked mise toolchain,
Python and the installed repository dependencies.

Package tests also run from this directory with `pnpm test`. Test paths are
based on their source location, not the caller's working directory. Operational
entry points intentionally use the current working directory as the target
repository, so invoke them from the repository root, for example:

```sh
node scripts/node/bin/terminal-text.js visible-width 'Hello'
node scripts/node/bin/validate-devcontainer-inputs.js
```
