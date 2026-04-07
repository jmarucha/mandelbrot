import BigNumber from 'bignumber.js';

BigNumber.config({ DECIMAL_PLACES: 50 });

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
  const { compute_orbit_bn: rustFn } = await import('./precompute/pkg-node/precompute.js');
  const bench = new Bench({ time: 10 });

  for (const n of [64, 256, 1024, 4096]) {
    bench
      .add(`float64 N=${n}`,       () => computeOrbitF64(CX_F64, CY_F64, n))
      .add(`Rust(150b) N=${n}`,   () => computeOrbitRust(rustFn, CX_BN, CY_BN, n, 150))
  }
    // .add(`BigNumber(50) N=${N_BN}`,  () => computeOrbitBN(CX_BN,  CY_BN,  N_BN))
    // .add(`float64 N=${N_BN}`,        () => computeOrbitF64(CX_F64, CY_F64, N_BN));

  bench.addEventListener('cycle', (e: Event) => {
    const t = (e as any).task;
    if (t?.result) {
      const ms = (t.result.latency.mean / 1e6).toFixed(3);
      console.log(`✓ ${t.name.padEnd(24)} ${ms} ms/op`);
    }
  });

  console.log('Running...');
  await bench.run();
  console.table(bench.table());
})();
