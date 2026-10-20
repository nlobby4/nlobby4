# Project dependency licenses

This private fixture has no application dependencies, so its current inventory
contains no third-party notices. Shared development-tool notices stay in the
root `licenses/` folder. Refresh this project's inventory after adding
dependencies:

```sh
pnpm run licenses:update
pnpm run licenses:check
```

Run these commands from the organization root. The collector keeps each ordinary
project's notices separate and does not enter independent submodules.
