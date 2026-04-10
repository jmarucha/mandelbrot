import BigNumber from 'bignumber.js';


const DECIMAL_PLACES = 50;
const BINARY_PLACES = 150;
BigNumber.config({ DECIMAL_PLACES });

const FP64_PRECISION=53;
const FP32_PRECISION=24;

const CX_F64 = -0.5;
const CY_F64 = 0.0;
const CX_BN  = new BigNumber('-0.5');
const CY_BN  = new BigNumber('0.0');

function computeOrbitF64(cx: number, cy: number, maxN: number): void {
  let zr = 0, zi = 0, dzr = 1, dzi = 0;
  for (let n = 0; n < maxN; n++) {
    if (zr * zr + zi * zi > 64) break;
    const nzr  = zr * zr - zi * zi + cx;
    const nzi  = 2.0 * zr * zi + cy;
    const ndzr = 2 * (zr * dzr - zi * dzi);
    const ndzi = 2 * (zr * dzi + zi * dzr);
    zr = nzr; zi = nzi; dzr = ndzr; dzi = ndzi;
  }
}

function computeOrbitBN(cx: BigNumber, cy: BigNumber, maxN: number): void {
  let zr  = new BigNumber(0);
  let zi  = new BigNumber(0);
  let dzr = new BigNumber(1);
  let dzi = new BigNumber(0);
  const ESC = new BigNumber(64);
  for (let n = 0; n < maxN; n++) {
    if (zr.times(zr).plus(zi.times(zi)).gt(ESC)) break;
    const nzr  = zr.times(zr).minus(zi.times(zi)).plus(cx);
    const nzi  = zr.times(zi).times(2).plus(cy);
    const ndzr = zr.times(dzr).minus(zi.times(dzi)).times(2);
    const ndzi = zr.times(dzi).plus(zi.times(dzr)).times(2);
    zr = nzr; zi = nzi; dzr = ndzr; dzi = ndzi;
  }
}

function computeOrbitRust(fn: (cx: string, cy: string, maxN: number, precision: number) => Float32Array, cx: BigNumber, cy: BigNumber, maxN: number, precision: number): void {
  fn(cx.toFixed(50), cy.toFixed(50), maxN, precision);
}

const N_F64  = 4096;
const N_BN   = 16;
const N_RUST = 4096;

(async () => {
  const { Bench } = await import('tinybench');
  const {
    compute_orbit_binary,
    compute_orbit_decimal,
  } = await import('./precompute/pkg-node/precompute.js');
  const bench = new Bench({ time: 10 });
  for (const n of [4096]) {
    bench
      .add(`JS  (f64)  N=${n}`, () => computeOrbitF64(CX_F64, CY_F64, n))
      .add(`Rust(${BINARY_PLACES}b) N=${n}`, () => computeOrbitRust(compute_orbit_binary, CX_BN, CY_BN, n, BINARY_PLACES))
      .add(`Rust(f64) N=${n}`, () => computeOrbitRust(compute_orbit_binary, CX_BN, CY_BN, n, FP64_PRECISION))
      .add(`Rust(f32) N=${n}`, () => computeOrbitRust(compute_orbit_binary, CX_BN, CY_BN, n, FP32_PRECISION))
  }
  bench
  //  .add(`BigNumber(${DECIMAL_PLACES}) N=${N_BN}`,  () => computeOrbitBN(CX_BN,  CY_BN, N_BN))
    .add(`Rust(${DECIMAL_PLACES}d) N=${N_BN}`,  () => computeOrbitRust(compute_orbit_decimal, CX_BN, CY_BN, N_BN, FP32_PRECISION))
    .add(`Rust(${BINARY_PLACES}b) N=${N_BN}`,  () => computeOrbitRust(compute_orbit_binary, CX_BN, CY_BN, N_BN, FP32_PRECISION))

  console.log('Running...');
  await bench.run();
  console.table(bench.table(), ['Task name', 'Throughput avg (ops/s)', 'Throughput med (ops/s)'] );
})();
