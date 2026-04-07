use std::str::FromStr;

use console_error_panic_hook;
use wasm_bindgen::prelude::*;


use dashu::float::DBig;
type FBig = dashu::float::FBig;

#[wasm_bindgen]
pub fn testWASM() -> String {
    console_error_panic_hook::set_once();

    let a: DBig = DBig::from_str("0.5").unwrap();

    // let a = FBig::try_from(0.5_f32).unwrap();
    a.to_decimal().value().to_string()
}

#[wasm_bindgen]
pub fn computeOrbitBN(cx: &str, cy: &str, maxN: usize, precision: usize) -> Box<[f32]> {
    console_error_panic_hook::set_once();
    let cx = DBig::from_str(cx).unwrap().to_binary().value().with_precision(precision).value();
    let cy = DBig::from_str(cy).unwrap().to_binary().value().with_precision(precision).value();
    _computeOrbitBN(cx, cy, maxN, precision)
}

fn _computeOrbitBN(cx: FBig, cy: FBig, maxN: usize, precision: usize) -> Box<[f32]> {
    let mut zr = FBig::ZERO;
    let mut zi = FBig::ZERO;
    let esc = FBig::try_from(64.0f64).unwrap().with_precision(precision).value();
    let two = FBig::try_from(2.0f64).unwrap().with_precision(precision).value();
    let mut output: Vec<f32> = Vec::new();

    for _ in 0..maxN {

        output.push(zr.to_f32().value());
        output.push(zi.to_f32().value());
        output.push(0.0);
        output.push(0.0);

        let zr2 = zr.clone() * zr.clone();
        let zi2 = zi.clone() * zi.clone();
        if zr2.clone() + zi2.clone() > esc {
            break;
        }
        let new_zr = zr2.clone() - zi2.clone() + cx.clone();
        let new_zi = two.clone() * zr.clone() * zi.clone() + cy.clone();
        zr = new_zr;
        zi = new_zi;
    }

    output.into_boxed_slice()
}
