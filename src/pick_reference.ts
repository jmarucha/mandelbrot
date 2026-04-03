import * as twgl from 'twgl.js';

const PICK_SIZE = 256;

export interface PickSetup {
  fbo: WebGLFramebuffer;
}

export function createPickFBO(gl: WebGLRenderingContext): PickSetup {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create pick texture');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PICK_SIZE, PICK_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error('Failed to create pick framebuffer');
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { fbo };
}

/**
 * Renders quick_pass to a 256×256 FBO, reads back pixels, and returns the
 * complex-plane coordinate of the escaped pixel with the highest iteration
 * count – a good perturbation-theory reference for the next frame.
 *
 * Falls back to center if nothing escapable is found.
 */
export function pickBestReference(
  gl: WebGLRenderingContext,
  setup: PickSetup,
  quickProgramInfo: twgl.ProgramInfo,
  bufferInfo: twgl.BufferInfo,
  colormap: WebGLTexture,
  center: number[],
  scale: number,
  origin: number[],
  maxIter: number,
): number[] {
  // ── quick pass → FBO ──────────────────────────────────────────────────────
  gl.bindFramebuffer(gl.FRAMEBUFFER, setup.fbo);
  gl.viewport(0, 0, PICK_SIZE, PICK_SIZE);
  gl.useProgram(quickProgramInfo.program);
  twgl.setBuffersAndAttributes(gl, quickProgramInfo, bufferInfo);
  twgl.setUniforms(quickProgramInfo, {
    u_resolution: [PICK_SIZE, PICK_SIZE],
    u_center:     center,
    u_scale:      scale,
    u_maxIter:    maxIter,
    u_colormap:   colormap,
    u_origin:     origin,
    u_debug:      0,
  });
  twgl.drawBufferInfo(gl, bufferInfo);

  // ── readback ──────────────────────────────────────────────────────────────
  const pixels = new Uint8Array(PICK_SIZE * PICK_SIZE * 4);
  gl.readPixels(0, 0, PICK_SIZE, PICK_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // ── find pixel with highest escaped iteration count ────────────────────
  // The quick_pass shader writes col.r = t = i/maxIter for escaped pixels,
  // and black (0,0,0) for maxiter (interior) pixels.
  let bestVal = -1;
  let bestX = PICK_SIZE / 2;
  let bestY = PICK_SIZE / 2;

  for (let py = 0; py < PICK_SIZE; py++) {
    for (let px = 0; px < PICK_SIZE; px++) {
      const idx = (py * PICK_SIZE + px) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      // Skip interior (black) pixels
      if (r === 0 && g === 0 && b === 0) continue;
      if (r > bestVal) {
        bestVal = r;
        bestX = px;
        bestY = py;
      }
    }
  }

  // ── pixel → UV (1:1 aspect for PICK_SIZE × PICK_SIZE) → world ────────────
  const uvX = bestX / PICK_SIZE - 0.5;
  const uvY = bestY / PICK_SIZE - 0.5;
  return [
    uvX * scale + center[0],
    uvY * scale + center[1],
  ];
}
