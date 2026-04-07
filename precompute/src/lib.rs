use astro_float::BigFloat;
use astro_float::FromExt;
use astro_float::expr;
use astro_float::RoundingMode;
use astro_float::ctx::Context;
use astro_float::Consts;
use astro_float::Radix;
use console_error_panic_hook;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn testWASM() -> String {
  console_error_panic_hook::set_once();
  let mut c = Consts::new().unwrap();
  //let x = BigFloat::parse("0.5e0", Radix::Dec, 128, RoundingMode::ToEven, &mut c);
  let x = BigFloat::from_f64(0.5, 128);
  BigFloat::write_str()
  x.to_string()
}

#[wasm_bindgen]
pub fn computeOrbitBN(cx: &str, cy: &str, maxN: usize, _arraySize: usize) -> Box<[f32]> {
  let mut ctx = Context::new(300, RoundingMode::None, Consts::new().unwrap(), -10000, 10000);
  let cx = BigFloat::parse(cx, Radix::Dec, ctx.precision(), ctx.rounding_mode(), ctx.consts());
  let cy = BigFloat::parse(cy, Radix::Dec, ctx.precision(), ctx.rounding_mode(), ctx.consts());
  _computeOrbitBN(cx, cy, 3, 3, &mut ctx)
}

fn _computeOrbitBN(cx: BigFloat, cy: BigFloat, maxN: usize, _arraySize: usize, mut ctx: &mut Context) -> Box<[f32]> {
  let mut zr  = BigFloat::new(ctx.precision());
  let mut zi  = BigFloat::new(ctx.precision());
  let ESC = BigFloat::from_f32(64.,ctx.precision());
  let mut output: Vec<f32> = Vec::new();


  for _ in 0..maxN {
    if expr!(zr*zr + zi*zi, ctx) > ESC {
        break;
    }
    (zr, zi) = (
        expr!(zr*zr - zi*zi + cx, ctx),
        expr!(2*zr*zi + cy, ctx)
    );
    output.push(big_number_to_small(&zr, ctx));
    output.push(big_number_to_small(&zi, ctx));
    output.push(0.);
    output.push(0.);
  }

  output.into_boxed_slice()
}

fn big_number_to_small(x: &BigFloat, cc: &mut Context) -> f32 {
  let num_as_string = x.format(Radix::Dec, cc.rounding_mode(), cc.consts()).unwrap();
  num_as_string.parse().unwrap()
}