# Local configuration schemas

Configuration files declare local schemas here. JSON and YAML editor downloads
are disabled, and CLI validation rejects external references instead of skipping
them. VS Code's built-in settings schemas remain supplied by VS Code itself.
Ordinary projects can reuse these schemas or own their own local schemas;
submodules remain independent.

## Sources and updates

sources.json declares every upstream source. Tool-shipped schemas follow exact
installed pnpm versions. Zizmor follows its mise pin, and EditorConfig checker
follows the explicitly selected native checker version. SchemaStore is pinned to
a Git commit; the Renovate schema is pinned to an exact npm version without
installing the bot runtime. sources.lock.json records versions, acquisition
URLs, dependency hashes, bundled hashes and license hashes. Upstream license
notices live in `../licenses/schema/`, not beside the bundles.

```sh
pnpm run schemas:update
pnpm run schemas:check
pnpm run lint:schema
```

Update installs frozen dependencies without lifecycle scripts, then uses
[@apidevtools/json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser)
to bundle external references into internal pointers. Downloads finish before
files are written. It then refreshes owner-scoped license inventories. Download
errors leave existing schemas untouched; an interrupted write is detected by the
next checksum check. No automatic repair or downloads occur during validation.
Check and lint work offline after setup. Hashes detect drift, not independent
publisher authenticity.

Renovate tracks SchemaStore commits and its own schema version. Its existing
self-hosted post-upgrade flow refreshes these files when dependencies change.
Schema-only updates do not require Docker. The administrator must enable the
self-hosted bot with the exact allowlisted commands in
.github/renovate-host.json; the hosted app cannot run arbitrary post-upgrade
commands. Automation is wired, not evidence of a live bot run. Reviews remain
required; automerge is disabled. The Git-ref datasource has no release
timestamp, so the SchemaStore digest rule does not inherit the npm release-age
delay. The normal update schedule and review policy still apply.

The devcontainer and source-inventory schemas are repository-owned contracts,
not generated upstream copies. Do not overwrite them with upstream defaults.
Other schema bundles and license text are updater-owned and excluded from
formatting. This explicit schemas location is an exception to the generic
.generated output policy. Preserve upstream license files and schema notices.

## Renovate global configuration

The published Renovate schema includes global-option definitions but forbids
those options in repository config through a top-level not constraint. The
renovate-global bundle removes only that constraint for the administrator-owned
host config and retains all upstream property definitions. An incompatible
upstream shape stops the update for review. This is a documented local adapter,
not a claim that Renovate publishes a separate global schema.

Schema $id values and draft $schema URIs identify vocabularies; they are not
runtime download requirements. Descriptions/defaults may retain upstream links.
Usable $ref pointers in the bundles are local. Application readiness, security
linters and repository-specific policies remain separate from structural schema
validation. Actual VS Code extension execution has not been verified.
