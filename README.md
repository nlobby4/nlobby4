<!-- ? ############################################# -->
<!-- ? Links -->

<!--
  Shields: https://shields.io/
  Unicode: https://www.amp-what.com/
  Spaces:  https://jkorpela.fi/chars/spaces.html
-->

<!-- ? ############################################# -->
<!-- ? Header -->

<a id="readme-top"></a>

<h1 align="center">

![nlobby4][logo]![banner][banner]

[![founded][founded]](https://github.com/nlobby4)
[![npm][npm]](https://www.npmjs.com/org/nlobby4)
[![website][website]](https://nlobby4.org)
[![discord][discord]](https://discord.gg/flockmod)
[![flockmod][flockmod]](https://flockmod.com/r/nlobby4)

</h1>

<!-- ? ############################################# -->
<!-- ? Description -->

This repository is nlobby4's main organization monorepo. Most projects are
managed directly under `projects/`, with shared CI workflows, development
container configuration, commit conventions, formatting rules, repository checks
and Git LFS support.

The root also serves as an organization development shell around projects under
`projects/`. Ordinary projects reuse shell-installed formatters, linters and Git
hooks. Shared checks respect project configs and otherwise use shell defaults;
application-specific framework rules and tests remain project-owned. Independent
Git repositories belong under `projects/submodules/`. See
[project ownership and workflows](projects/README.md) and open
`organization.code-workspace` for separate VS Code folder contexts.

Projects requiring their own repository-level features, such as GitHub Pages,
GitHub wikis or GitHub template repositories, are included as submodules.
Otherwise, direct monorepo management is the default. Node supports internal
automation and does not constrain project languages or frameworks.

<!-- ? ############################################# -->
<!-- ? URLs -->
<!-- markdownlint-disable MD013 -->

<div align="center">
  <span>ⓘ <a href="https://nlobby4.org/news/">[NEWS]</a></span>
  <span> 🖂 <a href="mailto:contact@nlobby4.org">[CONTACT]</a></span>
  <span> ★ <a href="https://github.com/nlobby4/nlobby4/issues/new?template=feature.yml">[REQUEST FEATURE]</a></span>
  <span> &#x26A0;&#xFE0E; <a href="https://github.com/nlobby4/nlobby4/issues/new?template=bug.yml">[REPORT BUG]</a></span>
</div>

<br>

<!-- markdownlint-enable MD013 -->
<!-- ? ############################################# -->
<!-- ? Table of Contents -->

<details>
  <summary>Table of Contents</summary>

  <ol>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#a-copy-to-an-existing-repository">A. Copy to an Existing Repository</a></li>
        <li><a href="#b-start-a-new-repository">B. Start a New Repository</a></li>
      </ul>
    </li>
    <li><a href="#dev-container">Dev Container</a></li>
    <li><a href="#what-is-included">What Is Included</a></li>
    <li><a href="#apply-these-changes">Apply These Changes</a></li>
    <li><a href="#for-outside-collaborators">For Outside Collaborators</a></li>
  </ol>

</details>

<!-- ? ############################################# -->
<!-- ? Main Area -->

## Usage

Clone the organization monorepo and use its shared development environment.
Directly managed projects belong under `projects/`, and npm packages belong
under `projects/packages/`.

```sh
git clone https://github.com/nlobby4/nlobby4.git
cd nlobby4
```

Infrastructure is a private submodule. Authorized contributors can initialize it
separately; access is not required for the root development setup.

```sh
git submodule update --init projects/submodules/infrastructure
```

The parent pins an infrastructure commit. Commit and publish infrastructure
changes in its own repository before updating that pointer in the monorepo.

<p align="right">[<a href="#readme-top">back to top</a>]</p>

---

## Development Setup

The Dev Container is the recommended path for a repeatable development
environment. A managed local setup is also available, but mise supplies only the
tools in `mise.toml`, not the system dependencies installed by the Dockerfile.

Before using the local path, install mise at the version in
`.devcontainer/versions.env`, Bash 4 or newer, Git, GNU coreutils (including
`timeout`), Python 3.11+ with venv support and a `python` command, and the
Dockerfile's direct dependencies: curl, Git LFS, jq, Python-based yq (not the Go
implementation), GNU awk, and cmark-gfm. Native Linux is the closest match;
stock macOS Bash/coreutils and Windows shells are not equivalent without
additional provisioning.

Full readiness checks also require an accessible Docker daemon, Buildx and
Compose matching the versions in `devcontainer.json`, and your own Git
`user.name`/`user.email`. Setup does not provision host Docker or invent a Git
identity. See
[the devcontainer guide and backlog](TODO.md#devcontainer-operating-guide).

For a stopped or unresponsive Dev Container, preview data-preserving recovery on
the Docker host with
`bash scripts/linux/commands/devcontainer/devcontainer-recover.sh`; add
`--restart` to restart the existing container and rerun lifecycle validation.
See the guide for the optional host dependencies and recovery limits.

From the repository root, use mise as the tool and task entry point:

```sh
mise trust
mise install --locked
mise run setup
```

The setup task installs the locked pnpm dependencies, configures the
repository-local Git settings, initializes Git LFS, restores executable bits,
and installs the Husky hooks.

To bypass mise task orchestration while retaining mise tool management:

```sh
mise trust
mise install --locked
mise exec -- pnpm install --frozen-lockfile --ignore-scripts
mise exec -- bash scripts/linux/commands/repository/setup.sh
```

To configure only the Git integrations without running the setup script, use
their equivalent manual commands:

```sh
git config --local blame.ignoreRevsFile .git-blame-ignore-revs
git config --local commit.template .gitmessage
git config --local core.autocrlf false
git config --local rerere.enabled true
git config --local rerere.autoupdate false
git lfs install --local
git lfs pull
```

Local `core.autocrlf=false` leaves line-ending conversion to `.gitattributes`,
including its LF default and explicit CRLF exceptions. Setup/doctor maintains
this setting without rewriting files or renormalizing the index. Global Git
settings and independent submodules are not changed.

Git's [rerere](https://git-scm.com/docs/git-rerere) remembers conflict
resolutions locally and reuses them during later merges or rebases. Automatic
staging stays disabled so you can review and test reused changes before
`git add`. Use `git rerere forget -- <path>` during a conflict to discard an
incorrect remembered resolution. Records stay in Git's native metadata, not in
committed files.

The manual path must be repeated when the corresponding toolchain, dependencies,
or repository-local configuration changes.

Run `mise run health` to check readiness after setup. Successful setup alone
does not establish readiness, security, or byte-identical image rebuilds.

`mise run doctor` diagnoses and repairs safe repository-local setup. Use
`mise run doctor -- --check` to report these issues without changing setup. It
repairs managed Git settings/LFS filters, workspace caches, executable
permissions and installed Husky hooks. It preserves custom hook paths and never
downloads LFS objects, installs dependencies, changes identity/signing, resets
files, changes shared-store ownership or updates locks. Unresolved checks fail
with manual-action guidance. Run health afterward for full readiness.

Security and configuration checks are available through stable tasks:

```sh
mise run lint:secrets
mise run lint:secrets:staged
mise run lint:dockerfile
mise run lint:policy
mise run lint:toml
mise run lint:yaml
```

The equivalent `pnpm run` commands are also supported. Tasks prefixed with `ci:`
are internal workflow interfaces and may change with the workflows.

<p align="right">[<a href="#readme-top">back to top</a>]</p>

---

## Dev Container

The repository includes a Dev Container for local development. It provisions the
shared toolchain during the image build, installs root Node.js dependencies when
workspace content is available, runs repository and project setup when the
container is created, and runs bounded repository health checks when it starts.

### VS Code

Install the
[Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers),
open this repository in VS Code, and run **Dev Containers: Reopen in Container**
from the command palette.

To apply personal dotfiles, configure them in your VS Code user settings before
creating or rebuilding the container:

```json
{
  "dotfiles.installCommand": "install.sh",
  "dotfiles.repository": "your-github-id/your-dotfiles-repo",
  "dotfiles.targetPath": "~/dotfiles"
}
```

The Dev Containers extension clones that repository into the container and runs
the install command when the container is created. Keep dotfiles in user
settings rather than `.devcontainer/devcontainer.json`, because shell aliases,
Git identity, editor preferences, and prompt configuration are personal
customizations rather than project requirements.

### Dev Container CLI

VS Code's Dev Containers workflow needs Docker and the extension, not host mise.
The command-line workflow below additionally uses host mise 2026.9.18 or newer
to supply Node and the Dev Container CLI.

Install the pinned host tools with mise:

```sh
mise install --locked node npm:pnpm npm:@devcontainers/cli
```

Start the container:

```sh
mise exec -- devcontainer up --workspace-folder . --frozen-lockfile
```

Start the container with personal dotfiles:

```sh
mise exec -- devcontainer up \
  --workspace-folder . \
  --frozen-lockfile \
  --dotfiles-repository https://github.com/your-github-id/your-dotfiles-repo.git \
  --dotfiles-target-path ~/dotfiles \
  --dotfiles-install-command install.sh
```

Unlike the VS Code Dev Containers extension, direct `devcontainer-cli` usage
does not automatically copy your local Git identity into the container. If you
use the CLI, make sure your dotfiles install script creates a usable
`~/.gitconfig`, or configure Git after the container starts:

```sh
devcontainer exec --workspace-folder . git config --global user.name "Your Name"
devcontainer exec --workspace-folder . git config --global user.email "you@example.com"
```

Rebuild the container from scratch:

```sh
mise run devcontainer:rebuild
```

Run a command inside the container:

```sh
mise exec -- devcontainer exec --workspace-folder . bash scripts/linux/commands/repository/health.sh
```

The Dev Container CLI is managed through `mise.toml` rather than installed as a
repository package. Running `mise install --locked` makes the pinned CLI
available for host-side `devcontainer:*` tasks. VS Code users can instead use
the Dev Containers extension directly.

For more information, see the
[VS Code Dev Containers dotfiles documentation](https://code.visualstudio.com/docs/devcontainers/containers#_personalizing-with-dotfile-repositories)
and the
[Dev Container CLI documentation](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli).

### Git Helper Regression Tests

```sh
node --test scripts/node/tests/git.test.js scripts/node/tests/barrels.test.js scripts/node/tests/terminal-color.test.js
```

These tests use disposable repositories to exercise safe fetch mappings, atomic
updates, path comparisons, partial clones, unusual history, transport cleanup
and the status scripts' upstream handling. They do not fetch the working
repository. Install the project dependencies first. The transport test takes
about 15 seconds.

Git network helpers require GNU timeout and recognize `timeout`, `gtimeout` and
`gnutimeout`. They refuse incompatible implementations. Their deadline kills the
process group immediately, so an interrupted fetch can leave lock files
requiring manual inspection. Transports that detach into another session are
unsupported. Local comparisons never download missing objects. Older Git
versions without `--no-lazy-fetch` support refuse partial-clone comparisons
rather than risk an implicit network operation.

### Optional Git SSH Integration Test

From a Linux host with Docker, Node, Bash, Git, OpenSSH, GNU timeout and
util-linux `script` installed, run:

```sh
pnpm run test:git:ssh
```

This creates a disposable SSH server using the pinned devcontainer base and
tests the Git helpers with both redirected output and a pseudo-terminal. It
covers working authentication, missing and encrypted keys, unknown and changed
host keys, and stalled operations. The timeout cases make the suite take about a
minute after the image build. The first build needs network access.

Only generated fixture credentials are used. Personal SSH files and agents are
not forwarded. The container, test image tag and temporary files are removed
afterward. Docker's ordinary build cache may remain. This test is optional and
is not part of repository readiness or the default test command.

<p align="right">[<a href="#readme-top">back to top</a>]</p>

---

## Markdown Authoring

The repository validates Markdown with markdownlint-cli2 and a custom GitHub
HTML compatibility rule. The rule reports unsupported raw HTML elements,
attributes, and URL protocols while preserving supported HTML and GFM syntax.
The same configuration is loaded by the VS Code markdownlint extension and CI.

Run style and compatibility validation:

```sh
pnpm run lint:md
```

Run the cmark-gfm conformance smoke test:

```sh
pnpm run lint:md:gfm
```

For fast offline preview, install the recommended VS Code extensions and run
**Markdown: Open Preview to the Side**. The built-in preview is styled with the
GitHub light or dark theme but remains a local approximation.

For a high-fidelity, live-reloading preview, install the GitHub CLI extension:

```sh
gh extension install yusukebe/gh-markdown-preview
pnpm run docs:preview:github -- README.md
```

The high-fidelity preview renders GFM through GitHub's Markdown API and
therefore requires network access. GitHub CLI extensions are third-party code;
review and trust the extension before installation.

<p align="right">[<a href="#readme-top">back to top</a>]</p>

---

## What Is Included

| Path                                                               | Purpose                                                                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `.devcontainer/`                                                   | Source-built dev container with system mise tools, Docker-in-Docker, VS Code extensions, and lifecycle health checks |
| `.devcontainer/Dockerfile`                                         | Reproducible dev-container image with system mise tools and pinned Debian inputs                                     |
| `.github/workflows/ci-general.yml`                                 | Root audit, formatting, schema, JavaScript, YAML, TOML, Markdown, shell, policy, and unused-dependency checks        |
| `.github/workflows/pr-automation.yml`                              | Label automation, dependency review, PR title linting                                                                |
| `.github/workflows/ci-test.yml`                                    | Test workflow running the test script specified in `package.json`                                                    |
| `.github/CODEOWNERS`                                               | Code ownership definitions for automatic PR review assignments                                                       |
| `renovate.json`                                                    | Reviewed dependency updates with coupled devcontainer lock/checksum maintenance                                      |
| `.github/labeler.yml`                                              | Automatic PR labeling by branch name, title, and changed files                                                       |
| `.husky/`                                                          | Git hooks for conventional commit message linting and lint-staged                                                    |
| `projects/submodules/`                                             | Independent repositories, including infrastructure that owns the organization media server                           |
| `scripts/linux/commands/repository/health.sh`                      | Repository health check run by the dev container on startup                                                          |
| `scripts/linux/commands/repository/doctor.sh`                      | Bounded diagnosis and safe local repair, with a non-mutating check-only option                                       |
| `scripts/linux/commands/repository/setup.sh`                       | Environment setup script for local development                                                                       |
| `scripts/linux/commands/tasks/attributes.sh`                       | Git attributes verification script                                                                                   |
| `scripts/linux/commands/tasks/dict.sh`                             | Optional dictionary validator; requires separately supplied spellcheck configuration                                 |
| `scripts/linux/commands/tasks/lfs.sh`                              | Git LFS verification for opted-in file attributes and pointer consistency                                            |
| `scripts/linux/commands/tasks/shellcheck.sh`                       | Shell script linting runner for ShellCheck                                                                           |
| `scripts/linux/commands/repository/validation/git-status.sh`       | Git configuration and remote status validation                                                                       |
| `scripts/linux/commands/repository/validation/workspace-status.sh` | Operating system, architecture, and workspace-environment status                                                     |
| `scripts/linux/utils/logging/core.sh`                              | Color policy, color constants and message labels                                                                     |
| `scripts/linux/utils/logging/status.sh`                            | Accumulated and aligned status rows                                                                                  |
| `scripts/linux/utils/logging/box.sh`                               | Streaming terminal-width boxes                                                                                       |
| `scripts/linux/utils/functions/git.sh`                             | Git repository checks and upstream operations                                                                        |
| `scripts/linux/utils/filters/filters.sh`                           | Source barrel for filter helpers and asset paths                                                                     |
| `scripts/linux/utils/filters/core.sh`                              | Generic named filter interface and public JQ_FILTER_DIR / AWK_FILTER_DIR paths                                       |
| `scripts/linux/utils/logging/label.sh`                             | Label helpers such as singular and plural wording                                                                    |
| `scripts/linux/utils/functions/node.sh`                            | Checked Node script execution without automatic runtime installation                                                 |
| `scripts/linux/utils/functions/core.sh`                            | Shared command and argument checks and optional version-aware command selection                                      |
| `scripts/linux/utils/functions/validation.sh`                      | Path and integer checks, with the shared core available through sourcing                                             |
| `scripts/linux/utils/logging/terminal.sh`                          | Terminal width, text measurement and separators                                                                      |
| `scripts/linux/utils/logging/ansi.sh`                              | ANSI stripping and terminal-aware ANSI asset output                                                                  |
| `scripts/linux/utils/logging/log.sh`                               | Message logging functions                                                                                            |
| `scripts/linux/utils/logging/logging.sh`                           | Source barrel for terminal, logging and formatting helpers                                                           |
| `scripts/linux/utils/functions/functions.sh`                       | Source barrel for shared core, validation, Node and Git helpers                                                      |
| `scripts/linux/utils/utils.sh`                                     | Source barrel for all Bash utilities                                                                                 |
| `.editorconfig`                                                    | Editor formatting configuration                                                                                      |
| `.gitattributes`                                                   | Line ending, diff, and Git LFS rules                                                                                 |
| `.markdownlint-cli2.json`                                          | Markdown rules, file discovery, exclusions, and custom-rule loading                                                  |
| `.yamllint.yaml`                                                   | Generic YAML correctness and style rules compatible with Prettier and GitHub Actions                                 |
| `eslint.config.js`                                                 | ESLint flat configuration scoped to repository-owned JavaScript automation                                           |
| `scripts/node/`                                                    | Private pnpm package for Node automation, shared libraries and tests                                                 |
| `scripts/node/lib/markdownlint/`                                   | GitHub-compatible raw HTML policy and author-time markdownlint rule                                                  |
| `.shellcheckrc`                                                    | Shared ShellCheck configuration used by CI, local scripts, and editor integrations                                   |
| `commitlint.config.js`                                             | Conventional commit configuration with a commitizen prompt wizard                                                    |
| `prettier.config.js`                                               | Formatting rules                                                                                                     |
| `knip.json`                                                        | Unused dependency and export detection                                                                               |

<p align="right">[<a href="#readme-top">back to top</a>]</p>

---

## Apply These Changes

After using this template to start a new project, you will have to make some
minor adjustments. The files include `TODO:` comments with instructions for easy
lookup. These comments can be removed once you have acknowledged their purpose.

The following table outlines the files you should modify and the changes you
need to make:

| File                                             | Change                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `.github/CODEOWNERS`                             | Add code owners                                                                 |
| `renovate.json` and `.github/renovate-host.json` | Activate the scoped self-hosted update runner and add ecosystems as needed      |
| `.github/labeler.yml`                            | Update label rules to match your used tooling                                   |
| `.github/workflows/ci-general.yml`               | Add jobs for new tools if needed                                                |
| `projects/<name>/.gitignore`                     | [Choose a project-owned ignore template](https://github.com/github/gitignore)   |
| `.gitattributes`                                 | [Choose an attributes template](https://github.com/gitattributes/gitattributes) |
| `.gitignore`                                     | Whitelist new configuration files and generated folders                         |
| `.mailmap`                                       | Alias your flockmod username                                                    |
| `mise.toml`                                      | Add tools, versions, and developer-facing tasks for mise                        |
| `mise.lock`                                      | Lock mise-managed tool downloads and checksums                                  |
| `AUTHORS`                                        | Add project maintainers                                                         |
| `dictionary.txt`                                 | Maintain a dictionary of project-specific words                                 |
| `LICENSE`                                        | [Choose a license](https://choosealicense.com/)                                 |
| `package.json`                                   | Update values and add scripts for new tools, tests and build                    |
| `pnpm-lock.yaml`                                 | Update locked dependencies with pnpm                                            |
| `README_TEMPLATE.md`                             | Use this as the base for your own `README.md`                                   |
| `projects/packages/<name>/release.config.js`     | Add project-owned semantic-release configuration only when needed               |

> [!NOTE]
>
> The community markdown files and PR/issue templates are provided by the
> organizations [.github](https://github.com/nlobby4/.github) repository. If you
> need to adjust them, copy the respective file into the `.github` directory and
> make the necessary changes.

<p align="right">[<a href="#readme-top">back to top</a>]</p>

---

## For Outside Users

### Labeler

Ensure your repository has the following labels defined, as they are used by the
automated labeler and referenced in issue and PR templates. You can set these up
in the repositories issue tab:

`feat` `fix` `docs` `chore` `ci` `build` `refactor` `perf` `test` `style`
`revert` `breaking-change` `dependencies` `release`

### Releases

Release management is intentionally project-owned. The root repository keeps
shared commit conventions, while semantic-release, Changesets, GoReleaser, Maven
release plugins, or other release tools should live inside the project that
needs them.

<p align="right">[<a href="#readme-top">back to top</a>]</p>

---

<!-- ? ############################################# -->
<!-- ? Footer -->

<div align="right">

![footer][footer]

</div>

<!-- ? ############################################# -->
<!-- ? References -->

[logo]:
  https://media.githubusercontent.com/media/nlobby4/organization/refs/heads/main/project/repo/readme/logo-readme.png
[banner]:
  https://media.githubusercontent.com/media/nlobby4/organization/refs/heads/main/project/repo/readme/banner-readme.png
[footer]:
  https://media.githubusercontent.com/media/nlobby4/organization/refs/heads/main/project/repo/readme/footer-readme.png
[founded]: https://img.shields.io/badge/founded:2024-black?logo=github
[npm]: https://img.shields.io/badge/npm%20packages-black?logo=npm&color=000000
[website]:
  https://img.shields.io/badge/nlobby4.org-black?logo=firefoxbrowser&logoColor=white&color=000000
[discord]:
  https://img.shields.io/badge/discord-black?logo=discord&logoColor=white
[flockmod]: https://img.shields.io/badge/r/nlobby4-black
