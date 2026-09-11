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
  name: HighlighterName;
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

export type HighlighterName = string;

export type AnimationOptions = {
  keyframesCss: string;
  name: string;
  duration: string;
  timingFunction:
    "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | string;
  iterationCount: number | "infinite";
};

export type HighlighterType =
  | "background-color"
  | "text-decoration-color"
  | "outline-color"
  | "background-image";

export type HighlighterBackgroundColorOption = {
  type: "background-color";
  color: string;
  animation?: AnimationOptions;
};

export type HighlighterTextDecorationColorOption = {
  type: "text-decoration-color";
  color: string;
  line?: "underline" | "overline" | "line-through";
  thickness?: number;
  offset?: number;
  style?: "solid" | "double" | "dotted" | "dashed" | "wavy";
  animation?: AnimationOptions;
};

export type HighlighterOutlineColorOption = {
  type: "outline-color";
  color: string;
  width?: number;
  offset?: number;
  style?:
    | "solid"
    | "dotted"
    | "dashed"
    | "double"
    | "groove"
    | "ridge"
    | "inset"
    | "outset";
  animation?: AnimationOptions;
};

export type HighlighterBackgroundImageOption = {
  type: "background-image";
  image: string;
  position?: "left" | "center" | "right" | "top" | "bottom" | string;
  repeat?: "no-repeat" | "repeat" | "repeat-x" | "repeat-y" | string;
  size?: "auto" | "cover" | "contain" | string;
  animation?: AnimationOptions;
};

export type Highlighter = {
  /**
   * A unique name for the highlighter.
   * It is used as the className of the tag that wraps the selection,
   * so in the css property you can add more styles than just the background color.
   * If names are repeated, the last one will be chosen.
   * @default "yellow-highlighter"
   */
  name: HighlighterName;
  options:
    | HighlighterBackgroundColorOption
    | HighlighterTextDecorationColorOption
    | HighlighterOutlineColorOption
    | HighlighterBackgroundImageOption;
};

/**
 * Options for the ref methods that act on the current text selection.
 */
