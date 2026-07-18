import {
  SelectableTextView,
  HTMLString,
  SelectableTextViewRef,
  CSSString,
  googleFonts,
  HighlighterName,
  HighlightData,
} from "@majornutcracker/react-native-selectable-text";
import { useRef, useState } from "react";
import { Linking, StyleSheet, Text, View, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionsFab } from "@/components/ActionsFab";
import { BottomSheetFab } from "@/components/BottomSheetFab";
import { HighlighterFab } from "@/components/HighlighterFab";
import { NotesBottomSheet } from "@/components/NotesBottomSheet";
import Clipboard from "@react-native-clipboard/clipboard";
import { useToastNotification } from "@/context/ToastNotificationProvider";
import { highlighters } from "@/constants/highlighters";

const guideContent: HTMLString = `
<article class="content">
  <header>
    <h1>SelectableTextView demo</h1>
    <p>
      HTML rendered in a WebView with native selection, Rangy highlights, and a bridge to React Native.
      Pick a color with the right FAB, select text, then use the system menu or the left FAB actions.
    </p>
  </header>

  <main>
    <section aria-labelledby="props">
      <h2 id="props">Props</h2>
      <dl>
        <dt><code>content</code></dt>
        <dd>This article is the HTML string passed to the component.</dd>
        <dt><code>css</code></dt>
        <dd>Injected styles for layout and typography (<code>.content</code>).</dd>
        <dt><code>fonts</code></dt>
        <dd>
          Optional WebView font setup via <code>googleFonts()</code>,
          <code>mergeFonts()</code>, or custom
          <code>preconnect</code>, <code>stylesheets</code>, and <code>@font-face</code> rules.
          Multiple families are supported in a single <code>fonts</code> config.
        </dd>
        <dt><code>highlighters</code></dt>
        <dd>Named highlight classes; the FAB switches the active one for <code>highlightSelection</code>.</dd>
        <dt><code>highlights</code></dt>
        <dd>Optional serialized state to restore highlights when the screen remounts.</dd>
        <dt><code>highlighterOptions</code></dt>
        <dd>
          <code>ignoredElements</code> — tags or classes such as <code>a</code>,
          <code>sup</code>, <code>.ignored</code>. Ignored nodes skip the visible highlight;
          they remain selectable and copyable.
        </dd>
        <dt><code>options</code></dt>
        <dd>
          Viewport zoom: <code>userScalable</code>, <code>initialScale</code>,
          <code>maximumScale</code>. This demo disables pinch zoom.
        </dd>
        <dt><code>webViewProps</code></dt>
        <dd>
          Pass-through to <code>react-native-webview</code>; here used for the custom
          Highlight / Unhighlight / Copy menu.
        </dd>
      </dl>
    </section>

    <section aria-labelledby="callbacks">
      <h2 id="callbacks">Callbacks</h2>
      <ul>
        <li><code>onTextSelectionChange</code> — logs the current selection (see Metro).</li>
        <li><code>onHighlightsChange</code> — logs the serialized highlight payload after each change.</li>
        <li><code>onLink</code> — handles link taps; try the sample link in the section below.</li>
        <li>
          <code>onError</code> — WebView SDK errors (<code>code</code>, <code>message</code>,
          <code>details</code>). Shown here as a toast; try highlighting over an existing highlight
          for <code>overlapping_highlight</code>, or highlight with no selection for
          <code>empty_selection</code>.
        </li>
        <li>
          <code>onHighlightPressed</code> — fired when a highlight is tapped. Payload:
          <code>id</code>, <code>name</code>, and <code>text</code>. In this demo it opens
          the notes sheet; tap any existing highlight to try it.
          Returns the className to apply to the highlight, you can styles for this className in the css property or return void to not apply any style.
        </li>
      </ul>
    </section>

    <section aria-labelledby="ref">
      <h2 id="ref">Ref API</h2>
      <ul>
        <li><code>highlightSelection(name?)</code> — applies the active color to the cached selection.</li>
        <li>
          <code>highlightSelectionWithValidation(validation, name?)</code> — highlights only if
          <code>validation(text)</code> returns (or resolves to) <code>true</code>. Try the
          "Highlight (4+ chars)" item in the native menu with a short selection.
        </li>
        <li><code>unhighlightSelection()</code> — removes highlight from the cached selection.</li>
        <li><code>clearHighlights()</code> — removes all highlights from the content (left FAB).</li>
        <li><code>getSelectedText()</code> — returns the cached selected text (left FAB).</li>
        <li><code>getHighlights()</code> — returns the serialized highlights string (left FAB).</li>
        <li>
          <code>getAllHighlightsData()</code> — returns an array of
          <code>{ id, name, text }</code> for every highlight. The left FAB
          "All Highlights Data" action opens a dedicated screen listing this payload.
        </li>
        <li><code>focusHighlight(id, className?)</code> — scrolls to a highlight by id and applies the focus style to it; pass a <code>className</code> to style it via the css property, or omit it for the default focus style (notes sheet "Focus").</li>
        <li>
          <code>unfocusHighlight()</code> — removes the focus style from the currently focused highlight without
          deleting it (notes sheet close).
        </li>
        <li><code>unhighlightById(id)</code> — removes a single highlight by id (notes sheet "Unhighlight").</li>
        <li>
          <code>getHighlightsVisibilityState()</code> — returns <code>true</code> when highlights are visible
          <code>false</code> when highlights are hidden.
        </li>
        <li>
          <code>toggleHighlightsVisibility()</code> — hides or shows highlights without deleting them.
        </li>
      </ul>
    </section>

    <section aria-labelledby="ignored">
      <h2 id="ignored">Ignored elements</h2>
      <p>
        Default ignored tags: <code>a</code>, <code>sup</code>, <code>sub</code>, plus headings in this demo.
        Select across normal text and these nodes — the visible highlight skips them, but the text stays selectable and copyable.
      </p>
      <p>
        Chemistry sample: H<sub>2</sub>O and E = mc<sup>2</sup> inside a longer sentence for cross-selection tests.
      </p>
      <p class="ignored">
        This paragraph uses <code>.ignored</code>. You can select and copy it; it just will not receive a visible highlight.
      </p>
    </section>

    <section aria-labelledby="try">
      <h2 id="try">Try selection</h2>
      <p>
        Drag a selection across multiple lines. Use Highlight / Unhighlight from the native menu
        or switch colors with the FAB and highlight again.
      </p>
      <ul>
        <li>List item with x<sup>2</sup> notation.</li>
        <li>Second item with CO<sub>2</sub> for multi-line ranges.</li>
      </ul>
      <p>
        Inline code: <code>highlightSelection</code> and <code>unhighlightSelection</code> are also exposed on the ref.
      </p>
    </section>

    <section aria-labelledby="links">
      <h2 id="links">Links</h2>
      <p>
        External navigation is handled in <code>onLink</code>:
        <a href="https://www.google.com">open via Linking</a>.
      </p>
    </section>
  </main>

  <footer>
    <p>Example screen — not production content.</p>
  </footer>
</article>
`;

