import BigNumber from 'bignumber.js';

BigNumber.config({ DECIMAL_PLACES: 50 });

export interface Camera {
  center: [BigNumber, BigNumber];
  scale: number;
  zoomIn(screenX: number, screenY: number): void;
  zoomOut(screenX: number, screenY: number): void;
  moveTo(screenX: number, screenY: number): void;
  startDrag(screenX: number, screenY: number): void;
  drag(screenX: number, screenY: number): void;

  startPinch(c1: [number, number], c2: [number, number]): void;
  pinch(c1: [number, number], c2: [number, number]): void;
}

export function createCamera(
  canvas: HTMLCanvasElement,
  initialCenter: [number, number] = [0, 0],
  initialScale = 3.0,
): Camera {
  const center: [BigNumber, BigNumber] = [
    new BigNumber(initialCenter[0]),
    new BigNumber(initialCenter[1]),
  ];
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
  let dragStartCenter: [BigNumber, BigNumber] = [new BigNumber(0), new BigNumber(0)];

  let pinchStartNdc: [number, number] = [0, 0];
  let pinchStartCenter: [BigNumber, BigNumber] = [new BigNumber(0), new BigNumber(0)];

  let pinchOrigDistance: number;
  let pinchOrigScale: number;

  return {
    get center(): [BigNumber, BigNumber] { return center; },
    get scale(): number { return scale; },

    zoomIn(screenX: number, screenY: number): void {
      const [nx, ny] = toNdc(screenX, screenY);
      const factor = 0.9;
      center[0] = center[0].plus(nx * aspect() * scale * (1 - factor));
      center[1] = center[1].minus(ny * scale * (1 - factor));
      scale *= factor;
      console.log(scale);
    },

    zoomOut(screenX: number, screenY: number): void {
      const [nx, ny] = toNdc(screenX, screenY);
      const factor = 1.1;
      center[0] = center[0].plus(nx * aspect() * scale * (1 - factor));
      center[1] = center[1].minus(ny * scale * (1 - factor));
      scale *= factor;
      console.log(scale);
    },

    moveTo(screenX: number, screenY: number): void {
      const [nx, ny] = toNdc(screenX, screenY);
      center[0] = center[0].plus(nx * aspect() * scale);
      center[1] = center[1].minus(ny * scale);
    },

    startDrag(screenX: number, screenY: number): void {
      dragStartNdc = toNdc(screenX, screenY);
      dragStartCenter = [center[0], center[1]];
    },

    drag(screenX: number, screenY: number): void {
      const [nx, ny] = toNdc(screenX, screenY);
      center[0] = dragStartCenter[0].minus((nx - dragStartNdc[0]) * aspect() * scale);
      center[1] = dragStartCenter[1].plus((ny - dragStartNdc[1]) * scale);
    },

    startPinch(c1: [number, number], c2: [number, number]): void {
      const c1_ndc = toNdc(c1[0], c1[1]);
      const c2_ndc = toNdc(c2[0], c2[1]);
      pinchStartNdc = [(c1_ndc[0]+c2_ndc[0])/2, (c1_ndc[1]+c2_ndc[1])/2]
      pinchStartCenter = [center[0], center[1]];
      pinchOrigDistance = Math.sqrt((c1_ndc[0]-c2_ndc[0])**2 + (c1_ndc[1]-c2_ndc[1])**2)
      pinchOrigScale = scale
    },
    pinch(c1: [number, number], c2: [number, number]): void {
      const c1_ndc = toNdc(c1[0], c1[1]);
      const c2_ndc = toNdc(c2[0], c2[1]);

      let [nx, ny] = [(c1_ndc[0]+c2_ndc[0])/2, (c1_ndc[1]+c2_ndc[1])/2]

      center[0] = pinchStartCenter[0].minus((nx - pinchStartNdc[0]) * aspect() * scale);
      center[1] = pinchStartCenter[1].plus((ny - pinchStartNdc[1]) * scale);


      let pinchCurrentDistance = Math.sqrt((c1_ndc[0]-c2_ndc[0])**2 + (c1_ndc[1]-c2_ndc[1])**2)

      scale = pinchOrigScale * pinchOrigDistance / pinchCurrentDistance
    },
  };
}
