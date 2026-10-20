# Third-party licenses

This folder collects top-level notices for the organization shell. Transitive
dependencies and operating-system packages are intentionally excluded.
Application dependency notices belong to each project's own `licenses/` folder.
Independent submodules manage their own notices and are never traversed by the
root collector.

## Refresh and verify

After installing the pinned dependencies and tools:

```sh
pnpm run licenses:update
pnpm run licenses:check
pnpm run test:licenses
```

Update collects the shell and ordinary pnpm workspace projects separately. Check
verifies input hashes and collected notice bytes offline without downloads or
installation. To select one project directly:

```sh
python3 scripts/python/collect-licenses.py --project projects/packages/example-package
python3 scripts/python/collect-licenses.py --check --project projects/packages/example-package
```

`schemas:update` also refreshes these inventories. Renovate's existing
self-hosted post-upgrade flow includes them. This is configured automation, not
evidence that the bot has been activated.

## Contents and coverage

- `schema/` preserves the upstream schema licenses and source-lock hashes
- `npm/` preserves directly declared dependency notices reported by pnpm,
  including dev dependencies and the internal Node script package
- `tools/` collects primary notices from exact mise/bootstrap tool release tags
- `inventory.json` records versions, notice hashes, input hashes and coverage
  gaps
- `sources.json` maps configured tools to their upstream repositories

Configured npm/Python-backed tools are covered by their primary upstream
notices, not by collecting all their internal dependencies. Package paths are
not recorded in committed inventories. Upstream notice bytes are preserved and
excluded from formatting. Old version folders are retained as historical
notices; only files listed in the current inventory are current.

The collector acquires all owners before writing. Download failures leave
inventories unchanged. An interrupted write can be detected by offline checks.
Hashes detect drift, not independent publisher authenticity. Absent notice files
and unknown license declarations need review; a successful check does not
certify legal compliance or satisfy every source-code distribution obligation.
Non-npm projects need their own ecosystem inventory.

Reference: [pnpm licenses](https://pnpm.io/10.x/cli/licenses).