const cssContent: CSSString = `
html,
body {
  overflow-x: hidden;
  max-width: 100%;
}
.content {
  font-family: "Source Sans 3", sans-serif;
  font-optical-sizing: auto;
  line-height: 1.6;
  font-size: 14px;
  background-color: #fff;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.content section {
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e5e5;
}
.content section:last-of-type {
  border-bottom: none;
}
.content h1,
.content h2 {
  font-family: "Source Serif 4", serif;
  font-optical-sizing: auto;
}
.content h2 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
}
.content dl {
  margin: 0;
}
.content dt {
  font-weight: 600;
  margin-top: 0.5rem;
}
.content dt:first-child {
  margin-top: 0;
}
.content dd {
  margin: 0.15rem 0 0 0;
  color: #444;
}
.content code {
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
  background: #f4f4f4;
  padding: 0.1em 0.35em;
  border-radius: 3px;
}
.content a {
  color: #0645ad;
}
.content .ignored {
  border-left: 3px solid #e5e5e5;
  padding-left: 0.75rem;
}
.focus-highlight {
  display: inline-block;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  animation: focus-highlight-animation 500ms ease-out;
}
@keyframes focus-highlight-animation {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}
.${highlighters[0].name} {
  background-image:
    radial-gradient(circle, rgba(255,255,255,.8) 2px, transparent 3px),
    radial-gradient(circle, rgba(255,255,255,.6) 3px, transparent 4px),
    radial-gradient(circle, rgba(255,255,255,.7) 2px, transparent 3px);
  background-size: 30px 30px, 40px 40px, 35px 35px;
  background-position: 10% 100%, 50% 100%, 80% 100%;
  animation: bubbles 2s linear infinite;
}
@keyframes bubbles {
  from {
    background-position:
      10% 100%,
      50% 100%,
      80% 100%;
  }
  to {
    background-position:
      10% -100%,
      50% -100%,
      80% -100%;
  }
}
`;

