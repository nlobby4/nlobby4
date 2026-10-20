# Repository agent instructions

The repository aims for a reproducible development container that validates its
own readiness and reports configuration drift and version misalignment. Future
self-correction should be deliberate, bounded, and observable. Treat mise tasks
as an orchestration abstraction above the container, not an additional readiness
requirement. The mise tool manager and its tool/version locks remain relevant.
The intended threat model is trusted repository code.

## Organization and project ownership

This repository is the organization's main monorepo, not a reusable repository
template. Manage projects directly here by default. Use independent repositories
under projects/submodules when separate repository-level features are needed,
such as GitHub Pages, GitHub wikis or GitHub template repositories. Do not split
ordinary projects into repositories merely for tool/config isolation. This
policy does not authorize creating repositories or migrating existing projects.

The root provides the shared organization development setup. Ordinary projects
in `projects/<name>` and `projects/packages/<name>` reuse the shell's installed
formatters, linters, hooks and secret scanning. They need not duplicate tool
dependencies or isolate their development environment. Projects own their
denylist, application rules/tests and optional mise overrides. Shared checks run
from each owner's directory and honor local configuration; otherwise they use
shell defaults. ESLint's generic JavaScript defaults are a fallback, not an
assumption about application frameworks or runtime globals. Framework parsers,
plugins and schemas stay project-owned. Shared attributes, Husky, commit policy
and Gitleaks apply across ordinary projects in this Git repository.

projects/submodules contains independent Git repositories, excluded from the
root pnpm graph, shared formatting and automatic setup/repair. Use local-only
submodules in isolated tests, never real remote repositories as mutable test
fixtures. Read projects/README.md for ownership and VS Code multi-root behavior.

GitHub template repositories belong under
`projects/submodules/templates/<name>`. The templates directory is a normal
grouping folder, not a Git repository or submodule. Each child has its own
remote and parent-pinned commit. Preserve uncommitted child changes when moving
or registering repositories.

Turbo schedules ordinary package-owned project scripts through projects:* tasks.
It does not replace mise or become a readiness requirement. Keep submodules and
root automation outside project command selection. Caching is opt-in by project,
remote caching is disabled and artifacts stay in checkout-local .cache/turbo.
Native per-package .turbo task logs require project-owned ignore rules. Preserve
explicit inputs/env/outputs when enabling caches and never cache mutable
external readiness checks or secret-bearing output.

Organization infrastructure belongs to an independent repository under
projects/submodules/infrastructure. Organization media belongs to its media
server, not a root media folder. Infrastructure owns asset storage and
publication rules; keep generic Git LFS support available without imposing a
root media rule. Infrastructure is a registered private submodule with origin
https://github.com/nlobby4/infrastructure.git. Do not enroll its tasks in Turbo,
execute deployments, publish changes or copy credentials/state into the
organization shell without explicit authorization. Its Nx definitions still
reference its original parent workspace and are not a runnable standalone setup.
Consult .local-work/INFRASTRUCTURE.md when available for the reference map and
boundaries. Do not migrate its task runner merely to match the organization
shell.

Whole-infrastructure portability is a goal, not a provider toggle. Keep
provider-specific Terraform state separate, service inputs provider-neutral and
Kubernetes application bases separate from cluster storage/ingress overlays.
Infrastructure PORTABILITY.md owns the current migration contract. Organization
mail must support public external delivery and member clients without VPN
access; administration remains separately restricted. Stalwart owns private
organization file sharing while the media service owns public delivery. Never
claim local tests establish public delivery, identity synchronization or backup
restoration.

Organization GitHub repositories live at projects/submodules/.github and
projects/submodules/.github-private; neither replaces the root .github
CI/config. Developer documentation lives at projects/submodules/developer-guide.
Its publication and maintenance are independently owned; root setup must not
publish or rewrite its contents.

## Tool selection and reuse

