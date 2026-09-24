import { SelectableTextView } from "@majornutcracker/react-native-selectable-text";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { Header } from "./components/Header";
import { Toolbar } from "./components/Toolbar";
import { highlighters } from "./highlighters";
import { theme } from "./theme";

const article = `
  <h1>The reading room</h1>
  <p class="lede">
    Select any part of this text. The menu that pops up is the native selection
    menu, and every item on it calls a method on this component.
  </p>
  <p>
    Each highlight is serialized into a plain string you can store anywhere —
    AsyncStorage, SQLite, your own API. Hand that string back through the
    <code>highlights</code> prop and the highlights return exactly where the
    reader left them: on another screen, another session, another device.
  </p>
  <p>
    Tap a highlight and you get its id, its text and where it sits on screen,
    so a popover can be anchored without measuring anything yourself.
  </p>
  <p>
    Try it: highlight a few passages, press the bin to clear them, then press
    undo to bring them back from the saved string.
  </p>
`;

const css = `
  body { background: ${theme.color.paper}; }
  .content {
    padding: 24px 22px 32px;
    font-size: 18px;
    line-height: 1.7;
    color: ${theme.color.paperInk};
    font-family: -apple-system, Roboto, "Segoe UI", sans-serif;
  }
  h1 { font-size: 25px; line-height: 1.2; margin: 0 0 12px; letter-spacing: -0.4px; }
  .lede { font-size: 19px; color: #2C3444; }
  p { margin: 0 0 16px; }
  code {
    background: #E7EAF2;
    padding: 1px 5px;
    border-radius: 5px;
    font-size: 15px;
  }
`;

function Demo() {
  const insets = useSafeAreaInsets();
  const ref = useRef(null);

  const [current, setCurrent] = useState("amber");
  const [highlights, setHighlights] = useState(undefined);
  const [count, setCount] = useState(0);
  const [depth, setDepth] = useState(0);
  const [status, setStatus] = useState("Select some text to begin");

  /**
   * Every payload the view has reported, oldest first — an undo history rather
   * than a single slot. A ref, not state: pushing must not re-render, and the
   * handlers have to read the current stack, not the one their closure was
   * created with.
   *
   * Popping matters for more than history. The view ignores a payload it just
   * emitted, and React skips an effect when the prop value is unchanged, so
   * restoring the *same* string twice does nothing either way. Each pop hands
   * over a different, older payload, so the prop always changes and the view
   * always acts.
   */
  const history = useRef([]);
  /** The payload a restore just pushed back in, so it is not re-recorded. */
  const restoring = useRef(null);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Header count={count} topInset={insets.top} />

      <View style={styles.reader}>
        <SelectableTextView
          ref={ref}
          content={article}
          css={css}
          highlighters={highlighters}
          highlights={highlights}
          webViewProps={{
            style: styles.webview,
            menuItems: [
              { key: "highlight", label: "Highlight" },
              { key: "underline", label: "Underline" },
              { key: "remove", label: "Remove" },
            ],
            onCustomMenuSelection: (event) => {
              const key = event.nativeEvent.key;
              if (key === "remove") {
                ref.current?.unhighlightSelection();
                setStatus("Removed");
              } else if (key === "underline") {
                ref.current?.highlightSelection("underline");
                setStatus("Underlined");
              } else {
                ref.current?.highlightSelection(current);
                setStatus(`Highlighted in ${current}`);
              }
            },
          }}
          onHighlightsChange={(serialized, items) => {
            setCount(items.length);

            // The echo of a restore: it is already in the history, one step
            // further back. Recording it again would undo the undo.
            if (serialized === restoring.current) {
              restoring.current = null;
              return;
            }
            // Clearing reports an empty payload; there is nothing to go back
            // to in it, and it would sit in the way of the real ones.
            if (items.length === 0) return;

            history.current.push(serialized);
            setDepth(history.current.length);
          }}
          onHighlightPressed={(highlight) => {
            setStatus(`Tapped: "${highlight.text.slice(0, 36)}"`);
          }}
          onError={(error) => {
            // `details` carries what actually went wrong — the Rangy message
            // behind a restore that refused, for instance. Worth showing:
            // without it a failed restore looks like a button that does
            // nothing.
            setStatus(`${error.code}: ${error.details ?? error.message}`);
            console.warn("[selectable-text]", error);
          }}
        />
      </View>

      <Toolbar
        current={current}
        onPick={(name) => {
          setCurrent(name);
          setStatus(`${name} selected — now highlight something`);
        }}
        onClear={() => {
          ref.current?.clearHighlights();
          setStatus("Cleared — undo brings them back");
        }}
        onRestore={() => {
          const previous = history.current.pop();
          setDepth(history.current.length);
          if (previous === undefined) return;

          restoring.current = previous;
          setHighlights(previous);
          setStatus(`Restored — ${history.current.length} step(s) left`);
        }}
        onToggle={() => ref.current?.toggleHighlightsVisibility()}
        canRestore={depth > 0}
        status={status}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Demo />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  reader: { flex: 1, backgroundColor: theme.color.paper },
  webview: { flex: 1, backgroundColor: theme.color.paper },
});
