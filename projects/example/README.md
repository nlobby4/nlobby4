# Example project

This private workspace package tests organization and project ownership. Its
four-space indentation, single quotes and lack of semicolons deliberately differ
from the root automation. It has no application dependencies.

```sh
pnpm --filter @nlobby4/example test
pnpm --filter @nlobby4/example check
mise run //projects/example:test
```

Prettier and ESLint are explicitly reused from the root development toolchain.
This project owns their rules, EditorConfig, Git denylist and staged-file tasks.
Other projects may pin their own tools instead of following this sharing model.

The isolated boundary regression suite creates a local-only submodule. It never
clones or modifies a real remote repository.
