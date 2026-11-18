// The arithmetic behind the scale object, shared by the 3D scene and the readout,
// so the picture, the figure and the rule can never disagree.
//
// The block is a 10 x 10 x 10 lattice of unit cubes. A single number, grow (0..3),
// says how much of it exists: 0 = one cube, 1 = a row of ten, 2 = a floor of a hundred,
// 3 = a block of a thousand.

export const N = 10;
export const EXTRUDE = 0.1; // share of a stage one cube takes to slide out
export const UNIT = 10000; // dollars of monthly revenue one cube stands for

// When each cell arrives, and along which axis it extrudes.
// axis 0: the ink unit. 1: along x (the row). 2: back along z (the floor). 3: up (the block).
export function cellPlan(ix, iy, iz) {
  if (ix === 0 && iy === 0 && iz === 0) return { axis: 0, order: 0 };
  if (iy === 0 && iz === 0) return { axis: 1, order: ((ix - 1) / 9) * 0.9 };
  if (iy === 0) return { axis: 2, order: 1 + ((iz - 1) / 9) * 0.84 + (ix / 9) * 0.06 };
  return { axis: 3, order: 2 + ((iy - 1) / 9) * 0.8 + ((ix + iz) / 18) * 0.08 };
}

// Sorted arrival points (halfway through each cube's extrusion), for counting cubes on screen.
export function arrivalTable() {
  const out = [];
  for (let iy = 0; iy < N; iy++)
    for (let iz = 0; iz < N; iz++)
      for (let ix = 0; ix < N; ix++) {
        const { axis, order } = cellPlan(ix, iy, iz);
        if (axis !== 0) out.push(order + EXTRUDE / 2);
      }
  return Float64Array.from(out).sort();
}

// Cubes on screen at a given grow value: 1..1000.
export function cubesAt(table, grow) {
  let lo = 0;
  let hi = table.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table[mid] <= grow) lo = mid + 1;
    else hi = mid;
  }
  return 1 + lo;
}
