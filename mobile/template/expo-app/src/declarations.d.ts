declare module 'react' {
  export = React;
}

declare module 'react-native' {
  export const View: any;
  export const Text: any;
  export const StyleSheet: any;
  export const ScrollView: any;
  export const TouchableOpacity: any;
  export const FlatList: any;
  export const ActivityIndicator: any;
  export const Modal: any;
  export const TextInput: any;
  export const KeyboardAvoidingView: any;
  export const Platform: any;
  export const Alert: any;
}

declare module 'expo-router' {
  export const Stack: any;
  export const Tabs: any;
  export const useRouter: () => any;
  export const useLocalSearchParams: <T = any>() => T;
}

declare module 'expo-status-bar' {
  export const StatusBar: any;
}

declare module 'react-native-safe-area-context' {
  export const SafeAreaProvider: any;
  export const SafeAreaView: any;
  export const useSafeAreaInsets: () => { top: number; bottom: number; left: number; right: number };
}

declare module '*.json' {
  const value: any;
  export default value;
}
