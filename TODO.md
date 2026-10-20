# Repository TODO and devcontainer guide

Last reconciled: 2026-10-04. This is the canonical backlog, operating guide and
audit record for the organization development shell. It replaces OUTPUT.md and
README-devcontainer.md. Source and configuration define actual behavior;
historical test results describe only the revisions that were tested.

## Repository direction

Provider facts recorded 2026-10-04: Porkbun is the registrar, Cloudflare is the
DNS provider and DigitalOcean is the current VPS provider. The infrastructure
[network access record](projects/submodules/infrastructure/shared/web/ACCESS.md)
recommends VPN administration, Cloudflare Tunnel for selected HTTP applications
and direct public mail transport. Cloudflare Access can reuse Authentik where
edge admission is needed. DNSSEC delegation, VPN isolation, origin-bypass
protection and independent recovery remain implementation/test gates. This is a
researched design record, not verification or modification of live accounts.

Infrastructure decision recorded 2026-10-04: public asset/application-media
delivery remains with the media server. Stalwart owns organization-only mail
accounts and private member/group file sharing, calendars and contacts. Do not
duplicate private organization document sharing in the media server. The media
README/design/audit and mail README record this boundary and supersede the
earlier private-media gateway proposal. VPN-only access versus authenticated
external file access remains open. This is documentation only; provisioning,
sharing ACLs, client compatibility, revocation and restore tests remain pending.

As of 2026-10-03, this repository is nlobby4's main organization monorepo, not a
reusable repository template. Directly manage projects under projects/ by
default. Use projects/submodules/ for independent repositories that need
repository-level features such as GitHub Pages, GitHub wikis or GitHub template
repositories. The root remains their shared development environment; existing
independent-repository ownership boundaries still apply.

Historical references to the template describe the former plan. This direction
does not itself migrate projects, create repositories, change remotes or alter
GitHub settings. Agent instructions, README and project guidance reflect it.

## Organization-root migration — 2026-10-03

The workflow-template working tree is now the root development setup of
nlobby4/nlobby4. The destination's original Git repository and origin were
preserved. Package identity, active GitHub links and local image/test names now
use nlobby4. The former checkout, including its dirty Git history and caches,
and the previous root README are retained under .local-work/migration, ignored
and excluded from root checks. This initial migration left template repositories
under templates/ untouched; the subsequent grouping below supersedes that
layout.

Infrastructure is a private registered submodule at
projects/submodules/infrastructure with nlobby4/infrastructure as origin. The
prepared 69 source files plus its ignore file were committed locally as 8dfb1ee,
signed, with subject chore: initial commit. Only the submodule link and
.gitmodules are staged in the parent; no parent commit, push or GitHub deletion
was performed. Publish that infrastructure commit before committing and
distributing the parent pointer, otherwise fresh submodule clones cannot obtain
it. The infrastructure's inherited Nx parent references still require separate
review; no services or deployments were run.

Verification: the mise lock, native sidecars, pnpm lock and bootstrap checksum
manifest match the source bytes. All 70 infrastructure files match the prepared
snapshot; its signed commit and parent gitlink agree and the submodule is clean.
Twelve schema regressions, six package-scheduling regressions and 20 Python
image-contract tests pass. Offline schemas validate 14 contracts against 18
configuration files; devcontainer input validation passes. A sandbox-blocked
Python subprocess was rerun successfully outside the sandbox. No fresh container
build, service execution or security scan was performed.

Remaining handoff: publish the infrastructure commit, review and commit the
parent files, initialize submodules from a fresh authorized clone, and reverify
the current lifecycle. Retiring workflow-template on GitHub remains an external
operator action after reviewing the migration and preserving needed history.

## Template repository grouping — 2026-10-03

Moved package-template, readme-template and wiki-template to
projects/submodules/templates/. The grouping directory is not a repository or
submodule. Package and README templates are registered independently with their
existing nlobby4 origin URLs, pinned at 368188b and b53c7ea. Git metadata was
absorbed into the parent; package-template's existing modified/untracked files
and readme-template's clean state are preserved.

Wiki-template is registered at f8647df with the approved origin
https://github.com/nlobby4/wiki-template.git. Its signed local initial commit
uses the exact requested subject chore: intial commit. Publish that commit
before distributing the parent pointer. No push, GitHub repository creation or
parent commit was performed; template registration is staged in the parent.

Removed transitional root templates/ exclusions, kept independent repositories
outside shared checks through the projects/submodules boundary, and added
separate template folders to the VS Code workspace. Twelve schema regressions
and offline validation pass. Actual editor activation remains unverified.

## Organization GitHub repositories — 2026-10-03

Registered projects/submodules/.github at 9ade640 and .github-private at 22f7aec
with their existing nlobby4 origin URLs. Both working trees remain clean; their
Git metadata is absorbed into the parent. Root .github remains this monorepo's
workflow/config directory, independent of those repositories.

Developer-guide's local files had no Git metadata. Cloning the approved
nlobby4/developer-guide origin confirmed an empty remote. Attached that cloned
metadata without replacing any local files, then created the authorized signed
commit 5f2a554 with subject chore: initial commit and registered the submodule.
All 37 versionable local files are committed and its working tree is clean.
Publish this commit before distributing the parent pointer. No push, parent
commit, Wiki publication or GitHub repository creation was performed.

Added all three folder contexts to the VS Code workspace and documented
independent ownership. Offline schema validation and Markdown/format checks
pass. Actual editor activation remains unverified.

## Example npm package fixture — 2026-10-03

Added projects/packages/example-package as @nlobby4/example-package, a private
dependency-free ESM package with a public greet export and three Node unit
tests. It owns its scripts, packaging allowlist, ignore rules and generated
content exclusions while inheriting shell-installed ESLint/Prettier and root
style defaults. No local runtime globals or framework rules are implicitly
provided. Local project configs can override those defaults.

The existing pnpm workspace and Turbo selection discover it automatically.
Offline pnpm lock regeneration added only its empty workspace importer; tool
versions, dependency graphs and mise locks were not changed. Added a dedicated
VS Code folder context and project documentation.

Verification: pnpm --filter @nlobby4/example-package check passes all three unit
tests, formatting and linting; pnpm run projects:check passes both ordinary
projects without selecting real submodules. All 19 isolated project-boundary
tests pass, including four new fixture tests for workspace/Turbo selection,
shared formatting, local formatter/linter overrides, package-owned ignores, Git
LF attributes and tarball contents. Source and manifest are included while
tests, caches, task logs and local environment files are excluded. Offline
frozen-lock validation, schema/hash checks and targeted lint pass.
Sandbox-suppressed subprocess output was rerun outside the sandbox; no tests
were weakened. This is not new container, security or editor-execution evidence.

## How to use this record

Read the current backlog first, then only the operating-guide or evidence
sections relevant to the request. Do not load the full historical archive for
routine edits. Open items are not authorization to implement unrelated changes.

Keep stable IDs when updating an item. Record the affected files, change,
verification command/result and remaining uncertainty. Mark completion only
after implementation and relevant verification, not merely after proposing a
fix. Preserve earlier failures and distinguish configured, tested, activated,
retired and undecided. Never treat a CLI pass as editor, container or security
evidence.

## Current backlog

These items reconcile the latest audit and local working notes. Reinspect the
named files before acting; this documentation consolidation does not retest or
fix the findings.

### Correctness and maintenance

- [ ] **TODO-01 — Bootstrap update regression (P1).** The release-manifest URL
      appears twice in `.devcontainer/checksums.sha256`; the updater expects one
      match. Resolve that ambiguity and rerun candidate, rollback and update
      tests. Four failures were recorded in `update-mise-bootstrap.test.js`.
- [ ] **TODO-02 — Docker diagnostic preservation (P2).** Multiline workload or
      cleanup failures can be rejected by `status_add`, aborting
      `docker-status.sh` before accumulated rows and resource IDs are printed.
      Add shell-integration regressions and preserve authentic diagnostics.
- [ ] **TODO-03 — Devcontainer input coverage (P3).** Tighten extension entry
      shapes, pnpm mount relationships and referenced lifecycle paths in the
      local schema/input validator. Existing valid configuration is not a
      demonstrated failure; malformed in-memory probes currently pass.
- [ ] **TODO-04 — Version parsing and drift advice (P3).** Reject noisy or
      multiline Buildx version output. Replace incomplete Dockerfile `mise lock`
      advice with the coordinated platform/native-graph update flow.
- [ ] **TODO-05 — Dependency inventory.** Recheck Knip's reported unused
      CSpell/OXC dependencies against current consumers before removing them.
- [ ] **TODO-06 — Refresh transaction scope.** Decide whether broader recovery
      is warranted: the four bootstrap files are journaled, but a full
      dependency, snapshot, Feature and schema refresh is not one atomic
      transaction.

### Editor integration and policy decisions

- [ ] **TODO-07 — Retired spellchecking cleanup.** Remove stale cSpell settings
      and the deleted spellcheck-directory association without reinstating
      required spellchecking.
- [ ] **TODO-08 — Rego tooling.** Decide between pinned OPA/Regal with explicit
      editor wiring and clearly documented syntax-only support. Extension
      prompts must not silently provision the toolchain.
- [ ] **TODO-09 — Editor/CLI parity.** Verify or deliberately accept Knip's
      bundled runtime and differing Dockerfile formatter. Test real remote
      extension activation and formatter round-trips, not just manifests.
- [ ] **TODO-10 — Python editing policy.** Reconcile four-space Python helpers
      with the root two-space EditorConfig default before selecting a formatter.
- [ ] **TODO-11 — Attachment readiness.** Decide whether
      `waitFor=postCreateCommand` intentionally allows attachment before startup
      health, or whether attachment should wait for postStart validation.
- [ ] **TODO-12 — pnpm environment scope.** Decide whether the store belongs in
      container-wide rather than remote-only environment for direct Docker
      execution; extend the local schema if changing the scope.
- [ ] **TODO-13 — Assignment parsing contract.** Keep the strict literal AWK
      reader until a deliberate decision on Node/dotenv semantics. Replacing it
      changes accepted inputs, escaping and error behavior; no migration is
      approved.

### Operational evidence and handoff

- [ ] **TODO-19 — Organization infrastructure launch.** The mail baseline and
      portable Terraform contracts are locally verified, not deployed. Establish
      a mail-capable provider/network, public DNS/PTR and trusted TLS renewal,
      approved member provisioning/offboarding, consistent offsite backups and
      restore evidence, queue/disk/security monitoring and external delivery.
      Implement host configuration management, protected Terraform backends and
      cluster storage/ingress adapters before claiming whole-infrastructure
      deployment portability. Proxmox is the recommended homelab target; actual
      VM provisioning awaits hardware/network/storage details. Private file VPN
      scope remains open and must not restrict public mail. Implement and test
      the documented Cloudflare edge/VPN access boundaries, including DNSSEC,
      IPv6 exposure, authorization and provider-independent recovery. Keep
      direct mail exceptions explicit.

- [ ] **TODO-14 — Security gate.** Obtain a fresh image vulnerability scan,
      triage HIGH/CRITICAL findings and keep any exceptions justified and
      expiring. Historical counts are not a current vulnerability report.
- [ ] **TODO-15 — Current lifecycle and platform evidence.** Reverify the latest
      revision's clean build, creation, startup, restart, recovery and offline
      reinstall. Gather native ARM64 and Linux/macOS/Windows
      host-versus-container evidence, including actual VS Code execution. Use
      the six paths in `.local-work/SCENARIOS.md` when that temporary workbench
      is available.
- [ ] **TODO-16 — Renovate activation.** Provision the administrator-controlled
      runner and scoped credentials, review a full dry run and the first
      maintenance PR, and verify schema/native-sidecar companion updates.
      Configuration exists; no live bot run is established.
- [ ] **TODO-17 — Commit handoff.** Review the dirty tree and ensure required
      configuration, automation, schemas and lock sidecars are committed
      together. Untracked implementation files do not reach a future clone. Do
      not stage or commit automatically.
- [ ] **TODO-18 — Maintenance observations.** Monitor image and persistent-cache
      growth as projects expand. Review base/frontend digests and publisher-key
      rotation deliberately; capacity floors do not replace workload sizing.

## Implemented controls and latest evidence

### Shared ruleset last-push approval — 2026-10-05

Disabled only `require_last_push_approval` in
`projects/submodules/.github-private/repository-ruleset.json` and the organization
settings reference copy, at the user's request after the test PR required another
reviewer despite a configured approval count of zero. Code-owner review, stale
review dismissal, thread resolution, all six rules, bypass actors and source
metadata remain unchanged. Shared settings ISSUES.md records the observed block
and pending live application.

Verification: parsed both exports and compared the change against the exact
single-parameter update; canonical and reference copies are byte-identical. No
live ruleset was edited, workflow run, commit, push or deployment performed.

### Shared ruleset auto-chan bypass — 2026-10-05

Removed only the Integration bypass for app ID 3447121 from
`projects/submodules/.github-private/repository-ruleset.json` and the organization
settings reference copy, at the user's request after the actor failed to resolve
in a test repository without app access. Other bypasses, all six branch rules,
and source metadata are unchanged. App installation and credential scope are
unchanged. Shared settings ISSUES.md records the finding and remaining test.

Verification: parsed the before/after JSON and compared it against the exact
single-actor removal; canonical and reference copies are byte-identical. No
GitHub ruleset was changed, workflow run, commit, push, or deployment performed.

### Fork-secret wording — 2026-10-05

Clarified `.github/workflows/pr-automation.yml` and the preserved
`.local-work/migration/workflow-template-checkout` copy: `pull_request_target`
uses trusted base/default-branch workflow code even for fork PRs and can access
referenced secrets; ordinary fork `pull_request` does not receive those secrets.
Environment protection still applies, and these workflows currently use only
job-scoped GITHUB_TOKEN permissions without the auto-chan key. User requested
comment corrections only; environment integration remains repository-owned
future work. Existing dirty changes were preserved.

Verification: compared all non-comment workflow lines before and after the edit;
executable YAML content is unchanged in both copies. Settings document links and
the canonical ruleset export reference were checked separately. No workflow was
run, committed, pushed, or deployed.

### Portable infrastructure and mail hardening — 2026-10-04

Reviewed the Terraform/Kubernetes examples, shared identity/ingress and mail
deployment together. Infrastructure PORTABILITY.md records provider-specific
stack/state ownership, a common service contract and migration of durable data.
Added a provider-free platform-contract module, an existing-host adapter and a
DigitalOcean communications VM/firewall adapter with native provider lock and
mocked tests. The cloud adapter refuses unverified SMTP transport. Terraform
does not configure services, secrets or DNS. Proxmox and Ansible are recommended
directions, not implemented VM provisioning or host configuration playbooks.

Mail remains outside Kubernetes and publicly reachable without VPN. Base ports
are loopback/high-port only; production.yaml replaces public client/mail
bindings without exposing bootstrap administration. Missing data paths fail,
logs/resources are bounded and the health probe targets production TLS readiness
rather than bootstrap liveness. Added pinned-release HTTP and SMTP policies plus
an explicit STARTTLS submission listener. Operators must apply and read back
these JSON patches and restart before public launch; Compose does not apply
them. Removed only the obsolete mail Nx target; other inherited Nx targets
remain a known independent-runner gap. Access catalog and offboarding intent now
include mail/file sharing and credential/share revocation, not active
synchronization.

Isolated evidence lives under /tmp/nlobby4-infrastructure-audit.n21o2M.
Terraform 1.15.9 was downloaded to that folder and checked against its official
checksum. Five provider-free native tests and three provider-mocked
firewall/transport tests pass; both adapter configurations validate without
cloud credentials or apply. The mail configuration matrix has 13 tests. The
explicit runtime fixture on an internal Docker network verifies bootstrap,
persistent datastore restart, HTTP patch acceptance/readback, public
admin/monitoring/SCIM denial, forged forwarded header denial, private/local
health, discovery, anonymous file denial, unknown recipient and external relay
rejection before DATA, TLS submission/IMAPS, member login and privileged JMAP
denial. It sends no messages or exposes host ports and removes only its
disposable containers, network and volumes.

The original local mail image failed the fixed HIGH/CRITICAL scan with 24
package findings, including three CRITICAL findings. A cached rebuild retained
those packages. A no-cache candidate build upgraded 29 Debian packages and the
fresh Trivy 0.69.3 fixed HIGH/CRITICAL gate passed with zero matching findings;
this does not establish Rust dependency or unfixed-vulnerability coverage.
Candidate tag nlobby4/stalwart:audit-20261004 remains local and was used for the
final runtime tests; no production tag was overwritten or image published.
Public transport, DNS/TLS issuance, identity sync, backup restoration, complete
sharing scenarios, ARM64/homelab execution and Kubernetes deployment remain
unverified launch gates.

### Shared PostgreSQL baseline — 2026-10-04

Added infrastructure shared/db/postgres with PostgreSQL 18.6-bookworm pinned to
the registry's multi-architecture index digest. The baseline uses persistent
external runtime storage at the PostgreSQL 18 mount location, a file-backed
administrator secret, SCRAM host authentication, local peer authentication and
an internal Docker network without a published port or ingress network access.
Applications must opt in and receive separate least-privilege roles/databases.
Authentik's dedicated PostgreSQL and Homarr's SQLite remain unchanged.

This is undeployed single-host configuration. Application enrollment, TLS,
scoped host-access rules, backups, restore evidence, monitoring, vulnerability
review, sizing and a production managed-service/operator decision remain open.
No database, credentials, network, volume or application migration was created.

Verification: registry manifest inspection confirms amd64 and arm64 entries.
Compose parsing and assertions pass for the private internal network, no
published port, secret-file reference, SCRAM/peer initialization settings,
PostgreSQL 18 storage mount and rejection of a missing runtime root. Formatting
and four affected documentation lint checks pass. No live PostgreSQL tests or
database recovery evidence were collected.

### Homarr organization dashboard — 2026-10-04

Local preview subsequently started at http://localhost:7575 using a separate
credentials-only Compose project nlobby4-homarr-preview. The pinned image was
pulled, database migrations completed and the root redirects to onboarding.
Preview configuration and generated encryption key are temporarily under
/tmp/nlobby4-homarr-preview.Yct914, with appdata in Docker volume
nlobby4-homarr-preview_appdata. Keep the key together with preview data if
retaining this instance beyond temporary use. It binds only 127.0.0.1, has no
Docker socket and does not use production OIDC or ingress. Startup reports a
Redis memory-overcommit warning; no host sysctl was changed. This preview does
not establish production identity, role permissions, VPN or recovery evidence.

The preview was stopped at the user's request. Compose removed its container and
network, and inspection confirmed the appdata volume was preserved. The
temporary configuration and encryption key also remain for a possible restart.

Replaced infrastructure's static web/portal with web/homarr. Updated DNS,
Traefik routing, Docker network aliases, access catalog/grants, policy fixtures
and shared-service documentation. Homarr v2.1.2 is pinned to the registry's
multi-architecture index digest. Appdata and file-backed encryption/OIDC secrets
remain outside Git. Native Authentik OIDC handles dashboard identity and groups,
with the existing forward-auth guard retained for ingress and first-run setup.
No host ports, Docker socket or cluster management credentials are configured.
Internet-backed requests are disabled initially.

This is configuration, not an activated dashboard. Authentik application and
ingress bindings, operator-only onboarding, board creation, group permissions,
private CA trust, runtime files, current image vulnerability review and live
login/persistence/recovery tests remain deployment gates. The surrounding
localhost-only DNS/ingress baseline and inherited Nx references remain open. No
services, cloud resources, users or secrets were created.

Verification: registry manifest inspection confirms amd64 and arm64 entries.
Compose parses and assertions pass for native OIDC, file-backed secrets,
persistent appdata, missing-path protection, no published ports and ingress
routing. Six missing-input cases fail as expected. Three affected documentation
files pass Markdown lint and targeted formatting passes. Runtime login,
permissions, image scanning and upgrade/recovery remain untested.

### Media application guidance and VPN baseline — 2026-10-04

The subsequent complete VPN review is recorded in infrastructure's
shared/web/vpn/ASSESSMENT.md and linked from its README. It confirms invalid
hyphenated peer examples against the pinned image's upstream revision and
identifies missing forwarding permissions, private DNS/ingress integration and
device lifecycle enforcement. The review compares plain WireGuard, native host
operation and NetBird. Findings remain open and no deployment configuration was
changed by recording the assessment.

Infrastructure's shared/media/README.md now records the social-media backend
candidates and separates application-owned upload/visibility rules from storage,
image processing and identity. No media implementation was selected or deployed.

Started reviewing shared/web/vpn. Retained its pinned WireGuard image and
independent-host topology. Compose now requires explicit DNS, tunnel subnet and
client routes instead of silently selecting broad network defaults. The example
routes are illustrative only. The README records DigitalOcean topology
decisions, server-side forwarding policy, private DNS, durable revocation and
acceptance checks. Removed the nonfunctional mise validation instruction without
migrating the inherited Nx project.

Verification: Compose parses the example configuration. Missing DNS, subnet and
routes are each rejected by separate non-starting checks. Documentation and YAML
were formatted. No host networking, keys, Docker services or cloud resources
were changed. Region, reviewed CIDRs, administrative access, firewall/NAT rules,
DNS hosting and current image vulnerability review remain open. Live handshake,
revocation, restart, client-platform and recovery tests remain unperformed.

### Infrastructure media design review — 2026-10-04

Recorded the proposed DigitalOcean Spaces, Kubernetes, Traefik/Authentik and
WireGuard media architecture in the infrastructure submodule's
shared/media/DESIGN.md, with research cross-references, implementation gates and
19 unexecuted acceptance scenarios in shared/media/AUDIT.md. Updated its README
to distinguish public assets from protected runtime data and clarify Terraform
secret-state handling. The review covers Saltzer/Schroeder protection
principles, NIST zero trust, cloud-storage and sharing research, OWASP, HTTP
caching and official platform behavior. Formatting and Markdown validation pass
for all three documents. No provider resources, services, access rules or
commits were created; live authorization, VPN routing, browser behavior and
restoration remain implementation gates, not verified controls. Keep these
changes inside the independently owned infrastructure repository when preparing
the commit handoff.

### License ownership and automation — 2026-10-04

Moved the seven schema notices byte-for-byte to licenses/schema and updated the
schema lock, updater and regressions. Root licenses now owns shell tool and
dependency notices; ordinary pnpm workspace projects receive their own separate
licenses inventories. Independent submodules are excluded.

The collector uses pnpm's native inventory for directly declared dependencies
and exact upstream mise/tool release tags. Transitive dependencies and OS
packages are deliberately excluded, following the clarified top-level scope.
Inventory and input hash checks run offline. schemas:update refreshes notices as
well as bundles; Renovate accepts companion license changes. CI checks
inventories and collector regressions. Source notices are not formatted or
line-ending-normalized.

Remaining gap: packages without shipped notices are recorded explicitly rather
than treated as legally complete. Non-npm projects own ecosystem collection.
Renovate activation remains TODO-16. These controls are an inventory, not legal
compliance certification or complete source-distribution obligations.

Verification: the reduced collection contains 65 notices across 54 direct
package/tool records, with no missing-notice gaps. Both dependency-free example
projects have empty owner inventories. Fifteen isolated collector tests and 12
schema regressions pass; all 19 project-boundary tests pass outside the sandbox,
whose subprocess output restrictions caused the initial run to fail. Offline
license checks, 15 schema contracts against 19 configuration files, frozen
offline lock validation and focused lint/format checks pass. No image build or
license scan was performed. The superseded transitive collection is retained
only in ignored .local-work/license-collection-full for recovery.

The following are implemented, not new requests: exact direct pins; native
format-3 mise graphs; frozen installs; signed bootstrap checksum updates;
bounded Linux bootstrap recovery; isolated installer caches; capacity floors;
scoped doctor repair; parallel readiness checks; Git signing and Docker workload
probes; ordinary-project ownership and opt-in Turbo caching; local offline
configuration schemas with upstream licenses and automatic refresh wiring.

Commit-template and Commitlint fixes are resolved, including removal of its
nonexistent editor formatter. Gitleaks/Hadolint header fixes are resolved.
Required spellchecking, image publication, Cosign and byte-comparison
diagnostics are deliberately retired, not pending work.

The last recorded complete local regression baseline was 506 Node tests: 501
passed, four failed, one skipped; 20 image-contract and six capacity tests
passed. The four failures share TODO-01. Later focused schema/automation checks
passed 39 tests, validated 14 local schemas against 18 configuration files and
confirmed byte-identical regeneration of 20 updater outputs. These are separate
dated runs, not a new all-green full-suite result.

Historical disposable amd64 lifecycle, restart, recovery and offline reinstall
passes remain evidence for their tested revisions. No fresh container run,
security scan, live bot activation, native ARM64 or real Windows/macOS/VS Code
execution is claimed by this consolidation.

### Documentation consolidation — 2026-10-03

Moved OUTPUT.md and README-devcontainer.md into this record, corrected stale
project-linting and Renovate guidance, and moved historical agent evidence here.
AGENTS.md now defines a scoped workflow; temporary notes link to this backlog
instead of maintaining duplicate issue states. README.md and versions.env point
to this guide. The retired documents are removed.

Verification: the complete audit body is preserved after heading/whitespace
normalization, all 18 backlog IDs are unique, and no active references target
the retired files. Markdownlint, Prettier and `git diff --check` pass. This was
documentation-only work; no runtime fixes or new container evidence are claimed.

### Markdown configuration rename — 2026-10-03

Renamed .markdownlint-cli2.jsonc to .markdownlint-cli2.json and removed trailing
commas without changing its parsed settings. The installed CLI does not discover
that JSON filename automatically, so lint, fix and staged-file commands now pass
`--config .markdownlint-cli2.json` explicitly. README and Git attributes use the
new name; the historical line map retains the old filename.

Verification: repository Markdown lint, offline schema/hash validation and
ShellCheck pass. An isolated valid HTML fixture passes and an unsupported HTML
fixture fails with the custom rule, confirming explicit configuration loading.

## Accepted boundaries

Trusted code and privileged Docker-in-Docker remain the design. There is no hard
kernel boundary against hostile code. Image-byte similarity is best effort, not
a measured percentage or readiness gate. Rolling Moby packages still limit
transitive image reproducibility. No image publishing, internal mirror or
upstream-outage-resilience service is planned. Capacity checks are floors, not
host/VM quota guarantees. Recovery is bounded to bootstrap files and controlled
container restart, not datastore repair or proof of real host power-loss safety.

## Devcontainer operating guide

This guide describes the intended configured workflow. Consult the backlog for
known gaps and the historical evidence for what was actually executed.

This repository builds its development container from source. CI validates and
scans local images; image publishing, signing and registry promotion are not
part of this setup.

The setup is intended for trusted repositories on single-user development
systems. See the current backlog and historical evidence below for remaining
gaps; a successful readiness check does not imply a vulnerability-free or
byte-reproducible image.

The primary goal is a repeatable, version-aligned environment with observable
drift. Byte-identical rebuilds are an improvement target, not a required
readiness condition. We retain the official Docker-in-Docker Feature rather than
maintaining a custom installer solely to achieve identical image bytes.

CI builds use the source commit's Unix timestamp as `SOURCE_DATE_EPOCH` and
rewrite exported layer timestamps. Direct local builds default to Unix epoch
unless the caller exports a timestamp. Neither setting freezes dependency
resolution or removes nondeterministic generated file contents.

