export interface ComputeFBO {
  fbo: WebGLFramebuffer;
  texZDZ: WebGLTexture;
  texIter: WebGLTexture;
  texTraps: WebGLTexture;
  texPtTraps: WebGLTexture;
  width: number;
  height: number;
}

function makeFloatTex(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function createComputeFBO(gl: WebGL2RenderingContext, width: number, height: number): ComputeFBO {
  if (!gl.getExtension('EXT_color_buffer_float')) {
    throw new Error('EXT_color_buffer_float not supported — cannot render to RGBA32F');
  }
  const texZDZ  = makeFloatTex(gl, width, height);
  const texIter = makeFloatTex(gl, width, height);
  const texTraps = makeFloatTex(gl, width, height);
  const texPtTraps = makeFloatTex(gl, width, height);

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texZDZ,  0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, texIter, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, texTraps, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, texPtTraps, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { fbo, texZDZ, texIter, texTraps, texPtTraps, width, height };
}

export function resizeComputeFBO(
  gl: WebGL2RenderingContext,
  fbo: ComputeFBO,
  width: number,
  height: number,
): void {
  if (fbo.width === width && fbo.height === height) return;

  gl.bindTexture(gl.TEXTURE_2D, fbo.texZDZ);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, fbo.texIter);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, fbo.texTraps);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, fbo.texPtTraps);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  fbo.width  = width;
  fbo.height = height;
}
