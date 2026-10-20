# Projects

This is the organization's main monorepo, not a repository template. Projects
are managed directly here by default. Use Git submodules for projects that need
an independent repository, for example GitHub Pages, GitHub wikis or GitHub
template-repository features. Separate tooling alone does not require a
submodule.

The root provides the shared organization development setup. This directory
contains directly managed projects and independent repositories, not the root
automation itself. Existing submodule ownership boundaries remain unchanged.

| Layout                                  | Ownership                                 |
| --------------------------------------- | ----------------------------------------- |
| `projects/<name>/`                      | Ordinary project with project-owned rules |
| `projects/packages/<name>/`             | Optional shared pnpm packages             |
| `projects/submodules/<name>/`           | Independent Git submodule                 |
| `projects/submodules/templates/<name>/` | Independent GitHub template repository    |

Each ordinary project owns its denylist `.gitignore`. Add application sources
without editing the root allowlist. Project outputs belong in `.generated/` and
caches in `.cache/<tool>/`, unless native tool discovery requires another
layout. Keep application-specific exclusions out of the root and
`projects/.gitignore`.

## Shared checks

Ordinary projects reuse the shell's installed tools. They do not need their own
copies of Prettier, ESLint, Hadolint, yamllint, ShellCheck, Husky or Gitleaks.
Project-specific plugins/parsers and deliberate tool-version overrides may be
declared where needed; isolation is not the default for ordinary projects.

Root formatting, YAML, EditorConfig, JavaScript and Dockerfile checks visit each
ordinary project separately. Installed project-local binaries take precedence.
Prettier discovers local configs and ignore files. YAML and EditorConfig-checker
use project config when present, otherwise the organization defaults. Nested
EditorConfig overrides apply, and `root = true` establishes independent editor
policy.

| Tool                    | Defaults and project overrides                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Prettier / EditorConfig | Native ancestor discovery, with nearer project config taking precedence                                              |
| ESLint                  | Native flat-config discovery per file; project eslint.config.* wins, otherwise shell JavaScript correctness defaults |
| yamllint                | Project .yamllint/.yaml/.yml when present, otherwise shell config                                                    |
| Hadolint                | Project-root .hadolint.yaml/.yml when present, otherwise shell config                                                |
| ShellCheck              | Native .shellcheckrc discovery with project overrides or ancestor shell defaults                                     |
| Husky / commitlint      | One repository's shared hooks and commit policy, not a separate installation per project                             |
| Gitleaks                | Shared Git history/staged secret checks; independent submodule history is not recursively scanned                    |

Use pnpm run lint:js, lint:dockerfile, lint:shell or lint:yaml from the shell
root to run shared checks. The ESLint fallback covers JavaScript, not automatic
TypeScript/React/framework configuration or guessed browser/Node application
globals. Add a project config for those needs. A project config replaces the
fallback rather than implicitly merging every shell rule into its application.
Without an override, generated output and common caches are excluded by the
shell ESLint defaults. Projects with their own config own their ignore patterns.

Project Dockerfile discovery uses Git to honor project denylists and skips
symlinked files. Dockerfile/Containerfile names and suffixed variants are
checked. The Microsoft-only registry restriction applies only to the
devcontainer checks, not ordinary project images. ShellCheck scans Git-visible
ordinary project scripts and their shell shebangs without entering submodules.

The small `workspace-check.js` router fills a native-tool discovery gap. Tools
do not all honor nested ignore and lint configs when scanning from one root. It
routes native commands rather than implementing lint rules, skips symlinked
project directories and submodules, stops on failure and never auto-installs.
Nested application folders are part of their owner, not separately enrolled.

Application-specific ESLint rules, Markdown authoring policy and schemas remain
project-owned while the tools and safe defaults are shared. Root secret scanning
covers monorepo history and staged changes. Git attributes provide
cross-platform text handling; a nearer project `.gitattributes` can override
them. Ordinary projects share this Git repository's commit hooks and
commit-message policy.

