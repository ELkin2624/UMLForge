import { drawScene, type DrawOp, type DrawOptions } from './draw';
import type { Scene } from './scene';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pts = (p: { x: number; y: number }[]) => p.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');

function op(o: DrawOp): string {
  switch (o.t) {
    case 'rect':
      return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw}"/>`;
    case 'circle':
      return `<circle cx="${o.cx}" cy="${o.cy}" r="${o.r}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw}"/>`;
    case 'path':
      return `<path d="${o.d}" fill="none" stroke="${o.stroke}" stroke-width="${o.sw}"/>`;
    case 'poly': {
      const tag = o.closed ? 'polygon' : 'polyline';
      const dash = o.dash ? ` stroke-dasharray="${o.dash}"` : '';
      return `<${tag} points="${pts(o.points)}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw}"${dash}/>`;
    }
    case 'text': {
      const attrs = [
        `x="${o.x.toFixed(1)}"`,
        `y="${o.y.toFixed(1)}"`,
        `font-size="${o.size}"`,
        `text-anchor="${o.anchor}"`,
        `font-family="DejaVu Sans, Arial, sans-serif"`,
        o.bold ? 'font-weight="bold"' : '',
        o.italic ? 'font-style="italic"' : '',
        o.underline ? 'text-decoration="underline"' : '',
      ].filter(Boolean);
      return `<text ${attrs.join(' ')}>${esc(o.text)}</text>`;
    }
  }
}

/** SVG autónomo de la escena: sirve para pruebas y para revisar el dibujo con ImageMagick. */
export function sceneToSvgString(scene: Scene, opts: DrawOptions = {}): string {
  const body = drawScene(scene, opts).map(op).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">\n<rect width="100%" height="100%" fill="#ffffff"/>\n${body}\n</svg>\n`;
}
