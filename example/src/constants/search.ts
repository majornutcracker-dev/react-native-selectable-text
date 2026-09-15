import type { CSSString } from "@majornutcracker/react-native-selectable-text";

import { theme } from "./theme";

/**
 * Names shared by the in-page search script and the document stylesheets, so
 * the two cannot drift apart.
 *
 * Matches are painted with the CSS Custom Highlight API, which colours ranges
 * without touching the DOM. That matters here: wrapping matches in elements
 * would rewrite the text nodes the module's own highlights are anchored to, and
 * selecting them would fire `onTextSelectionChange` and open the iOS callout.
 */
export const SEARCH_HIGHLIGHT = "example-search";
export const SEARCH_CURRENT_HIGHLIGHT = "example-search-current";

/**
 * WebViews without the Highlight API (Safari before 17.2) cannot paint ranges,
 * so the current match gets a brief outline instead.
 */
export const SEARCH_FLASH_CLASS = "example-search-flash";

const { accent } = theme.color;

export const searchCss: CSSString = `
::highlight(${SEARCH_HIGHLIGHT}) {
  background-color: ${accent}47;
  color: inherit;
}
::highlight(${SEARCH_CURRENT_HIGHLIGHT}) {
  background-color: ${accent};
  color: #FFFFFF;
}
.${SEARCH_FLASH_CLASS} {
  position: absolute;
  pointer-events: none;
  border-radius: 4px;
  background-color: ${accent}47;
  box-shadow: 0 0 0 2px ${accent};
  animation: exampleSearchFlash 1.2s ease-out forwards;
}
@keyframes exampleSearchFlash {
  0%, 60% { opacity: 1; }
  100%    { opacity: 0; }
}
`;
