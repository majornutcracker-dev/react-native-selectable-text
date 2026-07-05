export type Highlights = string;

export type HTMLString = string;

export type CSSString = string;

export type SelectableTextViewFontPreconnect = {
  href: string;
  crossOrigin?: boolean;
};

export type SelectableTextViewFontStylesheet = {
  href: string;
  crossOrigin?: "anonymous" | "use-credentials";
};

export type SelectableTextViewFontFace = {
  fontFamily: string;
  src: string | string[];
  fontWeight?: string | number;
  fontStyle?: "normal" | "italic" | "oblique";
  fontDisplay?: "auto" | "block" | "swap" | "fallback" | "optional";
  fontStretch?: string;
  unicodeRange?: string;
};

export type HighlightData = {
  id: string;
  colorClassName: string;
  text: string;
};

export type GoogleFontFamily = {
  family: string;
  weights?: string;
  italic?: boolean;
};

/**
 * Multiple fonts are supported: add several stylesheets, several @font-face entries,
 * or combine configs with mergeFonts(). Use googleFonts({ families: [...] }) for
 * multiple Google families in a single request.
 */
export type SelectableTextViewFonts = {
  preconnect?: SelectableTextViewFontPreconnect[];
  stylesheets?: SelectableTextViewFontStylesheet[];
  faces?: SelectableTextViewFontFace[];
};

export type ColorClassName = string;

export type ColorClass = {
  /**
   * A unique className that would be used as CSS classes to apply the selection
   */
  name: ColorClassName;
  color: string;
};

export type HighlighterOptions = {
  /**
   * CSS selectors for elements excluded from visible highlights (e.g., 'a', '.ignored').
   * Text inside ignored elements remains selectable and copyable.
   * @default ['a','sub','sup']
   */
  ignoredElements?: string[];
};

export type SelectableTextViewOptions = {
  /**
   * A boolean indicating whether to enable the user scaling of the content.
   * @default true
   */
  userScalable?: boolean;
  /**
   * A unsigned number indicating the initial scale of the content.
   * @default 1
   */
  initialScale?: number;
  /**
   * A unsigned number indicating the maximum scale of the content.
   * @default 2.5
   */
  maximumScale?: number;
};

/**
 * Error codes emitted by the WebView SDK via {@link SelectableTextViewPropsBase.onError}.
 */
export type SelectableTextViewErrorCode =
  | "unknown"
  | "overlapping_highlight"
  | "empty_selection"
  | "invalid_range"
  | "invalid_class_applier"
  | "invalid_highlight"
  | "initialization_error"
  | "bridge_message_error"
  | "failed_to_highlight_selection"
  | "failed_to_unhighlight_selection"
  | "failed_to_clear_highlights"
  | "highlight_not_found"
  | "failed_to_focus_highlight"
  | "failed_to_unhighlight_by_id";

export interface SelectableTextViewError extends Error {
  /**
   * A detailed description of the error
   */
  details?: string;
  /**
   * A message describing the error
   */
  message: string;
  /**
   * A code describing the error
   */
  code: SelectableTextViewErrorCode;
}

export type SelectableTextViewRef = {
  /**
   * A function that applies highlighting to the current selection with a colorClassName previously defined in the colorClasses property;
   * if it is not defined, the highlighting will not be applied.
   * @param name
   */
  highlightSelection: (name?: ColorClassName) => void;
  /**
   * A function that removes the highlighting from the current selection
   */
  unhighlightSelection: () => void;
  /**
   * A function that removes all the highlights
   */
  clearHighlights: () => void;
  /**
   * A promise that returns the selected text
   * @throws js Error
   * @returns The selected text
   */
  getSelectedText: () => Promise<string>;
  /**
   * A promise that returns the serialization of the current highlighting
   * @throws js Error
   * @returns The serialization of the current highlighting
   */
  getHighlights: () => Promise<Highlights>;
  /**
   * A function that focuses on a highlight by its id
   * Scrolls the content to the highlight and focuses on it
   * @param id
   */
  focusHighlight: (id: string) => void;
  /**
   * A function that removes a highlight by its id
   * @param id
   */
  unhighlightById: (id: string) => void;
  /**
   * A promise that returns all the highlights data
   * @throws js Error
   * @returns All the highlights data
   */
  getAllHighlightsData: () => Promise<HighlightData[]>;
};