export type SelectionActionOptions = {
  /**
   * Keep the text selected after the action completes.
   *
   * Defaults to `false`: the selection is cleared, which also dismisses the
   * platform's selection UI — on iOS the handles and the callout menu would
   * otherwise stay on top of the highlight that was just created, hiding it and
   * any entrance animation it has.
   *
   * Set this to `true` when you want to chain another action on the same text,
   * for example highlighting and then copying it from a menu that stays open.
   *
   * @default false
   */
  keepSelection?: boolean;
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
 * Options shared by the methods that remove highlights one at a time:
 * {@link SelectableTextViewRef.unhighlightById} and
 * {@link SelectableTextViewRef.unhighlightSelection}.
 */
export type UnhighlightOptions = {
  /**
   * A className added to the highlight before it is removed, so an exit
   * animation defined in the `css` prop can play. Pair it with `delay`.
   */
  className?: string;
  /**
   * Milliseconds to wait before the highlight is actually removed. Keep it in
   * sync with the duration of the animation on `className`.
   *
   * The wait happens inside the WebView, so there is no timer to track or
   * cancel on unmount. A highlight already staged for removal is left alone
   * rather than restarted, and one that disappears during the wait (a
   * `clearHighlights()`, a restore) is not reported as an error.
   * @default 0
   */
  delay?: number;
};

/**
 * Scroll behaviour used by {@link SelectableTextViewRef.focusHighlight}.
 */
export type FocusHighlightOptions = {
  /**
   * A boolean indicating whether to scroll the content to the highlight.
   * Set it to false to apply the focus style in place.
   * @default true
   */
  scroll?: boolean;
  /**
   * Where the highlight is aligned within the viewport once scrolled.
   * "nearest" only scrolls when the highlight is outside the viewport.
   * @default "center"
   */
  block?: "start" | "center" | "end" | "nearest";
  /**
   * The scrolling animation.
   * @default "smooth"
   */
  behavior?: "smooth" | "auto";
  /**
   * The height in pixels of a band covered at the top of the viewport, such as a
   * floating header. The highlight is aligned within the viewport minus that band,
   * so it is never left underneath it.
   * @default 0
   */
  offset?: number;
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
   * A function that applies highlighting to the current selection with a highlighter name previously defined in the highlighters property;
   * if it is not defined, the highlighting will not be applied.
   * @param name The name of the highlighter to apply to the selection.
   */
  highlightSelection: (
    name?: HighlighterName,
    options?: SelectionActionOptions
  ) => void;
  /**
   * A function that applies highlighting to the current selection with a highlighter name previously defined in the highlighters property;
   * if it is not defined, the highlighting will not be applied.
   * @param name The name of the highlighter to apply to the selection.
   * @param validation A callback function that will be called with the text of the selection if return true the highlighting will be applied.
   * @param options See {@link SelectionActionOptions}.
   */
  highlightSelectionWithValidation: (
    validation: (text: string) => boolean | Promise<boolean>,
    name?: HighlighterName,
    options?: SelectionActionOptions
  ) => Promise<void>;
  /**
   * A function that removes the highlighting from the current selection
   * @param options See {@link SelectionActionOptions} and {@link UnhighlightOptions}.
   * With a `delay`, the affected highlights are resolved immediately and the
   * selection is dropped right away, so the exit animation is not hidden behind
   * the platform's selection UI.
   */
  unhighlightSelection: (
    options?: SelectionActionOptions & UnhighlightOptions
  ) => void;
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
   * Scrolls the content to the highlight and applies the focus style to it
   * You can add important! to the backgroundColor to ensure it overrides the default background color.
   * Or disable image background by setting the backgroundImage to none.
   * @param id The id of the highlight
   * @param className The className to apply to the highlight, you can styles for this className in the css property.
   * If omitted, a default focus style (a box-shadow) is applied.
   * @param options Scroll alignment, animation and offset. By default the highlight is
   * centered in the viewport with a smooth animation; pass `{ scroll: false }` to apply
   * the focus style without scrolling.
   */
  focusHighlight: (
    id: string,
    className?: string,
    options?: FocusHighlightOptions
  ) => void;
  /**
   * A function that removes the focus style from the currently focused highlight.
   * Use after `focusHighlight` to clear the visual focus state without removing the highlight.
   */
  unfocusHighlight: () => void;
  /**
   * A function that removes a highlight by its id
   * @param id
   * @param options Pass `{ className, delay }` to play an exit animation before
   * the highlight is removed. See {@link UnhighlightOptions}.
   */
  unhighlightById: (id: string, options?: UnhighlightOptions) => void;
  /**
   * A promise that returns all the highlights data
   * @throws js Error
   * @returns All the highlights data
   */
  getAllHighlightsData: () => Promise<HighlightData[]>;
  /**
   * A promise that returns whether highlights are currently visibility.
   * Initially, highlights are visible.
   * @throws js Error
   * @returns `true` if highlights are visible, `false` if hidden
   */
  getHighlightsVisibilityState: () => Promise<boolean>;
  /**
   * A promise that toggles highlight visibility without clearing highlights and each highlight data.
   * Initially, highlights are visible.
   * @throws js Error
   * @returns The new visibility state (`true` if visible, `false` if hidden)
   */
  toggleHighlightsVisibility: () => Promise<boolean>;
};

export type SelectableTextViewPropsBase = {
  /**
   * --> Final property
   * A list of Highlighter, each with a unique name and an options object describing how to render the highlight
   * (background-color, text-decoration-color, outline-color or background-image).
   * The name is used as the className of the tag that wraps the selection, so in the css property you can add
   * more styles that not support by the Highlighter.options. If names are repeated, the last one will be chosen.
   * @default [{ name: "yellow-highlighter", options: { type: "background-color", color: "yellow" } }]
   */
  highlighters?: Highlighter[];
  /**
   * --> State property
   * A serialized string that represents the current highlights in the content. This can be used to restore the highlights when the component is re-rendered, for example when the user navigates away from the screen and then comes back.
   * You can obtain this string from getHighlights method or onHighlightsChange event.
   * You can also use as a state, the content will be re-rendered with the highlights applied whenever this string changes.
   *
   * A value the view itself just emitted through `onHighlightsChange` is ignored, so
   * storing that value in state and passing it straight back is safe and will not
   * replay the highlights.
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
   * @param highlights The serialized payload, to persist and feed back into the `highlights` prop.
   * @param items The highlights the payload contains, already resolved, so there is no
   * need to follow every change with a `getAllHighlightsData()` call.
   */
  onHighlightsChange?: (highlights: Highlights, items: HighlightData[]) => void;
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
   * The payload includes the id of the highlight, the name of the highlight and the text of the highlight.
   * @param highlight
   * @returns The className to apply to the highlight a focus style, you can styles for this className in the css property or return void to not apply any style.
   * The focus style is applied in place (without scrolling); use `focusHighlight(id)` if you also want to scroll to it.
   * The callback may be async: return a `Promise` and the resolved className (if any) is applied.
   */
  onHighlightPressed?: (
    highlight: HighlightData
  ) => string | void | Promise<string | void>;
  /**
   * --> State property
   * Called when the highlights visibility state changes.
   * @param visibilityState
   */
  onHighlightsVisibilityStateChange?: (visibilityState: boolean) => void;
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
    unfocusHighlight: "unfocusHighlight",
    unhighlightById: "unhighlightById",
  },
  // out
  events: {
    onTextSelectionChange: "onTextSelectionChange",
    onHighlightsChange: "onHighlightsChange",
    onError: "onError",
    onHighlightPressed: "onHighlightPressed",
    onHighlightsVisibilityStateChange: "onHighlightsVisibilityStateChange",
    // dev
    log: "log",
  },
  // in - out
  promises: {
    getSelectedText: "getSelectedText",
    getHighlights: "getHighlights",
    getAllHighlightsData: "getAllHighlightsData",
    getHighlightsVisibilityState: "getHighlightsVisibilityState",
    toggleHighlightsVisibility: "toggleHighlightsVisibility",
  },
};

export const VERSION = "1.0.0";
