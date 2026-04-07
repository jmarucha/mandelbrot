export interface Camera {
  center: [number, number];
  scale: number;
  zoomIn(screenX: number, screenY: number): void;
  zoomOut(screenX: number, screenY: number): void;
  moveTo(screenX: number, screenY: number): void;
  startDrag(screenX: number, screenY: number): void;
  drag(screenX: number, screenY: number): void;
}

export function createCamera(
  canvas: HTMLCanvasElement,
  initialCenter: [number, number] = [0, 0],
  initialScale = 3.0,
): Camera {
  const center: [number, number] = [...initialCenter];
  let scale = initialScale;

  // NDC offset from canvas center: [-0.5, 0.5] x [-0.5, 0.5]
  function toNdc(screenX: number, screenY: number): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [
      (screenX - rect.left) / rect.width  - 0.5,
      (screenY - rect.top)  / rect.height - 0.5,
    ];
  }

  function aspect(): number {
    return canvas.width / canvas.height;
  }

  let dragStartNdc: [number, number] = [0, 0];
  let dragStartCenter: [number, number] = [0, 0];

  return {
    get center(): [number, number] { return center; },
    get scale(): number { return scale; },

    zoomIn(screenX: number, screenY: number): void {
      const [nx, ny] = toNdc(screenX, screenY);
      const factor = 0.9;
      center[0] += nx * aspect() * scale * (1 - factor);
      center[1] -= ny * scale * (1 - factor);
      scale *= factor;
    },

    zoomOut(screenX: number, screenY: number): void {
      const [nx, ny] = toNdc(screenX, screenY);
      const factor = 1.1;
      center[0] += nx * aspect() * scale * (1 - factor);
      center[1] -= ny * scale * (1 - factor);
      scale *= factor;
    },

    // Pan so that the world point at (screenX, screenY) becomes the new center.
    moveTo(screenX: number, screenY: number): void {
      const [nx, ny] = toNdc(screenX, screenY);
      center[0] += nx * aspect() * scale;
      center[1] -= ny * scale;
    },

    startDrag(screenX: number, screenY: number): void {
      dragStartNdc = toNdc(screenX, screenY);
      dragStartCenter = [...center] as [number, number];
    },

    drag(screenX: number, screenY: number): void {
      const [nx, ny] = toNdc(screenX, screenY);
      center[0] = dragStartCenter[0] - (nx - dragStartNdc[0]) * aspect() * scale;
      center[1] = dragStartCenter[1] + (ny - dragStartNdc[1]) * scale;
    },
  };
}
