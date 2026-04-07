import * as twgl from 'twgl.js';
import VERT_SRC from './shaders/mandelbrot.vert';
import FRAG_SRC from './shaders/mandelbrot_pert.frag';
import QUICK_FRAG from './shaders/quick_pass.frag';
import { createFloatTexture, populateOrbitTexture } from './texture';
import { createPickFBO, pickBestReference } from './pick_reference';
import { createCamera } from './camera';

function main(): void {
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2');
  if (!gl) { alert('WebGL not supported'); return; }

  const programInfo      = twgl.createProgramInfo(gl, [VERT_SRC, FRAG_SRC]);
  const quickProgramInfo = twgl.createProgramInfo(gl, [VERT_SRC, QUICK_FRAG]);

  const colormap  = createFloatTexture(gl);
  const pickSetup = createPickFBO(gl);

  const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
    a_position: {
      numComponents: 2,
      data: new Float32Array([
        -1, -1,  1, -1, -1,  1,
        -1,  1,  1, -1,  1,  1,
      ]),
    },
  });

  const camera = createCamera(canvas);
  let debug  = false;
  let origin = [0.0, 0.0];

  let time_0 = Date.now()

  function resize(): void {
    canvas.width  = canvas.clientWidth  * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    gl!.viewport(0, 0, canvas.width, canvas.height);
  }

  function full_render(): void {
    // // 1. Quick pass → pick best reference origin
    if (true) {
      origin = pickBestReference(gl!, pickSetup, quickProgramInfo, bufferInfo,
        colormap.texture, camera.center, camera.scale, origin, 512);
    } else {
    origin[0] = camera.center[0];
    origin[1] = camera.center[1];
    }
    // // 2. Populate orbit texture from the chosen origin
    populateOrbitTexture(colormap, origin[0], origin[1], iter_guess());

    // 3. Main render
    mandelbrot_render();
  }

  function quick_render(): void {
    mandelbrot_render();
  }

  window.addEventListener('resize', () => { resize(); full_render(); });
  resize();
  full_render();

  // RAF loop
  function loop(): void {
    quick_render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Zoom with scroll wheel
  canvas.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) camera.zoomOut(e.clientX, e.clientY);
    else               camera.zoomIn(e.clientX, e.clientY);
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
  });

  window.addEventListener('mouseup', () => { dragging = false; full_render(); });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      debug = !debug;
      full_render();
    }
  });

  function mandelbrot_render(): void {
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl!, programInfo, bufferInfo);
    twgl.setUniforms(programInfo, {
      u_resolution: [canvas.width, canvas.height],
      u_center: camera.center,
      u_scale: camera.scale,
      u_maxIter: iter_guess(),
      u_colormap: colormap.texture,
      u_colormapIterNumber: colormap.iterNumber,
      u_origin: origin,
      u_debug: debug ? 1 : 0,
      u_time: Date.now() - time_0,
    });
    twgl.drawBufferInfo(gl!, bufferInfo);
  }

  function iter_guess(): number {
    const estimate = 80-Math.min(0,90*Math.log(camera.scale/3.));
    return Math.round(estimate);
  }
}

main();
