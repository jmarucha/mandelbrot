import * as twgl from 'twgl.js';
import VERT_SRC from './shaders/mandelbrot.vert';
import FRAG_SRC from './shaders/mandelbrot_pert.frag';
import QUICK_FRAG from './shaders/quick_pass.frag';
import { createFloatTexture, populateOrbitTexture } from './texture';
import { createPickFBO, pickBestReference } from './pick_reference';

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

  // View state
  let center = [0.0, 0.0];
  let scale  = 3.0;
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
        colormap.texture, center, scale, origin, 512);
    } else {
    origin[0] = center[0];
    origin[1] = center[1];
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
    const factor = e.deltaY > 0 ? 1.1 : 0.9;

    // Zoom towards cursor
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width  - 0.5;
    const ny = (e.clientY - rect.top)  / rect.height - 0.5;
    const aspect = canvas.width / canvas.height;

    center[0] += nx * aspect * scale * (1 - factor);
    center[1] -= ny * scale * (1 - factor);
    scale *= factor;
  }, { passive: false });

  // Pan with mouse drag
  let dragging = false;
  let dragStart = [0, 0];
  let centerStart = [0, 0];

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    dragging = true;
    dragStart = [e.clientX, e.clientY];
    centerStart = [...center];
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const aspect = canvas.width / canvas.height;
    const dx = (e.clientX - dragStart[0]) / rect.width  * aspect * scale;
    const dy = (e.clientY - dragStart[1]) / rect.height * scale;
    center[0] = centerStart[0] - dx;
    center[1] = centerStart[1] + dy;
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
      u_center: center,
      u_scale: scale,
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
    const estimate = 80-Math.min(0,90*Math.log(scale/3.));
    return Math.round(estimate);
  }
}

main();
