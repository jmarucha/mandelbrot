import * as twgl from 'twgl.js';
import BigNumber from 'bignumber.js';
import { GUI } from 'lil-gui';
import FULLSCREEN_VERT from './shaders/fullscreen.vert';
import COMPUTE_FRAG from './shaders/mandelbrot_compute.frag';
import COLOR_FRAG from './shaders/mandelbrot_color.frag';
import { createFloatTexture, populateOrbitTexture } from './texture';
import { createPickFBO, pickBestReference } from './pick_reference';
import { createCamera } from './camera';
import { createComputeFBO, resizeComputeFBO } from './compute_fbo';

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
}

function main(): void {
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
  canvas.tabIndex = 0;
  canvas.focus();
  const gl = canvas.getContext('webgl2');
  if (!gl) { alert('WebGL not supported'); return; }

  const computeProgramInfo = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, COMPUTE_FRAG]);
  const colorProgramInfo   = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, COLOR_FRAG]);

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
  let origin: [BigNumber, BigNumber] = [new BigNumber(0), new BigNumber(0)];

  const guiParams = {
    colouringMode: 'Distance', shadeDE: false, trapImage: '',
    colouringModeInt: 'Plain Color',
    speed: 1.0, phase: 0.0,
    trapPt0X: 0.0, trapPt0Y: 0.0, trapPt1X: -1.0, trapPt1Y: 0.0, trapPt2X: 0.0, trapPt2Y: 1.0,
    trapPt3X: -0.5, trapPt3Y: 0.5,
    invert: false,
    invertInt: false,
    colorInt: '#000000',
    colorExt: '#ff0000',
  };
  const gui = new GUI({autoPlace: true});
  const COLOUR_MODES = ['Distance', 'Escape Time', 'Orbit Traps', 'Point Traps', 'Plain Color'];
  const COLOUR_MODES_INT = ['Orbit Traps', 'Point Traps', 'Plain Color'];
  gui.add(guiParams, 'colouringMode', COLOUR_MODES)
    .name('Exterior')
    .onChange(() => { updateModeVisibility(); color_render(); });
  gui.add(guiParams, 'colouringModeInt', COLOUR_MODES_INT)
    .name('Interior')
    .onChange(() => { updateModeVisibility(); color_render(); });
  const ctrlColorInt = gui.addColor(guiParams, 'colorInt').name('Interior Color')
    .onChange(() => { color_render(); });
  const ctrlColorExt = gui.addColor(guiParams, 'colorExt').name('Exterior Color')
    .onChange(() => { color_render(); });
  gui.add(guiParams, 'shadeDE')
    .name('Shade close points')
    .onChange(() => { color_render(); });
  gui.add(guiParams, 'invert')
    .name('Invert Exterior')
    .onChange(() => { color_render(); });
  gui.add(guiParams, 'invertInt')
    .name('Invert Interior')
    .onChange(() => { color_render(); });

  // Trap image texture
  let trapImageTex: WebGLTexture | null = null;
  function createTrapImageTex(img: HTMLImageElement) {
    if (trapImageTex) gl!.deleteTexture(trapImageTex);
    trapImageTex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, trapImageTex);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, img);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.REPEAT);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.REPEAT);
    gl!.bindTexture(gl!.TEXTURE_2D, null);
    color_render();
  }
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      createTrapImageTex(img);
      guiParams.trapImage = file.name;
      gui.controllersRecursive().forEach(c => c.updateDisplay());
    };
    img.src = URL.createObjectURL(file);
  });
  const ctrlTrapImageName = gui.add(guiParams, 'trapImage').name('Trap Image').disable();
  const ctrlTrapImageLoad = gui.add({ load() { fileInput.click(); } }, 'load').name('Load Trap Image');
  const ctrlSpeed = gui.add(guiParams, 'speed', 0.0, 10.0, 0.1).name('Trap Speed')
    .onChange(() => { color_render(); });
  const ctrlPhase = gui.add(guiParams, 'phase', 0.0, 6.283, 0.01).name('Trap Phase')
    .onChange(() => { color_render(); });

  const trapFolder = gui.addFolder('Trap Points');
  trapFolder.add(guiParams, 'trapPt0X', -2, 2, 0.01).name('Point 0 X').onChange(() => { full_render(); });
  trapFolder.add(guiParams, 'trapPt0Y', -2, 2, 0.01).name('Point 0 Y').onChange(() => { full_render(); });
  trapFolder.add(guiParams, 'trapPt1X', -2, 2, 0.01).name('Point 1 X').onChange(() => { full_render(); });
  trapFolder.add(guiParams, 'trapPt1Y', -2, 2, 0.01).name('Point 1 Y').onChange(() => { full_render(); });
  trapFolder.add(guiParams, 'trapPt2X', -2, 2, 0.01).name('Point 2 X').onChange(() => { full_render(); });
  trapFolder.add(guiParams, 'trapPt2Y', -2, 2, 0.01).name('Point 2 Y').onChange(() => { full_render(); });
  trapFolder.add(guiParams, 'trapPt3X', -2, 2, 0.01).name('Point 3 X').onChange(() => { full_render(); });
  trapFolder.add(guiParams, 'trapPt3Y', -2, 2, 0.01).name('Point 3 Y').onChange(() => { full_render(); });

  function updateModeVisibility(): void {
    const modes = [guiParams.colouringMode, guiParams.colouringModeInt];
    // const anyPlain = modes.includes('Plain Color');
    const anyTraps = modes.includes('Orbit Traps') || modes.includes('Point Traps');
    const anyPtTraps = modes.includes('Point Traps');

    ctrlColorInt.show(guiParams.colouringModeInt === 'Plain Color');
    ctrlColorExt.show(guiParams.colouringMode === 'Plain Color');

    ctrlSpeed.show(anyTraps);
    ctrlPhase.show(anyTraps);
    ctrlTrapImageName.show(anyTraps);
    ctrlTrapImageLoad.show(anyTraps);

    anyPtTraps ? trapFolder.show() : trapFolder.hide();
  }
  updateModeVisibility();

  let time_0 = Date.now();

  let orbitComputeFn: ((cx: string, cy: string, maxN: number, precision: number) => Float32Array) | null = null;
  import('precompute').then(wasm => {
    orbitComputeFn = wasm.compute_orbit_binary as typeof orbitComputeFn;
    (window as any).test_wasm = wasm.test_wasm;
    full_render();
  });

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
    const dx = camera.center[0].minus(origin[0]).toNumber();
    const dy = camera.center[1].minus(origin[1]).toNumber();
    return Math.hypot(dx, dy) > 1 * camera.scale;
  }

  function full_render(): void {
    if (origin_needs_repick()) {
      console.debug("Picking Origin");
      // 1. Quick pass → pick best reference origin
      origin = pickBestReference(gl!, pickSetup, computeProgramInfo, fullscreenQuad,
        colormap.texture, camera.center, camera.scale, origin, iter_guess(), colormap.iterNumber ?? 0);
      // 2. Populate orbit texture from the chosen origin
      populateOrbitTexture(colormap, origin[0], origin[1], iter_guess(), 300, orbitComputeFn);
    }

    // 3. Compute pass (writes to MRT FBO)
    compute_render();
  }

  let sync: WebGLSync | null = null;
  function full_render_sif(): void {
    /* single-in-flight Mandelbrot compute render */
    if (sync != null) {
      let status = gl!.clientWaitSync(sync, 0, 0)
      if (status == gl!.TIMEOUT_EXPIRED) {
        return; // still rendering
      } else {
        gl!.deleteSync(sync);
      }
    }
    sync = gl!.fenceSync(gl!.SYNC_GPU_COMMANDS_COMPLETE, 0);
    full_render();
  }

  window.addEventListener('resize', () => { resize(); full_render_sif(); });
  resize();
  full_render_sif();

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
    full_render_sif();
  }, { passive: false });

  // Pan with mouse drag
  let dragging = false;
  let mouseX = 0, mouseY = 0;

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    canvas.focus();
    dragging = true;
    camera.startDrag(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!dragging) return;
    camera.drag(e.clientX, e.clientY);
    full_render_sif();
  });

  window.addEventListener('mouseup', () => { dragging = false; full_render_sif(); });

  canvas.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      full_render_sif();
    }
    // Keys 1-4: set trap points at cursor position
    const trapIdx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (trapIdx >= 0) {
      const rect = canvas.getBoundingClientRect();
      const ndcX = (mouseX - rect.left) / rect.width - 0.5;
      const ndcY = (mouseY - rect.top) / rect.height - 0.5;
      const aspect = rect.width / rect.height;
      const wx = ndcX * camera.scale * aspect;
      const wy = -ndcY * camera.scale;
      const keys = [
        ['trapPt0X', 'trapPt0Y'],
        ['trapPt1X', 'trapPt1Y'],
        ['trapPt2X', 'trapPt2Y'],
        ['trapPt3X', 'trapPt3Y'],
      ] as const;
      (guiParams as any)[keys[trapIdx][0]] = wx;
      (guiParams as any)[keys[trapIdx][1]] = wy;
      gui.controllersRecursive().forEach((c: any) => c.updateDisplay());
      full_render();
    }
  });


  canvas.addEventListener('touchstart', (e: TouchEvent) => {
    e.preventDefault();
    if (e.targetTouches.length == 1) {
      const first = e.targetTouches[0];
      camera.startDrag(first.clientX, first.clientY);
    }
    if (e.targetTouches.length == 2) {
      const first = e.targetTouches[0];
      const second = e.targetTouches[1];
      camera.startPinch([first.clientX, first.clientY], [second.clientX, second.clientY]);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e: TouchEvent) => {
    e.preventDefault();
    if (e.targetTouches.length == 1) {
      const first = e.targetTouches[0];
      camera.drag(first.clientX, first.clientY);
    }
    if (e.targetTouches.length == 2) {
      const first = e.targetTouches[0];
      const second = e.targetTouches[1];
      camera.pinch([first.clientX, first.clientY], [second.clientX, second.clientY]);
    }
    full_render_sif();
  }, { passive: false });
  canvas.addEventListener('touchend', (e: TouchEvent) => {
    e.preventDefault();
    if (e.targetTouches.length == 1) {
      const first = e.targetTouches[0];
      camera.startDrag(first.clientX, first.clientY);
    }
    if (e.targetTouches.length == 0) {
      full_render_sif();
    }
  });

  function compute_render(): void {
    const w = canvas.width;
    const h = canvas.height;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, computeFbo.fbo);
    gl!.drawBuffers([gl!.COLOR_ATTACHMENT0, gl!.COLOR_ATTACHMENT1, gl!.COLOR_ATTACHMENT2, gl!.COLOR_ATTACHMENT3]);
    gl!.viewport(0, 0, w, h);
    gl!.useProgram(computeProgramInfo.program);
    twgl.setBuffersAndAttributes(gl!, computeProgramInfo, fullscreenQuad);
    twgl.setUniforms(computeProgramInfo, {
      u_resolution:         [w, h],
      u_center:             [camera.center[0].toNumber(), camera.center[1].toNumber()],
      u_scale:              camera.scale,
      u_maxIter:            iter_guess(),
      u_colormap:           colormap.texture,
      u_colormapIterNumber: colormap.iterNumber,
      u_dcenter:            [camera.center[0].minus(origin[0]).toNumber(), camera.center[1].minus(origin[1]).toNumber()],
      u_trapPoint0:         [guiParams.trapPt0X, guiParams.trapPt0Y],
      u_trapPoint1:         [guiParams.trapPt1X, guiParams.trapPt1Y],
      u_trapPoint2:         [guiParams.trapPt2X, guiParams.trapPt2Y],
      u_trapPoint3:         [guiParams.trapPt3X, guiParams.trapPt3Y],
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
      u_texTraps:   computeFbo.texTraps,
      u_texPtTraps: computeFbo.texPtTraps,
      u_trapImage:  trapImageTex,
      u_hasTrapImage: trapImageTex ? 1 : 0,
      u_time:           Date.now() - time_0,
      u_scale:          camera.scale,
      u_colouring_mode_ext: COLOUR_MODES.indexOf(guiParams.colouringMode),
      u_colouring_mode_int: COLOUR_MODES.indexOf(guiParams.colouringModeInt),
      u_plainColorInt:  hexToRgb(guiParams.colorInt),
      u_plainColorExt:  hexToRgb(guiParams.colorExt),
      u_shade_de:       guiParams.shadeDE ? 1 : 0,
      u_speed:          guiParams.speed,
      u_phase:          guiParams.phase,
      u_invert:         guiParams.invert ? 1 : 0,
      u_invertInt:      guiParams.invertInt ? 1 : 0,
    });
    twgl.drawBufferInfo(gl!, fullscreenQuad);
  }

  function iter_guess(): number {
    const estimate = 80 - Math.min(0, 90 * Math.log(camera.scale / 3.));
    return Math.round(estimate);
  }
}

main();
