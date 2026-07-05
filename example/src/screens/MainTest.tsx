import {
  SelectableTextView,
  HTMLString,
  SelectableTextViewRef,
  ColorClass,
  CSSString,
  ColorClassName,
  googleFonts,
} from "@majornutcracker/react-native-selectable-text";
import { useRef, useState } from "react";
import { Linking, StyleSheet, Text, View, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionsFab } from "@/components/ActionsFab";
import { ColorFab } from "@/components/ColorFab";
import Clipboard from "@react-native-clipboard/clipboard";
import { useToastNotification } from "@/context/ToastNotificationProvider";

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
        <dt><code>colorClasses</code></dt>
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
      </ul>
    </section>

    <section aria-labelledby="ref">
      <h2 id="ref">Ref API</h2>
      <ul>
        <li><code>highlightSelection(colorClassName?)</code> — applies the active color to the cached selection.</li>
        <li><code>unhighlightSelection()</code> — removes highlight from the cached selection.</li>
        <li><code>clearHighlights()</code> — removes all highlights from the content (left FAB).</li>
        <li><code>getSelectedText()</code> — returns the cached selected text (left FAB).</li>
        <li><code>getHighlights()</code> — returns the serialized highlights string (left FAB).</li>
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
.content {
  font-family: "Source Sans 3", sans-serif;
  font-optical-sizing: auto;
  line-height: 1.6;
  font-size: 14px;
  background-color: #fff;
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
`;

const contentFonts = googleFonts({
  families: [
    { family: "Source Sans 3", weights: "200..900", italic: true },
    { family: "Source Serif 4", weights: "400;600", italic: true },
  ],
});

const colorClasses: ColorClass[] = [
  { name: "highlight-amber", color: "#FDE8A0" },
  { name: "highlight-coral", color: "#FCAAB8" },
  { name: "highlight-mint", color: "#A7F0D5" },
  { name: "highlight-sky", color: "#93C5FD" },
  { name: "highlight-violet", color: "#C4B5FD" },
];

export default function MainTest() {
  const selectableTextViewRef = useRef<SelectableTextViewRef>(null);
  const [currentColorClassName, setCurrentColorClassName] =
    useState<ColorClassName>(colorClasses[0].name);
  const { showToast } = useToastNotification();

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
                  currentColorClassName
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
          colorClasses={colorClasses}
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
        />
      </Group>
      <View style={styles.fabSpace} />
      <ActionsFab selectableTextViewRef={selectableTextViewRef} />
      <ColorFab
        colorClasses={colorClasses}
        currentColorClassName={currentColorClassName}
        setCurrentColorClassName={setCurrentColorClassName}
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
