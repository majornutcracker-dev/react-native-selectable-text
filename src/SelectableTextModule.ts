import { NativeModule, requireOptionalNativeModule } from "expo";

declare class MajornutcrackerReactNativeSelectableTextModule extends NativeModule {
  version: string;
}

// Optional so the package still loads where the native module is not in the
// binary — Expo Go and Snack, which already bundle `react-native-webview`.
// `SelectableTextView` never reads it, so the component works there too.
export default requireOptionalNativeModule<MajornutcrackerReactNativeSelectableTextModule>(
  "MajornutcrackerReactNativeSelectableText"
);
