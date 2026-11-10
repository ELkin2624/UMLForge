import { type ApollonEditor as NativeApollonEditor } from '@tumaet/apollon';

export type EditorRef = React.RefObject<NativeApollonEditor | null>;

export interface VisualPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export type VisualStateMap = Record<string, VisualPosition>;
