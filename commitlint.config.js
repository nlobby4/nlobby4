/**
 * Checks commit messages against the Conventional Commits format, which can
 * support changelog generation by separate tooling. It extends
 * @commitlint/config-conventional with repository rules for types, scopes and
 * formatting.
 *
 * Errors fail validation, while length warnings do not. Default ignores remain
 * enabled for messages such as generated merges and version tags.
 *
 * Use `mise run lint:commit` as the developer-facing command to validate the
 * latest commit. mise delegates to the pnpm script, which resolves the exact
 * repository-local Commitlint version from `node_modules/.bin`. The Git hook
 * calls the same pnpm script with the commit message file supplied by Git.
 *
 * The prompt configuration drives the interactive Commitizen wizard. The
 * commit-msg hook performs final validation.
 *
 * Use `mise run commit`, or `pnpm run commit` directly, to create a commit
 * through the interactive wizard.
 *
 * @file Commitlint configuration file.
 *
 * @author sphoon
 */

/**
 * @type {import("@commitlint/types").UserConfig}
 *
 * @see https://commitlint.js.org/reference/configuration.html
 */
export default {
  defaultIgnores: true,
  extends: ["@commitlint/config-conventional"],
  formatter: "@commitlint/format",
  helpUrl: "https://www.conventionalcommits.org/en/v1.0.0/#summary",
  prompt: {
    settings: {
      useExclamationMark: true,
    },
    messages: {
      skip: "(press enter to skip)",
      max: "upper %d chars",
      min: "%d chars at least",
      emptyWarning: "can not be empty",
      upperLimitWarning: "over limit",
      lowerLimitWarning: "below limit",
    },
    questions: {
      type: {
        description: "Select the type of change you are committing",
        enum: {
          feat: {
            description: "A new feature",
            title: "Features",
            emoji: "✨",
          },
          fix: {
            description: "A bug fix",
            title: "A confirmed issue fix",
            emoji: "🐛",
          },
          docs: {
            description: "Documentation only changes",
            title: "Documentation",
            emoji: "📚",
          },
          style: {
            description: "Changes that only change the style of the code",
            title: "Styles",
            emoji: "🧽",
          },
          refactor: {
            description:
              "A code change that neither fixes a bug nor adds a feature",
            title: "Code Refactoring",
            emoji: "📦",
          },
          perf: {
            description: "A code change that improves performance",
            title: "Performance Improvements",
            emoji: "🔥",
          },
          test: {
            description: "Adding missing tests or correcting existing tests",
            title: "Tests",
            emoji: "🚨",
          },
          build: {
            description:
              "Changes that affect the build system or external dependencies",
            title: "Builds",
            emoji: "🔨",
          },
          ci: {
            description: "Changes to CI configuration files and scripts",
            title: "Continuous Integration",
            emoji: "🔄",
          },
          chore: {
            description:
              "Maintenance changes that do not change product behavior",
            title: "Chores",
            emoji: "🧹",
          },
          revert: {
            description: "Reverts a previous commit",
            title: "Reverts",
            emoji: "⏪",
          },
        },
      },
      scope: {
        description: "What is the scope of this change (optional)",
      },
      subject: {
        description:
          "Write a short, imperative tense description of the change",
      },
      body: {
        description: "Provide a longer description of the change",
      },
      isBreaking: {
        description: "Are there any breaking changes?",
      },
      breakingBody: {
        description:
          "A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself",
      },
      breaking: {
        description: "Describe the breaking changes",
      },
      isIssueAffected: {
        description: "Does this change affect any open issues?",
      },
      issuesBody: {
        description:
          "If issues are closed, the commit requires a body. Please enter a longer description of the commit",
      },
      issues: {
        description: "Add issue references (e.g. fix #123, re #123)",
      },
    },
  },
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "scope-case": [2, "always", "kebab-case"],
    "subject-empty": [2, "never"],
    "subject-case": [
      2,
      "never",
      ["sentence-case", "start-case", "pascal-case", "upper-case"],
    ],
    "subject-max-length": [1, "always", 50],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [1, "always", 72],
    "header-trim": [2, "always"],
    "body-leading-blank": [2, "always"],
    "body-max-line-length": [1, "always", 100],
    "footer-max-line-length": [1, "always", 100],
    "footer-leading-blank": [2, "always"],
    "no-empty-scope": [2, "always"],
  },
  plugins: [
    {
      rules: {
        "no-empty-scope": ({ header }) => [
          !/^[a-z][a-z-]*\(\s*\)!?:/.test(header),
          "Scope cannot be empty. Use 'type: subject' or 'type(scope): subject'.",
        ],
      },
    },
  ],
};