const contentFonts = googleFonts({
  families: [
    { family: "Source Sans 3", weights: "200..900", italic: true },
    { family: "Source Serif 4", weights: "400;600", italic: true },
  ],
});

export default function MainTest() {
  const selectableTextViewRef = useRef<SelectableTextViewRef>(null);
  const [currentHighlighterName, setCurrentHighlighterName] =
    useState<HighlighterName>(highlighters[0].name);
  const { showToast } = useToastNotification();
  const [visibleNote, setVisibleNote] = useState(false);
  const [pressedHighlight, setPressedHighlight] =
    useState<HighlightData | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Module API Example</Text>
      <Group name="SelectableTextView" flex>
        <SelectableTextView
          ref={selectableTextViewRef}
          webViewProps={{
            style: styles.selectableText,
            menuItems: [
              {
                key: "highlight",
                label: "Highlight",
              },
              {
                key: "highlight-validated",
                label: "Highlight (4+ chars)",
              },
              {
                key: "unhighlight",
                label: "Unhighlight",
              },
              {
                key: "copy",
                label: "Copy",
              },
            ],
            onCustomMenuSelection: (event) => {
              const key = event.nativeEvent.key;
              if (key === "highlight") {
                selectableTextViewRef.current?.highlightSelection(
                  currentHighlighterName
                );
              } else if (key === "highlight-validated") {
                selectableTextViewRef.current?.highlightSelectionWithValidation(
                  (text) => {
                    const valid = text.trim().length >= 4;
                    if (!valid) {
                      showToast(
                        "Selection too short to highlight (min 4 chars)"
                      );
                    }
                    return valid;
                  },
                  currentHighlighterName
                );
              } else if (key === "unhighlight") {
                selectableTextViewRef.current?.unhighlightSelection();
              } else if (key === "copy") {
                Clipboard.setString(event.nativeEvent.selectedText);
                Platform.OS === "ios"
                  ? Alert.alert("Copied to clipboard")
                  : null;
              }
            },
          }}
          highlighters={highlighters}
          content={guideContent}
          css={cssContent}
          fonts={contentFonts}
          highlighterOptions={{
            ignoredElements: [
              "a",
              "sup",
              "sub",
              ".ignored",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
            ],
          }}
          options={{
            userScalable: false,
            initialScale: 1,
            maximumScale: 1,
          }}
          onLink={(url) => {
            console.log("link", url);
            Linking.openURL(url);
          }}
          onTextSelectionChange={(selectedText) => {
            console.log("textSelectionChange", selectedText);
          }}
          onHighlightsChange={(highlights) => {
            console.log("highlights", highlights);
          }}
          onError={(error) => {
            showToast(error.message);
          }}
          onHighlightPressed={(highlight) => {
            setPressedHighlight(highlight);
            setVisibleNote(true);
            return "focus-highlight";
          }}
        />
      </Group>
      <View style={styles.fabSpace} />
      <BottomSheetFab onPress={() => setVisibleNote(true)} />
      <ActionsFab
        selectableTextViewRef={selectableTextViewRef}
        onClearHighlights={() => {
          setPressedHighlight(null);
        }}
      />
      <HighlighterFab
        highlighters={highlighters}
        currentHighlighterName={currentHighlighterName}
        setCurrentHighlighterName={setCurrentHighlighterName}
      />
      <NotesBottomSheet
        visible={visibleNote}
        onClose={() => {
          selectableTextViewRef.current?.unfocusHighlight();
          setVisibleNote(false);
        }}
        highlight={pressedHighlight}
        onFocusHighlight={(id) => {
          setVisibleNote(false);
          selectableTextViewRef.current?.focusHighlight(id, "focus-highlight");
        }}
        onUnhighlight={(id) => {
          selectableTextViewRef.current?.unhighlightById(id);
          setVisibleNote(false);
          setPressedHighlight(null);
        }}
      />
    </SafeAreaView>
  );
}

function Group(props: {
  name: string;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <View style={[styles.group, props.flex ? { flex: 1 } : {}]}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 30,
  },
  groupHeader: {
    fontSize: 20,
  },
  group: {
    backgroundColor: "#fff",
    borderRadius: 10,
    gap: 20,
    padding: 20,
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 20,
    backgroundColor: "#eee",
  },
  selectableText: {
    flex: 1,
  },
  fabSpace: {
    height: 50,
  },
});