Byte equality is best effort, not measured or gated. No percentage guarantee or
byte-comparison diagnostic is provided.

### Security boundary

The container uses Docker-in-Docker with dedicated daemon-storage volumes. It
does not mount the host Docker socket, so workspace processes cannot ask the
host daemon to create privileged containers or mount arbitrary host paths.

Docker-in-Docker requires a privileged outer container and is not a hard kernel
security boundary. Run untrusted repositories and contributions in a disposable
VM, Codespace, or equivalent host-level sandbox.

Daily development runs as the non-root `nlobby4` user. The inherited sudo policy
is removed, and operating-system provisioning happens only during the reviewed
image build. Repository dependency installation uses `--ignore-scripts` to
reduce lifecycle-script risk.

### Configuration ownership

| Dependency                                                                                                                                 | Canonical owner                                  | Update mechanism                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------- |
| Node.js, pnpm, Dev Container CLI, ShellCheck, Trivy, Act, Actionlint, Zizmor, Minisign, Gitleaks, Gum, Hadolint, Conftest, Tombi, yamllint | `mise.toml` and `mise.lock`                      | Renovate or reviewed mise update   |
| JavaScript packages                                                                                                                        | `package.json` and `pnpm-lock.yaml`              | Renovate or pnpm                   |
| Docker-in-Docker Feature, Docker, and Buildx                                                                                               | `devcontainer.json` and `devcontainer-lock.json` | Renovate and Dev Container CLI     |
| Base image                                                                                                                                 | Dockerfile `FROM`                                | Renovate Dockerfile manager        |
| Dockerfile frontend                                                                                                                        | Dockerfile `# syntax` directive                  | Renovate or reviewed digest update |
| Debian snapshot and packages                                                                                                               | `versions.env`                                   | Refresh hook / snapshot resolver   |
| Direct-download checksums                                                                                                                  | `checksums.sha256`                               | Signed bootstrap updater           |
| GitHub Actions and service images                                                                                                          | Workflow declarations                            | Renovate                           |

The Dockerfile directly downloads only the mise bootstrap binary. Repository
tools, including Act, Actionlint, and Zizmor, are installed with
`mise install --system --locked` from `mise.toml`. Most backends record artifact
checksums in `mise.lock`; npm tools and uv-managed yamllint additionally commit
their native dependency graphs in `.mise/locks`. Renovate in the ownership table
is configured in `renovate.json`; activating its self-hosted runner is a
separate administrator step described below. `versions.env` remains the single
owner of the dated Debian package set and mise bootstrap, not a duplicate mise
tool list.

#### Native mise dependency locking

The repository pins mise 2026.9.18, uv 0.12.10 and lockfile format 3. Native
aube sidecars lock npm tools; yamllint uses uv with a committed `uv.lock`. The
Debian Python interpreter is the only interpreter configured here; the image
aliases `python` to `python3` for mise's installer. Mise manages uv/pipx and
isolated Python tool dependencies, not another Python runtime. uv interpreter
downloads are disabled during image installation and automated refresh. Debian
Python is also needed by system yq, venv support and stdlib-based maintenance
checks, so replacing it with a mise interpreter would add coupling rather than
remove a redundant interpreter. Projects may manage their own runtimes
separately. Older mise cannot read this lock: update host mise before using the
host-side task workflow.

`settings.locked = true` makes ordinary installs (including automatic task
setup) replay the committed locks rather than expanding their platform metadata.
Only deliberate `mise lock` commands refresh them.

The isolated test also recorded ESLint's 77-package graph, replayed frozen npm
installs, and rejected a deliberately edited sidecar. With checksum-verified uv
0.12.10, yamllint's native Python graph generated and replayed successfully; uv
0.12.5 was rejected. These tests used a temporary Linux installation, not the
repository's container. The subsequent migration includes these native graphs in
the image and readiness contract.

The currently installed pnpm and Dev Container CLI aube locks each contain one
package: these tools bundle their dependencies. Native locking therefore adds
committed package-integrity/graph references here rather than freezing a large
externally resolved npm graph. Yamllint's separately resolved Python
dependencies are the clearer immediate transitive-locking benefit.

