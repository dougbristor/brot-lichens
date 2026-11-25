import { meanField, BASE } from './lichens.mjs';
const f = (x0, p = BASE) => meanField(p, x0);
const r = (o) => `S ${o.freq[0].toFixed(3)} R ${o.freq[1].toFixed(3)} T ${o.freq[2].toFixed(3)} dens ${o.density.toFixed(3)} prev ${o.prevalence.toFixed(3)}`;
console.log('R vs S from R=0.01 ', r(f([0.99, 0.01, 0])));
console.log('R vs S from R=0.99 ', r(f([0.01, 0.99, 0])));
console.log('T vs S from T=0.01 ', r(f([0.99, 0, 0.01])));
console.log('T vs S from T=0.99 ', r(f([0.01, 0, 0.99])));
console.log('plant no mould R  ', r(f([0.5, 0.5, 0], { ...BASE, beta: 0 })));
console.log('plant no mould T  ', r(f([0.5, 0, 0.5], { ...BASE, beta: 0 })));
// 11-25 spore rain: the lines above are the Roy & Kirchner check (they run BASE, which now carries eps); the same at eps 0 for the theory itself:
const P0 = { ...BASE, eps: 0 };
console.log('eps 0: R from 0.01', r(f([0.99, 0.01, 0], P0)), '| R from 0.99', r(f([0.01, 0.99, 0], P0)), '| T from 0.01', r(f([0.99, 0, 0.01], P0)));
