"use client";

import type {MotifValue, PoolData} from "@/lib/types";
import {maybe, pickOne} from "@/lib/helpers";
import RerollButton from "./RerollButton";

function reroll(pools: PoolData, motif: MotifValue): MotifValue {
    const pool = motif.preferred && maybe(0.7) ? motif.preferred : motif.pool;
    const arr = pools[pool] ?? [];
    if (arr.length === 0) return motif;
    return {...motif, text: pickOne(arr)};
}

interface MotifProps {
    value: MotifValue;
    pools: PoolData;
    onSwap: (newValue: MotifValue) => void;
}

export default function Motif({value, pools, onSwap}: MotifProps) {
    return (
        <span className="inline-flex items-baseline gap-1">
            <span className="motif-text">
                {value.text}
            </span>
            <span className="pool-tag">
                [{value.pool}]
            </span>
            <RerollButton onClick={() => onSwap(reroll(pools, value))} />
        </span>
    );
}