Current [mise documentation](https://mise.jdx.dev/dev-tools/mise-lock.html)
describes graph locking through the embedded aube installer for npm and uv for
PyPI tools. Python graph locking requires uv 0.12.10 or newer, a suitable
installed Python interpreter, and compatible wheels. Standalone pipx installs
remain version-only; the `pipx:` backend name can still be used with uv.

The bootstrap, CI and minimum mise versions are coordinated. Native sidecars are
included in the build context, system installation, image fingerprint, update
snapshots and cache keys. Readiness verifies graph digests without rewriting
locks. To deliberately refresh graphs while keeping exact tool pins:

```bash
mise lock --bump --platform linux-x64,linux-arm64
git diff -- mise.lock .mise/locks
```

Commit the lock and all referenced sidecars together. Builds install frozen
graphs; they do not regenerate them. These graphs improve dependency
reproducibility, not byte-identical image layers or the vulnerability gate.

#### Host requirements

Opening the container in VS Code needs Docker with BuildKit/Buildx available
(included in Docker Desktop where applicable), VS Code and its Dev Containers
extension. No host mise, Node, pnpm or uv is required for this editor-driven
path. Docker alone does not interpret `devcontainer.json` or run its lifecycle
hooks. The terminal task workflow uses host mise to provide the Dev Container
CLI; alternatively provide that CLI and its Node runtime separately. Lock
maintenance can run inside the container.

System tools live under `/usr/local/share/mise/installs`, outside user home
directories. Mise discovers them automatically, including when a Dev Container
client mounts a home directory. Developers can install additional versions in
their normal user mise directory without changing the image-provided
installation globally. User shims precede system shims on `PATH`, so a developer
can intentionally override an image-provided tool for their account. Locked
BuildKit cache mounts isolate mise, pip, uv, npm and Node's compile cache from
image layers during installation. uv copies installed files rather than linking
them to the temporary cache. The Dockerfile also clears its APT download cache,
package lists and installation logs. The later DinD Feature can generate new
package logs; installed metadata and Python bytecode are retained. This removes
installer caches, not every source of image-byte variation.

The mise bootstrap selects its binary from BuildKit's target-platform argument,
so multi-platform builds follow the requested image architecture rather than the
architecture reported by the build executor.

User provisioning reuses the inherited UID 1000 account without assuming its
login, home or primary-group name. If absent, the account is created. The target
home is moved as needed and conflicting target identities fail the build. UID
1000 remains an explicit image convention, not universal base-image discovery;
the Dev Container client can remap it for the host at runtime.

User and system mise shims are on `PATH`, so tools work consistently in
interactive shells, login shells, CI processes, and editor integrations without
modifying global shell initialization files.

### Project ownership boundary

The root Dev Container provides the shared repository, CI, security, and
Docker-in-Docker toolchain. Ordinary projects reuse shared formatting and basic
lint tools. Local project configurations take precedence; generic shell ESLint
rules are the fallback when a project has no configuration. Projects own their
application dependencies, framework-specific rules, tests, denylist and optional
mise overrides. Independent repositories under `projects/submodules/` are
excluded from root formatting, pnpm/Turbo selection and automatic repair.
Infrastructure and its media server belong there, not in the root shell. See
projects/README.md for ownership and VS Code multi-root behavior.

A project may also contain its own Dockerfile when its build or runtime warrants
one. That Dockerfile is built and exercised through the root container's
isolated Docker-in-Docker daemon; it does not extend the root Dev Container by
default. This keeps dependency and image management at the narrowest applicable
project layer.

### Docker and Compose

The official Docker-in-Docker Feature owns the inner Docker installation.
`installDockerBuildx: false` prevents its separate latest-version download; the
Moby package still supplies the pinned Buildx. Compose is pinned explicitly via
`dockerDashComposeVersion`. Runtime checks allow only the declared upstream
Docker/Buildx version or that version with the known Moby `-1` suffix.

The Feature still adds a rolling Moby repository, including transitive packages
and a redundant Compose package. This remains a reproducibility limitation.
Completed images are scanned in CI; findings fail the security job rather than
being automatically accepted because repository code is trusted.

### Persistent state and resources

Workspace readiness checks available bytes and inodes on the workspace, the
temporary directory, the configured pnpm store and existing DinD
Docker/containerd volume mounts. Defaults require 1024 MiB and 1000 free inodes
per filesystem; override with `DEVCONTAINER_MIN_FREE_MIB` and
`DEVCONTAINER_MIN_FREE_INODES` (positive integers). Failures are red and fail
readiness. Filesystems without inode accounting are checked for free bytes only.
No caches are pruned automatically.

These checks measure accessible container filesystems, not Docker Desktop's
host/VM backing-store limit, image-build peak space or a guarantee that an
arbitrary workload will fit. Shared filesystems may appear under multiple
labels. Recovery is bounded to interrupted bootstrap updates and restarting the
existing container, as described below. It does not repair corrupted databases
or guarantee recovery after a host filesystem or hardware failure.

The pnpm store uses a volume whose name contains `${devcontainerId}`. The name
is stable for a workspace and distinct across separate clones and working trees,
so their package caches and cleanup ownership do not collide.

Docker-in-Docker has separate persistent volumes for its daemon state. These
volumes may contain valuable nested images and data. Preview cleanup first:

```bash
mise run devcontainer:clear
```

Run `bash scripts/linux/commands/devcontainer/devcontainer-clear.sh --apply` on
the host to remove the selected container, unused image, pnpm cache volume, and
local caches. Nested Docker/containerd volumes are preserved unless
`--include-docker-data` is also supplied. Unrelated attached volumes are never
selected. Deleted volumes have no automatic recovery.

#### Crash recovery

Container creation and startup recover an interrupted mise bootstrap update
before evaluating the workspace mise configuration. Recovery uses the image's
Node runtime and standard library, so an unusable workspace minimum version or
missing npm dependencies do not prevent it. The updater also checks for a
pending transaction before starting another update.

The four coupled bootstrap files are journaled with their original bytes,
candidate bytes, hashes and permissions before any replacement. File and
directory writes are flushed on Linux. A partial update rolls back; a fully
written candidate is retained. Recovery is repeatable even if interrupted again.
If any file contains a later edit, recovery refuses without overwriting it and
retains the journal for review. An operating-system `flock` lock prevents two
updates or recoveries from overlapping and is released on process termination.
The ignored lock file is intentionally retained to keep its inode stable.

Preview recovery from the Docker host:

```bash
bash scripts/linux/commands/devcontainer/devcontainer-recover.sh
```

To restart the uniquely identified existing workspace container and rerun
lifecycle validation, preserving every attached volume and nested Docker data:

```bash
bash scripts/linux/commands/devcontainer/devcontainer-recover.sh --restart
```

This optional host command requires Bash, Docker, GNU `timeout`, jq and the Dev
Container CLI with its Node runtime. It refuses ambiguous container selection
and does not prune, rebuild, reset or delete data. Run it directly when the
workspace mise configuration is broken; the optional mise task may not parse
then. VS Code can also restart the container and use the startup recovery hook
without these extra host tools.

For bootstrap-only recovery, run `node scripts/node/bin/recover-bootstrap.js`
from the workspace root using an available Node runtime. Updates and journal
recovery require `flock`; the Linux devcontainer supplies it. Native Windows
execution is not supported by this recovery mechanism. Durability relies on a
local filesystem honoring rename and fsync, not a guarantee for network
filesystems, storage hardware or real power loss. This does not journal other
lockfile updates or repair interrupted package installations. Rerun setup
deliberately if readiness reports such failures. Backups remain necessary for
valuable DinD data. No automatic deletion or datastore repair is attempted.

The container does not enforce CPU or memory limits or currently declare
`hostRequirements`. An init process handles signal forwarding and zombie
reaping.

### Lifecycle

On creation, the Dev Container CLI:

1. builds the Dockerfile;
2. applies the integrity-locked Docker-in-Docker Feature;
3. starts the isolated Docker daemon;
4. mounts the workspace and workspace-specific pnpm store;
5. recovers any interrupted bootstrap update using the image-provided Node;
6. trusts the repository mise configuration; and
7. runs `mise run setup`.

On every start, the Bash lifecycle hook runs `init.sh` directly. It recovers any
interrupted bootstrap update before reading the workspace mise configuration,
gives the inner Docker daemon 30 seconds to become ready, then runs `health.sh`
with a five-minute deadline. Mise tasks remain an orchestration interface, not a
separate readiness requirement.

Readiness checks include available filesystem capacity and compare versions,
dependency manifests, installed package/bin presence, Git identity/LFS/Husky
configuration, local Docker availability, and workspace/store writability. An
image manifest compares build inputs and seven direct Debian package versions;
changed toolchain inputs report that a rebuild is required. Mise task bodies and
editor customizations are excluded from this image fingerprint. This is drift
detection, not cryptographic attestation of all installed bytes.

`info.sh` still refreshes origin once with bounded, non-interactive Git fetch;
that intentionally changes remote-tracking refs and FETCH_HEAD. Dependency
consistency probes run on temporary manifest copies and cannot auto-install
missing mise tools. Independent status checks have 60-second deadlines and a
plain-text fallback when rich output cannot be rendered. Spellchecking and
dictionary validation are optional, not startup or CI requirements.

### Commands

Use mise as the stable developer interface:

```bash
mise run devcontainer:up
mise run devcontainer:rebuild
mise run devcontainer:clear
mise run devcontainer:update
mise run devcontainer:shell
mise run devcontainer:doctor
mise run devcontainer:health
mise run devcontainer:scan
mise run lint:secrets
mise run lint:secrets:staged
mise run lint:dockerfile
mise run lint:policy
mise run lint:toml
mise run lint:yaml
mise run test:devcontainer
```

Equivalent `pnpm run` commands remain available. The `ci:*` package tasks are
internal workflow interfaces rather than developer APIs.

#### Validation scope

- `lint:schema` verifies local schema source/lock integrity and configuration
  documents offline. Independent submodules retain their own schema policy.
- `lint:secrets` scans complete reachable Git history with redacted findings.
- `lint:secrets:staged` scans staged changes before `lint-staged`.
- `lint:dockerfile` runs warning-level Hadolint checks against the real
  devcontainer Dockerfile, verifies valid and deliberately invalid fixtures, and
  checks ordinary-project Dockerfiles with local configuration or shell
  defaults.
- `lint:policy` applies Conftest policies to live configuration and fixtures.
- `lint:toml` runs Tombi against `mise.toml` and validates mise task
  definitions.
- `lint:yaml` runs strict yamllint checks for the shell and ordinary projects,
  honoring each owner's configuration.
- `lint:js` runs ESLint for shell automation and ordinary projects, using local
  project configuration or generic shell defaults.
- `devcontainer:scan` performs vulnerability, secret, and SBOM analysis.
- `devcontainer:doctor` repairs safe repository-local setup without installing
  tools, downloading LFS objects or resetting data. Add `-- --check` for
  diagnosis only. It does not certify full readiness.
- `devcontainer:health` validates readiness without repairing local setup.
- `test:devcontainer` performs a clean build and complete runtime smoke test.

Conftest requires a non-root remote user, init, no host Docker socket mount,
locked Feature versions from approved registries, digest-pinned workflow service
images, least-privilege workflow permissions, and immutable external action
references. Organizational software-license policy is intentionally separate.

### Updating dependencies

#### mise-managed tools

1. Update `mise.toml`.
2. Run `mise lock --platform linux-x64,linux-arm64`.
3. Review the platform URLs, checksums, and provenance in `mise.lock`.
4. Run the repository checks and `mise run test:devcontainer`.

To refresh all three lock layers for already-declared versions, run
`bash scripts/linux/commands/devcontainer/devcontainer-update.sh --locks`. The
default updates only the Feature lock; `--check` validates without updating.
This is not an automatic version-bump transaction: review diffs even after a
failed update, and edit coupled source pins/checksums deliberately.

Renovate has a native mise manager and can propose tool updates. Lockfile
regeneration requires a Renovate execution environment that is permitted to run
mise safely. The mise bootstrap version in `versions.env` is separate. Update it
with an explicitly chosen release:

```bash
bash scripts/linux/commands/devcontainer/devcontainer-update.sh --mise 2026.9.18
```

The updater verifies the official checksum manifest's Minisign signature against
a pinned publisher key, then cross-checks the manifest digest and both Linux
binary hashes against GitHub release metadata. Minisign must already be
installed (it is included in the container). Invalid or missing signatures,
missing verification tools and network failures leave source files unchanged.
Key rotation requires a reviewed change to the pinned key, never a downloaded
replacement. The key is documented in the
[official mise installation guide](https://mise.jdx.dev/installing-mise.html#github-releases).

A temporary candidate is validated before updating `versions.env`, both
bootstrap hashes and their source URL, the CI bootstrap and mise.toml's minimum
version. Native lock sidecars and the local aqua registry are included. Atomic
file replacements use the durable four-file journal described above; ordinary
write failures attempt rollback and interrupted updates are recovered before the
next update or container lifecycle. The updater does not install the selected
mise version on the host. Review its diff and run the smoke test.

#### Dockerfile inputs

1. Resolve a dated Debian snapshot and all seven package pins together with
   `node scripts/node/bin/update-debian-snapshot.js YYYYMMDDT000000Z`, or use
   `--recent` for a snapshot seven days behind UTC today. The resolver reads
   amd64 and arm64 package indexes in disposable, read-only containers based on
   the pinned image. It checks signed APT metadata, rejects architecture-version
   mismatches and backward moves, and does not install host packages.
2. When updating mise itself, run `devcontainer-update.sh --mise VERSION` to
   align both Linux hashes and `.github/actions/setup-node-deps/action.yml`.
3. Review `checksums.sha256` using canonical `sha256sum` formatting.
4. Review base-image and Dockerfile-frontend digest changes.
5. Run `pnpm run lint:devcontainer`, `mise run lint:dockerfile`, and
   `mise run test:devcontainer`.

Never accept an unknown checksum merely to make validation pass.

Direct Debian packages remain exactly versioned against the dated snapshot, but
the Dockerfile does not allow package downgrades. If the pinned base image is
newer than the selected snapshot packages, the build fails and the two inputs
must be reviewed together.

#### Dev Container Feature

1. Update the Feature or its options in `devcontainer.json`.
2. Run `mise run devcontainer:update`.
3. Review `devcontainer-lock.json`.
4. Run the clean smoke test.

CI uses the frozen Feature lockfile, so validation cannot silently accept a
resolution that has not been reviewed.

### CI validation

#### Automated update flow

Configuration schemas are explicit local bundles under `schemas/`. Run
`pnpm run schemas:update` after relevant dependency/source changes and
`pnpm run lint:schema` to check pins, hashes and offline configuration
validation. The updater owns generated bundles, licenses and
`sources.lock.json`; preserve the hand-authored devcontainer and source
contracts. VS Code schema downloads are disabled. Renovate tracks pinned source
revisions and refreshes bundles; this is configured automation, not evidence of
a live bot run.

`renovate.json` replaces Dependabot and discovers mise tools, JavaScript
dependencies, GitHub Actions, the Dockerfile base/frontend and Dev Container
Features. Custom extraction covers the mise bootstrap and DinD Docker, Buildx
and Compose options. Minor/patch toolchain changes are grouped, releases have a
seven-day age floor except SchemaStore Git refs, which lack release timestamps,
and nothing auto-merges. Major changes still need review. Mise is canonical for
Node/pnpm; refresh derives packageManager and engines in package.json instead of
letting separate managers move those declarations.

Toolchain minor/patch, digest and pin updates add this reviewed refresh command:

```bash
bash scripts/linux/commands/devcontainer/devcontainer-update.sh --refresh
```

It installs existing frozen JavaScript dependencies without lifecycle scripts,
synchronizes runtime declarations and publisher-verified bootstrap hashes,
downloads that exact checksum-verified mise to a temporary directory, locks and
installs the candidate uv, refreshes both Linux platforms and native transitive
graphs, regenerates Feature/pnpm locks and resolves the recent Debian snapshot.
The resulting PR includes all generated companion files, not just edited pins.
The global branch-level hook runs `pnpm run schemas:update`; schema-only and
unrelated updates do not run the container refresh hook. Review every generated
companion diff. Renovate's independent mise artifact generation is disabled so
this one flow owns the selected bootstrap and platform/sidecar policy.

Both refresh and the read-only `--check` end with exact tool/lock matching,
artifact URL/checksum presence for amd64 and arm64, native graph digest checks,
bootstrap/CI alignment and `mise lock --dry-run --json` for both Linux targets.
Dry-run JSON covers version entries only; an empty array is not proof that all
artifact metadata is present. `--locks` regenerates declared locks without
bumping native transitives; `--refresh` deliberately refreshes those graphs too.
Ordinary builds, setup and startup remain frozen and never fix drift silently.
CI checks drift, tests base-account variants and runs the full native container
lifecycle plus existing security gates. A successful update command is not proof
that the image builds, starts or passes vulnerability scanning. The
image-contract recording step also verifies exact pins and frozen artifacts for
both Linux platforms before accepting a built image. Run refresh on a disposable
maintenance branch/worktree and review its diff; the whole refresh is not a
single transaction. Only the four coupled bootstrap files have the dedicated
crash-recovery journal.

Activation requires a self-hosted Renovate deployment. Load
`.github/renovate-host.json` as its administrator-owned global config, outside
bot-edited branches. Provision its trusted disposable Linux environment with
Node, pnpm, mise, uv, Minisign, Python 3.11+, jq, Git, Bash, curl, sha256sum and
Docker access; the configured devcontainer supplies these. Pin/update the bot
deployment separately, not as a repository readiness tool. Restrict its
repository list to this repository and supply a scoped GitHub App/PAT outside
the config. It needs permissions to create update branches/PRs and update
workflow files; do not expose that token to PR-triggered repository execution.
Start with Renovate's `--dry-run=full` and review logs before enabling writes.
Schedule the runner at least weekly; config schedules restrict eligible runs. No
bot installation, token provisioning or external PR creation was performed by
this implementation. A maintenance branch must be attempted for its hook to
advance the snapshot; this is not an independent Debian snapshot scheduler.

The [hosted Renovate app](https://docs.renovatebot.com/mend-hosted/faq/) blocks
arbitrary post-upgrade commands, so simply installing that app does not enable
this checksum/lock flow. The global template allows only the exact container
refresh and schemas:update commands, not arbitrary shell commands. Schema-only
updates refresh local bundles without running the Docker maintenance hook. It
permits mise's repository-defined locking explicitly and does not forward all
runner environment variables. See
[Renovate post-upgrade tasks](https://docs.renovatebot.com/configuration-options/#postupgradetasks)
and [mise locking semantics](https://mise.jdx.dev/dev-tools/mise-lock.html).
This is for trusted repository code, consistent with the container threat model.
Prefer disposable DinD storage over forwarding a host Docker socket to a
credentialed maintenance process.

The Dev Container workflow performs native AMD64 and ARM64 builds and smoke
tests, Dockerfile checks, local source-image vulnerability/secret scans and SPDX
JSON SBOM generation. SBOMs are uploaded as CI artifacts. No image is pushed to
a registry, and no package-write, attestation-write or OIDC signing permissions
are requested.

### Smoke-test coverage

The disposable-container smoke test verifies:

- an uncached image build and lifecycle setup;
- exact mise-managed tool versions, including Tombi and yamllint;
- non-root execution and unavailable sudo;
- absence of the host Docker socket;
- inner-Docker and Compose operation;
- init and volume configuration;
- workspace-specific pnpm volume naming;
- absence of installer-cache files in the resulting image;
- container restart behavior;
- interrupted bootstrap recovery with an unusable workspace mise config;
- abrupt container termination and data-preserving restart;
- offline pnpm restoration; and
- cleanup of disposable resources, including partial lifecycle failure.

Local smoke tests copy trackable working-tree files; CI uses an isolated archive
of HEAD. Failures preserve the test workspace and lifecycle log. For a prebuilt
candidate, set `DEVCONTAINER_SMOKE_IMAGE` to its immutable digest and
`DEVCONTAINER_SMOKE_PLATFORM` to `linux/amd64` or `linux/arm64`; the same test
exercises that image without changing the repository's real build configuration.

## Historical evidence archive

The former OUTPUT.md is retained below as dated evidence, including its original
line-by-line responsibility map, unsuccessful runs and implementation
follow-ups. Its former current-status table is a historical snapshot; the
backlog above is now authoritative for open items. Old filenames and line
numbers describe their audited revisions, not current paths. A later pass
supersedes only the specific finding it tested; it does not rewrite an earlier
result.

### Devcontainer lifecycle audit

Tests performed: 2026-09-26; report finalized: 2026-09-27. Scope: the current
working tree, including staged, unstaged, and untracked implementation files.
This is not an audit of HEAD alone. No implementation fixes were made during the
original audit. **Implementation work is recorded in the follow-up section at
the end of this file.** Its results supersede the original state descriptions
where explicitly noted; the historical evidence and line map are retained.

#### Historical issue-status snapshot — 2026-10-03

Use this section and the final configuration/editor audit for current status.
The original assessment, findings, implementation order and line map below are
historical snapshots, not a current checklist. Later successful tests do not
retroactively make earlier failures pass. Earlier test counts describe those
particular revisions, not the current tree.

| Concern                                                         | Current status                                           | Evidence or remaining action                                                                                                                                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker pins and inactive frontend directive                     | Resolved                                                 | First-line frontend pin, exact Compose pin, disabled separate Buildx installation and known Moby package-suffix handling are implemented.                                                                            |
| Required spellchecking blocks startup                           | Resolved for required checks                             | Removed as requested. Obsolete editor settings remain, recorded below.                                                                                                                                               |
| Diagnostic lock mutation and implicit tool installation         | Resolved for the identified paths                        | Disposable dependency probes and disabled readiness auto-install are implemented. Git refresh and disposable workload probes still have explicitly bounded side effects.                                             |
| Missing dependencies, broken hooks and executable/version drift | Substantially resolved                                   | Current readiness includes executable versions, hook checks and package-content/offline-cache integrity. This does not attest every installed system/tool byte.                                                      |
| Repair false success and duplicated setup configuration         | Resolved, scoped doctor implemented                      | `doctor.sh` replaces repair, verifies postconditions, aggregates independent failures and offers non-mutating `--check`. `health` remains separate readiness validation. General self-correction is not implemented. |
| Partial-start cleanup, deadlines and presentation fallback      | Resolved for the tested paths                            | Scoped cleanup, hard deadlines, parallel collection and plain-output fallback are implemented. Silent successful checks now fail summary readiness; status 137 is not misidentified as a definite timeout.           |
| Input/policy fail-open findings                                 | Original findings resolved, coverage extension open      | Structural/Feature graph checks are implemented. Editor settings, extension entries, lifecycle paths and pnpm mount relationships are not fully validated.                                                           |
| Ignored required configuration files                            | Ignore rules fixed, commit handoff pending               | Hadolint/Gitleaks configuration is allowed by Git rules. Many implementation files remain untracked in this working tree; a future clone only receives committed files.                                              |
| Native npm/Python graphs                                        | Resolved for configured mise graphs                      | Format-3 locks, committed native sidecars and frozen consumption are implemented. Never hand-edit mise-owned graph bytes. Rolling DinD package metadata remains a boundary.                                          |
| Signed bootstrap updates                                        | Verification implemented, current update regression open | Duplicate release URL comments cause four updater tests to fail before candidate validation. See the current audit below.                                                                                            |
| Coordinated update automation                                   | Implemented configuration, activation pending            | Refresh tooling and a self-hosted Renovate template exist. Schema bundles refresh after dependency/source updates. No live bot run is established. Whole-refresh transactionality remains limited.                   |
| External or skipped configuration schemas                       | Resolved for shell-owned configuration                   | Explicit local bundles, pinned source inventory, license/hash lock, offline drift checks and JSONC validation are implemented. Editor downloads are disabled. Actual editor activation remains unverified.           |
| Capacity and bounded bootstrap crash recovery                   | Implemented and tested historically                      | Capacity floors and four-file Linux journal recovery supersede earlier statements that these were absent. Real power loss and datastore repair are not established.                                                  |
| Image publication, Cosign and byte-comparison diagnostics       | Retired, not pending                                     | Deliberately removed. Publisher Minisign verification is a different retained control. Image-byte similarity remains best effort, not a percentage guarantee.                                                        |
| Git signing and Docker workload capability                      | Implemented, Docker error-display gap open               | Real signing/workload evidence is recorded below. A multiline workload failure can prevent Docker status rows from printing.                                                                                         |
| Image vulnerability gate                                        | Open, current scan not established                       | Historical HIGH/CRITICAL findings were not closed. Old counts and removed-tool findings must not be presented as a current scan.                                                                                     |
| Current complete lifecycle and editor execution                 | Not reverified after latest changes                      | Earlier amd64 lifecycle evidence remains valid for its tested revisions. Native ARM64, Windows/macOS and actual VS Code remote extension activation remain unverified.                                               |
| Literal AWK extraction versus dotenv parsing                    | Open design question                                     | No migration approved. Keep the existing strict literal reader until its contract is deliberately changed.                                                                                                           |

The 2026-10-02 local regression result was **506 Node tests, 501 passed, four
failed, one skipped**, plus **20 image-contract tests and six capacity tests
passed**. The four failures share the duplicate checksum-URL cause. This is not
evidence that the latest devcontainer builds, passes startup or meets its
security gate. Only this report was changed during that configuration/editor
audit. Later focused implementation evidence is recorded at the end, not a new
complete-suite pass.

#### Original assessment — 2026-09-27 (historical)

The architecture is a good starting point, but the repository does not yet meet
its intended contract: **a reproducible container whose successful validation
means the development environment is ready**.

The image builds, the non-root development session works, Docker-in-Docker runs
workloads, and the persistent pnpm store supports an offline reinstall. However,
normal startup validation fails, some checks give false reassurance, one status
check writes a lockfile, and several dependencies remain outside the intended
reproducibility boundary.

The most important next step is to make the readiness contract accurate and
side-effect-free. Do not add automatic repair on top of the current checks yet.

| Area                         | State                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Image construction           | Works on the tested Linux amd64 host                                                         |
| Creation/setup               | Works in the isolated working-tree copy                                                      |
| Startup readiness            | Fails; reproduced on first start and restart                                                 |
| Docker and Compose usability | Working, despite version-validation failures                                                 |
| Dependency caching           | Offline reinstall passed: 537 packages reused, zero downloaded                               |
| Reproducibility              | Partial: strong pins in several layers, floating inputs elsewhere                            |
| Drift detection              | Useful but incomplete; some false passes and one package-version false alarm                 |
| Read-only diagnosis          | Not achieved                                                                                 |
| Fresh-checkout consistency   | Broken for two required, ignored configuration files                                         |
| Security                     | Useful hardening, but privileged DinD remains a host trust boundary; image scan needs triage |
| Automated updates            | Fragmented; the current updater refreshes Features, not the complete environment             |
| Self-correction              | A partial repair script exists; not yet a reliable reconciliation mechanism                  |

Mise's **task definitions are orchestration**, not an additional readiness
requirement. This report does not propose validating task names or their
existence as proof that the container is healthy. Mise's installed executable,
tool versions, configuration, trust, and lockfile are actual toolchain inputs
and remain in scope.

#### Isolation, evidence, and limits

Before the new lifecycle tests, the working tree was copied into a separate
repository:

```text
/tmp/workflow-template-lifecycle-audit.xxmLyn
```

The original Git directory and installed node_modules were not reused. The copy
received its own Git repository, container, and named volumes. No personal Git
identity or credentials were intentionally forwarded. A synthetic identity was
configured only in the test repository after confirming the missing-identity
failure.

The test scripts and logs remain in that directory:

- `audit-start.sh` / `audit-start.log`: full initial lifecycle.
- `audit-checks.mjs` / `audit-results.json`: status and deliberate-drift matrix.
- `audit-final-tests.mjs` / `audit-final-results.json`: Compose, offline
  install, policy, lockfile mutation, and restart.
- `audit-boundaries.mjs`: missing configurations, broken Husky runner,
  formatting boundaries, and traced mise drift.
- `audit-*.log`: individual command output.
- `audit-trivy.json`: image vulnerability/secret scan.

The earlier no-cache smoke-test table is preserved in [AGENTS.md](AGENTS.md).
The new build reused cached image layers; it is not a second independent
no-cache reproducibility proof. The audit container image was:

```text
sha256:0c8f496927b23680584eeedef6c1b759f6a2a425fb154cfac24696fed0fbf687
```

The test workspace deliberately included local ignored configuration files,
matching the user's current working tree. A separate missing-file simulation and
Git tracking inspection exposed where that differs from a fresh checkout. This
was not an end-to-end fresh-clone CI run.

Not executed: native arm64 lifecycle, Windows/macOS hosts, VS Code attachment,
Codespaces, registry publication, OIDC signing, or GitHub-hosted workflows. The
report distinguishes reproduced failures from static findings. Reading every
in-scope source file is not a proof of every possible runtime path. The broad
historical Git/utility test claims were not assumed to substitute for evidence
from this run.

##### New test results

| Test                                               | Result                                      | Interpretation                                                                                      |
| -------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Frozen Feature resolution and image creation       | Passed                                      | Configuration can create a container                                                                |
| postCreate setup and dependency installation       | Passed                                      | Fresh copied workspace initialized                                                                  |
| postStart                                          | Failed                                      | Missing dictionary config, Docker version comparison, Buildx drift, and initially Git identity      |
| Remote user / workspace ownership                  | Passed                                      | UID/GID 1000; development commands ran as nlobby4                                                   |
| PID 1                                              | Passed                                      | docker-init present                                                                                 |
| Non-interactive sudo                               | Denied as intended                          | No passwordless sudo for the development user                                                       |
| Host Docker socket                                 | Not mounted                                 | No docker-host.sock; nested daemon was used                                                         |
| Seven explicit Debian package versions             | Passed                                      | dpkg-query matched versions.env for curl, git-lfs, jq, python3-venv, yq, gawk, cmark-gfm            |
| mise / Node / pnpm                                 | Passed baseline                             | 2026.9.1 / 24.15.0 / 10.20.0                                                                        |
| mise install metadata                              | Passed baseline                             | All 16 configured tools reported installed and active in the system installation                    |
| Docker daemon/client                               | Operational, status failed                  | Both report 29.6.0-1; validator expects 29.6.0                                                      |
| Buildx                                             | Real drift detected                         | Executable 0.37.1; configured package pin 0.37.0                                                    |
| Compose workload                                   | Passed                                      | hello-world container exited 0; test network/container removed                                      |
| Git with absent identity                           | Failed as intended                          | Fresh CLI environment has no implicit personal Git identity                                         |
| Git with synthetic identity                        | Passed                                      | No origin and disabled signing remain advisory                                                      |
| Workspace status                                   | Passed                                      | Debian 12, amd64, container detected                                                                |
| Offline clean node_modules reinstall               | Passed                                      | 537 packages reused; dependency status passed afterward                                             |
| Stop and restart                                   | Runtime passed; lifecycle failed            | dockerd and store recovered; health still failed                                                    |
| Missing eslint executable                          | False pass                                  | node-status still reported dependencies installed                                                   |
| Missing Husky shared runner .husky/_/h             | False pass                                  | git-status reported active hooks; actual hook execution failed                                      |
| Modified mise Node version                         | Failed, poor diagnostic                     | Missing tool/drift rows were built, but formatting invoked the Node shim and attempted installation |
| Replaced Node artifact checksum in mise.lock       | Passed                                      | Current dry-run check measures version-entry drift, not artifact or installed-file integrity        |
| Extra pnpm-lock.yaml newline                       | Check passed and rewrote file               | Before/after SHA-256 differed                                                                       |
| Corrupt LFS smudge with existing clean filter      | Repair false success                        | repair exited 0 and left corruption; LFS validation subsequently failed                             |
| Duplicate versions.env key                         | Accepted                                    | Input validator silently keeps the last value                                                       |
| Empty Feature lock in input validator              | Accepted                                    | That validator does not validate Feature lock contents                                              |
| Empty devcontainer/lock object in Conftest         | False pass                                  | Six policy rules reported passed                                                                    |
| Missing ignored Hadolint/Gitleaks configs          | Failed as predicted                         | Both commands exit 1 in a fresh-checkout-like configuration                                         |
| Hadolint with local config                         | Passed                                      | Informational finding in valid fixture only                                                         |
| ShellCheck with repository configuration           | Failed                                      | Includes SC2312/SC2310 error-propagation warnings and style findings                                |
| Schema validation                                  | Passed but no meaningful container coverage | Zero local schemas/config pairs validated; eight external references skipped                        |
| Existing policy fixtures                           | Passed                                      | Current positive/negative fixtures do not cover missing-field cases                                 |
| Markdown rule tests                                | Passed                                      | Two existing tests                                                                                  |
| CJK character in format-lines width 1 with padding | Failed                                      | RangeError from negative repeat count                                                               |
| Box title wider than terminal                      | Fails explicitly                            | A 12-column width rejects the workspace-status title rather than printing a fallback                |

The new test did not rerun the repository smoke script past its first failure.
Later runtime phases were exercised independently so that failed readiness did
not hide whether Docker, restart, or the pnpm store actually worked.

#### Lifecycle and ownership map

```text
Host Docker + Dev Containers CLI
  -> devcontainer.json + Feature lock
  -> Dockerfile:
       pinned base -> Debian snapshot/packages -> verified mise bootstrap
       -> copied mise configuration/lock -> system tool installation
  -> Docker-in-Docker Feature:
       engine/plugins -> privileged daemon entrypoint -> persistent daemon volumes
  -> container + workspace bind + pnpm volume + UID adjustment
  -> postCreate:
       trust -> frozen pnpm install -> setup -> repair -> tool checks
  -> postStart:
       wait for Docker -> health
         -> dictionary / attributes / LFS checks
         -> info
              -> one shared Git fetch
              -> parallel docker / git / mise / node / workspace status
              -> ordered boxes and aggregate failure
  -> stop:
       preserve named volumes
  -> restart:
       daemon entrypoint and postStart again, not normal postCreate setup
```

Mise tasks and package scripts route into this graph; they do not establish
readiness by themselves.

| State                           | Owner                                       | Persistence / consequence                                             |
| ------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Base image and Dockerfile       | Repository, image build                     | Rebuild needed after changes                                          |
| Feature implementation          | devcontainer-lock.json                      | Locks Feature code, not all network artifacts fetched by it           |
| Direct Debian pins and snapshot | versions.env                                | Installed at build; not checked by current startup status             |
| Bootstrap mise bytes            | checksums.sha256 + versions.env             | SHA-256 checked during image build                                    |
| Tool versions/artifacts         | mise.toml + mise.lock                       | System installation; user shims can select another runtime later      |
| Root JS dependencies            | package.json + pnpm-lock.yaml               | Installed into bind-mounted workspace; not baked into image           |
| pnpm downloads                  | Dedicated named volume                      | Survive rebuild/restart; active store is configured through remoteEnv |
| Nested images/containers        | DinD Docker/containerd volumes              | Survive restart and can contain valuable local state                  |
| Git configuration/hooks         | Workspace .git and .husky/_                 | setup/repair mutate workspace state                                   |
| Personal identity/signing       | Developer                                   | Must not be invented or automatically repaired                        |
| Status output                   | validation scripts and formatting utilities | Human-readable result and process exit status                         |
| Update automation               | Currently several separate mechanisms       | No single complete update transaction                                 |

The development command user is non-root, but the container itself has a root
daemon entrypoint and privileged mode. Those are different properties. Also,
remoteEnv is applied by the Dev Containers lifecycle/exec tooling; a bare
host-side docker exec does not automatically reproduce that environment.

#### Original findings and recommended changes (historical)

Priorities below mean: P1 blocks the stated readiness/reproducibility/security
goal; P2 is a robustness or maintenance gap; P3 is a useful simplification. They
are not vulnerability severity ratings.

##### P1: Docker pins do not describe the installed executables

Files: .devcontainer/devcontainer.json:32-38 and
scripts/linux/commands/repository/validation/docker-status.sh:103-134.

The locked Feature installs the pinned moby-buildx package, then its
installDockerBuildx branch resolves the latest upstream Buildx and replaces the
executable at /usr/libexec/docker/cli-plugins/docker-buildx. The audited Feature
installer explicitly assigns buildx_version="latest". Observed package version:
0.37.0-debian12u1; observed executable: 0.37.1. That download branch does not
verify a repository-pinned checksum.

Recommendation: use one Buildx installation source. For the current Moby
Feature, disabling the separate installDockerBuildx download and retaining the
pinned Moby package is the most direct candidate; verify both architectures
before adopting it.

The engine version comparison has a different problem: 29.6.0-1 is the packaged
runtime version, while the configured upstream version is 29.6.0. Define and
test the allowed package suffix explicitly, or pin/check the exact package and
executable versions separately. Do not blindly remove arbitrary suffixes and
accidentally accept prereleases or unrelated builds.

Compose uses the moving v2 selector. The resulting CLI reports 2.40.3, while the
installed moby-compose package reports 5.5.1-debian12u1: there are two
installation paths here too. Pin the intended Compose executable, avoid
redundant installation, and check its exact expected version.

##### P1: The apparent Dockerfile frontend pin is inactive

File: .devcontainer/Dockerfile:36.

The syntax directive follows ordinary comments and a blank line. Docker stops
looking for parser directives at that point. The generated
Dockerfile-with-features also retained it below preceding content. Move it to
the first line and add a regression check that the desired frontend is actually
resolved.
[Docker parser directive rules](https://docs.docker.com/reference/dockerfile/#parser-directives).

##### P1: Successful status is not yet a reliable readiness guarantee

- Node status compares package metadata/lockfiles, not required installed
  commands. Removing node_modules/.bin/eslint still passes.
- Git status checks the repository hooks and generated hook entrypoints but not
  their shared Husky runner. Removing .husky/_/h still passes.
- mise status checks installed-version metadata and dry-run version entries, not
  all executable behavior or installed-file integrity.
- No startup check compares the running image's system-package/input manifest
  against current workspace inputs. Changing Dockerfile, base digest, snapshot,
  bootstrap checksum, or Feature implementation can require a rebuild without
  being comprehensively reported.
- Workspace status supplies context, not proof of sufficient disk space,
  workspace/store writability, or a supported complete host environment.
- Docker context/endpoint are displayed, but not enforced as the intended nested
  daemon. Local dockerd detection alone does not prove the queried daemon is
  that process.

Recommendation: define a small explicit environment contract. Validate the
required executables, their selected paths/versions, essential package imports,
actual Husky support files, writable workspace/store, and build-input
fingerprint. A successful check need not hash every installed byte on every
start. State precisely which kind of drift it covers.

##### P1: Diagnosis currently performs changes and can install tools

File: scripts/node/bin/node-status.js:211-215.

The pnpm install --lockfile-only --frozen-lockfile --ignore-scripts probe
rewrote a lockfile with an extra newline. The exact test hashes were:

```text
before 0f8c630ef281a38a4610d57ff97e55f78e82155ec2c6c0597e9395ae8767ab59
after  b58d4b4a1f12785037837ae0313d3e253df5909de3172bd23fd6c5c78e22db24
```

Run resolution/consistency probes against copied manifests and lockfiles in a
temporary workspace, or use a pinned-version-supported read-only API. Do not
assume options documented for newer pnpm releases exist in 10.20.0. The current
documentation explicitly describes lockfile-only as a write operation.
[pnpm install options](https://pnpm.io/cli/install#--lockfile-only).

Separately, status_print -> visible_width -> node executes a mise shim. With
Node changed to unavailable 24.15.1, the mise check prepared failure rows, but
rendering tried to install Node and failed with a download error instead of
displaying them. MISE_SAFE is applied only to the mise lock probe, not to the
later Node invocation.

Recommendation: preserve simple Bash/plain-text diagnostic output when Node or
formatting packages are unavailable. Keep automatic installation out of status
commands. The normal rich renderer can remain.

Git freshness is an intentional exception today: info performs a bounded fetch
--prune and writes remote-tracking refs/FETCH_HEAD. Document that side effect,
or make refreshing explicit and let readiness consume the result. Do not
describe the entire current info command as read-only.

##### P1: Startup cannot currently pass in the copied environment

health.sh:50-54 requires dict.sh, which requires the currently deleted
.cspell.json. This is a real wiring failure, not a Docker failure. Either
restore the intended dictionary configuration or deliberately revise that
quality-check contract. Do not silently skip required checks to obtain a green
startup.

Git identity also needs an explicit provisioning story for CLI/CI use. The
validator correctly fails on absent name/email; the smoke fixture should set a
synthetic local identity, while human developers supply their own. Disabled
signing and missing origin are advisory today, not failures.

Consider distinguishing "environment ready" from "repository content passes
quality checks". health currently mixes both. Keep the requested health task
coverage, but make those two outcomes distinguishable.

##### P1: Fresh-checkout inputs are incomplete

.hadolint.yaml and .gitleaks.toml exist locally but are untracked and matched by
the deny-by-default .gitignore rule. Commands explicitly require them. Both
failed when the files were temporarily hidden in the external copy.

Add deliberate tracking exceptions and commit the required files as part of the
eventual fix. Add a clean-checkout test, not only a tar copy of a developer
working directory. Preserve a separate working-tree smoke mode when testing
uncommitted changes.

##### P1: Smoke testing leaks resources and contains a guaranteed later failure

File: scripts/linux/commands/tests/devcontainer-smoke.sh.

Container/image/volume discovery occurs only after devcontainer up succeeds. A
postStart failure exits earlier under set -e, leaving cleanup with empty
resource identifiers. This explains the historical leak recorded in AGENTS.md.
Discover label-scoped test resources in cleanup even after partial startup, and
record both generated image tags rather than only the final UID image.

The pnpm volume assertion hardcodes workflow-template-pnpm-v10-store, but
devcontainer.json derives its prefix from localWorkspaceFolderBasename. The
smoke workspace has a generated basename, so the assertion will reject the
volume after the earlier startup failures are fixed. Derive expected identity
from the exact test workspace/config, and assert mount destination, writability,
and isolation rather than a stale project name.

Preserve failing logs before deleting the disposable workspace. Add tests for
partial creation, postCreate failure, postStart failure, interruption, and
cleanup failure.

##### P1: Image scan does not meet the configured vulnerability threshold

Trivy 0.69.3 scanned the actual isolated image with the repository's empty
exception file and HIGH/CRITICAL filtering. It reported:

| Class                                     | Finding occurrences |
| ----------------------------------------- | ------------------: |
| HIGH                                      |                 709 |
| CRITICAL                                  |                  28 |
| Distinct vulnerability IDs                |                 389 |
| Occurrences with a reported fixed version |                 301 |
| Detected secrets                          |                   0 |

These are scanner-reported package occurrences, not 737 independently
exploitable vulnerabilities. The same ID can occur in multiple packages or
binaries. Reachability and Debian/vendor applicability need triage. Zero
detected secrets is not proof that no secret exists.

The report includes 432 OS-package occurrences plus findings in Node/Python
packages and bundled Go tools. The scan covers the image, not bind-mounted
repository node_modules. The collection command used Trivy's default exit
behavior; a zero command exit here means scanning completed, not that the image
met the repository's --exit-code 1 vulnerability gate.

Recommendation: triage the saved JSON; refresh the base/snapshot/toolchain in
reviewed update batches; keep exceptions narrow, justified, and expiring. Do not
suppress all findings merely because the repository code is trusted.

##### P2: Pinning remains incomplete outside the Debian snapshot

The Dockerfile correctly removes inherited APT sources before adding dated
Debian sources. However, the Feature later adds a separate rolling Moby
repository. Its additional dependency/plugin selections are not all fixed by
versions.env or the Feature lock.

mise.lock contains 16 tool records. Thirteen have artifact records with
checksums for both target Linux architectures. The npm pnpm, npm Dev Containers
CLI, and pipx yamllint records contain version/backend/specifier information,
but no artifact checksum records. Top-level version pins do not by themselves
freeze all npm/Python transitive dependency resolution.

The root pnpm lock is stronger for its own scope: all 622 package-resolution
records carry integrity fields; it has one importer and 624 snapshots. It does
not lock the separate mise npm/pipx installations.

Choose the desired reproducibility level explicitly:

1. Repeatable declared tool versions.
2. Repeatable complete installed dependency graph/artifacts.
3. Bit-for-bit identical image builds.

The current implementation only partially achieves level 1 and does not
establish levels 2 or 3. Byte-identical images require additional timestamp,
builder, metadata, and repository-availability controls beyond version pins.
Prefer an immutable, tested prebuilt image digest for consumption; retain the
source recipe and reviewed update path.

##### P2: Input/policy validation has missing coverage

validate-devcontainer-inputs.js validates version/checksum text structure, not
the complete devcontainer contract. Duplicate version keys pass because
Object.fromEntries keeps the last one. Values are only constrained to
non-whitespace strings although the Dockerfile sources the file as shell. With
trusted source this is not a new attacker boundary, but data validation should
reject duplicates and enforce per-field formats.

Conftest accepted {"devcontainer":{},"lock":{"features":{}}}. Rules comparing
absent properties can become undefined rather than deny. The positive fixture
also accepts a short illustrative digest sha256:abc. Require object types,
required fields, exact digest shape, expected Feature membership, and correct
lock consistency before checking individual values.

The schema runner is genuinely used; Rego is not a replacement for schemas. It
validated zero local pairs in this test and skipped external references. Use the
already installed Ajv with a vendored/pinned devcontainer schema plus
Feature-specific validation. Keep structural validation separate from repository
policy. Add missing/null/wrong-type/duplicate/stale-lock fixtures.

The mise dry-run checksum mutation passing is not evidence that mise install
ignores checksums: it proves only that this status probe does not check them.
Retain its accurate "version entries" wording and add distinct build-input drift
detection rather than overstating its guarantee.

##### P2: Repair is not yet a dependable future self-correction layer

repair.sh:62 checks only whether filter.lfs.clean exists. A wrong smudge,
process, or required value can remain unrepaired while success is printed. Use
the existing complete LFS configuration validator as a postcondition.

Other repair limitations:

- LFS download/checkout and Husky failures can end with overall success.
- setup duplicates Git configuration already owned by repair.
- Store ownership repair runs after the task's pnpm installation.
- It can invoke interactive sudo although the image intentionally denies
  passwordless sudo.
- Its PNPM_STORE_DIR lookup differs from the configured NPM_CONFIG_STORE_DIR.
- Creating cache directories does not demonstrate they are writable.

Repair should report repaired / already-correct / failed / manual-action results
and return failure if required postconditions remain unmet. Do not silently
repair identity, signing, Git branches, dependency versions, or checksums.

##### P2: Some "bounded" behavior and error propagation are incomplete

init.sh retries 30 times but docker version itself has no timeout. The message
promises 30 seconds without enforcing that deadline. Some setup version commands
are embedded in successful logging calls, masking their exit status.
Process-substitution discovery can similarly hide find/Git failures. ShellCheck
identified these classes under the enabled optional rules.

info captures both stdout and stderr, preserves emitted ANSI, runs checks in
parallel, renders in stable order, and propagates failing checks correctly when
rendering works. These are strengths. However:

- A renderer failure under set -e can prevent later results being displayed.
- Cleanup signals child shell PIDs, not necessarily their descendant process
  groups; an outer per-check deadline/cancellation policy would be clearer.
- There is no whole-health deadline; dictionary/content checks can be costly.
- narrow terminals or missing rendering dependencies need plain output fallback
  so diagnostics survive presentation failures.

The public format-lines helper crashes for a width-2 character at width 1 with
--pad. Handle over-width graphemes explicitly; merely clamping negative padding
avoids the exception but does not define how to honor the width. Streaming is
per logical line, so one enormous newline-free log record is still buffered.
strip-ansi intentionally reads its entire input.

##### P2: CI is promising, but its coverage and artifact identity need tightening

- The devcontainer PR path filter excludes terminal/node-status JS helpers,
  pnpm-workspace.yaml, hooks, and several policy/configuration inputs that
  affect readiness. Include the full dependency closure or remove the narrow
  filter if the cost is acceptable.
- setup-node-deps installs a selected tool subset. Source-image and publish jobs
  call devcontainer directly but do not request npm:@devcontainers/cli in that
  subset. Explicitly install it rather than rely on caches, preinstalled
  executables, or shim auto-install behavior. This is a static wiring risk, not
  a reproduced GitHub-run failure.
- Native smoke builds and the published image are separate builds. With floating
  inputs, the image scanned/published need not be the one whose lifecycle
  passed. Test the exact candidate digests before promotion.
- The published-image verification script checks version commands but does not
  repeat the full mounted-workspace lifecycle or Docker daemon behavior.
- Promotion precedes signing and final verification. Prefer build -> test ->
  scan -> attest/sign -> verify -> promote.
- Image verification equates mise.toml min_version with the exact bootstrap
  version, although those are different concepts. Read versions.env for the
  bootstrap assertion.
- The shared pnpm cache key contains runner.os but not runner.arch. Include
  architecture for clearer native-artifact isolation; no cache corruption was
  demonstrated here.
- General audit uses pnpm audit --prod, while root tooling is all in
  devDependencies. Include the existing audit:dev path in the tooling security
  policy if these dependencies are intended to be covered.
- The scan script exits at the vulnerability gate before generating its SBOM.
  Produce diagnostic artifacts even on failure, while preserving the failing
  exit status and blocking promotion.

Actions are generally SHA-pinned, checkout credentials are deliberately not
persisted in important build paths, and publish permissions are separated. Those
are good choices. Publication, actual signature interoperability, and OIDC
identity verification remain untested in this local audit.

##### P2/P3: Maintenance and documentation gaps

The updater only performs devcontainer upgrade and validates version/checksum
input formatting. It does not update base/frontend digests, Debian snapshot
package pins, bootstrap checksums, mise tools/lock, pnpm packages/lock, or CI
bootstrap versions as one coherent unit.

Normal up/rebuild package commands omit --frozen-lockfile while the smoke and
build paths use it. Apply a consistent consumption policy and keep mutation in
the explicit update path.

README.md still contains an obsolete "nlobby4 doctor" command and an unpinned
global CLI install example beside the mise-managed path. README-devcontainer
contains claims/checklists that should be reconciled with the actual failures,
Compose configuration, available automation, and configured host requirements.

devcontainer-clear removes every named volume attached to the matching
container, not just disposable caches. Currently that includes all nested
Docker/containerd data. Label/select owned volumes explicitly, offer a preview,
and describe the destructive scope. It should never become automatic repair.

#### Security under the trusted-code assumption

Good existing controls:

- Minimal allowlisted build context, with the repository mounted only at
  runtime.
- Pinned base/Feature code and verified mise bootstrap.
- Non-root development commands; inherited passwordless sudo removed.
- No host Docker socket mount; independent DinD daemon storage.
- Frozen root package installation with lifecycle scripts disabled, followed by
  explicit Husky setup.
- Bounded Git network calls, disabled interactive credential prompts, and masked
  displayed remote credentials/email.
- Temporary output directories, quoted paths, array-based command arguments, and
  explicit error aggregation in much of the validation layer.
- Image scanning, policy tooling, and planned digest-based signatures.

The remaining boundary is important: privileged DinD plus access to its daemon
is not a sandbox against hostile code or a compromised dependency. The workspace
is writable and the development user can control nested containers. Removing
sudo does not neutralize that authority.

For trusted work, keeping DinD can be reasonable if Docker workloads are a real
requirement. Use a disposable host/VM where stronger isolation is needed, avoid
unnecessary credential forwarding and extra host mounts, maintain the
host/container runtime, and keep data-bearing volumes out of automatic cleanup.
Do not claim the environment is "secure" solely because readiness passes.

#### Recommended target design and update workflow

Keep three responsibilities distinct:

| Responsibility | Allowed behavior                                                                      |
| -------------- | ------------------------------------------------------------------------------------- |
| Validate       | Observe versions, paths, configuration, required capabilities; return useful failures |
| Repair         | Explicitly restore safe local state to the committed contract; verify postconditions  |
| Update         | Deliberately change the committed contract and lockfiles through a reviewed change    |

At build time, record a manifest/fingerprint of actual build inputs and
installed system/tool versions under /usr/local/share/devcontainer. At startup,
compare relevant current workspace inputs with that manifest and report "rebuild
required" when appropriate. Do not include mise task bodies as additional
readiness requirements; separate toolchain-affecting inputs from
orchestration-only edits.

An eventual update command should:

1. Work in an explicit branch or temporary worktree, preserving user changes.
2. Refresh selected dependencies, not silently everything.
3. Update coupled values together: mise bootstrap/checksums/CI bootstrap; pnpm
   tool pin/packageManager/lock; snapshot/direct package versions; Feature
   version/options/Feature lock.
4. Generate locks with the supported pinned tooling, including linux-x64 and
   linux-arm64 entries where supported.
5. Validate input structure/policy and inspect the diff.
6. Run clean native builds, lifecycle readiness, restart, offline reinstall,
   deliberate-drift tests, and scans.
7. Publish a reviewable report/PR; do not silently accept replacement artifacts
   after a checksum mismatch.

Until that exists, the current operations remain separate:

| Change             | Current source of truth                | Necessary follow-up                                               |
| ------------------ | -------------------------------------- | ----------------------------------------------------------------- |
| Base/frontend      | Dockerfile tag and digest              | Review digest provenance; rebuild both platforms                  |
| Feature            | devcontainer.json                      | devcontainer upgrade, review lock and options                     |
| Debian packages    | versions.env snapshot + exact versions | Resolve against chosen snapshot; build and scan                   |
| mise bootstrap     | versions.env + checksums.sha256        | Obtain verified assets for both architectures; align CI bootstrap |
| mise-managed tools | mise.toml                              | mise lock, review lock diff, locked installation/rebuild          |
| pnpm packages      | package manifests/workspace config     | pnpm install in update context; review pnpm-lock.yaml             |
| pnpm itself        | mise.toml and packageManager           | Align both, refresh lock/install behavior tests                   |

Do not regenerate locks during ordinary image builds to make drift disappear.
The build should consume the reviewed contract and fail when it cannot. The host
mise dependency remains consistent with the chosen workflow.

##### Existing tools worth using

| Tool                           | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renovate                       | Strong candidate for coordinated mise, npm, Docker, Feature, and Actions update PRs. Its mise manager supports lockfile updates; configure the execution trust policy deliberately. Bootstrap checksums/snapshot packages still need a reviewed updater, not blind textual replacement. [mise manager](https://docs.renovatebot.com/modules/manager/mise/), [devcontainer manager](https://docs.renovatebot.com/modules/manager/devcontainer/) |
| Existing Dev Containers CLI    | Keep frozen consumption and use complete config resolution in tests; no new lifecycle framework is required.                                                                                                                                                                                                                                                                                                                                   |
| Existing Ajv + Conftest        | Add pinned structural schemas and missing-field policy fixtures. They cover different failure classes.                                                                                                                                                                                                                                                                                                                                         |
| Existing ShellCheck + Hadolint | Fix the reported propagation issues and track their configs; adding another linter is not the immediate need.                                                                                                                                                                                                                                                                                                                                  |
| Existing Trivy                 | Keep digest-scoped scans and SBOM output; triage findings and include developer dependencies where appropriate.                                                                                                                                                                                                                                                                                                                                |
| container-structure-test       | Optional declarative image checks for files, commands, and metadata; useful for consolidating duplicated static image assertions, but not a replacement for the Dev Containers lifecycle test. [Official project](https://github.com/GoogleContainerTools/container-structure-test)                                                                                                                                                            |

Choose one update-bot owner per dependency ecosystem rather than have Dependabot
and Renovate open competing PRs. The smallest useful next step is better use of
tools already present, not another orchestration layer.

#### Implementation order

1. Fix Docker/Buildx/Compose contract, missing required configs, and smoke
   fixture identity/resource discovery/volume assertion.
2. Make status non-mutating and presentation-failure-tolerant; test missing
   binaries/Husky support files and explicit failure exit codes.
3. Add structural schema/policy coverage and a source-to-image drift manifest.
4. Reconcile remaining unpinned installs and triage the image scan.
5. Make repair postcondition-driven, non-interactive, and narrowly scoped.
6. Connect coordinated update PRs to native, exact-artifact lifecycle tests.

None of these proposed fixes was applied during the original audit. Subsequent
implementation is recorded in the dated follow-ups and current status above.

#### Consolidated line-responsibility map

This is the original audit's historical, line-oriented map. Several paths and
responsibilities have since changed, including the utilities split, retired
publication scripts and removed domain-specific filters. It is not a map of the
current tree. Adjacent lines with one responsibility are consolidated; line
numbers refer to the audited source, not this report. Headers, comments, blank
lines, braces, and continuations belong to their enclosing block. Generated lock
records are mapped by their schema and sections rather than repeating thousands
of dependency entries. Vendor dependencies, image layers, Git objects, caches,
and unrelated project content are not treated as repository source files.

##### Container specification and build inputs

| File / lines                             | Responsibility and relationship                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| .devcontainer/devcontainer.json:1-8      | Select Dockerfile, root build context, and the build-time username                                                                                                             |
| devcontainer.json:9-30                   | Install editor extensions; editor UX dependencies, not runtime readiness checks                                                                                                |
| devcontainer.json:31-40                  | Select exact DinD Feature release and engine/plugin installation options; these options currently conflict over Buildx ownership                                               |
| devcontainer.json:41                     | Request an init process for process reaping/signal handling                                                                                                                    |
| devcontainer.json:42-48                  | Define per-workspace/per-container persistent pnpm-store volume                                                                                                                |
| devcontainer.json:49                     | Human-readable display name                                                                                                                                                    |
| devcontainer.json:50                     | Trust workspace mise config and run creation/setup orchestration                                                                                                               |
| devcontainer.json:51                     | Run startup orchestration on each start                                                                                                                                        |
| devcontainer.json:52-54                  | Configure pnpm store for remote commands                                                                                                                                       |
| devcontainer.json:55                     | Select the non-root development user                                                                                                                                           |
| devcontainer.json:56                     | Stop the container on client shutdown; do not delete its volumes                                                                                                               |
| devcontainer.json:57                     | Adjust remote UID for host workspace ownership                                                                                                                                 |
| devcontainer.json:58-59                  | Set the attachment wait point to postCreate; editor attachment is not synonymous with successful postStart validation                                                          |
| .devcontainer/Dockerfile:1-35            | Explain intended build/toolchain model; ordinary comments precede the misplaced parser directive                                                                               |
| Dockerfile:36-44                         | Intended frontend pin and immutable base-image index reference                                                                                                                 |
| Dockerfile:45-56                         | Architecture/user build arguments, Bash pipefail shell, user/system mise shim search order                                                                                     |
| Dockerfile:57-82                         | Copy canonical versions, remove inherited APT sources, write Debian and security snapshot sources; signed metadata retained, expiry checking disabled for historical snapshots |
| Dockerfile:83-92                         | Rename vscode user/group, remove sudo membership/policy, provision owned cache/store parent directories                                                                        |
| Dockerfile:93-106                        | Install seven exact direct package versions and clean package lists                                                                                                            |
| Dockerfile:107-120                       | Document mise ownership/bootstrap; copy checksum manifest                                                                                                                      |
| Dockerfile:121-138                       | Map amd64/arm64 to release asset, download with retry/time limits, select checksum, verify, install system mise, remove download                                               |
| Dockerfile:139-142                       | Copy toolchain configuration and lock into system-owned image location                                                                                                         |
| Dockerfile:143-164                       | Map target platform, trust build config, reject reported version-entry drift, install locked system tools, make system tree readable/executable and not generally writable     |
| .devcontainer/versions.env:1-7           | Define purpose of shell-compatible build data                                                                                                                                  |
| versions.env:8                           | Debian snapshot timestamp                                                                                                                                                      |
| versions.env:9-15                        | cmark-gfm, curl, gawk, Git LFS, Python venv, jq, and yq exact Debian versions                                                                                                  |
| versions.env:16                          | Bootstrap mise version, distinct from tool versions managed by mise                                                                                                            |
| .devcontainer/checksums.sha256:1-10      | Explain checksum format and bootstrap scope                                                                                                                                    |
| checksums.sha256:11-12                   | Expected SHA-256 of the Linux x64 and arm64 mise executables                                                                                                                   |
| .devcontainer/devcontainer-lock.json:1-9 | Feature key, resolved OCI digest, integrity, and dependency metadata; does not freeze arbitrary downloads inside the Feature installer                                         |
| .dockerignore:1-23                       | Explain deny-by-default build context                                                                                                                                          |
| .dockerignore:24-34                      | Exclude everything, allow directory traversal, include only versions/checksums/mise config/lock needed by COPY                                                                 |

The installed jq is Debian jq 1.6, not a separately downloaded binary. The yq
package is Debian's Python/jq-oriented yq, not the differently implemented Go yq
CLI. They must not be assumed interchangeable.

##### Toolchain and package manifests

| File / lines             | Responsibility                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| mise.toml:1-11           | Comments, minimum supported mise version, lockfile setting                                                                                 |
| mise.toml:12-28          | Declare the 16 tool versions listed below                                                                                                  |
| mise.toml:29-142         | Thin task routing, including install-before-setup dependency; orchestration outside the readiness contract                                 |
| mise.lock:1-4            | Generated-file notice and lock format version                                                                                              |
| mise.lock:5-298          | act, actionlint, conftest, cosign, gitleaks, gum, hadolint backend/version/platform download records                                       |
| mise.lock:299-331        | Node backend/version/platform artifact records                                                                                             |
| mise.lock:332-341        | Dev Containers CLI and pnpm npm backend/version records without platform artifact checksums                                                |
| mise.lock:342-510        | pipx, ShellCheck, tombi, Trivy version and platform artifact records                                                                       |
| mise.lock:511-515        | yamllint pipx backend/version record without platform artifact checksums                                                                   |
| mise.lock:516-555        | zizmor version/platform records, including backend-specific provenance metadata                                                            |
| package.json:1-9         | Package identity, ESM mode, private workspace declaration                                                                                  |
| package.json:10-66       | Command routing and direct quality-tool invocations; prepare declares Husky, but frozen installation intentionally skips lifecycle scripts |
| package.json:67-87       | Staged-file format/lint/fix commands; these mutate files when hooks are invoked                                                            |
| package.json:88-92       | Commitizen adapter selection                                                                                                               |
| package.json:93-125      | Exact root development dependency versions, including renderer/parser libraries                                                            |
| package.json:126-131     | Canonical pnpm declaration and supported engine ranges                                                                                     |
| pnpm-workspace.yaml:1-6  | Workspace package glob, exact save preference, strict engine/peer checks                                                                   |
| pnpm-lock.yaml:1-6       | Lock format and resolution settings                                                                                                        |
| pnpm-lock.yaml:7-104     | Root importer linking declared dependencies to resolved versions                                                                           |
| pnpm-lock.yaml:105-2614  | 622 package metadata/resolution records; all have integrity fields                                                                         |
| pnpm-lock.yaml:2615-5183 | 624 dependency snapshots, including peer/optional/native variants                                                                          |

| Tool                   | Declared version | Purpose                                                            |
| ---------------------- | ---------------- | ------------------------------------------------------------------ |
| node                   | 24.15.0          | JS runtime, validation helpers, package tooling                    |
| npm:pnpm               | 10.20.0          | Repository package installation and script environment             |
| npm:@devcontainers/cli | 0.88.0           | Host/container lifecycle and image building                        |
| pipx                   | 1.17.6           | Isolated Python tool installation backend                          |
| shellcheck             | 0.11.0           | Shell diagnostics                                                  |
| trivy                  | 0.69.3           | Image vulnerability/secret scans and SBOMs                         |
| act                    | 0.2.89           | Optional local workflow execution                                  |
| actionlint             | 1.7.7            | Workflow syntax/semantic linting                                   |
| conftest               | 0.69.0           | Rego policy checks                                                 |
| cosign                 | 3.1.3            | Image signing and attestation verification                         |
| gitleaks               | 8.30.1           | Git history/staged secret scanning                                 |
| gum                    | 2.0.0            | Available optional CLI UX tooling; current renderer remains custom |
| hadolint               | 2.15.1           | Dockerfile linting                                                 |
| tombi                  | 1.5.2            | TOML validation                                                    |
| yamllint               | 1.38.0           | YAML linting, installed through pipx backend                       |
| zizmor                 | 1.26.1           | Workflow security analysis                                         |

##### Repository lifecycle commands

Paths in this table are under scripts/linux/commands/repository/.

| File / lines                 | Responsibility                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| setup.sh:1-44                | Declare interface, enable strict shell behavior, source helpers, require repository/Git/repair entrypoint                    |
| setup.sh:45-61               | Configure blame/template then invoke repair; duplicated configuration ownership                                              |
| setup.sh:62-77               | Ensure locked mise tools are installed; warns if mise/config absent                                                          |
| setup.sh:78-111              | Check selected command availability, log versions, announce completion                                                       |
| repair.sh:1-41               | Load helpers and required commands; require root worktree and Git LFS                                                        |
| repair.sh:42-55              | Set local blame-ignore and commit-template configuration                                                                     |
| repair.sh:56-94              | Initialize LFS filters if clean is absent; fetch/check out LFS objects when listed                                           |
| repair.sh:95-115             | Create caches and attempt pnpm-store ownership repair                                                                        |
| repair.sh:116-143            | Restore executable bits on script files and repository hooks; count results                                                  |
| repair.sh:144-161            | Reinstall Husky when available and announce repair completion                                                                |
| init.sh:1-17                 | Retry Docker readiness, then replace process with doctor orchestration; timeout claim currently stronger than implementation |
| health.sh:1-36               | Load validators/formatter and require repository/Bash                                                                        |
| health.sh:37-69              | Optional banner, separator, three-check list, display colors and aggregate status                                            |
| health.sh:70-94              | Run dictionary/attributes/LFS scripts separately; continue after failures                                                    |
| health.sh:95-101             | Invoke info readiness aggregation                                                                                            |
| health.sh:102-119            | Print overall result and return aggregate status                                                                             |
| info.sh:1-37                 | Resolve own location and load utilities; validate execution context                                                          |
| info.sh:38-47                | Refresh origin once and export result to child status processes                                                              |
| info.sh:48-72                | Discover validation scripts dynamically; select child color behavior based on final output stream                            |
| info.sh:73-91                | Define cleanup, allocate private temporary directory, install exit trap                                                      |
| info.sh:92-107               | Launch all status scripts, capturing stdout/stderr independently                                                             |
| info.sh:108-128              | Wait in filename order, color failed borders, render captured content, cleanup, return failure if any child failed           |
| devcontainer-update.sh:1-34  | Strict shell setup and prerequisites for explicit Feature update                                                             |
| devcontainer-update.sh:35-45 | Run Feature upgrade, require output lock, validate version/checksum manifest syntax                                          |
| devcontainer-clear.sh:1-52   | Require host context and derive workspace/cache targets                                                                      |
| devcontainer-clear.sh:53-83  | Discover label-matched containers and collect attached image/volume IDs                                                      |
| devcontainer-clear.sh:84-120 | Delete matched containers/volumes/images, clear/recreate caches; not routine validation                                      |

##### Readiness scripts

Paths are under scripts/linux/commands/repository/validation/.

| File / lines                | Responsibility                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| docker-status.sh:1-28       | Strict mode, imports, expected config location                                                                         |
| docker-status.sh:29-50      | Five-second Docker wrapper and local dockerd process detection                                                         |
| docker-status.sh:51-97      | Require inputs; extract unique DinD option values through prefix-match filter; validate expected version syntax        |
| docker-status.sh:98-147     | Query client/server data; compare versions; require local daemon; collect failed red values                            |
| docker-status.sh:148-164    | Display Docker context and effective/reported endpoint                                                                 |
| docker-status.sh:165-215    | Query/compare Buildx; validate current builder and all its node states                                                 |
| docker-status.sh:216-228    | Require some Compose version output; print rows and exit aggregate status                                              |
| git-status.sh:1-32          | Strict mode and imports                                                                                                |
| git-status.sh:33-75         | Mask displayed email and URL credentials/query fragments                                                               |
| git-status.sh:76-117        | Derive ahead/behind/diverged advisory branch text                                                                      |
| git-status.sh:118-130       | Require root worktree, capture branch/upstream, initialize status                                                      |
| git-status.sh:131-176       | Validate configured identity; report signing settings without verifying signing capability                             |
| git-status.sh:177-209       | Require configured local blame-ignore and commit-template files                                                        |
| git-status.sh:210-255       | Enumerate hooks, require hooksPath and executable repository/generated entrypoints                                     |
| git-status.sh:256-273       | Report detached checkout and masked origin                                                                             |
| git-status.sh:274-324       | Reuse shared fetch result or fetch standalone; discover remote default branch; report advisory freshness               |
| git-status.sh:325-337       | Compare current upstream when applicable; avoid duplicate branch row; print/exit                                       |
| mise-status.sh:1-42         | Constants/imports including metadata and lock timeouts                                                                 |
| mise-status.sh:43-62        | Bounded invocation wrappers                                                                                            |
| mise-status.sh:63-88        | Numeric dotted minimum-version comparison                                                                              |
| mise-status.sh:89-135       | Require inputs; prefer executable /usr/local/bin/mise; classify host/container source; read expected bootstrap version |
| mise-status.sh:136-197      | Read version/platform; exact container version versus minimum host version; report unavailable paths                   |
| mise-status.sh:198-264      | Verify workspace config selection and trust state                                                                      |
| mise-status.sh:265-291      | Inspect current missing-tool metadata and aggregate failure                                                            |
| mise-status.sh:292-328      | Bounded safe-mode lock dry-run; report version-entry drift; render and exit                                            |
| node-status.sh:1-40         | Imports, JS helper path, required jq/Node, status initialization                                                       |
| node-status.sh:41-92        | Optional origin refresh and upstream dependency-change advisory                                                        |
| node-status.sh:93-119       | Run JS metadata helper, validate JSON rows via jq, map ok=false to red/failed status                                   |
| node-status.sh:120-129      | Report missing package manifest; print rows and return aggregate health                                                |
| workspace-status.sh:1-38    | Imports and root/uname prerequisites                                                                                   |
| workspace-status.sh:39-51   | Detect Codespaces, editor devcontainer, generic container, or local shell                                              |
| workspace-status.sh:52-74   | Detect Windows-like kernels first; otherwise parse os-release or use kernel name                                       |
| workspace-status.sh:75-86   | Normalize aarch64/x86_64 architecture labels                                                                           |
| workspace-status.sh:87-118  | Gather context, propagate detection failures into red rows                                                             |
| workspace-status.sh:119-129 | Optional Codespace name; render and exit                                                                               |

The Git worktree requirement is deliberate for these repository commands. The
lower-level check_git_repo utility accepts initialized bare repositories; that
does not mean a full workspace-readiness command can run in one.

##### Shared Bash utilities and filters

Paths are under scripts/linux/utils/.

| File / lines                             | Responsibility                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| terminal.sh:1-22                         | Source-only and already-loaded guards                                                                                        |
| terminal.sh:23-45                        | Discover columns through tput using a real output TTY; return failure without one                                            |
| terminal.sh:46-59                        | Evaluate NO_COLOR, TERM, CI/GitHub Actions, stream TTY, and capture override                                                 |
| terminal.sh:60-62                        | Mark successful initialization                                                                                               |
| logging/logging.sh:1-31                  | Guards and terminal-helper import                                                                                            |
| logging/logging.sh:32-44                 | Public immutable color constants                                                                                             |
| logging/logging.sh:45-68                 | ASCII/Unicode labels and separate stdout/stderr color decisions                                                              |
| logging/logging.sh:69-76                 | printf-based public log functions and completion guard                                                                       |
| validation.sh:1-32                       | Guards/import logging; complete initialization only at end                                                                   |
| validation.sh:33-69                      | Command availability, required arguments, shell-variable-name checks                                                         |
| validation.sh:70-116                     | Canonical non-negative integer/range validation using length/lexical comparison, avoiding numeric overflow in the comparison |
| validation.sh:117-129                    | Nonempty single-line argument validation                                                                                     |
| validation.sh:130-189                    | Regular file, directory, existing path, symlink, and resolved-symlink checks                                                 |
| validation.sh:190-235                    | Repository detection, Git LFS executable and full local filter contract                                                      |
| validation.sh:236-257                    | Worktree-root check using filesystem identity; completion guard                                                              |
| functions.sh:1-35                        | Guards, validation import, fixed filter directories                                                                          |
| functions.sh:36-50                       | Canonical-count singular/plural selection                                                                                    |
| functions.sh:51-106                      | Named awk/jq filter execution; restricted names, required files, argument forwarding without eval                            |
| functions.sh:107-115                     | Timeout and non-interactive Git network environment                                                                          |
| functions.sh:116-144                     | Explicit/default remote refresh and prune; distinguish unavailable remote from operational failure                           |
| functions.sh:145-170                     | Query remote HEAD symbolic target; no assumed main/master fallback                                                           |
| functions.sh:171-216                     | Compare specified paths from merge-base to upstream; tri-state return and completed-load guard                               |
| logging/formatting.sh:1-35               | Guards, imports, resolve shared terminal-text CLI                                                                            |
| formatting.sh:36-42                      | Public stdin ANSI-stripping wrapper                                                                                          |
| formatting.sh:43-71                      | Require .ansi file; preserve authentic asset, strip color, or print supplied ASCII fallback                                  |
| formatting.sh:72-86                      | Width-aware Unicode/ASCII separator                                                                                          |
| formatting.sh:87-115                     | Batch visible-width lookup and result validation                                                                             |
| formatting.sh:116-142                    | Reset/add alternating status entries; optional value color                                                                   |
| formatting.sh:143-180                    | Measure labels once, align colons, print entries without wrapping                                                            |
| formatting.sh:181-220                    | Subshell box renderer: validate title/input/color, select terminal/fallback width, reject overlong title                     |
| formatting.sh:221-254                    | Choose rounded/ASCII borders and print colored top border                                                                    |
| formatting.sh:255-278                    | Stream formatted/padded lines through Node; print side/bottom borders and propagate renderer errors                          |
| formatting.sh:279-281                    | Completed-load marker                                                                                                        |
| filters/awk/env-value.awk:1-15           | Read one named assignment without executing it; preserve all equals signs after the first                                    |
| filters/awk/os-release.awk:1-14          | Extract PRETTY_NAME and remove simple enclosing double quotes; does not evaluate shell syntax                                |
| filters/jq/json-prefix-match.jq:1-56     | Validate structured path/prefix/field-list; require exactly one matching object entry; return requested fields               |
| filters/jq/docker-buildx-builder.jq:1-25 | Require one selected builder, valid name/nonempty nodes; return name and all-running flag                                    |
| filters/jq/status-rows.jq:1-29           | Require nonempty typed status rows and serialize label/value/boolean as TSV                                                  |
| ../resources/banner.ansi:1-5             | Decorative startup asset; not a readiness requirement                                                                        |

The dependency chain is terminal -> logging -> validation -> formatting and
functions, without a circular source dependency. Commands generally source via
their own file location, while repository data paths intentionally depend on
running from the checked workspace root.

##### Node helpers

Paths are under scripts/node/.

| File / lines                               | Responsibility                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| bin/node-status.js:1-49                    | Imports, known paths, safe regular-file/directory probes                                                                                |
| node-status.js:50-80                       | Read expected Node through mise config and pnpm through packageManager                                                                  |
| node-status.js:81-111                      | Bounded subprocess output/version helpers                                                                                               |
| node-status.js:112-177                     | Parse/validate manifest and construct runtime version rows                                                                              |
| node-status.js:178-210                     | Detect missing lock/modules                                                                                                             |
| node-status.js:211-246                     | Invoke pnpm lock-only consistency probe and classify failures                                                                           |
| node-status.js:247-284                     | Require installed lock, compare bytes, emit dependency result and JSON rows                                                             |
| bin/terminal-text.js:1-32                  | Imports and usage-error exit 64                                                                                                         |
| terminal-text.js:33-46                     | Whole-input ANSI stripping and argument-based width output                                                                              |
| terminal-text.js:47-69                     | Validate width/options; stream wrapped lines with optional padding/backpressure                                                         |
| terminal-text.js:70-85                     | Dispatch CLI subcommand                                                                                                                 |
| lib/terminal-lines.js:1-34                 | Terminal libraries, status-prefix pattern, CRLF normalization, ANSI removal, Unicode width                                              |
| terminal-lines.js:35-77                    | Hard wrapping with word preference; bounded hanging indentation for label/value or indented input                                       |
| terminal-lines.js:78-105                   | UTF-8 chunk-to-line processing with remainder handling                                                                                  |
| terminal-lines.js:106-112                  | Backpressure-aware newline output                                                                                                       |
| validate-devcontainer-inputs.js:1-41       | Read/check expected version assignments and timestamp syntax                                                                            |
| validate-devcontainer-inputs.js:42-69      | Check checksum row syntax, duplicate artifacts, expected/missing/stale filenames                                                        |
| validate-devcontainer-inputs.js:70-77      | Aggregate input errors and exit, or announce success                                                                                    |
| build-policy-input.js:1-12                 | Parse devcontainer/lock JSON and emit the combined object consumed by Rego                                                              |
| bin/validate-schemas.js:1-35               | Invoke reusable schema validation, print errors/counts, set process result                                                              |
| lib/schema-validator.js:1-140              | File discovery, data parsing, error rendering, AJV dialect selection                                                                    |
| schema-validator.js:141-294                | Schema identification, local reference/modeline resolution, validation-pair discovery, external-reference counting                      |
| schema-validator.js:295-375                | Compile/check local schemas and data, collect failures and result counts                                                                |
| markdownlint/github-html.mjs:1-107         | Load HTML allowlist; recursively inspect parsed elements/attributes/protocols; report source locations through custom Markdownlint rule |
| markdownlint/github-html-policy.json:1-156 | Allowed raw-HTML elements, global/element attributes, and URL protocol sets                                                             |
| markdownlint/github-html.test.js:1-64      | Minimal supported/unsupported HTML fixtures and diagnostic assertions                                                                   |

Hanging indentation is deliberately a formatting heuristic, not a structured
status protocol: a prefix must leave at least 16 columns and occupy at most
min(32, half the width); otherwise normal wrapping is used.

##### Quality tasks and ancillary commands

Paths below are under scripts/linux/commands/. For thin 15-line wrappers, lines
1-14 provide the interpreter, purpose, and strict mode; line 15 performs the
indicated operation. These remain task implementation, not mise-task readiness
checks.

| File / lines                        | Responsibility                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| tasks/check.sh:1-21                 | Sequential format, lint, test, unused-dependency, and production audit gates                                        |
| tasks/lint.sh:1-15                  | Sequential repository lint suite                                                                                    |
| tasks/format.sh:1-15                | Prettier write operation                                                                                            |
| tasks/format/check.sh:1-15          | Prettier non-writing check                                                                                          |
| tasks/deps/audit.sh:1-15            | High-severity production dependency audit                                                                           |
| tasks/deps/audit-dev.sh:1-15        | Development-dependency audit                                                                                        |
| tasks/deps/check.sh:1-15            | Report outdated packages                                                                                            |
| tasks/deps/unused.sh:1-15           | Knip unused-dependency analysis with local cache                                                                    |
| tasks/dict.sh:1-61                  | Require dictionary config/tools and collect dictionary files                                                        |
| dict.sh:62-114                      | Parse unique/duplicate words and allocate cleanup-managed temporary data                                            |
| dict.sh:115-176                     | Collect project files and locate unused dictionary entries                                                          |
| dict.sh:177-227                     | Compare words against cspell without project dictionaries to find redundant entries                                 |
| dict.sh:228-292                     | Print duplicate/unused/redundant reports and final result                                                           |
| tasks/attributes.sh:1-78            | Validate context, identify missing attribute coverage and uppercase extensions                                      |
| attributes.sh:79-198                | Annotate rules in a temporary attribute file, detect ordering/overlap concerns, print advisory results              |
| tasks/lfs.sh:1-53                   | Require correct local Git LFS setup; fsck existing HEAD or handle unborn repository                                 |
| lfs.sh:54-122                       | Collect NUL-safe expected LFS paths and validated actual JSON path records; compute missing/orphaned sets           |
| lfs.sh:123-173                      | Report LFS discrepancies and overall failure                                                                        |
| tasks/ignore.sh:1-72                | Parse ignore rules and duplicate rules                                                                              |
| ignore.sh:73-157                    | Discover ignored paths, match rules, report ineffective/duplicate configuration                                     |
| tasks/shellcheck.sh:1-38            | Imports/config/tool prerequisites                                                                                   |
| shellcheck.sh:39-94                 | Deduplicate discovered shell scripts and shell-shebang hooks/files                                                  |
| shellcheck.sh:95-104                | Invoke configured ShellCheck and propagate status                                                                   |
| tasks/actionlint.sh:1-39            | Require worktree and actionlint                                                                                     |
| actionlint.sh:40-69                 | Discover workflow files, handle none, invoke actionlint                                                             |
| tasks/zizmor.sh:1-68                | Require tooling, discover workflow/action/Dependabot inputs                                                         |
| zizmor.sh:69-97                     | Select offline/online behavior and run security auditing                                                            |
| tasks/act.sh:1-46                   | Prerequisites, cache/runner/platform defaults                                                                       |
| act.sh:47-85                        | Parse list/event/job arguments                                                                                      |
| act.sh:86-119                       | Assemble act invocation and forward execution result                                                                |
| tasks/actions/local.sh:1-15         | Invoke local workflow execution wrapper                                                                             |
| tasks/actions/local-list.sh:1-15    | List local workflow execution plan                                                                                  |
| tasks/actions/test.sh:1-15          | Invoke test workflow via act wrapper                                                                                |
| tasks/actions/test-list.sh:1-15     | List test workflow plan                                                                                             |
| tasks/lint/actions.sh:1-15          | Route to actionlint implementation                                                                                  |
| tasks/lint/actions-security.sh:1-15 | Route to zizmor implementation                                                                                      |
| tasks/lint/commit.sh:1-26           | Require Git/commitlint; lint last commit or supplied message arguments                                              |
| tasks/lint/dockerfile.sh:1-10       | Hadolint actual Dockerfile and positive fixture; require negative fixture to fail                                   |
| tasks/lint/md.sh:1-15               | Markdownlint check                                                                                                  |
| tasks/lint/md-fix.sh:1-15           | Markdownlint fix operation                                                                                          |
| tasks/lint/md-gfm.sh:1-57           | Require cmark-gfm and exercise rendered Markdown feature assertions with temporary fixture/output                   |
| tasks/lint/policy.sh:1-21           | Build devcontainer policy input, test current configs, and assert positive/negative policy fixtures                 |
| tasks/lint/schema.sh:1-15           | Invoke Node schema CLI                                                                                              |
| tasks/lint/secrets.sh:1-4           | Gitleaks full-history scan with explicit config/redaction                                                           |
| tasks/lint/secrets-staged.sh:1-4    | Gitleaks staged-diff scan with explicit config/redaction                                                            |
| tasks/lint/shell.sh:1-15            | Route to shell discovery/analysis                                                                                   |
| tasks/lint/spell.sh:1-15            | cspell invocation using repository cache                                                                            |
| tasks/lint/toml.sh:1-5              | Tombi lint mise source and lock                                                                                     |
| tasks/devcontainer-scan.sh:1-86     | Resolve image/SBOM/cache options, optionally build full devcontainer, enforce Trivy threshold, generate SPDX output |
| tests/smoke.sh:1-89                 | Optional application ESM/CJS dist import smoke test; not the devcontainer lifecycle test                            |
| docs/preview-github.sh:1-29         | Validate optional gh extension and invoke GitHub-backed Markdown preview                                            |

The optional preview tool/extension is not currently declared in mise.toml. That
is acceptable as an explicitly optional documentation workflow; do not make it a
container readiness requirement merely because a script exists.

##### Lifecycle smoke test and CI implementation scripts

| File / lines                                            | Responsibility                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| scripts/linux/commands/tests/devcontainer-smoke.sh:1-92 | Strict mode, test-resource variables, cleanup trap, host/tool prerequisites                             |
| devcontainer-smoke.sh:93-115                            | Create isolated working-tree copy and independent Git index                                             |
| devcontainer-smoke.sh:116-163                           | No-cache frozen up, then discover container/image/mounts and assert volume name                         |
| devcontainer-smoke.sh:164-194                           | Extract expected tool versions from manifests                                                           |
| devcontainer-smoke.sh:195-249                           | Remote runtime assertions, tool versions, store, Compose workload, doctor                               |
| devcontainer-smoke.sh:250-265                           | Stop/restart and rerun Docker/health checks                                                             |
| devcontainer-smoke.sh:266-283                           | Remove test dependencies, reinstall offline, require resulting node_modules                             |
| scripts/linux/ci/buildkit-check.sh:1-5                  | Run Dockerfile build checks without building the full workspace lifecycle                               |
| ci/confirm-architecture.sh:1-16                         | Normalize native host architecture and require expected Linux platform                                  |
| ci/build-source-image.sh:1-8                            | No-cache frozen complete devcontainer build and push to designated registry                             |
| ci/publish-candidate.sh:1-16                            | Derive candidate image tag, multi-platform build/push, export index digest                              |
| ci/platform-digests.sh:1-11                             | Resolve amd64/arm64 manifest digests and export workflow outputs                                        |
| ci/verify-platform-images.sh:1-11                       | Validate inputs and enforce compressed-layer-size limit                                                 |
| verify-platform-images.sh:12-49                         | Run each platform image, parse expected versions, check user/sudo/workspace absence and tool versions   |
| ci/promote-image.sh:1-10                                | Create stable commit tag from selected candidate digest                                                 |
| ci/devcontainer-sign.sh:1-11                            | Keyless index signature and per-platform SPDX attestations                                              |
| ci/devcontainer-verify.sh:1-14                          | Verify identity/issuer-constrained signature and provenance/SBOM attestations                           |
| ci/install-cmark-gfm.sh:1-6                             | Install CI-host Markdown renderer using runner APT; separate from pinned container package installation |
| ci/test-cache-key.sh:1-8                                | Emit workflow test-cache key from runner OS and input hash                                              |

##### Workflows, policy, editor, and repository configuration

| File / lines                                      | Responsibility                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| .github/workflows/ci-devcontainer.yml:1-44        | Events/path filters/schedule/concurrency and default-deny permissions                                                                  |
| ci-devcontainer.yml:45-80                         | Native amd64/arm64 build-input checks and lifecycle smoke jobs                                                                         |
| ci-devcontainer.yml:81-124                        | Separate source-image scan/SBOM job with local digest-pinned registry service                                                          |
| ci-devcontainer.yml:125-248                       | Main-only candidate publication, per-platform inspection/scan, promotion, provenance/SBOM/signatures, verification, artifact retention |
| .github/actions/setup-node-deps/action.yml:1-25   | Composite interface and selected mise-tool installation with CI bootstrap version                                                      |
| setup-node-deps/action.yml:26-47                  | pnpm-store restore, frozen script-disabled install, save cache on miss                                                                 |
| .github/workflows/ci-general.yml:1-30             | PR event, concurrency, default permissions                                                                                             |
| ci-general.yml:31-158                             | EditorConfig, production audit, Prettier, Markdown, schema jobs                                                                        |
| ci-general.yml:159-289                            | ESLint, TOML, YAML, ShellCheck, actionlint, zizmor jobs                                                                                |
| ci-general.yml:290-408                            | cspell, Knip, Gitleaks, Hadolint, Conftest jobs                                                                                        |
| .github/workflows/ci-test.yml:1-73                | PR test setup, cache key/restore, package test command, cache save                                                                     |
| .github/workflows/pr-automation.yml:1-124         | Metadata-oriented labeler, dependency review, and semantic PR-title automation; separate from container readiness                      |
| .github/dependabot.yml:1-131                      | Scheduled dependency update ecosystems/groups and PR conventions; no complete custom bootstrap/checksum updater                        |
| .github/labeler.yml:1-100                         | Map changed paths/branch conventions to PR labels                                                                                      |
| .github/zizmor.yml:1-17                           | Workflow audit configuration/exceptions                                                                                                |
| .github/CODEOWNERS:1-16                           | Default review ownership                                                                                                               |
| policy/devcontainer/devcontainer.rego:1-50        | Non-root/init, mount, Feature registry/version, lock membership/integrity policy                                                       |
| policy/workflows/workflows.rego:1-43              | Workflow permission, action SHA, service registry/digest rules                                                                         |
| policy/fixtures/devcontainer/valid.json:1-24      | Positive illustrative Feature/config/lock fixture                                                                                      |
| policy/fixtures/devcontainer/invalid.json:1-24    | Negative policy fixture with several violations                                                                                        |
| policy/fixtures/dockerfile/valid.Dockerfile:1-3   | Positive pinned-base/non-root Hadolint fixture                                                                                         |
| policy/fixtures/dockerfile/invalid.Dockerfile:1-3 | Negative registry/pinning/package-install fixture                                                                                      |
| policy/fixtures/workflows/valid.yml:1-14          | Positive least-permission/pinned-reference workflow fixture                                                                            |
| policy/fixtures/workflows/invalid.yml:1-12        | Negative broad-permission/unpinned-reference fixture                                                                                   |
| .gitignore:1-89                                   | Deny-by-default source tracking exceptions and generated-state exclusions; missing Hadolint/Gitleaks exceptions matter                 |
| .gitattributes:1-179                              | Text/line-ending classification, binary/LFS attributes, file-type policy                                                               |
| .editorconfig:1-55                                | Per-file whitespace/newline conventions                                                                                                |
| .editorconfig-checker.json:1-6                    | EditorConfig checker schema and line-length exception                                                                                  |
| .shellcheckrc:1-26                                | ShellCheck external-source/optional-check policy                                                                                       |
| .hadolint.yaml:1-6                                | Dockerfile warning threshold/trusted registry; currently local and ignored                                                             |
| .gitleaks.toml:1-5                                | Extend standard Gitleaks rules; currently local and ignored                                                                            |
| .trivyignore.yaml:1-6                             | Empty, explicitly scoped vulnerability/misconfiguration/secret/license exception sets                                                  |
| .yamllint.yaml:1-18                               | YAML syntax/style and generated/dependency exclusions                                                                                  |
| .markdownlint-cli2.jsonc:1-25                     | Markdown rules, local schema, custom HTML rule, globs/ignores                                                                          |
| eslint.config.js:1-14                             | Node script lint configuration and ignored generated paths                                                                             |
| knip.json:1-14                                    | Dependency-analysis entry/configuration scope                                                                                          |
| prettier.config.js:1-75                           | Formatting policy/plugins and file overrides                                                                                           |
| .prettierignore:1-35                              | Exclude generated/lock/resource content from formatting where configured                                                               |
| commitlint.config.js:1-187                        | Conventional commit checks, custom casing/range rules, interactive prompt policy                                                       |
| .husky/pre-commit:1-18                            | Run staged secret scan then staged quality tooling                                                                                     |
| .husky/commit-msg:1-24                            | Verify message input and invoke commitlint                                                                                             |
| .gitmessage:all                                   | Human commit template configured by setup/repair                                                                                       |
| .git-blame-ignore-revs:all                        | Blame exclusions configured by setup/repair                                                                                            |
| .mailmap:all                                      | Historical author identity mapping; not the source of current Git user configuration                                                   |
| .vscode/extensions.json:1-6                       | Host/editor extension recommendations                                                                                                  |
| .vscode/settings.json:1-72                        | Formatter/tool selection, file types, editor schema downloads, excluded generated/search paths                                         |
| .vscode/launch.json:1-56                          | Debug Node through mise and expose task picker; UX abstraction only                                                                    |
| README.md:development/container sections          | Human setup, identity, dotfiles, CLI, and command documentation                                                                        |
| README-devcontainer.md:1-264                      | Container design, claims/checklists, update/test/security notes needing reconciliation                                                 |

Deleted .cspell.json and spellcheck files have no current contents to map, but
their remaining callers are included above. AUTHORS, LICENSE,
README_TEMPLATE.md, media assets, and application package content are not
container provisioning logic; their indirect formatting/LFS policies are covered
rather than auditing their substantive content.

#### Final preservation and cleanup record

Only AGENTS.md and OUTPUT.md were added to the original repository. The original
dirty implementation changes were preserved. A SHA-256 comparison of 138
source/configuration files against the external audit copy found no content
differences; details are in audit-preservation.json beside the logs. This
comparison excludes generated dependencies, caches, Git internals, and these two
new documentation files.

The disposable audit container, its three named volumes, and both generated
image tags were removed. A follow-up scoped Docker listing returned no matching
resources. The deleted volumes contained only audit pnpm/DinD state; that state
is not retained and would need to be recreated. Shared Docker build caches were
not globally pruned.

The external test repository, logs, scripts, and temporary Trivy database cache
were retained. The harnesses record this run's container ID; after recreating
the container, update that ID before rerunning the dependent harnesses. The
directory is under /tmp, so it is evidence for inspection, not a durable archive
guaranteed to survive host cleanup.

#### Implementation follow-up — 2026-09-27

The following changes were applied to the working tree after the original audit.
Existing user changes, including deleted spellcheck configuration, were
preserved. Nothing was committed or published. The user explicitly chose to
remove spellchecking from required checks rather than restore the dictionaries.

##### Applied changes

| Concern                            | Resolution                                                                                                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inactive frontend pin              | The digest-pinned syntax directive is now the first Dockerfile line; input validation rejects a preceding comment. Build logs show the pinned frontend resolving.                                                                                              |
| Buildx overwrite                   | Disabled the Feature's separate latest-version Buildx download. Its pinned Moby package supplies `0.37.0-1`. The initial follow-up test exposed the package suffix; the parser was corrected, not the pin weakened.                                            |
| Docker/Buildx version comparison   | Accept the exact declared version or its known Moby `-1` packaging suffix. Other suffixes and version drift remain failures.                                                                                                                                   |
| Compose drift                      | Replaced the moving selector with explicit `2.40.3` and added exact runtime comparison. The Feature's redundant/transitive package path remains a limitation below.                                                                                            |
| Wrong Docker endpoint              | Readiness requires the intended local Unix socket and respects Docker context precedence.                                                                                                                                                                      |
| Required spellchecking             | Removed dictionary validation from health, spelling from required lint/CI, and cspell from staged Markdown checks. Optional commands/dependency remain available for a future separately configured opt-in.                                                    |
| Lockfile mutation during diagnosis | Node checks copy manifests/config/lock to a temporary workspace for the frozen offline probe. Installed lock comparison uses parsed YAML, not byte equality.                                                                                                   |
| Missing installed dependencies     | Check direct dependency manifests and their declared executable links. Deliberately removing ESLint now fails readiness. This is not a hash check of every package file.                                                                                       |
| Incomplete Husky readiness         | Check the shared `.husky/_/h` runner and reject `HUSKY=0`.                                                                                                                                                                                                     |
| Hidden mise executable damage      | Add bounded capability probes for all 16 required commands; a missing ShellCheck binary now fails despite installed metadata. These probes establish executability, not full artifact integrity.                                                               |
| Image/input drift                  | Record build-input fingerprints and seven direct Debian package versions in the image; workspace status compares them at startup. Includes complete mise lock contents, but excludes mise task bodies and editor customizations.                               |
| Workspace usability                | Check workspace/Git-directory and configured pnpm-store writability. Linked worktrees use the resolved Git directory rather than the `.git` pointer file.                                                                                                      |
| Validation auto-install            | Disable both mise auto-install settings in readiness/rendering paths. Missing Node yields plain diagnostic output rather than an attempted install.                                                                                                            |
| Narrow/wide-character rendering    | Fall back to plain output for an over-wide box title or unavailable renderer; width-1 CJK padding no longer throws. An indivisible width-2 grapheme may exceed a width-1 request rather than being corrupted.                                                  |
| Deadlines and result preservation  | Enforce Docker's 30-second wait, 60-second independent status deadlines, and five-minute startup health deadline. Preserve later results after rendering failure.                                                                                              |
| Input validation                   | Reject duplicate/nonliteral env assignments; validate a local repository-specific devcontainer schema, Feature lock membership/digests/versions, frontend placement, and CI/bootstrap alignment.                                                               |
| Schema/policy fail-open            | JSON `$schema` declarations now participate in local schema discovery. Add required-object/field/digest checks and negative Rego tests. Missing local schema references fail.                                                                                  |
| Clean-checkout configuration       | Allow `.hadolint.yaml` and `.gitleaks.toml` through `.gitignore`. They remain untracked until the user includes them in a commit.                                                                                                                              |
| Repair false success               | Validate all LFS filters before and after repair; propagate LFS/Husky failures; check cache/store writability; remove interactive sudo/store chown; use `NPM_CONFIG_STORE_DIR`.                                                                                |
| Setup duplication/error masking    | Leave Git configuration ownership to repair; capture version command results before logging so failure cannot be hidden.                                                                                                                                       |
| Shell discovery failures           | Replace process-substitution discovery with checked temporary-file steps; handle predicate statuses explicitly. All 68 discovered shell scripts pass the configured ShellCheck rules.                                                                          |
| Smoke isolation and cleanup        | Support working-tree and HEAD copies, synthetic fixture identity, correct volume prefix, failure logs/workspace retention, and cleanup discovery after partial lifecycle failure.                                                                              |
| Cleanup safety                     | Preview by default; `--apply` required. Select only the workspace pnpm volume; nested Docker data requires `--include-docker-data`; unrelated attached volumes are preserved; symlinked cache roots are rejected.                                              |
| Lock consumption/update            | Normal up/rebuild use frozen Feature locks. Update script supports Feature-only refresh, explicit `--locks` across both Linux mise platforms plus pnpm, and non-mutating `--check`. This does not automatically bump all pins or provide transaction rollback. |
| CI coverage and tooling            | Remove the narrow PR path filter, explicitly install the Dev Containers CLI in relevant jobs, add architecture to pnpm cache keys, and audit development dependencies.                                                                                         |
| Candidate identity                 | Extend smoke tests to consume an immutable prebuilt-image digest. Platform verification invokes the full lifecycle on each candidate before scan/sign/promotion. Local amd64 digest-mode testing passed; remote/arm64 execution remains unverified.            |
| Supply-chain ordering              | Generate SBOM before the vulnerability gate, upload it on failure, and promote only after signing/verification. Correct the bootstrap assertion to read `versions.env`, not mise's minimum version.                                                            |
| Documentation                      | Reconcile actual Compose/lifecycle/cleanup behavior, host CLI installation, optional spelling, pinning limits, and remaining maintenance work.                                                                                                                 |

##### Verification evidence

The external follow-up repository is:

```text
/tmp/workflow-template-devcontainer-smoke.Wn00Yr
```

It retains `fix-regressions.py`, `fix-regressions.json`, and `fix-trivy.json`.
Tests temporarily changed only disposable fixture state and restored it after
each case. The original repository's Git identity, hooks, and dependency
installation were not repaired as part of these fixture tests.

| Check                                                           | Result                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean no-cache Linux amd64 build                                | Passed; log `/tmp/workflow-template-smoke-second.log`                                                                                             |
| postCreate and postStart readiness                              | Passed with synthetic fixture identity                                                                                                            |
| Non-root, denied passwordless sudo, init, no host Docker socket | Passed                                                                                                                                            |
| Pinned tools and Docker/Buildx/Compose                          | Passed                                                                                                                                            |
| Inner-daemon Compose workload                                   | Passed                                                                                                                                            |
| Stop/restart and repeated health                                | Passed                                                                                                                                            |
| Offline pnpm reinstall from its dedicated volume                | Passed                                                                                                                                            |
| Prebuilt immutable-digest lifecycle                             | Passed; log `/tmp/workflow-template-candidate-smoke.log`                                                                                          |
| Missing ESLint executable                                       | Nonzero readiness, identifies ESLint                                                                                                              |
| Manifest/lock disagreement                                      | Nonzero readiness                                                                                                                                 |
| Harmless extra lockfile newline                                 | Readiness passes without rewriting the lockfile                                                                                                   |
| Missing Husky runner                                            | Nonzero readiness                                                                                                                                 |
| Corrupted LFS smudge filter                                     | Repair restores the required value; postcondition passes                                                                                          |
| Disabled Husky during repair                                    | Repair exits nonzero                                                                                                                              |
| Changed image checksum input                                    | Reports `rebuild required`, exits nonzero                                                                                                         |
| Mise task-only edit                                             | Does not require an image rebuild                                                                                                                 |
| Unavailable configured Node version                             | Failure diagnostics remain visible; no automatic install                                                                                          |
| Missing system ShellCheck binary                                | Mise executable row names `shellcheck`, exits nonzero; binary restored afterward                                                                  |
| CJK width 1 with padding                                        | No RangeError; intact glyph preserved                                                                                                             |
| 12-column info output                                           | All check output survives via plain fallback                                                                                                      |
| Input regression suite                                          | 13 Node tests passed                                                                                                                              |
| Fingerprint boundary suite                                      | Six Python tests passed                                                                                                                           |
| Rego negative-state suite                                       | Four tests passed; live and existing positive/negative fixtures also passed                                                                       |
| Mocked cleanup selection                                        | Preview non-mutating; apply preserves Docker data by default; explicit data selection works; unrelated volume and symlinked cache protection pass |
| ShellCheck / ESLint                                             | Passed for all discovered shell scripts and root Node automation                                                                                  |
| Hadolint / actionlint / zizmor / yamllint                       | Passed with existing configured lint policy/exceptions, no new security suppressions                                                              |
| Local schemas                                                   | One schema and one schema-backed config validated; external references intentionally skipped                                                      |
| Markdown tests / touched docs / formatting                      | Passed                                                                                                                                            |
| `devcontainer-update.sh --check`                                | Passed without regenerating locks                                                                                                                 |
| Trivy HIGH/CRITICAL gate                                        | **Failed**, deliberately retained as a blocker                                                                                                    |

##### Still open at 2026-09-27 — historical, partly superseded

Native graph locking, signed bootstrap updates, update configuration, capacity
checks and bounded bootstrap recovery were implemented in later follow-ups.
Publication was retired. Use the current issue-status table rather than treating
the list below as today's backlog. Vulnerability counts below are historical.

1. **Image vulnerabilities:** the rebuilt image rescan with the retained audit
   database still reports 709 HIGH and 28 CRITICAL occurrences, 389 distinct
   IDs, and 301 occurrences with reported fixes. Breakdown: OS 432, Node
   packages 42, Python packages 2, Compose 58, Act 40, Actionlint 22, Conftest
   21, Cosign 16, Gitleaks 33, Gum 5, Trivy 66. Counts are not exploitability
   assessments. Coordinate reviewed base/snapshot/tool updates and vendor
   applicability triage; no vulnerability exceptions were added. The publication
   gate remains failing until this is addressed.
2. **Complete dependency-graph reproducibility:** rolling Moby transitive
   packages and mise's npm/pipx graphs are not fully frozen. Fixing that
   requires a deliberate provisioning/lock strategy, potentially a local Feature
   or separate integrity-locked tool installations. The input fingerprint
   detects declared drift; it does not make two independent builds
   byte-identical.
3. **Update automation:** explicit lock refresh is improved, but coordinated
   version bumps, verified bootstrap hash acquisition, snapshot resolution, and
   reviewable update PRs are not automated. Renovate remains a suggested tool;
   no app, credentials, bot configuration, or external write was installed.
4. **Untested environments and operations:** native arm64, Windows/macOS hosts,
   VS Code attachment, GitHub runners, registry publication, and OIDC/signature
   interoperability still require their own execution evidence. Exact-candidate
   CI wiring is implemented but has not been run against GHCR locally.
5. **Readiness limits:** no disk-capacity policy, exhaustive dependency-import
   checks, or installed-byte attestation. A huge newline-free record remains
   line-buffered. Git fetch intentionally writes remote-tracking state. Abrupt
   host/daemon loss and forced-kill cleanup recovery are not established by the
   successful and partial-startup cleanup tests.

Do not mark the entire audit closed merely because startup is now green. The
current result is a substantially stronger, tested readiness contract with a
still-blocking security update and reproducibility backlog.

##### Follow-up cleanup record

The final exact-image smoke run, including the latest executable checks, passed;
its log is `/tmp/workflow-template-final-smoke.log`. Its disposable resources
were removed automatically. The separate diagnostic container was then removed
with its three exact named volumes and two image tags. Scoped Docker queries
confirmed no matching container, volume, or image remained for that diagnostic
run or the final smoke run. Older, unrelated Docker resources were left alone;
no global image or build-cache pruning was performed.

The volumes contained only test state and have no recovery copy. The external
fixture repository, regression output, vulnerability JSON, and lifecycle logs
remain under `/tmp`; archive them elsewhere if durable evidence is required.

#### Checksum update follow-up — 2026-09-30

Added the official release checksum URL to `checksums.sha256` and implemented
`devcontainer-update.sh --mise VERSION`. The updater downloads an explicit
stable release's checksum manifest, cross-checks the manifest and both Linux
hashes against GitHub release metadata, validates a temporary candidate, and
updates the version manifest, checksum entries/source URL, and CI bootstrap
together. It preserves unrelated source content, detects intervening edits,
prints a diff, and attempts rollback if file replacement fails. Signature-key
verification and automatic update PRs remain future work.

All 15 isolated updater tests passed, including network/hash failures, invalid
candidates, concurrent edits, idempotence, and replacement rollback. The
existing 13 input tests and six Python fingerprint tests also passed. A live
update to 2026.9.18 succeeded in `/tmp/workflow-template-mise-update.HacRRe`;
the original repository remains pinned to 2026.9.1. ESLint, ShellCheck,
formatting, input validation, and documentation lint passed. This tests the
updater, not the runtime or vulnerability status of a container built with the
newer release.

#### Feature dependency lock validation follow-up — 2026-09-30

Both the Node build-input validator and the Rego policy now follow locked
`dependsOn` references from explicitly configured Features. Reachable transitive
entries are accepted; missing dependencies, disconnected/stale entries,
malformed dependency lists, unapproved registries, version mismatches, and
digest mismatches are rejected. Direct Features retain the configuration's
exact-version contract. Transitive Features may use numeric major/minor/exact
selectors, digest selectors, or unversioned references, but must resolve to an
exact version and SHA-256 digest in the lock. Graph traversal terminates even
for cycles; it does not assert that a cyclic Feature installation is supported
by the Dev Container CLI.

The disposable input fixtures passed all 26 input tests, and all 15 updater
tests and six Python fingerprint tests also passed. The 17 Rego tests and the
complete policy lint/check workflow passed, as did ESLint and formatting checks.
The valid policy fixture now includes its required Feature version. The actual
Feature lock and container configuration were not changed, and no container
rebuild was performed for this validator-only change.

#### Dockerfile reproducibility follow-up — 2026-09-30

Added Docker's official best-practice and reproducible-build links. Direct APT
updates now fail on any index error, the package list is alphabetized, and the
mise download has a 300-second retry window and 60-second per-attempt timeout.
Curl's retry window does not interrupt an already-running attempt, so this is
not a strict 300-second total deadline. Comments distinguish committed checksum
verification from publisher-signature verification and explain why the image
does not set `USER`: the Docker-in-Docker daemon starts as root, while
`remoteUser` selects the non-root editor/lifecycle account.

The Dockerfile supplies a Unix-epoch fallback for `SOURCE_DATE_EPOCH`. CI builds
and smoke tests select the source commit timestamp, and CI image exporters
request `rewrite-timestamp=true`. The candidate command uses exporter-controlled
push rather than CLI `--push`, because Dev Container CLI 0.88.0 otherwise
ignores `--output`. No external image publication was performed to test this
wiring.

Added an opt-in `test:devcontainer:reproducibility` command. It freezes current
inputs into a temporary workspace and builds twice using separate, empty-cache
BuildKit 0.24.0 builders pinned to an immutable digest. OCI archives are
streamed through integrity checks and their platform
manifest/configuration/layers are compared, excluding outer tar ordering and
provenance. This is not a startup readiness gate and is not a claim that every
platform is reproducible.

The finalized end-to-end command ran in
`/tmp/workflow-template-reproducibility.8MeFhH`. Both amd64 builds succeeded,
timestamp rewriting was observed, and the comparison correctly exited 1:

- first platform manifest:
  `sha256:871b0086dfbb03ba7f3759998ba4e4173fa2a0441b4caa9ddb578898e13c0a57`;
- second platform manifest:
  `sha256:a242b5c052a31ba544d649b6916fbfa16190cd9f3da491ee0fec8415f69fedf7`;
- layers 13, 18 and 26 differ, along with the image configuration.

The earlier pair in `/tmp/workflow-template-reproducibility.5YoppI` also built
successfully. Its script comparison was interrupted by editing/formatting the
running shell script; a separate archive comparison confirmed the same differing
layer positions. File-content inspection located differences in APT/dpkg logs,
ldconfig's auxiliary cache, pip HTTP cache, pipx's extracted bytecode, Node's
compile cache, npm installer state, and yamllint installation logs. Timestamp
normalization alone cannot normalize these generated contents.

All 52 Node tests, six Python fingerprint tests, seven OCI tests, policy checks,
Hadolint, ShellCheck, ESLint, formatting and documentation lint passed. Both
test runs' disposable builders were removed; no development container or
persistent workspace volume was changed. Approximately 3.1 GiB of OCI archives,
plus logs and isolated input copies, remain in the two printed `/tmp`
directories.

**Not fixed:** fully frozen Moby/npm/pipx graphs, generated-content
nondeterminism, and the historical vulnerability gate. Closing these requires
reviewing a provisioning strategy (for example, an artifact-locked local Feature
and a transitive-lock-capable mise/tool installer), not silently changing the
official Feature or treating a checksum/version check as a dependency lock.

#### Native mise locking and local guide follow-up — 2026-09-30

The user clarified that byte-identical images are an improvement goal, not a
strict readiness requirement. Retain the official Docker-in-Docker Feature
rather than introducing a custom installer solely for byte equality. The
reproducibility command remains an opt-in diagnostic.

Tested native locking in `/tmp/workflow-template-mise-transitive.GKV9IQ` with
isolated mise data/cache/state. The host and repository remain on mise 2026.9.1:

| Test                             | Observation                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2026.9.1 `mise lock --upgrade`   | Retained format 1; no native dependency sidecars generated.                                                 |
| Checksum-verified mise 2026.9.18 | Generated format 3 and aube sidecars for npm tools.                                                         |
| ESLint graph                     | Recorded 77 packages, not merely a top-level CLI version.                                                   |
| Frozen npm install               | Dev Container CLI and ESLint installed from the generated locks; ESLint reported 10.10.0.                   |
| Deliberate npm sidecar edit      | Frozen install rejected its digest mismatch; the original sidecar bytes were restored afterward.            |
| Old mise with new lock           | Reported unsupported format 3; migration must coordinate host/container/CI versions.                        |
| uv 0.12.5                        | Python graph generation explicitly rejected it as too old.                                                  |
| Checksum-verified uv 0.12.10     | Generated yamllint's uv sidecar with wheel hashes, replayed a frozen install, and reported yamllint 1.38.0. |

The Python install used the available host interpreter, not a container Python
3.11 migration test. No repository tool pins, lockfiles, host installations, or
required readiness gates were changed. A real migration must also wire sidecars
into Docker COPY/context, image fingerprints, updater snapshots, cache keys, and
graph-specific installation-path validation.

The existing host aube installation locks for pnpm and Dev Container CLI each
contain one package. Their dependencies are bundled rather than separately
resolved during npm installation. Thus the immediate native-locking gain for
these two tools is a committed package integrity/graph reference, not freezing a
large external npm dependency tree. ESLint's 77-package graph was a test
fixture, not a proposed additional mise-managed repository tool. Yamllint's
Python graph is the more direct current transitive-dependency benefit.

Corrected the managed-local guide in README.md, the Dockerfile header and the
setup script header: explicit system prerequisites, Linux/platform caveats, host
Docker and Git identity requirements, `mise exec` for the task-free path,
`--ignore-scripts` for dependencies, and Bash invocation before executable-bit
repair. Added post-setup readiness guidance without claiming that local setup
produces an identical container environment. Documentation formatting/lint,
ShellCheck, Hadolint and build-input validation passed; the setup script itself
was not executed against the original repository.

#### Native mise locking implementation — 2026-09-30

Implemented the previously proposed migration: checksum-verified mise 2026.9.18
for the image and CI, matching `min_version`, uv 0.12.10, lockfile format 3,
native npm graphs and a uv-managed yamllint graph. All six generated sidecar
files under `.mise/locks` are source inputs, not local caches. Builds copy them
into the system mise configuration and install frozen graphs without generating
replacement locks. Debian's Python remains snapshot-managed;
`/usr/local/bin/python` explicitly aliases `/usr/bin/python3` for the native
installer.

The sidecars participate in Git/build allowlists, image fingerprints, updater
snapshots and cache keys. The fingerprint helper also validates referenced paths
and native SHA-256 digests (using mise's CRLF normalization). Mise readiness
checks these graphs and uv's executable. Bootstrap updates now coordinate the
minimum version too, and reject a downgrade below the native-lock baseline.
Formatters and YAML lint leave checksum-addressed, generated sidecars untouched.
Explicit `mise lock --bump` refreshes dependency graphs while exact tool pins
remain fixed; ordinary installs are frozen with `settings.locked = true`.

Two preliminary isolated runs found and then resolved integration gaps: Debian
only exposed `python3`, and automatic mise task installation expanded platform
metadata in the workspace lock. The explicit Python alias fixed the first;
project-wide frozen installs fixed the second. The successful disposable amd64
run used `/tmp/workflow-template-devcontainer-smoke.TMZeKE`, with lifecycle log
`/tmp/workflow-template-devcontainer-smoke-log.OrWTgm`. It passed a no-cache
image build, postCreate/setup, postStart/readiness, dedicated runtime assertions
(including uv 0.12.10), restart/health and offline pnpm reinstall. Native graphs
and the image contract both passed. Cleanup exited successfully, removing its
disposable container, volumes, image tags and successful workspace. Preliminary
failed input copies and lifecycle logs remain under `/tmp` for diagnosis.
Subsequent changes were comments/documentation and additional regression cases,
not provisioning behavior changes.

Regression coverage includes graph tampering, missing npm/Python graph
references, missing files, path escape, CRLF equivalence, companion-manifest
drift, bootstrap/minimum alignment, updater rollback and concurrent edits. All
55 Node regressions, 13 image-input Python tests and 7 OCI-comparison tests
passed. ShellCheck, Hadolint, ESLint, TOML/documentation lint and targeted
formatting checks passed. Read-only Docker checks found no remaining successful
test container, image tag or workspace-specific pnpm volume.

Host requirements are now explicit: Docker with BuildKit/Buildx plus VS Code's
Dev Containers extension is sufficient for editor-driven lifecycle execution;
host mise/Node/pnpm/uv are not required for that path. Docker alone does not
interpret devcontainer.json. The optional host CLI/task workflow needs the Dev
Container CLI and Node, supplied here by compatible host mise. The host mise
binary was not replaced (it remains 2026.9.1); tests used the verified temporary
2026.9.18 binary. Newly graph-specific pinned tools were installed for the test
runner. Users retaining the host task workflow must update host mise.

This closes the repository's native npm/yamllint graph integration gap, not all
transitive reproducibility. The official Moby Feature still uses rolling package
metadata, generated image bytes remain nondeterministic, and the historical
vulnerability gate remains open. ARM64 locks are generated but this migration's
container lifecycle was tested only on native amd64. No image vulnerability
scan, publication, signature or byte-identical comparison was performed here.

#### Follow-up — 2026-10-01: source-only builds, publisher verification and capacity

This section supersedes earlier publishing/signing and byte-comparison
proposals; those historical findings and evidence above are preserved.
Docker-in-Docker remains the accepted implementation for trusted code. No
crash-recovery work was performed. Byte similarity remains a best-effort goal,
without diagnostics or a claimed/measured 90% result. SOURCE_DATE_EPOCH and
layer timestamp normalization remain; rolling Moby metadata and generated
contents still prevent guarantees.

##### Implemented changes

| Files                                                                                                                                                    | Responsibility/change                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci-devcontainer.yml`, `scripts/linux/ci/build-source-image.sh`                                                                        | Removed publication, registry service/push, signing, attestations and promotion. Native smoke jobs remain; the security job scans a locally loaded image and uploads its SBOM. No package-write or OIDC signing authority remains.                                                                                                    |
| `package.json`, `mise.toml`, `mise.lock`, setup/readiness/smoke scripts                                                                                  | Removed exclusive publication interfaces and Cosign CLI; locked Minisign 0.12 and verify its runtime availability/version. Internal mise artifact provenance labelled `cosign` remains valid and needs no separate Cosign CLI.                                                                                                        |
| Removed `publish-candidate.sh`, `platform-digests.sh`, `verify-platform-images.sh`, `promote-image.sh`, `devcontainer-sign.sh`, `devcontainer-verify.sh` | These exclusively implemented the retired registry workflow.                                                                                                                                                                                                                                                                          |
| Removed `devcontainer-reproducibility.sh`, `compare-oci-images.py` and its tests                                                                         | Retired optional exact-byte comparison diagnostics; retained timestamp normalization and source-build argument tests.                                                                                                                                                                                                                 |
| `scripts/node/update-mise-bootstrap.js` and tests, `checksums.sha256`                                                                                    | Download the manifest and its `.minisig`, verify against the reviewed/pinned mise publisher key, then validate manifest/binary API hashes and the candidate before replacing files. Missing/invalid signatures or a missing verifier fail closed. Temporary files are private and removed.                                            |
| `.mise/aqua.yaml`, Dockerfile, ignore rules, image contract and updater/test candidate lists                                                             | The upstream Minisign registry excludes Linux ARM64 although the signed archive contains an AArch64 executable. A local registry entry adds that platform without disabling signature verification. Both architectures have locked artifact hashes and Minisign provenance. Registry contents participate in drift/rebuild detection. |
| `scripts/python/devcontainer-capacity.py` and tests, `workspace-status.sh`, smoke tests                                                                  | Read-only available-byte/inode checks for workspace, temporary storage, configured pnpm store and existing DinD mount points. Red failed values and nonzero readiness exits below configured floors; no pruning or repair. Windows-style filesystems fall back to byte capacity when statvfs/inodes are unavailable.                  |
| `README-devcontainer.md`, `README.md`, `AGENTS.md`                                                                                                       | Document the source-only model, verification, thresholds, retained DinD and deliberately deferred gaps.                                                                                                                                                                                                                               |

Capacity defaults are **1024 MiB** and **1000 free inodes** per accessible
filesystem. Positive integer overrides are `DEVCONTAINER_MIN_FREE_MIB` and
`DEVCONTAINER_MIN_FREE_INODES`. Reserved blocks are excluded where statvfs is
available. Unsupported inode accounting does not incorrectly fail byte checks.
Shared storage may appear under several labels. These checks cannot establish
Docker Desktop host/VM backing capacity or guarantee space for arbitrary builds.

##### Evidence

- 57 Node regressions passed: inputs, source-build arguments, transactional
  updates and rejection of missing/invalid signatures and missing verifiers.
- 13 image-input/lock tests and 6 capacity tests passed. Capacity boundaries,
  inode exhaustion, inspection failures, invalid overrides and the no-statvfs
  fallback are simulated without exhausting real storage.
- Real upstream mise 2026.9.18 signature verified using Minisign. Modified
  signed contents and a modified signature were rejected; a missing executable
  failed closed. An updater execution on an isolated copy verified the real
  release and returned unchanged/idempotent. This establishes verification of
  the current bootstrap hashes, not a new image-signing workflow.
- Disposable native amd64 no-cache build, creation/startup readiness, non-root
  runtime/tool assertions, Docker/Compose workloads, deliberate capacity failure
  exits/red values, restart and offline pnpm restoration passed. Final lifecycle
  log: `/tmp/workflow-template-devcontainer-smoke-log.YjaciX`; successful
  workspace `/tmp/workflow-template-devcontainer-smoke.lZmWgu` and its
  disposable resources were cleaned by the harness. An earlier ordinary
  lifecycle pass is logged at
  `/tmp/workflow-template-devcontainer-smoke-log.5M5ZCk`.
- A preliminary negative-test run used the wrong color override and expected
  ANSI sequence. Normal readiness passed; the test assertion failed. The fixture
  was corrected to use the utilities' existing force-color convention and the
  actual red sequence. Its failed workspace was intentionally retained at
  `/tmp/workflow-template-devcontainer-smoke.HI9g1z`, with log
  `/tmp/workflow-template-devcontainer-smoke-log.7Fh2KW`; disposable Docker
  resources were cleaned. This was a harness error, not evidence of passing
  negative tests; the subsequent run above passed them.
- ShellCheck, Hadolint, ESLint, Tombi, targeted strict YAML/Markdown/format
  checks, input validation, actionlint and workflow policy checks passed.
  Workflow policy reported five successful checks. No actual registry
  publication was attempted.

##### Remaining gaps and deliberate boundaries

1. The historical HIGH/CRITICAL vulnerability gate remains unresolved; this
   follow-up did not rescan or establish security-job success.
2. Native ARM64 lifecycle evidence and real Windows/macOS VS Code lifecycle
   evidence remain pending. ARM64 verifier artifact metadata is locked and its
   executable architecture checked, not executed on ARM64 here.
3. Rolling Moby packages and generated tool/cache state still limit image-byte
   reproducibility. No byte-equality percentage is asserted or gated.
4. Capacity floors do not replace host/VM quota monitoring, workload sizing or
   deliberate cache maintenance. Inode checks are unavailable on some
   filesystems.
5. Publisher-key rotation and dependency updates remain reviewed operations.
   Signature verification is at checksum update time; builds replay committed
   hashes. The updater remains individually atomic with rollback, not a
   crash-recoverable multi-file transaction.
6. Privileged DinD is accepted for trusted work, not isolation from hostile
   code. No self-correction, crash recovery, mirror or offline-build service was
   added.

##### Docker build-context hardening — 2026-10-01

Replaced the broad `.devcontainer` COPY with the five required files and made
the corresponding `.dockerignore` exceptions explicit. Removed `!*/` and broad
`.mise` directory exceptions too. An isolated scratch Docker build showed these
exceptions also admitted descendant files, so narrowing COPY alone was not
sufficient to make the context a true allowlist.

The corrected context excludes sentinel local environment files, notes, nested
credentials, mise-cache files and unrelated root files. All required inputs
remain available, and the exported context's image fingerprint matches the
repository fingerprint. Docker build checks, Hadolint and the 13 image-input
tests pass. This tests context selection, not a fresh complete lifecycle or
vulnerability scan. Existing images may contain previously copied files in lower
layers. Rebuild the image after this change. Crash recovery and installer-cache
cleanup remain unchanged.

##### Installer-cache isolation and bounded crash recovery — 2026-10-01

Implemented at the user's request, superseding the earlier deferred recovery
finding without changing its historical evidence.

| Area              | Change                                                                                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dockerfile        | Locked BuildKit mounts isolate mise, pip, uv, npm and Node compile caches. uv copies installed files rather than depending on cache links. APT download cache, package lists and Dockerfile-stage package logs are cleared.                                 |
| Bootstrap updater | A private durable journal records all four old/new file contents, SHA256 hashes and modes before replacements. Atomic replacements and directory flushes support restartable recovery; flock serializes updates and recoveries and releases on termination. |
| Recovery          | Partial updates roll back; complete candidates are retained. Later edits, damaged journals and unsafe paths refuse recovery without overwriting files. Interrupted recovery is itself repeatable.                                                           |
| Lifecycle         | Creation/start recover using the image-provided Node and standard library before reading the workspace mise config. Startup directly invokes Bash init rather than depending on mise task parsing.                                                          |
| Host restart      | devcontainer-recover.sh defaults to read-only preview. Explicit --restart resolves/rechecks exactly one existing workspace container, repairs a pending bootstrap and reruns bounded lifecycle validation without removing or resetting volumes.            |
| Tests/docs        | Added SIGKILL transaction tests, recovery-command stub tests and a guarded crash fixture. Expanded the disposable lifecycle test and documented supported recovery boundaries.                                                                              |

Evidence:

- 77 Node tests, 13 Python image-contract tests and 6 capacity tests pass. Log
  `/tmp/workflow-template-recovery-unit-tests.log`.
- ESLint, ShellCheck, Hadolint, Tombi and formatting checks pass for the changed
  implementation files.
- Initial amd64 no-cache lifecycle passed cache isolation, ordinary restart,
  abrupt termination, volume/data preservation and offline reinstall. Log
  `/tmp/workflow-template-devcontainer-smoke-log.Jh0hOn`.
- The harder pending-bootstrap test initially exposed a non-root trust failure
  when resolving Node from the image's mise config. Log
  `/tmp/workflow-template-devcontainer-smoke-log.mXkOd5`. Fixed by scoping
  MISE_TRUSTED_CONFIG_PATHS to the root-owned image config for that resolution,
  with automatic installation disabled. It does not trust the workspace.
- Final disposable amd64 no-cache lifecycle passed startup/readiness, empty
  installer-cache assertions, ordinary restart, a deliberate SIGKILL after
  writing an unusable workspace mise minimum version, abrupt container kill,
  journal rollback, readiness, identical volume mounts, preserved hello-world
  image in DinD and offline pnpm reinstall. Log
  `/tmp/workflow-template-cache-recovery-final.log`. The harness removed its
  disposable container, volumes, images and workspace successfully.

Limits still open:

- This is local Linux filesystem recovery using flock/rename/fsync, not evidence
  of actual host power-loss recovery or guarantees for network filesystems or
  storage hardware. Native Windows journal recovery is not supported; use the
  Linux container. Extra host recovery tools are optional, not prerequisites for
  opening the container through VS Code.
- Only the four coupled mise bootstrap files are journaled. Other lock updates,
  interrupted package installation and corrupted Docker/containerd data are not
  automatically repaired. Valuable data still requires backups. Preparing or
  atomic-write temporary files can remain after a precisely timed process kill;
  no broad temporary-file deletion is attempted.
- DinD Feature package logs, installed tool metadata and bytecode may remain.
  Rolling Moby packages and other generated state still prevent claiming a
  measured image-byte similarity percentage.
- No new vulnerability scan, ARM64 runtime, Windows/macOS or real VS Code
  lifecycle evidence was produced. Privileged DinD remains the accepted trusted
  repository threat model.

##### User/Python ownership and update-flow alignment — 2026-10-01

Implemented the requested follow-up without updating the original repository's
dependency pins or hand-editing mise-owned sidecar bytes.

| Concern               | Implementation                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base account coupling | Dockerfile reuses UID 1000 regardless of login/home/group names, creates it if absent, moves the home if necessary and refuses conflicting target identities. The inherited primary group is preserved; cache ownership uses its numeric GID.                                                                                                                                 |
| Python ownership      | Debian remains the sole configured interpreter, with system yq and venv support. Mise manages uv/pipx and isolated tool graphs, not Python itself. Clarified this in the Dockerfile and disabled uv interpreter downloads during image installation and refresh.                                                                                                              |
| versions.env          | Retained as the canonical dated Debian package set and signed mise bootstrap, not a second mise tool manifest. Snapshot resolver queries both architecture indexes in unprivileged, read-only disposable base-image containers and replaces all pins only after complete agreement.                                                                                           |
| Renovate              | Replaced Dependabot configuration. Native managers discover mise/npm/Actions/images/Features; custom extraction covers the bootstrap and DinD options. No automerge, release-age floor, grouped toolchain updates and a narrow global post-task permission. The bot is not installed/activated here.                                                                          |
| Refresh               | Installs frozen script dependencies without hooks, derives package runtime declarations from mise, verifies publisher-signed bootstrap hashes, selects that exact checksum-verified temporary mise, prepares uv, bumps native transitive graphs for both Linux platforms, refreshes Feature/pnpm locks and advances the snapshot. Generated files are included in the bot PR. |
| Drift                 | Read-only --check uses offline exact-pin, artifact URL/checksum and native-digest validation, then safe-mode mise dry-run JSON for both Linux architectures. Image recording and readiness also check frozen artifact completeness. JSON alone only reports version changes.                                                                                                  |
| CI/tests              | Added the read-only drift gate and native Docker account-variant tests. Added isolated snapshot, Renovate extraction and deliberately drifted real-mise tests. Persistent mount comparisons are now order-independent.                                                                                                                                                        |

Evidence:

- 98 Node input/update/recovery tests, 20 image-contract/synchronization tests
  and 6 capacity tests pass. Log `/tmp/workflow-template-update-unit-final.log`.
- Seven real Docker base-account variants pass: stock, renamed login/group/home,
  absent inherited account, already provisioned target, target with another
  home, conflicting UID and forbidden root target. Log
  `/tmp/workflow-template-user-variants.log`.
- Actual mise dry-run returned `[]` for a missing unchanged-version checksum.
  The offline check rejected it. All tested build inputs remained byte-identical
  through read-only checks. Log `/tmp/workflow-template-update-drift.log`.
- Both real Debian architecture-index queries reproduced all seven current
  package pins from snapshot 20260824. Log
  `/tmp/workflow-template-debian-resolution.log`.
- Complete refresh in `/tmp/workflow-template-maintenance.MpYgZH` verified the
  signed bootstrap, regenerated native graphs/locks and resolved
  snapshot 20260924. A repeat was idempotent at the snapshot/pin level. Log
  `/tmp/workflow-template-maintenance-refresh-final.log`. The changed yamllint
  sidecar bytes were generated by mise in the candidate only.
- The refreshed candidate's final amd64 no-cache lifecycle passed startup,
  readiness, installer-cache assertions, restart, interrupted-bootstrap
  recovery, preserved volumes/DinD data and offline reinstall. Cleanup passed.
  Log `/tmp/workflow-template-update-lifecycle-final.log`.
- An initial disposable fixture lacked HEAD and needed an explicit source
  timestamp. A subsequent lifecycle passed readiness/recovery but failed an
  order-sensitive mount comparison; the harness now sorts mounts and names
  failed assertions. These are preliminary test failures, not evidence of
  successful validation until the final run.
- Renovate repository configuration passes the official schema and custom
  extraction/command-permission tests. Its global administrator template is
  intentionally not validated as repository config (that schema rejects global
  permissions). No live Renovate run, remote branch or PR creation is claimed.

Remaining boundaries:

- A scoped, administrator-operated self-hosted Renovate runner must be
  activated. Hosted arbitrary post-upgrade execution is blocked. Load the global
  template outside bot-edited branches, restrict repositories and keep
  credentials out of PR-triggered execution. Use a disposable trusted Linux
  environment; the repository tool manager does not install Renovate as a
  readiness dependency.
- Snapshot advancement occurs when a maintenance branch's hook runs, not via an
  independent Debian scheduler. A snapshot/package mismatch between
  architectures deliberately blocks the candidate. Base/snapshot skew, major
  migrations and publisher-key rotation still require review and may fail gates.
- Refresh is not one transaction across package.json, every lock and the
  snapshot; use a disposable worktree and review/retry failures. Dedicated
  bootstrap crash recovery still covers only its four coupled files.
- UID 1000, Debian Bookworm tooling and `/home/USER` remain deliberate build
  conventions. This is not a generic installer for arbitrary base distributions.
- No new vulnerability scan, native ARM64 runtime, Windows/macOS VS Code or real
  power-loss evidence was produced. Rolling DinD packages and generated metadata
  still limit byte-identical image reproducibility.

#### 2026-10-02 readiness-command audit follow-up

This follow-up reviews `repository/validation/*.sh`, their Node/filter helpers,
and `repository/info.sh`. It is local and isolated test evidence, not a new
container lifecycle, image-security or cross-platform runtime claim.

| Area      | Implemented correction                                                                                                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary   | Parallel checks receive closed stdin. Silent nonzero exits get an explanatory message in the failed box. Existing output colors and deterministic ordering are preserved.                                                                                                                                                     |
| Docker    | Matching versions alone no longer accept the wrong daemon OS/architecture. Malformed context, endpoint, Compose and builder-name output fails without losing the remaining status rows.                                                                                                                                       |
| Git       | Documentation is excluded from hook discovery. Husky runners/wrappers must be regular readable files. Malformed identity/config/remote text is reported safely. Signing remains informational and explicitly unverified.                                                                                                      |
| mise      | Metadata, executable and lock probes share a 40-second command budget. Configured commands and pins derive from mise.toml through mise-tool-commands.py, with small naming/flag exceptions. Actual executable version output is checked. Hosts use active PATH; containers prefer the image binary and fail if it is missing. |
| Node      | Command probes share a 30-second budget inside the existing 35-second hard wrapper. Corepack downloads, prompts and manifest auto-pinning are disabled. Embedded carriage returns in version output are rejected.                                                                                                             |
| Workspace | Image-contract and capacity subprocesses have standalone deadlines and closed stdin. Empty contract output is not accepted as healthy.                                                                                                                                                                                        |

Verification: 426 Node tests passed with one intentional skip, including
isolated readiness failures, deadlines, signal cleanup, host/image mise
selection and an actual offline pnpm manifest/lock check. All 20 Python
image-contract tests and six capacity tests passed. ShellCheck, ESLint and
formatting checks passed for the changed supported files. Real host Node and
mise probes reported healthy. Native mise lock/sidecar bytes and the container
build configuration were not changed. No package-content integrity guarantee,
signing execution, new image build, ARM64 runtime or Windows/macOS execution is
claimed.

#### 2026-10-02 signing, workloads and package-content integrity

The subsequent implementation adds the three checks that the preceding audit
left unverified. They run through the existing readiness commands and info.sh.
Failures produce red values and nonzero status rather than silently repairing
configuration or fetching missing packages.

| Check                  | Implementation and scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Git signing            | When commit.gpgsign is enabled, sign and verify a disposable empty commit using the configured key and verification policy. Its objects live in a temporary directory. Repository refs, HEAD, index and original object storage are unchanged. OpenPGP/X.509 pinentry and SSH askpass are disabled. Disabled signing remains informational.                                                                                                                                                      |
| Docker workloads       | When Docker prerequisites pass, build a UUID-tagged scratch image containing local true and its libraries with Buildx, then execute it with Docker and Compose. No image pulls, host mounts, volumes or workload network access are requested. Runs are non-root, read-only and capability-free. Exact probe resources are removed on success or failure. Cleanup failure reports the affected identifiers. No shared resources are pruned; BuildKit may retain a small cache.                   |
| Node package integrity | Validate pnpm store status, reconstruct a frozen offline reference without install scripts or pnpmfile execution, then compare active package bytes, executable bits and dependency links. Unexpected package files fail. Workspace source files and environment-specific metadata are not package payloads. Unused virtual-store versions may remain. Missing cache artifacts fail rather than trigger downloads. This covers PNPM-managed dependencies, not Debian or mise binary attestation. |

Verification: 448 Node tests passed with one intentional skip. This includes
real disposable SSH/OpenPGP signing, absent trust policy, missing keys and an
encrypted SSH key without an agent. Repository objects and refs remained
unchanged. An actual pnpm frozen offline installation passed before deliberate
tampering and failed afterward; the shared host store remained untouched.
Separate cases cover modified bytes, added/missing files, executable bits and
links. Build/run/Compose/cleanup failure fixtures check exact cleanup targets.
All 20 Python image-contract tests and six capacity tests passed. ShellCheck and
ESLint passed for the changed commands/helpers/tests.

A real Linux host offline Buildx/Docker/Compose workload passed and removed its
disposable resources. This is not a new devcontainer lifecycle or cross-platform
test. The host repository's new integrity check correctly reports a missing
offline any-ascii 0.3.3 tarball; its cache was not repaired or populated by
these checks. Readiness remains failed until the required package artifacts are
available. Existing native mise graph bytes and container build configuration
were not changed by this follow-up.

##### Open design question — literal assignment extraction or dotenv parsing

Should `env-value.awk` remain the strict literal reader for `versions.env`, or
should callers use Node's built-in `util.parseEnv()` instead?

- The AWK filter preserves quotes, surrounding spaces and additional equals
  signs. Missing keys and duplicate assignments fail explicitly. It does not
  require working Node to read mise's expected bootstrap version.
- `util.parseEnv()` provides standard Node dotenv semantics without an extra
  package. It removes surrounding quotes, trims unquoted surrounding whitespace
  and uses the last duplicate assignment. Duplicate-pin rejection would need
  separate validation, and its callers would depend on working Node.
- Both produce the same values for the current unquoted, unique version pins.
  Neither approach is inherently worse. Decide whether this file should retain a
  strict literal-manifest contract or intentionally adopt dotenv semantics.

No parser migration is approved or implemented by this note. Keep the AWK filter
until this question is revisited.

#### Devcontainer configuration and editor wiring audit — 2026-10-02

##### Scope and conclusion

Reviewed every field in `.devcontainer/devcontainer.json` and
`.vscode/settings.json`, the host extension recommendations, launch
configuration, local schema and relevant lifecycle/tool/formatter configuration.
The requested file is `.devcontainer/devcontainer.json`, not a root
`.devcontainer.json`.

The container configuration is coherent for the intended trusted-code DinD
workflow. Editor installation is wired, but editor tools are not uniformly the
same implementations/versions used by command-line checks. There are actionable
editor leftovers, an ineffective formatter selection and incomplete Rego editor
tooling. Successful container readiness is not proof that every extension
installed or activated successfully.

All 16 configured extension IDs have locally available manifests that were
inspected together with relevant runtime code. These are **host extension
artifacts**, not evidence of installation inside the devcontainer. Locally
available versions illustrate the defaults inspected; remote installations are
unversioned and can differ. No VS Code window, extension host or new container
was started. A sandboxed `code --version` attempt was refused by Snap
confinement; the host application's package manifest reports VS Code 1.139.0.
This is not remote execution evidence.

##### Complete devcontainer field map

Line numbers refer to the 60-line configuration inspected in this audit.

| Lines / field                             | Responsibility                                                                                             | Assessment                                                                                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2, `$schema`                              | Select the committed repository-specific schema.                                                           | Resolves correctly. This is intentionally a subset of the upstream specification, not a complete editor/lifecycle contract.                                                               |
| 3–9, `build`                              | Resolve `Dockerfile` relative to `.devcontainer`, use repository-root context and pass `USER=nlobby4`.     | Correct paths. Validator requires the build user to equal `remoteUser`. Dockerfile/context allowlisting is implemented.                                                                   |
| 10–31, `customizations.vscode.extensions` | Request 16 editor extensions for the remote workspace.                                                     | IDs match inspected manifests. The list does not install CLI dependencies or prove activation. No custom remote editor settings are supplied here.                                        |
| 32–41, `features`                         | Select exact DinD 4.1.1, Docker 29.6.0, Moby Buildx 0.37.0 and Compose 2.40.3.                             | Matches the committed Feature digest lock. Disabling the separate Buildx installer avoids the earlier overwrite. Compose-switch installation is intentionally disabled.                   |
| 42, `init`                                | Request process reaping/signal handling.                                                                   | Appropriate for lifecycle children and DinD workloads. Not a health check.                                                                                                                |
| 43–49, `mounts`                           | Persist the pnpm v10 store in a workspace/container-specific named volume.                                 | Matches the configured store path and user home. Do not automatically delete it. DinD storage/privilege also comes from Feature wiring, not solely this explicit mount list.              |
| 50, `name`                                | Human-readable container name.                                                                             | Informational, not used as proof of readiness.                                                                                                                                            |
| 51, `postCreateCommand`                   | Recover the bounded bootstrap journal, trust the workspace mise configuration and run setup orchestration. | Correct order and short-circuiting. The setup task installs frozen pnpm dependencies before repository repair and locked tool checks. No host mise is needed for this editor-driven path. |
| 52, `postStartCommand`                    | Run Bash init directly on every start.                                                                     | Avoids parsing possibly interrupted workspace mise configuration before recovery. Init recovers first, waits for Docker and runs bounded repository health with auto-install disabled.    |
| 53–55, `remoteEnv`                        | Set `NPM_CONFIG_STORE_DIR` for supporting-client processes.                                                | Matches the volume. It is not an environment variable on every arbitrary `docker exec` process. Consider `containerEnv` if that broader scope is intended.                                |
| 56, `remoteUser`                          | Run editor and lifecycle commands as `nlobby4`.                                                            | Correct non-root account. Does not change the root container entrypoint required by DinD.                                                                                                 |
| 57, `shutdownAction`                      | Stop the container when the supporting client closes.                                                      | Does not delete persistent volumes. Recovery/cleanup remain separate explicit operations.                                                                                                 |
| 58, `updateRemoteUserUID`                 | Adjust remote account IDs for Linux bind-mount ownership.                                                  | Appropriate. Earlier account-variant tests cover image account provisioning, not every actual VS Code UID-adjustment scenario.                                                            |
| 59, `waitFor`                             | Allow attachment after creation/setup finishes.                                                            | `postStartCommand` health is later than this wait point. Editor attachment must not be interpreted as successful readiness. Waiting for postStart is an optional stricter readiness UX.   |
| Omitted workspace/command/port fields     | Rely on normal Dockerfile-based workspace mounting and supporting-client command defaults.                 | No extra mount or port forwarding is currently required. Do not infer that omitted credential settings prohibit VS Code's normal credential/agent integration.                            |

The distinction between remote-user/container-user, remote/container environment
and lifecycle attachment is defined by the
[Dev Container metadata reference](https://github.com/devcontainers/spec/blob/main/docs/specs/devcontainerjson-reference.md).
The host needs Docker and an appropriate supporting client, such as VS Code's
Dev Containers extension; Docker alone does not interpret this configuration.
`.vscode/extensions.json` correctly recommends
`ms-vscode-remote.remote-containers` on the host and the Containers extension.
The host attachment extension does not need to appear in the remote list.

##### Extension-to-tool wiring

| Configured extension                            | Inspected host version | Repository wiring and conclusion                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ms-azuretools.vscode-containers`               | 2.5.2                  | Selected Dockerfile formatter. Its Docker language-server formatter is separate from repository Prettier's Dockerfile parser. Hadolint supplies CLI linting separately. A real editor/CLI format round-trip is not tested.                                                                                        |
| `github.vscode-github-actions`                  | 0.32.3                 | Workflow editor/schema/navigation support. Its `github-actions-workflow` language ID is supported by the configured Prettier YAML plugin. Actionlint, zizmor and act remain separate locked CLI tools.                                                                                                            |
| `EditorConfig.EditorConfig`                     | 0.18.2                 | Reads committed `.editorconfig`. Prettier also reads EditorConfig by default. Disabling indentation detection is consistent with explicit project policy.                                                                                                                                                         |
| `dbaeumer.vscode-eslint`                        | 3.0.34                 | Uses repository-local ESLint and flat `eslint.config.js`. Formatting remains Prettier's responsibility. No ESLint fix-on-save action is configured. Its default Node runtime is the extension host, not necessarily mise Node.                                                                                    |
| `esbenp.prettier-vscode`                        | 12.4.0                 | Global formatter, local Prettier 3.9.6 and committed `prettier.config.js`/plugins. `requireConfig=true` is appropriate. The actual extension-host runtime/plugin loading still needs a remote activation test.                                                                                                    |
| `joshbolduc.commitlint`                         | 2.6.3                  | Loads local Commitlint libraries/config when available, with bundled fallback. Supplies commit diagnostics, not a formatting provider. Selecting it as `[git-commit].editor.defaultFormatter` is ineffective.                                                                                                     |
| `timonwong.shellcheck`                          | 0.42.0                 | Explicit `shellcheck.executablePath=shellcheck` resolves through image PATH/mise shims to the locked tool, rather than choosing the extension's bundled executable. Uses repository ShellCheck configuration.                                                                                                     |
| `zizmor.zizmor-vscode`                          | 0.0.12                 | Default executable name is `zizmor`, supplied by mise 1.26.1. Workflow security diagnostics complement actionlint. No bundled-tool mismatch established.                                                                                                                                                          |
| `hverlin.mise-vscode`                           | 1.25.2                 | Default binary is `mise`, resolved via PATH. Automatic environment updates and config trust default on; automatic extension configuration defaults off. It does not currently impose explicit pinned paths on every other extension. The CLI task layer remains orchestration, not readiness.                     |
| `webpro.vscode-knip`                            | 2.3.1                  | `knip.json` and `requireConfig=true` are wired. The inspected extension imports its own bundled `knip/session.js` (Knip 6.36.0), whereas the repository CLI is 6.5.0. Its server uses `node` by default. Editor results can differ from the pinned CLI, even with the same config.                                |
| `redhat.vscode-yaml`                            | 1.24.0                 | YAML validation/schema support. Prettier is the selected formatter, so merely registering another formatter is not itself a conflict. Online schema updates are not locked container inputs.                                                                                                                      |
| `tombi-toml.tombi`                              | 1.7.0                  | Selected TOML formatter. Resolution checks an explicit path, development override, workspace venv/npm installations, then PATH, then a bundled fallback. With the image's PATH and no override, it should find mise Tombi 1.5.2. This is source-based expectation, not an observed remote language-server launch. |
| `exiasr.hadolint`                               | 1.1.2                  | Default `hadolint` executable resolves through mise PATH to 2.15.1. Committed `.hadolint.yaml` is the intended lint policy. It is not a Dockerfile formatter.                                                                                                                                                     |
| `tsandall.opa`                                  | 0.26.0                 | Rego syntax/editor features are requested, but no `opa` or `regal` executable is declared/provisioned. Conftest is not a replacement executable for these extension commands. Evaluation/testing requires OPA; its current language-server formatting requires Regal. No Rego formatter override is configured.   |
| `jq-syntax-highlighting.jq-syntax-highlighting` | 0.0.2                  | Provides `.jq` syntax highlighting, not a formatter or jq runtime. Debian's pinned jq is separate. No extra file association is needed.                                                                                                                                                                           |
| `luggage66.AWK`                                 | 0.0.2                  | Provides `.awk` syntax highlighting, not a formatter or AWK runtime. Debian's pinned gawk is separate. No extra file association is needed.                                                                                                                                                                       |

References for the behavior checked against installed artifacts:
[Prettier VS Code](https://github.com/prettier/prettier-vscode),
[Commitlint VS Code](https://github.com/joshbolduc/vscode-commitlint),
[Tombi VS Code implementation](https://github.com/tombi-toml/tombi/tree/main/editors/vscode),
[Knip VS Code implementation](https://github.com/webpro-nl/knip/tree/main/packages/vscode-knip),
and
[OPA extension requirements](https://github.com/open-policy-agent/vscode-opa#requirements).
These projects can change independently of the inspected local versions.

Unversioned extensions are normal developer UX, but they do not provide a
reproducible editor-toolchain guarantee. Marketplace access, compatible VS Code
versions and architecture-specific extension binaries remain external to the
image readiness contract. Do not add extension task names to container health.

##### Complete workspace settings map

| Lines / settings                     | Assessment                                                                                                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2–4, Dockerfile formatter            | Valid provider, but different formatter implementation from CLI Prettier. Choose one formatting authority or verify an intentional round-trip.                                                                                                                                          |
| 5–11, commit editor                  | Rulers, wrapping and restore-view-state preference are coherent. Remove the non-provider default formatter without removing Commitlint diagnostics. Neither current Prettier plugins nor Commitlint provide a commit-message formatter.                                                 |
| 12–16, JSON string suggestions       | Valid built-in editor preference, independent of validation.                                                                                                                                                                                                                            |
| 17–21, Markdown                      | Whitespace diff and visual wrap preferences are intentional. The cSpell reference-provider setting is stale. Editor visual wrapping and Prettier prose wrapping are separate behaviors, not a contradiction.                                                                            |
| 22–24, TOML formatter                | Correct Tombi extension ID. Current image PATH should select the locked CLI. An explicit container-only path can strengthen selection without imposing a Linux path on hosts.                                                                                                           |
| 25–33, cSpell                        | All remaining cSpell options lack a configured extension and refer to the retired spellchecking setup. Remove these leftovers rather than restoring required spellchecks.                                                                                                               |
| 34–40, global formatting/indentation | Local-config Prettier on explicit save, no paste/type formatting and no indentation guessing are coherent. Unsupported languages do not gain a formatter from this global default.                                                                                                      |
| 41–52, file associations             | Ignore/checksum/identity/ownership/license/Husky mappings are useful highlighting choices, not validators. `mise.toml` is harmless but already recognized. The `spellcheck/*.txt` mapping is stale. jq/AWK already register their extensions.                                           |
| 53, automatic saving                 | Disabled intentionally. Formatting runs when explicitly saved.                                                                                                                                                                                                                          |
| 54–59, JSON schemas                  | Enabled with trusted source domains. These are real built-in settings in the inspected VS Code version. Local devcontainer schema resolves without a download; external schemas may change or be unavailable offline. This is not workspace trust or executable integrity verification. |
| 60–61, Knip                          | Config file exists and requiring it avoids accidental unconfigured scans. Does not force the extension to use repository CLI Knip.                                                                                                                                                      |
| 62, Prettier                         | Requiring configuration correctly selects the committed project policy.                                                                                                                                                                                                                 |
| 63–70, search exclusions             | Hide generated dependencies/caches and lockfiles from normal search. They do not exempt those inputs from health checks or Git review. Lock exclusions are a discoverability preference worth reconsidering for drift investigation.                                                    |
| 71, ShellCheck path                  | Correct generic executable name, provided through mise shims in the image.                                                                                                                                                                                                              |

`.vscode/launch.json` resolves Node through mise and its 15 task-picker options
exist in `mise.toml`. It is a curated subset, not broken because newer recovery,
update and scan tasks are absent. The dynamic task picker is an optional UX
improvement, not a container validation requirement.

##### Current actionable findings

| Priority                   | File(s)                                                      | Finding and next action                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 update flow             | `.devcontainer/checksums.sha256`, `update-mise-bootstrap.js` | The same release-manifest URL occurs twice in comments. `replaceOnce` requires exactly one match and aborts. Four isolated updater regressions fail. Keep a single canonical URL or deliberately define unambiguous replacement semantics, with tests. The normal input validator currently still accepts this file.                                                                          |
| P2 editor                  | `.vscode/settings.json`                                      | Remove stale cSpell settings and the deleted spellcheck-directory association. Required spelling checks remain intentionally removed.                                                                                                                                                                                                                                                         |
| P2 editor                  | `.vscode/settings.json`                                      | Commitlint is not a formatter. Remove its default-formatter selection or separately choose a real commit formatter if needed.                                                                                                                                                                                                                                                                 |
| P2 editor                  | `devcontainer.json`, tool/settings config                    | Decide whether Rego needs full editor capabilities. Either provision reviewed/pinned OPA and Regal and select the Rego formatter, or document syntax-only support/remove the extension. Do not silently allow an extension installation prompt to become the tool provisioning strategy.                                                                                                      |
| P2 readiness UX            | `devcontainer.json:59`                                       | `waitFor=postCreateCommand` permits attachment before startup health finishes. Keep this only if attachment and ready-for-work are explicitly distinguished, or wait for postStart validation.                                                                                                                                                                                                |
| P2 Docker diagnostics      | `docker-status.sh`, `devcontainer-workload.py`               | RuntimeError/cleanup failures emit two lines. Passing that captured output to the single-line `status_add` API under `set -e` aborts before `status_print`, losing accumulated rows and the detailed resource IDs. Normalize the diagnostic to a single status value or print it separately while preserving all rows. Helper-only failure fixtures did not establish this shell integration. |
| P2 consistency             | Knip/Dockerfile editor settings                              | Knip uses an extension-bundled version and Dockerfile formatting uses a different provider than the CLI. Decide whether editor/CLI parity is required. A remote round-trip test is needed before asserting parity.                                                                                                                                                                            |
| P3 coverage                | `schemas/devcontainer.schema.json`, input tests              | In-memory schema probes accept an extension entry of `123`, a pnpm mount target of `/wrong-store` and `postStartCommand='bash nonexistent.sh'`. Add targeted shape/path/relationship checks rather than trying to validate every arbitrary shell command. Current legitimate values are correct.                                                                                              |
| P3 environment scope       | `devcontainer.json`, schema                                  | The static pnpm-store variable is in `remoteEnv`. Consider container-wide scope if direct Docker execution should inherit it. The local schema must be extended if adopting `containerEnv`. This is not a demonstrated normal lifecycle failure.                                                                                                                                              |
| P3 hardening/documentation | `docker-status.sh`, Dockerfile                               | Buildx version parsing can accept multiline/noisy output containing an expected version. Dockerfile drift advice still says plain `mise lock`, which is incomplete advice for the coordinated native graph/platform update flow. Tighten parser expectations and point to the explicit updater.                                                                                               |

Retained operational gaps are listed in the current status table: fresh security
evidence, real cross-platform/editor execution, live Renovate activation and
whole-refresh transaction boundaries. Privileged DinD and imperfect image-byte
reproducibility are accepted design boundaries, not newly discovered
regressions. The earlier host offline-cache failure was not rechecked against
the original repository in this audit; it is historical evidence, not a newly
confirmed current failure or a claimed resolution.

##### Verification and report reconciliation

- Current version/checksum/Feature/schema input validation passed.
- Every configured extension ID matched an available local manifest. Formatter
  selection, default executable paths and relevant loader code were inspected.
  Commitlint has no formatting registration in its inspected extension runtime.
- Actual local Prettier 3.9.6 loaded the committed seven-plugin config.
  `getSupportInfo()` confirms support for shell, Dockerfile, JSON, Markdown,
  JavaScript, YAML and `github-actions-workflow`; it does not provide TOML,
  commit-message, Rego, jq or AWK formatting. Tombi supplies TOML separately.
- The full explicitly enumerated Node regression suite completed with 506 tests:
  501 passed, four failed and one skipped. All four failures are in
  `update-mise-bootstrap.test.js` and share
  `expected exactly one upstream checksum URL`. Existing tests create disposable
  fixtures for their mutations.
- All 20 Python image-contract/synchronization tests and six capacity tests
  passed. Schema boundary probes operated on cloned in-memory objects.
- An initial test-runner invocation passed the tests directory instead of
  enumerated test files and failed discovery. The corrected invocation produced
  the totals above. An initial root-level Ajv import failed because that
  dependency belongs to `scripts/node`; the successful boundary probe resolved
  it from that package. Neither preliminary invocation is counted as a product
  regression.
- Original assessment/findings and the outdated line map are now explicitly
  historical. The 2026-09-27 open list is marked partly superseded. The current
  index marks implemented fixes, deliberate removals, pending activation and
  unverified evidence separately. Earlier test results/logs remain unchanged.
- The later workload follow-up accurately records the implemented probe, but its
  broad cleanup-error reporting claim is qualified by the current shell
  integration finding above. No present-day all-green readiness claim is made.

No implementation, dependency, lock, editor-setting, container or Git
configuration changes were made during this audit. Only `OUTPUT.md` was updated.

#### Repository doctor follow-up — 2026-10-02

`scripts/linux/commands/repository/repair.sh` is replaced by `doctor.sh`. The
old `mise run doctor` task meant full readiness. It now means bounded local
diagnosis and safe repair. `mise run health` retains the full readiness
contract. Corresponding pnpm/container commands, README guidance, setup and the
VS Code mise-task picker have been updated. Startup already calls health
directly, and the two lifecycle smoke assertions now explicitly use
`mise run health`.

Doctor defaults to repairing managed local Git settings and LFS filters, active
workspace cache directories, owner executable bits and installed Husky hooks.
`--check` diagnoses those conditions without repairing them. Independent checks
continue after failures and the summary exits nonzero for unresolved issues.
Tool invocations disable mise auto-install, close stdin and share a 120-second
command budget with a maximum of 15 seconds per invocation. This is not a hard
deadline for every filesystem operation or a guarantee against hung storage.

Repairs verify effective Git configuration and Husky runner/wrapper content, not
merely installer exit status. Global/worktree/command overrides are reported.
Custom hook paths, identity, signing, source-hook contents, shared storage
ownership, dependency versions and locks are not reset. Symlinked cache/script
components and generated hooks are refused. There is no sudo, dependency
installation, cache pruning, network fetch or LFS object download in doctor.
Setup retains its previous LFS download/checkout responsibility explicitly. The
repair model assumes trusted files, not concurrent hostile filesystem edits.
General autonomous self-correction remains outside this change.

Verification used disposable Git repositories, not repairs to this workspace:

- The focused doctor matrix passes, covering idempotence, non-mutating checks,
  missing prerequisites, preserved identity/signing/custom hooks, effective
  overrides, global defaults, NUL-safe names, ignored/deleted sources, symlink
  targets, installer failures/false success, corrupt runner/wrappers, bare
  rejection and linked worktrees.
- The combined doctor/Git/signing/info/mise/node/workspace/readiness regression
  run passed 201 tests before the additional corrupted-wrapper case. That case
  was subsequently tested with the full doctor matrix.
- All 20 Python image-contract/synchronization tests pass. ShellCheck, ESLint
  and targeted formatting checks pass for changed implementation files.
- An initial combined non-isolated Node run encountered subprocess restrictions
  and failed. The successful combined run used normal file isolation and
  approved subprocess access. Preliminary fixture failures also exposed a wrong
  Husky executable filename in the test fixture, corrected before the successful
  matrix. Neither is claimed as passing evidence.

No new container lifecycle, security scan, native ARM64 or macOS/Windows editor
execution was performed. Existing unrelated open findings remain open.

#### Gitleaks configuration review — 2026-10-02

`.gitleaks.toml` remains `[extend] useDefault = true`. This inherits maintained
rules and upstream false-positive exceptions from the pinned Gitleaks release.
There are no repository-specific allowlists, disabled rules or baselines to
weaken detection. No custom regexes or broad directory exclusions were needed.
Only comments changed, explaining rule ownership, exceptions and scan scope.

Both secret commands explicitly select this config and redact output. The
history scan uses Gitleaks 8.30.1's default all-ref/full-history traversal, and
CI checks out full history. The pre-commit command scans staged changes. These
are appropriate distinct scopes, not proof that unstaged/untracked content has
been scanned. Upstream exclusions and unsupported/undetected secrets remain tool
boundaries rather than a claim of universal coverage.

Ten real-scanner checks passed in disposable fixtures: clean stdin, GitHub-token
detection, generic API-key detection, clean Git history, unstaged exclusion from
staged scanning, staged rejection, committed rejection, non-current branch
history, untracked directory scanning and invalid-config failure. Synthetic
values were generated only in the temporary fixtures. Tombi lint and a TOML
parse confirming unchanged settings passed. An initial sandboxed scanner timed
out, so the successful matrix used approved subprocess access. The temporary
reproducer is `.local-work/gitleaks-audit.mjs`, not a production dependency.
This is configuration validation, not a fresh secret scan of this repository.

#### Commitlint integration fixes — 2026-10-03

Four findings were confirmed and fixed. The custom empty-scope rule now rejects
whitespace-only scopes as well as literal empty parentheses, without requiring a
scope. The commit-msg hook no longer mandates CSpell, following the decision to
remove required spellchecking. Optional editor spelling support is unchanged. CI
General now validates the full pull-request base/head commit range with full Git
history, read-only permissions and no persisted checkout credentials. The commit
editor no longer selects a diagnostics-only extension as its formatter, and
disables inherited format-on-save. Commitlint diagnostics remain available.

Existing optional scopes, warning-only length limits, generated-merge ignores
and either breaking-change marker are intentional behavior, not defects.

All 22 permanent regression tests in `scripts/node/tests/commitlint.test.js`
passed. These use the installed Commitlint implementation and disposable Git
repositories, including real hook rejection, filenames containing spaces and an
invalid intermediate commit caught by range validation but missed by `--last`.
The fixture dispatches only the hook's package command to the real runner; it
does not install tools or exercise unrelated pre-commit checks. The initial
sandboxed run failed; the successful run used approved subprocess access.
ESLint, ShellCheck, Prettier, actionlint, yamllint and offline Zizmor passed for
the changed implementation files and workflow. No live GitHub Actions run,
interactive prompt session or VS Code runtime test is claimed.

#### Git ignore and attribute policy fixes — 2026-10-03

The root ignore file remains a deny-by-default allowlist with traversable
directories, generic root configuration extensions and existing global runtime
cache safeguards. Duplicate exceptions were removed. Node and Python script
folders now have focused nested denylists for dependencies, caches, build/test
outputs, logs and local environment files. Example environment files remain
trackable. Headers now distinguish directory traversal from descendant rules,
nested precedence and already-tracked files.

Attributes now default detected text to LF checkouts, preserving explicit CRLF
exceptions and opaque binary/patch bytes. Python lives under source code with
the built-in Python diff driver. Dockerfile suffixes have an explicit LF rule.
SVG outside media is text; media assets remain LFS-managed. Markdown and MDX in
media are excluded from LFS and retain normal merge fallback. Unsupported
document-converter declarations were replaced with text/binary handling. Export
exclusions remain optional template customization, not active policy.

All four permanent `git-policies.test.js` regression groups passed with approved
subprocess access. They cover nested ignore rules, effective attributes, all
current native sidecar bytes across four autocrlf/eol configurations and a real
non-overlapping media Markdown merge. ESLint, Prettier and targeted diff checks
passed. The original workspace index and native lock bytes were not modified.
This is Linux Git simulation of checkout settings, not native Windows/macOS
evidence or an LFS network-download test.

#### YAML formatter alignment — 2026-10-03

The yamllint configuration now has an explanatory header and excludes nested
dependency/generated directories, while preserving root project/native-lock
exclusions. Current strict YAML linting passes. A compatibility probe found that
Prettier removed quotes from "yes", causing a yamllint truthy warning that fails
strict mode. The installed YAML plugin now selectively quotes the twelve YAML
1.1 yes/no/on/off spellings in both YAML extensions. Actual boolean values,
workflow keys and unrelated scalar types retain their semantics.

All 26 permanent formatter regressions and 24 real Prettier-to-yamllint probes
passed. The current linted YAML files also pass formatting checks and the full
strict YAML scan. ESLint and targeted whitespace checks pass. No dependency,
lockfile or schema policy changed. No live CI or VS Code runtime is claimed.

#### Generated-content and workspace-cache policy — 2026-10-03

The generated-directory inventory and ownership rules are recorded in
`docs/generated-content.md`. Repository outputs belong in `.generated/`, caches
in `.cache/<tool>/`. A script's existing path is not tool discovery. The root
ignore file now documents narrowly scoped generated-artifact exceptions while
keeping all generated content opt-in and caches ignored. No generated report was
newly selected for tracking. Prettier and yamllint skip generated output and
tool caches, preserving generator ownership.

Prettier, Knip, Trivy and POSIX Commitizen now use tool-named workspace caches.
Both Python test loaders use Python's native cache-prefix setting for their
repository imports. Doctor and workspace readiness agree on these five cache
folders. CI restore/save paths and cache-key namespaces were updated together.
The empty test-cache restore/save steps and readiness requirement were removed
because the current test command has no cache producer. Existing on-disk caches
and bytecode were not deleted or relocated.

The user explicitly deferred recovery-state and hook-layout migration. Native
mise sidecars and Node dependency layouts remain tool-owned. Container-wide
stores, installer caches and runtime state are listed separately, not claimed as
migrated. Commitizen's installed cache library ignores XDG_CACHE_HOME on
macOS/Windows; this remains a documented cross-platform cache-layout gap.

The final 90 isolated doctor/readiness/Git-policy tests and all 26 Python tests
passed. An earlier 112-test run including Commitlint passed before the final two
cache folders were added to readiness expectations. ShellCheck, ESLint,
actionlint, strict yamllint, offline Zizmor and targeted formatting/Markdown
checks passed. No live CI, container rebuild or native macOS/Windows execution
was performed, and no native graph bytes or dependency locks changed.

##### 2026-10-03 — Local conflict resolution reuse

Git rerere is enabled locally with automatic index updates disabled. Setup's
doctor applies and verifies both owned settings, and Git readiness reports
missing or overridden settings in red. Manual setup commands and review/forget
guidance are documented in README.md. Git owns the local resolution cache; no
workspace cache relocation or committed resolution database is introduced.

All 96 isolated doctor, readiness and Git-policy regressions passed. A real
repeated merge conflict reused the recorded working-tree resolution while the
index remained unmerged until explicit staging. Missing settings, unsafe
effective overrides and alternate boolean spellings were covered. ShellCheck,
ESLint and targeted formatting checks passed. The current repository's local
settings were enabled and read back; global Git configuration was not changed.
No fresh container build or native macOS/Windows execution was performed.

##### 2026-10-03 — Organization shell and project boundaries

The repository separates organization automation, ordinary projects and
independent submodules. Direct projects and optional package projects join the
pnpm workspace; submodules do not. The dependency-free projects/example harness
owns its Git denylist, editor, formatter, staged-file and ESLint policy. Its
different indentation/quotes/semicolons exercise overrides. pnpm added its empty
importer offline; a frozen offline install without lifecycle scripts passed. No
new package version or mise native graph bytes were introduced.

Shared formatting, YAML and EditorConfig checks route installed native tools
through each project's working directory, preferring local binaries/configs.
Root passes exclude project directories before separate project checks.
Application-specific ESLint, shell lint, Markdown policy and schemas remain
project-owned. Git text handling and secret scans still cover ordinary monorepo
files, but parent secret scans do not recursively cover submodule history.

mise uses explicit config roots, native task namespaces and project-local tool
locks. Parent tool declarations remain inherited defaults. The documented and
tested MISE_CEILING_PATHS session setting isolates independent submodule tools.
There is no implicit submodule initialization or hidden environment mutation.

The tests create a real 160000-mode local submodule from a disposable Git
origin. No remote was cloned, no main-workspace submodule was registered and no
remote was written. Existing empty submodule directories were preserved.
Ownership and commands are documented in projects/README.md.
organization.code-workspace gives separate VS Code folder contexts; actual
extension/save execution is untested.

All 10 boundary tests passed without skips, covering local style/exclusions,
staged config ownership, application lint isolation, YAML/EditorConfig
overrides, symlink avoidance, native failure codes, submodule preservation and
mise boundaries. The example's format/lint/test checks passed. Targeted
ShellCheck, ESLint, Markdown, formatting, YAML and TOML checks passed. Relevant
container input, dependency-readiness, doctor, readiness and Git-policy
regressions passed.

The full pinned-Node run reported 599 tests, 594 passes, four failures and one
skip. All failures are in the existing bootstrap updater: the checksum header
has two release-manifest URLs, but its replacement requires exactly one. Neither
file changed in this project work. Knip still reports the existing unused
@prettier/plugin-oxc and cspell dependencies; the dynamically routed
EditorConfig checker is explicitly recorded as used. These gaps remain open, so
the whole repository is not claimed to pass. No new container lifecycle, live CI
or native Windows/macOS execution was performed.

##### 2026-10-03 — Cache cleanup layout alignment

A remaining legacy producer was found in devcontainer-clear.sh. It recreated
general/cspell, general/knip, general/prettier, general/trivy, local and test
after explicit cleanup. It now recreates knip, prettier, commitizen, python and
trivy directly under .cache, matching doctor, readiness, native tool outputs and
CI. No other active script/CI grouping path remains. Historical cache-layout
notes and deliberate legacy fixtures remain for documentation and regression
coverage.

Four isolated tests passed: cache-name agreement, non-mutating preview, explicit
cleanup directory layout and symlink refusal. Docker was replaced by a fixture
client with no real resources. ShellCheck, ESLint and formatting passed.
Existing workspace cache data, containers and volumes were not deleted or
migrated.

##### 2026-10-03 — Attributes-owned Git line endings

Doctor now maintains repository-local core.autocrlf=false when .gitattributes is
present and readable. Setup already delegates to doctor. Attributes remain the
conversion authority, including explicit CRLF exceptions; core.eol is not added
because the tracked default already specifies LF. No renormalization, index
rewrite, checkout or global/submodule Git change is performed automatically. Git
readiness checks local and effective policy, reporting missing settings,
overrides and unavailable attributes as red failures. Manual setup and header
comments explain the contract. Existing checkouts must rerun doctor/setup to
apply the new local setting; the working repository's config was not changed.

All 104 relevant tests passed: 29 doctor, 69 readiness and six Git-policy tests.
Cases cover true/input inherited and local values, normalized false spellings,
higher-priority overrides, unchanged existing CRLF bytes/index, read-only
checks, linked worktrees, LF/CRLF exceptions, binary preservation and native
lock bytes. Readiness subprocess tests were rerun outside the sandbox after
EPERM failures. ShellCheck, ESLint, Markdown and formatting checks passed. These
are isolated Linux Git tests, not fresh container or native Windows/macOS
execution evidence.

##### 2026-10-03 — Project task scheduling with Turborepo

Added exact root devDependency turbo 2.11.7 and its pnpm-owned lock entries.
Turborepo was chosen over Nx for explicit package-script scheduling without
introducing framework generators or inferred application policy. pnpm remains
the package/lock owner and mise remains the stable organization task interface.
projects:build/check/dev/test select ordinary projects only; root automation and
submodules remain outside command selection. Non-package projects can continue
using their own mise tasks. Readiness does not execute application tasks.

Builds and tests wait for dependency builds; declared dev servers are persistent
and uncached. Missing scripts are skipped, not evidence that an application has
tests or deployment configuration. Defaults are uncached. The example opts into
local caching for deterministic tests, with shared configuration/toolchain
inputs included in hashes. Remote caching and automatic AGENTS.md edits are
disabled. Caches resolve to checkout-local .cache/turbo, including in linked
worktrees. Turbo's native per-package .turbo task-log location has no relocation
setting; the example owns its ignore/formatter exclusions and the exception is
documented in docs/generated-content.md. New project owners must do the same.

Added the official VS Code extension to existing host recommendations and the
devcontainer list, preserving prior recommendations. Configurations reference
the matching versioned schema; tests validate against the installed schema
offline. The schema URL resolved successfully. Single-folder and multi-root
editor settings permit Turbo's versioned schema domains specifically, without
allowing arbitrary domains. When updating the package, maintainers must also
update the two versioned schema URLs; tests enforce this. Renovate already
tracks npm dependencies, but bot activation remains external.

All six new isolated task regressions and ten existing ownership regressions
passed. Cases cover ordinary/shared-package selection, submodule/root exclusion,
read-only AGENTS preservation, uncached execution, deliberate failure,
dependency ordering/blocking, cache hits/source and shared-config invalidation,
persistent dev definitions and native schema validation. Fixtures use local
temporary Git repositories and installed binaries without fetching packages or
starting services. Initial fixture PATH resolution reached Corepack; tests now
prefer installed mise pnpm and forbid Corepack network access. Two boundary
subprocess output assertions passed when rerun outside sandbox restrictions.

The real example check/test and mise project-task dispatch passed. Frozen
offline pnpm installation, ESLint, formatting, Markdown, TOML, all 33 mise task
definitions, schema validation and devcontainer input validation passed. Knip
still reports the existing unused CSpell/OXC dependencies, with no new unused
dependency. No full regression suite, fresh container lifecycle, actual editor
activation, native ARM64/macOS/Windows or application deployment execution is
claimed.

##### 2026-10-03 — Local organization infrastructure reference

Copied the requested sibling template's infrastructure directory to an
independent local repository at projects/submodules/infrastructure. All 69
source files are byte-identical and the source was unchanged. Added a local
repository ignore list, created a synthetic initial commit and verified 70
tracked files, clean Git state and no remotes. This is a snapshot, not preserved
source history or a registered submodule. No parent gitlink/index entry or
.gitmodules URL was added. A local nested ignore excludes the copy and itself
from parent staging. The root allowlist overrides info/exclude, so that
ineffective alternative was tested and removed. Ignore behavior was verified.

The reference includes Terraform modules, Kubernetes/Kustomize resources and
Rego, plus shared DNS/ingress/private TLS, identity/RBAC, VPN, mail, portal,
observability and media contracts. Nx definitions still assume the original
parent workspace and bootstrap. The copy is therefore not a complete standalone
runtime. Preserved that ownership rather than migrating infrastructure to Turbo.
The detailed local-only map lives in .local-work/INFRASTRUCTURE.md. Organization
instructions record the distinction and VS Code includes a separate folder.

Installed Gitleaks reported no leaks in the source scan, not a security
guarantee. Ignore checks preserve templates while excluding secrets, state,
caches and generated output. Turbo still selects only the ordinary example. No
dependencies, remotes, services, Terraform initialization/plans/applies,
deployments or source edits occurred. Runtime/editor verification remains open.

##### 2026-10-03 — Shared tooling for ordinary projects

Ordinary projects reuse tools installed in the organization shell rather than
requiring isolated installations. Application configs take precedence, with
shell defaults used where no project config exists. Independent submodules
remain excluded. Husky, commitlint and Gitleaks belong to the shared Git
repository, not a separate installation per ordinary project.

Removed the blanket project ESLint exclusion and routed checks by owner. Native
ESLint 10 file-based discovery selects project flat configs or the ancestor
shell config. The fallback provides generic JavaScript correctness rules, not
guessed runtime globals, framework rules or TypeScript parsers. Added basic
JavaScript linting to the ordinary-project staged-file fallback. Local configs
replace that fallback, and projects with their own ESLint config own their
ignore policy.

Added ordinary-project Dockerfile discovery using Git-visible files and project
Hadolint config or shell defaults. ShellCheck now includes ordinary scripts and
honors native configuration lookup. Registry restrictions apply only to the
devcontainer checks. Testing found that the previous trusted-registries YAML key
was silently ignored; the devcontainer task now uses the documented
--trusted-registry option and regression tests verify rejection. Hadolint's
actual YAML configuration key is trustedRegistries. Added shared lint configs to
Turbo's cache inputs and documented defaults and editor discovery boundaries.

All 15 isolated ownership regressions and six Turbo task regressions passed.
Cases include fallback without project installations, local overrides, projects
without JavaScript, staged failure/correction, ignored Dockerfiles, registry
rejection and native ShellCheck fallback. The real shared JavaScript and
Dockerfile checks passed. Targeted ShellCheck, ESLint, Prettier, Markdown, YAML,
TOML and diff-whitespace checks passed. The full 75-script ShellCheck scan did
not complete within a bounded run; this is not a full-shell lint pass.
Sandbox-blocked native subprocess tests were rerun with approval.

No new dependencies, infrastructure changes, deployments, fresh container
lifecycle or actual editor execution are claimed. Hadolint's VS Code extension
uses its workspace-folder config lookup rather than this CLI router's explicit
fallback; separate project folders need a config or an explicit shell config
path when using that extension.

##### 2026-10-03 — Infrastructure-owned organization media

Organization media belongs to the infrastructure media server rather than the
organization shell root. Removed the root media placeholder README (the only
file), its allowlist entry and root media-specific LFS attributes. Updated the
layout and ownership guidance. No asset bytes needed moving, and the independent
local infrastructure reference was not changed. Existing remote README image
URLs were preserved; no replacement server URL has been specified.

The shell still installs/configures Git LFS and validates opted-in pointers.
Ordinary projects own optional attributes, and independent infrastructure owns
its storage/publication and Git policy. Root validation does not recursively
validate submodule assets. The Git-policy regressions now verify project LFS
opt-in without affecting another project, ignored root media, ordinary Markdown
merging and the absence of root media LFS rules. All seven isolated Git-policy
tests passed, along with ESLint, formatting, Markdown and diff-whitespace
checks. No media server, deployment or asset migration was performed.

##### 2026-10-03 — Explicit local schemas and automated refresh

Schema-backed shell configuration now declares local files under schemas/.
Replaced external JSON/YAML references and the node_modules Markdown schema
reference. Package manifests also declare local schemas. VS Code single-folder
and organization-workspace settings disable JSON downloads, automatic YAML
SchemaStore association and external Kubernetes CRD lookup. Built-in editor
settings schemas remain editor-provided. Projects/submodules retain ownership.

Selected the maintained @apidevtools/json-schema-ref-parser for reference
bundling and the existing Renovate updater rather than adding a second updater
or implementing reference resolution. The small repository policy layer owns
source/version selection, safe acquisition, provenance and offline drift checks.
Vendir was considered, but generic file vendoring alone does not bundle schema
references or align tool-shipped schemas with the installed package graph.

sources.json pins SchemaStore to a Git revision, Renovate's schema to an exact
package version and tool schemas to their declared versions. Knip, Turbo and
Markdownlint sources use installed frozen packages. sources.lock.json records
acquisition URLs/dependency hashes, tool versions, bundled hashes and license
hashes. Upstream license text is included and preserved without formatter or
checkout normalization. Bundles are updater-owned. The devcontainer and
source-inventory schemas remain hand-authored repository contracts. The explicit
schemas location is a documented exception to .generated.

The updater restricts remote hosts, rejects redirects and arbitrary local-file
reads, bounds request time/body size and completes acquisition before writes.
Failures before writes preserve existing outputs; interrupted multi-file writes
are detected by the lock check, not automatically recovered. Hashes detect
drift, not independent publisher authenticity. Schema identifiers/draft URIs
remain standard metadata rather than runtime fetch dependencies.

Schema lint now verifies hashes/version alignment before validating local JSON,
JSONC and YAML. External schema references fail instead of being skipped.
Fourteen local schemas validate eighteen configuration files with zero external
references. The published Renovate schema forbids global administrator options
at its root. The separately documented global variant removes that constraint
only and preserves upstream definitions; an incompatible upstream shape stops
the updater for review.

Renovate custom extraction tracks the SchemaStore commit and Renovate schema
version. The existing self-hosted post-upgrade flow installs frozen pnpm
dependencies without lifecycle scripts and refreshes schema artifacts. The
administrator allowlist includes the exact schemas:update command. Schema-only
updates do not run the Docker maintenance hook; toolchain updates retain it. Bot
activation/credentials remain external and automerge remains disabled. The
schema Git-ref rule disables release-age gating because that datasource supplies
no release timestamp; schedules and reviews still apply. Manual update is pnpm
run schemas:update; offline verification is pnpm run schemas:check followed by
pnpm run lint:schema.

All eleven isolated schema regressions, seven Renovate configuration
regressions, fifteen project-ownership regressions and six Turbo regressions
passed (39 total). Covered reference bundling, pin/hash/license drift, unsafe
targets, package mismatch, rejected hosts/local reads, HTTP/body limits,
download failure, JSONC validation and global adaptation. A real regeneration
exposed nondeterministic dependency-record insertion order; canonical sorting
and a completion-order regression fixed it. All twenty schema/license/lock
outputs were byte-identical on a subsequent independent upstream regeneration.
Initial sandbox subprocess failures were rerun with approval and the pinned
runtime. New license files and the example's four-space indentation are
protected by their owning policies.

Offline frozen installation, schema lint, devcontainer input validation,
targeted ESLint/ShellCheck, Markdown, YAML, TOML, formatting and whitespace
checks passed. No complete-suite pass, new container lifecycle, live Renovate
run or actual VS Code activation is claimed. Earlier external-schema skips and
trusted-domain settings remain historical, superseded by this follow-up.

## Historical agent audit context

These notes and the original container-test table were moved from AGENTS.md
without discarding their evidence. Their dated test counts and tool versions are
historical, not pins to copy over current configuration.

### Recorded container test — 2026-09-26

This is historical evidence from the disposable `mise run test:devcontainer`
execution, not a claim that the current tree passes. Preserve the distinction
between container startup and successful lifecycle validation.

| Test stage                           | Result           | Observation                                                                                                                                         |
| ------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolated workspace                   | Passed           | Current working tree copied to a temporary repository.                                                                                              |
| Configuration and feature resolution | Passed           | CLI resolved the configured Docker-in-Docker feature.                                                                                               |
| Base image                           | Passed           | Pinned Bookworm image resolved.                                                                                                                     |
| No-cache image build                 | Passed           | Image built successfully.                                                                                                                           |
| mise tool installation               | Passed           | Locked tools downloaded and installed; verification messages observed.                                                                              |
| Docker-in-Docker installation        | Passed           | Docker, Buildx, and Compose installed.                                                                                                              |
| Container creation                   | Passed           | Disposable privileged container and volumes created.                                                                                                |
| Container process startup            | Passed           | `Container started` observed.                                                                                                                       |
| postCreateCommand                    | Passed           | Dependency installation and setup completed.                                                                                                        |
| pnpm dependencies                    | Passed           | Frozen installation completed.                                                                                                                      |
| Git LFS initialization               | Passed           | Local filters initialized.                                                                                                                          |
| Repository repair                    | Passed           | Git settings, executable bits, and Husky setup completed.                                                                                           |
| postStartCommand                     | Failed           | `mise run init` propagated health-check failure.                                                                                                    |
| Dictionary validation                | Failed           | Missing `.cspell.json`.                                                                                                                             |
| Attribute validation                 | Warning          | Missing file rules and uppercase `.Dockerfile` extensions; check still passed.                                                                      |
| LFS validation                       | Passed / limited | No tracked LFS files; fsck skipped for unborn HEAD.                                                                                                 |
| Docker client version                | Failed           | `29.6.0-1` compared with `29.6.0`.                                                                                                                  |
| Docker daemon version                | Failed           | `29.6.0-1` compared with `29.6.0`.                                                                                                                  |
| Docker daemon availability           | Passed           | Local dockerd detected and queried.                                                                                                                 |
| Docker context and endpoint          | Passed           | Default context and Unix socket reported.                                                                                                           |
| Buildx version                       | Failed           | Installed `0.37.1`, expected `0.37.0`.                                                                                                              |
| Docker builder                       | Passed           | Default builder reported running.                                                                                                                   |
| Compose availability                 | Passed           | `2.40.3` reported; workload test was not reached.                                                                                                   |
| Git readiness                        | Failed           | user.name and user.email unset in the fresh test repository. Signing disabled and origin absent were informational, not established failure causes. |
| mise readiness                       | Passed           | Expected version, system source, trust, tools, and Linux lock version entries reported.                                                             |
| Node readiness                       | Passed           | Node/pnpm versions and installed dependencies reported.                                                                                             |
| Workspace status                     | Passed           | Debian 12, amd64, and container detected.                                                                                                           |
| Dedicated runtime assertions         | Not reached      | Initial `devcontainer up` exited before these assertions.                                                                                           |
| Stop/restart                         | Not reached      | Initial lifecycle failed.                                                                                                                           |
| Offline pnpm reinstall               | Not reached      | Initial lifecycle failed.                                                                                                                           |
| Repository preservation              | Observed         | Git status hash unchanged; this was not a full file-content hash comparison.                                                                        |
| Automatic cleanup                    | Failed           | Temporary workspace removed but container, three volumes, and two images remained.                                                                  |
| Manual cleanup                       | Passed           | Exact disposable container, volumes, and image tags removed afterward.                                                                              |

The subsequent lifecycle audit and its evidence are recorded in
`the historical audit archive above`. Do not treat its original findings or
proposed fixes as already implemented. The implementation follow-up at the end
records subsequent fixes and tests: amd64 lifecycle/startup/restart/offline
reinstall now pass, while the image vulnerability gate and full transitive
reproducibility remain open. Preserve both the historical failures and the
distinction between readiness and security.

The 2026-09-30 native-lock migration pins mise 2026.9.18 and uv 0.12.10, uses
format-3 mise.lock plus committed `.mise/locks` sidecars, and defaults installs
to frozen mode. Preserve sidecar bytes: mise owns their checksums. A disposable
amd64 no-cache lifecycle/startup/restart/offline reinstall passed after this
migration; details and preliminary failures are in the historical audit archive
above. This improves npm/Python graph reproducibility but does not resolve
rolling Moby packages, byte-identical images, ARM64 runtime verification or the
vulnerability gate.

The 2026-10-01 simplification removes image publication, registry promotion,
Cosign CLI/signing tasks and optional OCI byte-comparison diagnostics. Keep DinD
and timestamp normalization: byte similarity is best effort, not a measured
percentage or readiness requirement. The bootstrap updater now verifies the mise
publisher's Minisign signature against a pinned key before accepting hashes.
Minisign 0.12 is locked; `.mise/aqua.yaml` corrects the upstream registry's
missing Linux ARM64 platform while retaining publisher-signature verification.
Preserve this registry in build inputs, update candidates and the image
contract. Workspace readiness checks free bytes/inodes on accessible workspace,
temporary, pnpm and DinD storage. Defaults are 1024 MiB and 1000 free inodes,
configurable with DEVCONTAINER_MIN_FREE_MIB and DEVCONTAINER_MIN_FREE_INODES.
These are readiness floors, not host/VM capacity guarantees; do not
automatically prune. A disposable amd64 no-cache lifecycle passed, including
forced capacity failures, red output, restart and offline reinstall. Real
publisher-signature verification, tampering rejection and an isolated idempotent
update passed. The final suite has 57 Node tests, 13 image-contract tests and 6
capacity tests. Crash recovery remains deliberately deferred. No new
vulnerability scan, ARM64 runtime or Windows/macOS VS Code execution is claimed.

The subsequent 2026-10-01 cache/recovery follow-up isolates mise, pip, uv, npm
and Node compile caches in locked BuildKit mounts and clears the Dockerfile's
APT cache/lists/logs. uv uses copy mode; installed metadata/bytecode are
retained. The official DinD Feature may regenerate APT logs later. Bootstrap
updates now use a durable four-file journal with flock serialization.
Startup/creation recover with image-provided Node before parsing the workspace
mise config. Recovery refuses conflicting later edits; it never resets volumes
or repairs datastores. Host devcontainer-recover.sh defaults to preview;
--restart selects one exact existing workspace container and reruns bounded
lifecycle validation. A disposable amd64 no-cache lifecycle passed, including
empty installer caches, an interrupted bootstrap with an unusable
minimum-version setting, SIGKILL, recovery, preserved volumes/nested Docker data
and offline reinstall. The final suite has 77 Node tests, 13 image-contract
tests and 6 capacity tests. Linux flock/local-filesystem recovery is supported;
no real host power loss, ARM64, Windows/macOS runtime or new vulnerability
evidence is claimed. Earlier notes that recovery was deferred remain historical,
superseded by this follow-up.

The later 2026-10-01 ownership/update follow-up removes the vscode login/group
assumption while retaining an explicit UID 1000 image convention. Debian remains
the sole configured Python interpreter; mise owns uv/pipx/tool graphs and uv
interpreter downloads are disabled during installation/refresh. versions.env
remains canonical for the dated Debian package set and signed mise bootstrap.
Renovate replaces Dependabot configuration, with an exact allowed refresh hook
and an administrator-owned self-hosted template. Activation/credentials remain
external operator steps, not readiness requirements. Refresh uses verified mise,
candidate uv, native sidecar bumping, both Linux targets and coupled package
pins; Node/pnpm declarations derive from mise. --check, readiness and image
recording validate exact pins and artifact completeness separately from
version-only mise dry-run JSON. Preserve native graph bytes; only mise may
regenerate them. 98 Node tests, 20 image-contract/synchronization tests, 6
capacity tests and 7 real Docker account variants pass. An isolated refreshed
snapshot/native-graph candidate passed the final amd64 no-cache
lifecycle/recovery/offline reinstall. No live bot run, new vulnerability scan or
native ARM64/Windows/macOS execution is claimed. See the follow-up in the
historical audit archive above for evidence and update boundaries.
