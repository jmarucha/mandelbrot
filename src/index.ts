import * as twgl from 'twgl.js';
import VERT_SRC from './shaders/mandelbrot.vert';
import FULLSCREEN_VERT from './shaders/fullscreen.vert';
import COMPUTE_FRAG from './shaders/mandelbrot_compute.frag';
import COLOR_FRAG from './shaders/mandelbrot_color.frag';
import QUICK_FRAG from './shaders/quick_pass.frag';
import { createFloatTexture, populateOrbitTexture } from './texture';
import { createPickFBO, pickBestReference } from './pick_reference';
import { createCamera } from './camera';
import { createComputeFBO, resizeComputeFBO } from './compute_fbo';

function main(): void {
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2');
  if (!gl) { alert('WebGL not supported'); return; }

  const computeProgramInfo = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, COMPUTE_FRAG]);
  const colorProgramInfo   = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, COLOR_FRAG]);
  const quickProgramInfo   = twgl.createProgramInfo(gl, [VERT_SRC, QUICK_FRAG]);

  const colormap  = createFloatTexture(gl);
  const pickSetup = createPickFBO(gl);

  const fullscreenQuad = twgl.createBufferInfoFromArrays(gl, {
    a_position: {
      numComponents: 2,
      data: new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1,
      ]),
    },
  });

  const camera = createCamera(canvas);
  let origin = [0.0, 0.0];
  let time_0 = Date.now();

  // Init canvas size before creating the FBO
  canvas.width  = canvas.clientWidth  * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const computeFbo = createComputeFBO(gl, canvas.width, canvas.height);

  function resize(): void {
    canvas.width  = canvas.clientWidth  * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    gl!.viewport(0, 0, canvas.width, canvas.height);
    resizeComputeFBO(gl!, computeFbo, canvas.width, canvas.height);
  }

  function origin_needs_repick(): boolean {
    const dx = camera.center[0] - origin[0];
    const dy = camera.center[1] - origin[1];
    return Math.hypot(dx, dy) > 2 * camera.scale;
  }

  function full_render(): void {
    if (origin_needs_repick()) {
      // 1. Quick pass → pick best reference origin
      origin = pickBestReference(gl!, pickSetup, quickProgramInfo, fullscreenQuad,
        colormap.texture, camera.center, camera.scale, origin, 512);
      // 2. Populate orbit texture from the chosen origin
      populateOrbitTexture(colormap, origin[0], origin[1], iter_guess());
    }

    // 3. Compute pass (writes to MRT FBO)
    compute_render();
  }

  window.addEventListener('resize', () => { resize(); full_render(); });
  resize();
  full_render();

  // RAF loop — only re-colors every frame (palette animates via u_time)
  function loop(): void {
    color_render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Zoom with scroll wheel
  canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) camera.zoomOut(e.clientX, e.clientY);
    else               camera.zoomIn(e.clientX, e.clientY);
    full_render();
  }, { passive: false });

  // Pan with mouse drag
  let dragging = false;

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    dragging = true;
    camera.startDrag(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return;
    camera.drag(e.clientX, e.clientY);
    full_render();
  });

  window.addEventListener('mouseup', () => { dragging = false; full_render(); });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      full_render();
    }
  });

  function compute_render(): void {
    const w = canvas.width;
    const h = canvas.height;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, computeFbo.fbo);
    gl!.drawBuffers([gl!.COLOR_ATTACHMENT0, gl!.COLOR_ATTACHMENT1]);
    gl!.viewport(0, 0, w, h);
    gl!.useProgram(computeProgramInfo.program);
    twgl.setBuffersAndAttributes(gl!, computeProgramInfo, fullscreenQuad);
    twgl.setUniforms(computeProgramInfo, {
      u_resolution:         [w, h],
      u_center:             camera.center,
      u_scale:              camera.scale,
      u_maxIter:            iter_guess(),
      u_colormap:           colormap.texture,
      u_colormapIterNumber: colormap.iterNumber,
      u_origin:             origin,
    });
    twgl.drawBufferInfo(gl!, fullscreenQuad);
  }

  function color_render(): void {
    const w = canvas.width;
    const h = canvas.height;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, w, h);
    gl!.useProgram(colorProgramInfo.program);
    twgl.setBuffersAndAttributes(gl!, colorProgramInfo, fullscreenQuad);
    twgl.setUniforms(colorProgramInfo, {
      u_resolution: [w, h],
      u_texZDZ:     computeFbo.texZDZ,
      u_texIter:    computeFbo.texIter,
      u_time:       Date.now() - time_0,
      u_scale:      camera.scale,
    });
    twgl.drawBufferInfo(gl!, fullscreenQuad);
  }

  function iter_guess(): number {
    const estimate = 80 - Math.min(0, 90 * Math.log(camera.scale / 3.));
    return Math.round(estimate);
  }
}

main();
