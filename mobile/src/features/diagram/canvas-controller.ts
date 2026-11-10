import { Animated, PanResponder, type PanResponderInstance } from 'react-native';

import type { Scene, SceneNode } from './scene';

export const MIN_SCALE = 0.15;
export const MAX_SCALE = 3;

interface Transform {
  tx: number;
  ty: number;
  s: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function fitTransform(scene: Scene, w: number, h: number): Transform {
  if (w <= 0 || h <= 0) return { tx: 0, ty: 0, s: 1 };
  const s = clamp(Math.min(w / scene.width, h / scene.height, 1), MIN_SCALE, 1);
  return { tx: (w - scene.width * s) / 2, ty: (h - scene.height * s) / 2, s };
}

/** Elemento bajo el punto (coordenadas de escena); el último dibujado gana. */
export function hitTest(scene: Scene, x: number, y: number): SceneNode | null {
  for (let i = scene.nodes.length - 1; i >= 0; i--) {
    const n = scene.nodes[i];
    if (x >= n.x && x <= n.x + n.width && y >= n.y && y <= n.y + n.height) return n;
  }
  return null;
}

type Touch = { pageX: number; pageY: number; locationX: number; locationY: number };
const dist = (a: Touch, b: Touch) => Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);

/**
 * Estado y gestos del lienzo (pan, pinch, doble toque, toque). Vive fuera del render:
 * los valores animados se actualizan imperativamente para no repintar el SVG.
 */
export class CanvasController {
  readonly tx = new Animated.Value(0);
  readonly ty = new Animated.Value(0);
  readonly scale = new Animated.Value(1);
  readonly panHandlers: PanResponderInstance['panHandlers'];

  scene: Scene = { nodes: [], edges: [], width: 200, height: 200 };
  size = { w: 0, h: 0 };
  onSelect: ((node: SceneNode | null) => void) | undefined;

  private t: Transform = { tx: 0, ty: 0, s: 1 };
  private start: Transform = { tx: 0, ty: 0, s: 1 };
  private startDist = 0;
  private moved = false;
  private startTime = 0;
  private lastTap = 0;
  private originX = 0;
  private originY = 0;

  constructor() {
    this.panHandlers = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        this.start = { ...this.t };
        this.moved = false;
        this.startTime = Date.now();
        this.startDist = 0;
        this.originX = e.nativeEvent.locationX;
        this.originY = e.nativeEvent.locationY;
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches as unknown as Touch[];
        if (touches.length >= 2) {
          this.moved = true;
          const d = dist(touches[0], touches[1]);
          if (this.startDist === 0) {
            this.startDist = d;
            this.start = { ...this.t };
            return;
          }
          const fx = (touches[0].locationX + touches[1].locationX) / 2;
          const fy = (touches[0].locationY + touches[1].locationY) / 2;
          const { tx, ty, s } = this.start;
          const ns = clamp(s * (d / this.startDist), MIN_SCALE, MAX_SCALE);
          this.apply({ s: ns, tx: fx - (fx - tx) * (ns / s), ty: fy - (fy - ty) * (ns / s) });
          return;
        }
        if (this.startDist !== 0) return; // venía de un pinch: ignora el dedo restante
        if (Math.abs(g.dx) + Math.abs(g.dy) > 8) this.moved = true;
        if (this.moved) this.apply({ s: this.start.s, tx: this.start.tx + g.dx, ty: this.start.ty + g.dy });
      },
      onPanResponderRelease: () => {
        const wasPinch = this.startDist !== 0;
        this.startDist = 0;
        if (this.moved || wasPinch || Date.now() - this.startTime > 350) return;
        const now = Date.now();
        if (now - this.lastTap < 300) {
          this.lastTap = 0;
          this.fit();
          return;
        }
        this.lastTap = now;
        const { tx, ty, s } = this.t;
        this.onSelect?.(hitTest(this.scene, (this.originX - tx) / s, (this.originY - ty) / s));
      },
    }).panHandlers;
  }

  private apply(next: Transform) {
    this.t = next;
    this.tx.setValue(next.tx);
    this.ty.setValue(next.ty);
    this.scale.setValue(next.s);
  }

  setOnSelect(fn: ((node: SceneNode | null) => void) | undefined) {
    this.onSelect = fn;
  }

  setView(scene: Scene, size: { w: number; h: number }) {
    this.scene = scene;
    this.size = size;
  }

  fit() {
    this.apply(fitTransform(this.scene, this.size.w, this.size.h));
  }

  zoomBy(factor: number) {
    const fx = this.size.w / 2;
    const fy = this.size.h / 2;
    const { tx, ty, s } = this.t;
    const ns = clamp(s * factor, MIN_SCALE, MAX_SCALE);
    this.apply({ s: ns, tx: fx - (fx - tx) * (ns / s), ty: fy - (fy - ty) * (ns / s) });
  }
}
