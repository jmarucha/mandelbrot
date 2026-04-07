import * as twgl from 'twgl.js';

const PICK_SIZE = 4;

export interface PickSetup {
  fbo:     WebGLFramebuffer;
  texZDZ:  WebGLTexture;
  texIter: WebGLTexture;
}

function makePickTex(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, PICK_SIZE, PICK_SIZE, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function createPickFBO(gl: WebGL2RenderingContext): PickSetup {
  if (!gl.getExtension('EXT_color_buffer_float')) {
    throw new Error('EXT_color_buffer_float not supported');
  }
  const texZDZ  = makePickTex(gl);
  const texIter = makePickTex(gl);

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texZDZ,  0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, texIter, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { fbo, texZDZ, texIter };
}

export function pickBestReference(
  gl: WebGL2RenderingContext,
  setup: PickSetup,
  computeProgramInfo: twgl.ProgramInfo,
  bufferInfo: twgl.BufferInfo,
  colormap: WebGLTexture,
  center: number[],
  scale: number,
  origin: number[],
  maxIter: number,
  colormapIterNumber: number,
): number[] {
  gl.bindFramebuffer(gl.FRAMEBUFFER, setup.fbo);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  gl.viewport(0, 0, PICK_SIZE, PICK_SIZE);
  gl.useProgram(computeProgramInfo.program);
  twgl.setBuffersAndAttributes(gl, computeProgramInfo, bufferInfo);
  twgl.setUniforms(computeProgramInfo, {
    u_resolution:         [PICK_SIZE, PICK_SIZE],
    u_center:             center,
    u_scale:              scale,
    u_maxIter:            maxIter,
    u_colormap:           colormap,
    u_colormapIterNumber: colormapIterNumber,
    u_origin:             origin,
  });
  twgl.drawBufferInfo(gl, bufferInfo);

  // Read texIter (COLOR_ATTACHMENT1): (n, escaped, 0, 0)
  gl.readBuffer(gl.COLOR_ATTACHMENT1);
  const pixels = new Float32Array(PICK_SIZE * PICK_SIZE * 4);
  gl.readPixels(0, 0, PICK_SIZE, PICK_SIZE, gl.RGBA, gl.FLOAT, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // Pick escaped pixel with lowest iteration count
  let bestN = Infinity;
  let bestX = PICK_SIZE / 2;
  let bestY = PICK_SIZE / 2;

  for (let py = 0; py < PICK_SIZE; py++) {
    for (let px = 0; px < PICK_SIZE; px++) {
      const idx     = (py * PICK_SIZE + px) * 4;
      const n       = pixels[idx];
      const escaped = pixels[idx + 1];
      if (escaped > 0.5 && n < bestN) {
        bestN = n;
        bestX = px;
        bestY = py;
      }
    }
  }

  // Pixel centre → UV (same aspect correction as the compute shader)
  const uvX = (bestX + 0.5) / PICK_SIZE - 0.5;
  const uvY = (bestY + 0.5) / PICK_SIZE - 0.5;
  return [
    uvX * scale + center[0],
    uvY * scale + center[1],
  ];
}
