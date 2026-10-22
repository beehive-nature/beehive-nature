use super::{
    air::*,
    model::{BLOCKS, Hash, Record, prelude, sequence},
};
use crate::air::{HALF_FULL, P2, PARTIAL, SBOX_DEGREE, SBOX_REGISTERS, WIDTH, round_constants};
use crate::statement::{F, Hasher, node_input};
use p3_field::PrimeCharacteristicRing;
use p3_koala_bear::GenericPoseidon2LinearLayersKoalaBear;
use p3_matrix::{Matrix, dense::RowMajorMatrix};
use p3_poseidon2_air::generate_trace_rows;

pub fn generate(air: &RepositoryAir, context: &Hash, records: &[Record]) -> RowMajorMatrix<F> {
    assert_eq!(records.len(), air.bucket);
    let mut chunks = prelude(context, air.bucket).to_vec();
    for (i, r) in records.iter().enumerate() {
        chunks.extend(r.blocks(i));
    }
    let h = Hasher::default();
    let mut acc = [F::ZERO; 8];
    let mut inputs = Vec::new();
    let mut rows = Vec::new();
    for row in 0..air.height {
        let run = row < chunks.len();
        let data = if run { chunks[row] } else { [F::ZERO; 8] };
        let input = if run {
            node_input(&acc, &data)
        } else {
            [F::ZERO; 16]
        };
        if run {
            acc = h.compress(input);
        }
        inputs.push(input);
        let mut extra = vec![F::ZERO; COLS - P2];
        let at = |col: usize| col - P2;
        for k in 0..8 {
            use p3_field::PrimeField32;
            let val = data[k].as_canonical_u32();
            for bit in 0..16 {
                extra[at(BITS) + k * 16 + bit] = F::from_u32((val >> bit) & 1);
            }
        }
        if row >= 3 && row < 3 + BLOCKS * air.bucket {
            let r = &records[(row - 3) / BLOCKS];
            for k in 0..16 {
                extra[at(PREVIOUS) + k] = F::from_u16(r.previous[k]);
                extra[at(NEXT) + k] = F::from_u16(r.next[k]);
            }
            extra[at(BEFORE)..at(BEFORE) + 4].copy_from_slice(&sequence(r.before));
            extra[at(AFTER)..at(AFTER) + 4].copy_from_slice(&sequence(r.after));
            let mut carry = r.active as u32;
            extra[at(CARRY)] = F::from_u32(carry);
            for k in 0..4 {
                carry = (((r.before >> (16 * k)) & 65535) as u32 + carry) >> 16;
                extra[at(CARRY) + k + 1] = F::from_u32(carry);
            }
            extra[at(ACTIVE)] = F::from_bool(r.active);
        }
        for k in 0..16 {
            extra[at(POLICY) + k] = F::from_u16(records[0].policy[k]);
            extra[at(SCOPE) + k] = F::from_u16(records[0].scope[k]);
        }
        extra[at(ACC)..].copy_from_slice(&acc);
        rows.push(extra);
    }
    let p2 = generate_trace_rows::<
        F,
        GenericPoseidon2LinearLayersKoalaBear,
        WIDTH,
        SBOX_DEGREE,
        SBOX_REGISTERS,
        HALF_FULL,
        PARTIAL,
    >(inputs, &round_constants(), 0);
    let mut values = Vec::with_capacity(COLS * air.height);
    for (row, extra) in rows.into_iter().enumerate() {
        values.extend_from_slice(&p2.row_slice(row).unwrap());
        values.extend(extra);
    }
    RowMajorMatrix::new(values, COLS)
}
