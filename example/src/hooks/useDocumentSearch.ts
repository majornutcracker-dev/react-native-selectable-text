import type { SelectableTextViewRef } from "@majornutcracker/react-native-selectable-text";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  SEARCH_CURRENT_HIGHLIGHT,
  SEARCH_FLASH_CLASS,
  SEARCH_HIGHLIGHT,
} from "@/constants/search";

export type SearchState = {
  /** How many matches the current query has. */
  total: number;
  /** The match on screen, or -1 when there is none. */
  index: number;
};

const NO_MATCHES: SearchState = { total: 0, index: -1 };

/** One letter matches almost everything, and paints the page solid. */
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

/**
 * Installs `window.exampleSearch` in the page, unless it is already there.
 *
 * Every call carries it, so a page that reloaded — the content process can be
 * killed in the background — heals itself instead of failing on a global that
 * no longer exists.
 */
const INSTALL = `
if (!window.exampleSearch) {
  window.exampleSearch = (function () {
    var MATCHES = ${JSON.stringify(SEARCH_HIGHLIGHT)};
    var CURRENT = ${JSON.stringify(SEARCH_CURRENT_HIGHLIGHT)};
    var FLASH = ${JSON.stringify(SEARCH_FLASH_CLASS)};
    var canPaint =
      typeof CSS !== "undefined" && !!CSS.highlights && typeof Highlight === "function";
    var query = "";
    var ranges = [];
    var index = -1;

    function normalize(value) {
      return String(value).trim().replace(/\\s+/g, " ").toLowerCase();
    }

    // The text as it reads on screen — whitespace collapsed, case folded — and,
    // for each of its characters, where it really sits in the DOM. Matching the
    // collapsed text finds phrases that the markup splits across elements and
    // across the source's line breaks.
    function collect(needle) {
      var found = [];
      if (!needle) {
        return found;
      }
      var root = document.querySelector(".doc") || document.body;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var parent = node.parentElement;
          return parent && parent.closest("script, style")
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        },
      });
      var text = "";
      var map = [];
      var lastWasSpace = true;
      for (var node = walker.nextNode(); node; node = walker.nextNode()) {
        var value = node.nodeValue;
        for (var i = 0; i < value.length; i++) {
          if (/\\s/.test(value[i])) {
            if (lastWasSpace) {
              continue;
            }
            text += " ";
            map.push([node, i]);
            lastWasSpace = true;
          } else {
            // A few characters grow when lowercased, so map every unit of it.
            var lower = value[i].toLowerCase();
            for (var j = 0; j < lower.length; j++) {
              text += lower[j];
              map.push([node, i]);
            }
            lastWasSpace = false;
          }
        }
      }
      for (var from = 0, at; (at = text.indexOf(needle, from)) !== -1; from = at + needle.length) {
        var start = map[at];
        var end = map[at + needle.length - 1];
        var range = document.createRange();
        range.setStart(start[0], start[1]);
        range.setEnd(end[0], end[1] + 1);
        found.push(range);
      }
      return found;
    }

    function paint() {
      if (!canPaint) {
        return;
      }
      if (ranges.length) {
        CSS.highlights.set(MATCHES, new Highlight(...ranges));
      } else {
        CSS.highlights.delete(MATCHES);
      }
      if (index >= 0) {
        var current = new Highlight(ranges[index]);
        current.priority = 1;
        CSS.highlights.set(CURRENT, current);
      } else {
        CSS.highlights.delete(CURRENT);
      }
    }

    // Outside <body> on purpose: the module anchors highlights to the text of
    // the body, and this element must not become part of it.
    function flash(rect) {
      var mark = document.createElement("div");
      mark.className = FLASH;
      mark.style.left = rect.left + window.scrollX - 3 + "px";
      mark.style.top = rect.top + window.scrollY - 2 + "px";
      mark.style.width = rect.width + 6 + "px";
      mark.style.height = rect.height + 4 + "px";
      document.documentElement.appendChild(mark);
      setTimeout(function () {
        mark.remove();
      }, 1300);
    }

    function reveal() {
      var range = ranges[index];
      if (!range) {
        return;
      }
      var rect = range.getBoundingClientRect();
      var top = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      if (!canPaint) {
        var lines = range.getClientRects();
        for (var k = 0; k < lines.length; k++) {
          flash(lines[k]);
        }
      }
    }

    function state() {
      return { total: ranges.length, index: index };
    }

    return {
      find: function (value) {
        query = normalize(value);
        ranges = collect(query);
        index = ranges.length ? 0 : -1;
        paint();
        reveal();
        return state();
      },
      move: function (step) {
        // Collected again rather than reused: highlighting while a search is
        // open rewrites the text nodes the previous ranges pointed into.
        ranges = collect(query);
        if (!ranges.length) {
          index = -1;
        } else if (index < 0) {
          index = step > 0 ? 0 : ranges.length - 1;
        } else {
          index = (((index + step) % ranges.length) + ranges.length) % ranges.length;
        }
        paint();
        reveal();
        return state();
      },
      clear: function () {
        query = "";
        ranges = [];
        index = -1;
        paint();
        return state();
      },
    };
  })();
}
`;

/**
 * Find-in-page for a reader, built entirely on `evaluateJavaScript`.
 *
 * Nothing in the page changes but a CSS highlight registry and the scroll
 * position, so the module's highlights and selection are left alone.
 */
export function useDocumentSearch(
  viewRef: RefObject<SelectableTextViewRef | null>
) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>(NO_MATCHES);

  // Only the answer to the newest call is applied. Calls resolve out of order
  // when typing is fast, and a late answer for an older query would otherwise
  // overwrite the current one.
  const latest = useRef(0);
  useEffect(
    () => () => {
      latest.current += 1;
    },
    []
  );

  const hasSearched = useRef(false);

  const run = useCallback(
    (call: string) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      const request = ++latest.current;
      view
        .evaluateJavaScript<SearchState>(
          `${INSTALL}\nreturn window.exampleSearch.${call};`
        )
        .then((next) => {
          if (request === latest.current && next) {
            setState(next);
          }
        })
        .catch(() => {
          if (request === latest.current) {
            setState(NO_MATCHES);
          }
        });
    },
    [viewRef]
  );

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < MIN_QUERY_LENGTH) {
      // Nothing to clear before the first search; that call would only queue
      // up behind the page load for no reason.
      if (hasSearched.current) {
        run("clear()");
      }
      setState(NO_MATCHES);
      return;
    }
    const timer = setTimeout(() => {
      hasSearched.current = true;
      run(`find(${JSON.stringify(needle)})`);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, run]);

  const next = useCallback(() => run("move(1)"), [run]);
  const previous = useCallback(() => run("move(-1)"), [run]);
  const reset = useCallback(() => setQuery(""), []);

  return useMemo(
    () => ({
      query,
      setQuery,
      total: state.total,
      index: state.index,
      /** True once a query is long enough to be searched. */
      searching: query.trim().length >= MIN_QUERY_LENGTH,
      next,
      previous,
      reset,
    }),
    [query, state, next, previous, reset]
  );
}
