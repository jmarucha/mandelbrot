export interface FloatTexture {
  texture: WebGLTexture;
  iterNumber: number | null;
  upload(data: Float32Array): void;
}


const BUFF_SIZE = 64;
/**
 * Creates a BUFF_SIZExBUFF_SIZE RGBA float texture (requires OES_texture_float).
 * upload() expects a Float32Array of length BUFF_SIZE * BUFF_SIZE * 4.
 */
export function createFloatTexture(gl: WebGLRenderingContext): FloatTexture {
  const ext = gl.getExtension('OES_texture_float');
  if (!ext) throw new Error('OES_texture_float not supported');

  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // Allocate empty texture
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, BUFF_SIZE, BUFF_SIZE, 0, gl.RGBA, gl.FLOAT, null);

  return {
    texture,
    iterNumber: null,
    upload(data: Float32Array): void {
      if (data.length !== BUFF_SIZE * BUFF_SIZE * 4) {
        throw new Error(`Expected ${BUFF_SIZE * BUFF_SIZE * 4} floats, got ${data.length}`);
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, BUFF_SIZE, BUFF_SIZE, 0, gl.RGBA, gl.FLOAT, data);
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
export function populateOrbitTexture(colormap: FloatTexture, cx: number, cy: number, maxN: number = 65536): void {
  const SIZE = BUFF_SIZE;
  const data = new Float32Array(SIZE * SIZE * 4); // zeroed by default

  let zx = 0.0;
  let zy = 0.0;

  let n;
  for (n = 0; n < maxN; n++) {
    const mod2 = zx * zx + zy * zy;
    data[n * 4 + 0] = zx;
    data[n * 4 + 1] = zy;

    // todo: replace with dzx, dzy
    data[n * 4 + 2] = mod2;
    data[n * 4 + 3] = n / (SIZE - 1);

    if (mod2 > 4.0) break;

    const nx = zx * zx - zy * zy + cx;
    const ny = 2.0 * zx * zy + cy
    zx = nx;
    zy = ny;
  }
  console.log(n);
  colormap.iterNumber = n;
  colormap.upload(data);
}