export type SelectableTextViewPropsBase = {
  /**
   * --> Final property
   * A list of ColorClass containing a unique name, color Hex or strings, The name is used as the className of the tag that wraps the selection,
   * so in the css property you can add more styles than just the background color. If names are repeated, the last one will be chosen.
   * @default [{name: yellow-highlighter, color: yellow}]
   */
  colorClasses?: ColorClass[];
  /**
   * --> State property
   * A serialized string that represents the current highlights in the content. This can be used to restore the highlights when the component is re-rendered, for example when the user navigates away from the screen and then comes back.
   * You can obtain this string from getHighlights method or onHighlightsChange event.
   * You can also use as a state, the content will be re-rendered with the highlights applied whenever this string changes.
   */
  highlights?: Highlights;
  /**
   * --> Final property
   * A html string that will be rendered in the WebView.
   * You can add class names and reference them in the css property to style the content.
   * Changing this params no trigger a re-render, you have to remount the component or change the rerender function to trigger a re-render with the new content.
   */
  content?: HTMLString;
  /**
   * --> Final property
   * A CSS string that will be injected into the WebView to style the content. This can be used to customize the appearance of the content, for example by changing the font size or color.
   * This use a default implementation that provides some basic styles for the content, but you can provide your own implementation if you want to customize the appearance.
   */
  css?: CSSString;
  /**
   * --> Final property
   * Font resources injected into the WebView head: preconnect hints, external stylesheets
   * (e.g. Google Fonts), and optional @font-face rules for self-hosted fonts.
   * Use the exported googleFonts() helper or build SelectableTextViewFonts manually.
   */
  fonts?: SelectableTextViewFonts;
  /**
   * --> Final property
   * Rangy highlighter options. See {@link HighlighterOptions}.
   */
  highlighterOptions?: HighlighterOptions;
  /**
   * --> Final property
   * A object which represents the available options to customize the behavior of the component.
   */
  options?: SelectableTextViewOptions;
  /**
   * --> State property
   * A callback function that will be called when the user clicks on a link in the content.
   * The callback will receive the URL of the link that was clicked.
   * You can use this callback to perform any action you want when the user clicks on a link,
   * Note that WebView not support local navigation to another page, so you have to handle the link clicks yourself in this callback.
   * You can also use this callback to prevent the default behavior of the link clicks, for example by not doing anything when a link is clicked.
   *  @param url
   *
   */
  onLink?: (url: string) => void;
  /**
   * --> State property
   * A callback function that will be called when the selected text changes.
   * The callback will receive the currently selected text as a parameter.
   * You can use this callback to perform any action you want when the selected text changes.
   * @param selectedText
   */
  onTextSelectionChange?: (selectedText: string) => void;
  /**
   * --> State property
   * Called when the serialized highlights change.
   * @param highlights
   */
  onHighlightsChange?: (highlights: Highlights) => void;
  /**
   * --> State property
   * Called when an error occurs inside the WebView SDK (highlight restore, bridge, selection, etc.).
   * The payload includes {@link SelectableTextViewError.code}, {@link SelectableTextViewError.message},
   * and optional {@link SelectableTextViewError.details}.
   * @param error
   */
  onError?: (error: SelectableTextViewError) => void;
  /**
   * --> State property
   * Called when a highlight is pressed.
   * The payload includes the id of the highlight, the colorClassName of the highlight and the text of the highlight.
   * @param highlight
   */
  onHighlightPressed?: (highlight: HighlightData) => void;
};

export type Message = {
  type: string;
  value: any;
};

export const BridgingNames = {
  // in
  functions: {
    updateHighlights: "updateHighlights",
    highlightSelection: "highlightSelection",
    unhighlightSelection: "unhighlightSelection",
    clearHighlights: "clearHighlights",
    focusHighlight: "focusHighlight",
    unhighlightById: "unhighlightById",
  },
  // out
  events: {
    onTextSelectionChange: "onTextSelectionChange",
    onHighlightsChange: "onHighlightsChange",
    onError: "onError",
    onHighlightPressed: "onHighlightPressed",
    // dev
    log: "log",
  },
  // in - out
  promises: {
    getSelectedText: "getSelectedText",
    getHighlights: "getHighlights",
    getAllHighlightsData: "getAllHighlightsData",
  },
};

export const VERSION = "1.0.0";

/*

export type RootBlocks = (ListBlock | HeadingBlock | ParagraphBlock)[];

export interface TextBlock {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

export interface ListBlock {
  type: "list";
  format: "ordered" | "unordered";
  children: (ListBlock | ListItemBlock)[];
}

export interface ListItemBlock {
  type: "list-item";
  children: (TextBlock | LinkBlock)[];
}

export interface LinkBlock {
  type: "link";
  url: string;
  children: TextBlock[];
}

export interface HeadingBlock {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: (TextBlock | LinkBlock)[];
}

export interface ParagraphBlock {
  type: "paragraph";
  children: (TextBlock | LinkBlock)[];
}
*/
