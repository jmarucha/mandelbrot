use std::str::FromStr;

use num_traits::{FromPrimitive, Num, NumOps, ToPrimitive, Zero};
use wasm_bindgen::prelude::*;

use dashu::float::{DBig, FBig};

pub const FP64_PRECISION: usize = 53;
pub const FP32_PRECISION: usize = 24;

#[wasm_bindgen]
pub fn test_wasm() -> String {
    console_error_panic_hook::set_once();

    let a: DBig = DBig::from_str("0.5").unwrap();

    // let a = FBig::try_from(0.5_f32).unwrap();
    a.to_decimal().value().to_string()
}

#[wasm_bindgen]
pub fn compute_orbit_binary(cx: &str, cy: &str, max_n: usize, precision: usize) -> Box<[f32]> {
    console_error_panic_hook::set_once();
    let read_big = |x: &str| -> FBig {
        DBig::from_str(x)
            .unwrap()
            .to_binary()
            .value()
            .with_precision(precision)
            .value()
    };

    match precision {
        ..=24 => {
            let (cx, cy): (f32, f32) = (cx.parse().unwrap(), cy.parse().unwrap());
            _compute_orbit(&cx, &cy, max_n)
        }
        25..=53 => {
            let (cx, cy): (f64, f64) = (cx.parse().unwrap(), cy.parse().unwrap());
            _compute_orbit(&cx, &cy, max_n)
        }
        54.. => {
            let (cx, cy) = (read_big(cx), read_big(cy));
            _compute_orbit(&cx, &cy, max_n)
        }
    }
}

#[wasm_bindgen]
pub fn compute_orbit_decimal(cx: &str, cy: &str, max_n: usize, precision: usize) -> Box<[f32]> {
    console_error_panic_hook::set_once();
    let read_big = |x: &str| -> FBig {
        DBig::from_str(x)
            .unwrap()
            .to_binary()
            .value()
            .with_precision(precision)
            .value()
    };
    let (cx, cy) = (read_big(cx), read_big(cy));
    _compute_orbit(&cx, &cy, max_n)
}

#[wasm_bindgen]
pub fn compute_orbit_f64(cx: &str, cy: &str, max_n: usize) -> Box<[f32]> {
    let cx: f64 = cx.parse().unwrap();
    let cy: f64 = cy.parse().unwrap();
    _compute_orbit_cursed(&cx, &cy, max_n)
}

fn _compute_orbit_cursed<T>(cx: &T, cy: &T, max_n: usize) -> Box<[f32]>
where
    T: Zero + PartialOrd + ToPrimitive + FromPrimitive,
    for<'a> &'a T: NumOps<&'a T, T>, //  &T * &T -> T
{
    let mut zr: T = Zero::zero();
    let mut zi: T = Zero::zero();
    let esc: T = FromPrimitive::from_f32(8192.0).unwrap();
    let two: T = FromPrimitive::from_f32(2.0).unwrap();
    let mut output: Vec<f32> = Vec::new();

    for _ in 0..max_n {
        output.push(zr.to_f32().unwrap());
        output.push(zi.to_f32().unwrap());
        output.push(0.0);
        output.push(0.0);

        let zr2 = &zr * &zr;
        let zi2 = &zi * &zi;
        if &zr2 + &zi2 > esc {
            break;
        }
        let new_zr = &(&zr2 - &zi2) + cx;
        let two_zr_zi = &(&two * &zr) * &zi;
        let new_zi = &two_zr_zi + cy;
        zr = new_zr;
        zi = new_zi;
    }

    output.into_boxed_slice()
}

#[allow(dead_code)]
fn _compute_orbit<T>(cx: &T, cy: &T, max_n: usize) -> Box<[f32]>
where
    T: Num + PartialOrd + ToPrimitive + FromPrimitive + Clone,
{
    let mut zr: T = Zero::zero();
    let mut zi: T = Zero::zero();
    let esc: T = FromPrimitive::from_f32(8192.0).unwrap();
    let two: T = FromPrimitive::from_f32(2.0).unwrap();
    let mut output: Vec<f32> = Vec::new();

    for _ in 0..max_n {
        output.push(zr.to_f32().unwrap());
        output.push(zi.to_f32().unwrap());
        output.push(0.0);
        output.push(0.0);

        let zr2 = zr.clone() * zr.clone();
        let zi2 = zi.clone() * zi.clone();
        if zr2.clone() + zi2.clone() > esc {
            break;
        }
        let new_zr = zr2 - zi2 + cx.clone();
        let two_zr_zi = two.clone() * zr * zi;
        let new_zi = two_zr_zi + cy.clone();
        zr = new_zr;
        zi = new_zi;
    }

    output.into_boxed_slice()
}
