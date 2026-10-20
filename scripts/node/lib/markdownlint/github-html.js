import { readFileSync } from "node:fs";

import { parseFragment } from "parse5";

const policy = JSON.parse(
  readFileSync(new URL("./github-html-policy.json", import.meta.url), "utf8"),
);

const allowedElements = new Set(policy.allowedElements);
const globalAttributes = new Set(policy.allowedAttributes["*"]);

function locationFor(token, location) {
  return {
    lineNumber: token.lineNumber + location.startLine - 1,
    range: [
      location.startCol,
      Math.max(1, location.endOffset - location.startOffset),
    ],
  };
}

function protocolOf(value) {
  const match = value.trim().match(/^([a-z][a-z\d+.-]*):/i);
  return match ? match[1].toLowerCase() : "relative";
}

function visit(node, token, onError) {
  if (node.tagName && node.sourceCodeLocation) {
    const element = node.tagName.toLowerCase();
    const startTag =
      node.sourceCodeLocation.startTag ?? node.sourceCodeLocation;

    if (!allowedElements.has(element)) {
      onError({
        ...locationFor(token, startTag),
        detail: `Element <${element}> is not supported by the GitHub HTML policy.`,
      });
    } else {
      const elementAttributes = new Set(
        policy.allowedAttributes[element] ?? [],
      );

      for (const attribute of node.attrs ?? []) {
        const name = attribute.name.toLowerCase();
        const attributeLocation =
          node.sourceCodeLocation.attrs?.[name] ?? startTag;

        if (!globalAttributes.has(name) && !elementAttributes.has(name)) {
          onError({
            ...locationFor(token, attributeLocation),
            detail: `Attribute "${name}" is not supported on <${element}>.`,
          });
          continue;
        }

        const protocols = policy.allowedProtocols[`${element}.${name}`];
        if (protocols && !protocols.includes(protocolOf(attribute.value))) {
          onError({
            ...locationFor(token, attributeLocation),
            detail: `Protocol in ${element}[${name}] is not supported. Allowed: ${protocols.join(", ")}.`,
          });
        }
      }
    }
  }

  for (const child of node.childNodes ?? []) {
    visit(child, token, onError);
  }
}

function collectHtmlTokens(tokens, result = []) {
  for (const token of tokens) {
    if (token.type === "html_block" || token.type === "html_inline") {
      result.push(token);
    }
    collectHtmlTokens(token.children ?? [], result);
  }
  return result;
}

export default {
  names: ["github-html"],
  description: "Raw HTML must be supported by the repository GitHub policy",
  information: new URL(
    "https://github.github.com/gfm/#disallowed-raw-html-extension-",
  ),
  tags: ["html", "gfm"],
  parser: "markdownit",
  function: (params, onError) => {
    const htmlTokens = collectHtmlTokens(params.parsers.markdownit.tokens);

    for (const token of htmlTokens) {
      const document = parseFragment(token.content, {
        sourceCodeLocationInfo: true,
        onParseError: (error) => {
          onError({
            lineNumber: token.lineNumber + error.startLine - 1,
            range: [error.startCol, 1],
            detail: `Invalid raw HTML: ${error.code}.`,
          });
        },
      });
      visit(document, token, onError);
    }
  },
};
