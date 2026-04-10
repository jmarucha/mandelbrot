import BigNumber from "bignumber.js";

export interface FloatTexture {
  texture: WebGLTexture;
  iterNumber: number | null;
  upload(data: Float32Array): void;
}

export type OrbitComputeFn = (cx: string, cy: string, maxN: number, precision: number) => Float32Array;

const BUFF_SIZE = 64;

export function createFloatTexture(gl: WebGL2RenderingContext): FloatTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, BUFF_SIZE, BUFF_SIZE, 0, gl.RGBA, gl.FLOAT, null);

  return {
    texture,
    iterNumber: null,
    upload(data: Float32Array): void {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, BUFF_SIZE, BUFF_SIZE, 0, gl.RGBA, gl.FLOAT, data);
    },
  };
}

/**
 * Populates a FloatTexture with the Mandelbrot orbit of point c = (cx, cy).
 * Computes BUFF_SIZE iterations of z_{n+1} = z_n² + c starting from z_0 = 0.
 * Each iteration n is stored at pixel n (first row of the texture) as:
 *   R = Re(z_n), G = Im(z_n), B = |z_n|², A = n / 255
 * The remaining pixels are zeroed out.
 */

export function populateOrbitTexture(
  colormap: FloatTexture,
  cx: BigNumber,
  cy: BigNumber,
  maxN = BUFF_SIZE * BUFF_SIZE,
  precision: number,
  computeFn: OrbitComputeFn | null,
): void {
  let data, iterNumber;
  if (computeFn) {
    console.debug("Using WASM(Rust)");
    const orbit = computeFn(cx.toFixed(150), cy.toFixed(150), Math.min(maxN, BUFF_SIZE * BUFF_SIZE), precision);
    data = new Float32Array(BUFF_SIZE * BUFF_SIZE * 4);
    data.set(orbit);

    colormap.iterNumber = orbit.length / 4;
  } else {
    [data, iterNumber] = populateOrbitTextureFallback(cx.toNumber(), cy.toNumber(), Math.min(maxN, BUFF_SIZE * BUFF_SIZE))

    colormap.iterNumber = iterNumber;
  }

  colormap.upload(data);
}

export function populateOrbitTextureFallback(cx: number, cy: number, maxN: number | undefined = BUFF_SIZE*BUFF_SIZE): [Float32Array, number] {
  const SIZE = BUFF_SIZE;
  const data = new Float32Array(SIZE * SIZE * 4); // zeroed by default

  let zr = 0.0;
  let zi = 0.0;

  let dzr = 1.0;
  let dzi = 0.0;

  let n;
  maxN = Math.min(maxN, BUFF_SIZE*BUFF_SIZE);
  //maxN = 0;
  for (n = 0; n < maxN; n++) {
    const mod2 = zr * zr + zi * zi;
    data[n * 4 + 0] = zr;
    data[n * 4 + 1] = zi;

    // todo: replace with dzx, dzy
    data[n * 4 + 2] = dzr;
    data[n * 4 + 3] = dzi;

    if (mod2 > 64.) break;

    const n_zr = zr * zr - zi * zi + cx;
    const n_zi = 2.0 * zr * zi + cy

    //const n_dzr = 2*(zr*dzr - zi*dzi);
    //const n_dzi = 2*(zr*dzi + zi*dzr);

    zr = n_zr;
    zi = n_zi;

    //dzr = n_dzr;
    //dzi = n_dzi;
  };
  return [data, 3];
}