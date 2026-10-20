# Generated content

Repository-owned persistent outputs belong in `.generated/`. Disposable tool
caches belong in `.cache/<tool>/`, named for the tool that owns them. A custom
script's existing path is not a tool-discovery requirement.

Committed schema bundles and their provenance/licenses explicitly live in
schemas/ by repository policy. This user-selected location is an exception to
.generated, not a tool-discovery claim. See schemas/README.md for update
ownership.

Tool-managed discovery and dependency layouts are separate from build reports.
Temporary test/update fixtures outside the workspace are also separate: they
must remain isolated and be cleaned up by their owning process.

## Repository outputs and caches

These are configured destinations, not a claim that every folder currently
exists or contains files.

| Destination                              | Producer                                                  | Git policy                                    |
| ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| `.generated/policy/`                     | Policy-input builder used by Conftest                     | Ignored, regenerate from configuration        |
| `.generated/` (`devcontainer.spdx.json`) | Trivy image SBOM command                                  | Ignored, publish as a CI artifact when needed |
| `.cache/prettier/`                       | Prettier formatting check                                 | Never commit                                  |
| `.cache/knip/`                           | Knip unused-dependency check                              | Never commit                                  |
| `.cache/trivy/`                          | Trivy scanner                                             | Never commit                                  |
| `.cache/commitizen/`                     | Commitizen on Linux/POSIX through `XDG_CACHE_HOME=.cache` | Never commit                                  |
| `.cache/python/`                         | Python test loaders importing repository modules          | Never commit                                  |
| `.cache/turbo/`                          | Checkout-local project task artifact cache                | Never commit                                  |

The old `.cache/general/*` and `.cache/local` paths are no longer configured.
`.cache/test` had no producer; its readiness requirement and empty CI cache
restore/save steps were removed. Existing folders are not automatically deleted
or migrated. Run setup or `mise run doctor` to create the current cache folders.
Turbo creates its optional cache when project tasks run; it is not a doctor or
readiness prerequisite. Explicit devcontainer cleanup recreates the same direct
tool folders. It no longer creates legacy grouping folders or caches for removed
checks.

Commitizen's installed cache library ignores `XDG_CACHE_HOME` on macOS/Windows
and uses the operating system's user cache location. The repository command does
not yet provide uniform workspace-local caching on those platforms. Python test
loaders respect an explicitly supplied Python cache prefix. Other tools also
allow explicit caller overrides; these defaults are not a filesystem sandbox.

## Tool layouts and deferred review

| Destination                                   | Responsibility                                                                     | Decision                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `node_modules/`, `scripts/node/node_modules/` | pnpm installation and Node module resolution                                       | Keep the native dependency layout, ignored                                      |
| `.mise/locks/`                                | mise-owned native dependency graphs beside the discovered root lock                | Keep the documented tool layout and commit with `mise.lock`                     |
| `.husky/_/`                                   | Generated hook launchers, currently selected through Git configuration             | Deferred hook-layout review, not an established strict root-discovery exception |
| `.devcontainer/.mise-bootstrap-update*`       | Durable update journal, staging directories and serialization lock                 | Deferred backward-compatible recovery-state migration, never commit             |
| `scripts/python/__pycache__/`                 | Bytecode left by earlier runs or direct imports without the configured test prefix | Legacy output, ignored; current test loaders use `.cache/python/`               |
| `projects/<owner>/.turbo/`                    | Native per-package task logs without a relocation setting                          | Project-owned ignore rules, never commit                                        |

The retained native sidecar layout is owned by mise, including its paths and
digests. Do not relocate or rewrite those files manually. See the
[mise native sidecar documentation](https://mise.jdx.dev/dev-tools/mise-lock.html#native-dependency-sidecars).

Container-wide paths such as the pnpm named-volume store, Docker data and
BuildKit installer caches are outside this workspace-output migration. They must
not be treated as disposable repository artifacts or pruned automatically. Git
metadata and installed tool environments are not build-report folders.

Git also keeps remembered conflict resolutions in its native `rr-cache` metadata
directory. Use `git rev-parse --git-path rr-cache` to locate it, including in
linked worktrees. Keep it local and Git-owned, rather than moving it into
`.cache/` or committing it.

| External destination                              | Responsibility                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/root/.cache/{mise,pip,uv,node}/`, `/root/.npm/` | BuildKit-mounted image installer caches; npm's build cache still uses its native path |
| `/home/nlobby4/.local/share/pnpm/store/`          | Persistent pnpm dependency store in a named volume                                    |
| `/var/lib/docker/`                                | Nested Docker runtime data managed by the DinD Feature                                |
| `/usr/local/share/devcontainer/` (`state.json`)   | Image-provided input/version contract, not a workspace report                         |
| `$TMPDIR` or the system temporary directory       | Disposable test, update and diagnostic workspaces                                     |

## Committing selected generated artifacts

The root `.gitignore` has a Generated content section. Its examples are
commented out deliberately; no reports or cache files become trackable merely
because they have a common extension.

If a stable generated artifact is necessary for consumers of the repository, add
a narrowly scoped exception, for example:

```gitignore
!/.generated/schemas/*.json
```

Generated schemas or documentation can be appropriate when consumers need them
without running the generator. Record their producer and regeneration command,
review changes and verify reproducibility in CI before enabling the exception.
Routine reports, logs, recovery journals and caches should stay ignored.

Prettier and yamllint exclude generator-owned output and caches. Committing an
artifact does not transfer formatting ownership away from its generator.