`projects/.lintstagedrc.json` provides staged formatting and basic JavaScript
linting through the shared tools. A nearer project configuration replaces it
rather than merging with it. Root readiness describes the organization
environment, not successful tests of every application.

CLI fallback is the authoritative shared-check behavior. Editor tooling uses
native discovery: ESLint and Prettier find ancestor configs, but Hadolint's
extension resolves config from its VS Code workspace folder. A separate project
folder without a config can explicitly set hadolint.cliOptions to --config plus
the shell config path, or supply a project config. Do not force one global
override that would prevent project-specific configs. Actual extension execution
has not been verified.

## Dependencies and mise

projects/packages/example-package is a private, dependency-free npm fixture. It
inherits the shell's formatting and basic lint defaults rather than defining
another toolchain. Run pnpm --filter @nlobby4/example-package check to verify
its public exports and local scripts. pnpm run test:projects copies it into
isolated repositories to test shell influence, overrides, packaging and ignore
rules.

Direct projects and `projects/packages/*` packages with `package.json` join the
shared pnpm workspace and root lock. They share its package-manager and engine
policy. Submodules are excluded and may own independent dependency graphs.

mise uses native task namespaces. Opt in new mise roots through the root's
`[monorepo].config_roots`. Parent tool declarations are defaults that projects
may override. `monorepo.lockfile = false` keeps application tool locks local; do
not merge them into container bootstrap sidecars. Trust and install project
tools deliberately, never during readiness checks.

```sh
mise run //:check
mise run //projects/example:check
mise -C projects/example run test
pnpm --filter @nlobby4/example test
```

## Project task scheduling

Turborepo coordinates ordinary pnpm projects without replacing their scripts,
mise configs or tool choices. Its explicit task configuration fits this
package-based setup without adding framework generators or inferred application
policy. Projects without package.json remain outside Turbo and can use their own
mise tasks. Submodules stay outside the shared pnpm and Turbo graph.

```sh
mise run projects:check
mise run projects:test
mise run projects:build
mise run projects:dev
pnpm run projects:test --dry=json
pnpm exec turbo run test --filter=@nlobby4/example
```

Organization commands select packages under projects/. Each project owns its
check, test, build and dev scripts. Missing scripts are skipped, so success
verifies declared tasks, not the presence of tests in every project. Dependency
builds precede builds and tests. Development servers are persistent and
uncached. Turbo does not allocate ports, isolate databases or deploy branches.
Root check/health/setup do not invoke application tasks.

Use pnpm exec turbo for a single project. Adding another positive --filter to an
organization command forms a union, not a narrower selection. The dry run shows
the selected tasks without running project commands.

Caching is off by default. Projects can extend the root turbo.json with their
own turbo.json and enable caching after declaring relevant inputs, environment
variables and outputs. The dependency-free example opts into local caching for
its deterministic Node tests. Shared tool/config changes invalidate entries.
Tests depending on networks, databases, host tools or mutable external state
should remain uncached unless that state is modeled. Outputs belong in
.generated/ unless a framework requires a native layout. Never cache secrets or
node_modules.

Artifacts use checkout-local .cache/turbo/, not a shared worktree cache. Remote
caching is disabled even when credentials exist. Turbo also writes package task
logs in its native .turbo/ directory, without a supported relocation option.
Projects must ignore it in their own denylist and formatter config, as the
example does. This documented native-tool exception is not a new root denylist
or permission to commit logs. CLI overrides remain explicit operator choices,
not a sandbox.

The local schema in schemas/turbo.schema.json validates turbo.json in VS Code.
Isolated tests use the committed bundle offline. Vercel's Turbo extension is
recommended on the host and included in devcontainer extensions for task/config
navigation. Single-folder settings disable schema downloads and use local
references. No remote cache account or editor extension is required to run
tasks. Turbo does not automatically rewrite AGENTS.md in this repository.