Configuration schemas must use explicit local references under schemas/.
Preserve updater-owned bundles, lock hashes and upstream licenses. Run pnpm run
schemas:update after tool changes, then pnpm run lint:schema. Validation stays
offline and rejects external references rather than skipping them. Do not
auto-update schemas during readiness or overwrite the repository's hand-authored
devcontainer/source contracts. Independent projects/submodules retain schema
ownership.

Top-level third-party shell notices belong under licenses/. Do not expand this
inventory to transitive dependencies or OS packages. Ordinary projects own their
dependency notices under their own licenses/ directories. Run licenses:update
after dependency/tool changes and licenses:check offline after refresh. Preserve
upstream notice bytes and report inventory gaps rather than claiming legal
completeness. Do not enroll independent submodules in root collection.

Before adding custom automation, look for established tools that already solve
the problem. Start with the tools installed in this repository and prefer
well-maintained, documented solutions over reimplementing standard behavior.
Check official documentation when evaluating unfamiliar or changing features.

Evaluate fit rather than popularity alone. Consider reproducible installation,
security, supported platforms, offline behavior, failure reporting, maintenance
cost and VS Code integration. Avoid overlapping tools and unnecessary wrappers.
Use custom code for repository-specific policy or gaps that existing solutions
do not cover cleanly, and explain the tradeoff when that choice is substantial.
Tool discovery does not authorize installation or unrelated migrations. Keep
changes within the requested scope and preserve dependency and lock ownership.

## Agent workflow

AGENTS.md owns stable constraints. TODO.md owns the current backlog,
devcontainer operating guide and dated evidence. Source/configuration owns
actual behavior. Read TODO.md's current backlog before related substantive work,
then only the relevant guide or evidence sections. Do not load its whole
historical archive for routine changes. Open TODOs are not authorization for
unrelated work.

1. Establish the requested scope and inspect the dirty tree. Preserve existing
   changes, project ownership and mise-owned native lock bytes.
2. Recheck the relevant TODO against source and existing tests. Prefer installed
   established tools before adding helpers; consult official documentation for
   unfamiliar behavior.
3. Implement only authorized changes. Keep readiness checks separate from
   repair, refresh and orchestration. Never hide drift with automatic
   installation or lock regeneration during diagnosis.
4. Run focused regressions and appropriate linters. For tool changes inspect VS
   Code settings, extensions, executable/config resolution and formatter
   ownership. Distinguish static wiring from actual editor execution.
5. Update the affected TODO ID with files, verification command/result and
   remaining uncertainty. Record configured, tested, activated and resolved
   separately; preserve dated failures. Do not claim full lifecycle, platform or
   vulnerability evidence from narrower tests.
6. Hand off the outcome and remaining gaps. Do not stage, commit, publish,
   activate bots or start unrelated services without the requested authority.

When present, .local-work/WORKING.md provides temporary verification commands,
REPOSITORY.md provides style/context and SCENARIOS.md tracks six platform paths.
These ignored notes supplement TODO.md rather than owning another backlog. Never
commit them or copy them into production inputs.

## Reproducibility and recovery invariants

Preserve format-3 mise.lock and .mise/locks sidecar bytes; only mise regenerates
native graphs and their checksums. Keep frozen consumption and both declared
Linux targets. versions.env owns the Debian snapshot/package set and signed mise
bootstrap; mise owns tool versions and pnpm owns package dependencies. Debian is
the shell's configured Python interpreter; do not introduce another runtime
without a deliberate decision.

Preserve the pinned publisher verification key and the .mise/aqua.yaml Minisign
ARM64 registry correction in build inputs, update candidates and image checks.
Key rotation requires explicit review. Recover interrupted bootstrap files with
image-provided Node before parsing workspace mise configuration; refuse later
conflicting edits. Recovery never resets valuable volumes or repairs datastores.

Keep privileged DinD for trusted work, capacity floors and timestamp
normalization. Image publication, required spellchecking and byte-comparison
diagnostics are retired. Byte similarity is best effort, not a percentage or
readiness gate. Readiness success does not establish vulnerability-gate success.
Historic amd64 passes and failures are preserved in TODO.md; native ARM64,
Windows/macOS, editor and live bot evidence must be recorded, not assumed.
