/**
 * Prettier is installed as a dev dependency and is used for consistent
 * formatting across the project, it also automatically applies EditorConfig
 * settings as formatting rules.
 *
 * These rules are also enforced in CI to avoid unformatted code and to ensure
 * consistency across the codebase.
 *
 * **NOTE:** The prettier yaml plugin does not support docker files, they get
 * handled by the sh plugin. To avoid conflicts, name docker files "Dockerfile"
 * instead of "dockerfile.yaml".
 *
 * **NOTE:** The Prettier vscode extension cannot use a .gitignore and
 * .prettierignore at the same time, if you open a file that is ignored by
 * .gitignore but not by .prettierignore, it will be formatted by Prettier on
 * save.
 *
 * @file Prettier configuration file.
 *
 * @author sphoon
 *
 * @see https://github.com/prettier/prettier-vscode/issues/3894
 */

/**
 * @type {import("prettier").Config}
 *
 * @see https://prettier.io/docs/configuration
 */
export default {
  // Plugins are applied in the order they are listed here
  plugins: [
    "prettier-plugin-sh",
    "prettier-plugin-yaml",
    "prettier-plugin-sort-json",
    "prettier-plugin-packagejson",
    "prettier-plugin-multiline-arrays",
    "prettier-plugin-organize-imports",
    "prettier-plugin-jsdoc",
  ],

  // Allow files to ignore prettier by adding a pragma at the top of the file
  checkIgnorePragma: true,

  // Always wrap prose if it exceeds the print width.
  proseWrap: "always",

  // Put the operator at the beginning of the line
  experimentalOperatorPosition: "start",

  // Use the curious ternaries formatting style.
  // https://prettier.io/blog/2023/11/13/curious-ternaries.html
  experimentalTernaries: true,

  // Don't remove unused imports
  organizeImportsSkipDestructiveCodeActions: true,

  // Add a period at the end of JSDoc descriptions if missing
  jsdocDescriptionWithDot: true,

  // Put @returns on a separate line from @param
  jsdocSeparateReturnsFromParam: true,

  // Separate JSDoc tags into groups with blank lines between them
  jsdocSeparateTagGroups: true,

  overrides: [
    {
      files: ["*.yaml", "*.yml"],
      options: {
        proseWrap: "preserve",
        // Keep YAML 1.1 boolean-like strings quoted to satisfy yamllint
        yamlQuoteValuesMatching:
          "^(yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF)$",
      },
    },
  ],
};