Renovate tracks the pinned Turbo package through the root package.json and pnpm
lock. The schema updater copies its locked schema into schemas/ and verifies
alignment offline. Renovate refreshes schemas after dependency updates; manual
updates use pnpm run schemas:update. Bot activation remains an external operator
step.

Run pnpm run test:projects:tasks for isolated scheduling, failure and cache
regressions. No application services or remote submodules are started.

References:
[Turbo task configuration](https://turborepo.dev/docs/reference/configuration),
[package-owned overrides](https://turborepo.dev/docs/reference/package-configurations),
[editor integration](https://turborepo.dev/docs/getting-started/editor-integration).

## Submodules

Organization GitHub repositories use projects/submodules/.github and
projects/submodules/.github-private. These are independent from this monorepo's
root .github workflow/config directory. Developer documentation lives in
projects/submodules/developer-guide; its root setup is independent too.

GitHub template repositories are grouped under projects/submodules/templates/.
That directory is not itself a submodule; each child repository is registered
and pinned separately. Package, README and wiki templates have separate VS Code
folder contexts in organization.code-workspace. Submodule sources remain outside
root linting, formatting, package selection and automatic setup/repair.

Infrastructure is registered at projects/submodules/infrastructure with remote
https://github.com/nlobby4/infrastructure.git. It is private and requires access
to initialize. Root setup and readiness do not require cloning it. Publish its
pinned commit before distributing a parent commit that refers to it.

```sh
git submodule update --init projects/submodules/infrastructure
```

Organization infrastructure belongs here as an independently owned platform
repository. Terraform, Kubernetes, shared services and policy/asset publication
retain their own toolchain, state, deployment permissions and recovery contract.
Root readiness validates the development shell, not live infrastructure. Shared
tool availability does not authorize initialization, deployment or mutation of
infrastructure state. Its runner need not match this shell's Turbo layer.

Organization media belongs to the infrastructure media server, not a root media
directory in this shell. Infrastructure owns asset storage, publication and any
Git LFS rules. Ordinary projects may opt into LFS using their own
.gitattributes; the shell provides the client and shared pointer validation,
without imposing a media-directory rule or validating submodule assets.

Submodules retain their Git config, ignore/attribute rules, hooks, mise configs
and dependency graphs. Root setup does not initialize, fetch, repair or format
them. Initialize selected trusted submodules manually, review their pinned
commits and run their documented setup. The parent secret scan does not scan a
submodule's Git history recursively.

mise normally reads parent configuration even across a Git boundary. For an
independent submodule toolchain, set a discovery ceiling for that shell/session
before running its mise commands. Image-installed tools still remain available.

```sh
export MISE_CEILING_PATHS="$PWD/projects/submodules"
cd projects/submodules/<name>
mise config ls
```

Unset `MISE_CEILING_PATHS` when returning to organization work. This is an
explicit project/session choice, not a hidden environment mutation by root
setup.

No real remote submodule is added for testing. This command creates and cleans
up a local-only submodule inside a disposable temporary organization repository:

```sh
pnpm run test:projects
```

## VS Code

Projects own application dependency notices in their own `licenses/` folders.
The shell's `pnpm run licenses:update` refreshes separate inventories for
ordinary pnpm workspace projects without copying shared development-tool
licenses into them. Non-npm projects and independent submodules own their
ecosystem collection.

Open `organization.code-workspace`, including inside the devcontainer, for
separate organization and example folder contexts. Add project/submodule folders
to activate their own `.vscode/settings.json`. Nested folder settings do not
take effect in single-folder mode, although native tool configs and EditorConfig
do.

The example sets a project-local Prettier ignore path and ESLint working
directory in multi-root mode. Shared container extensions are conveniences, not
proof that project checks ran or permission to overwrite project configuration.

References: [mise monorepo tasks](https://mise.jdx.dev/tasks/monorepo.html),
[lint-staged project config](https://github.com/lint-staged/lint-staged#how-to-use-lint-staged-in-a-multi-package-monorepo),
[VS Code multi-root workspaces](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces).
