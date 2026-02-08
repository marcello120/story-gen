"use client";

import type {MotifValue, PoolData} from "@/lib/types";
import {maybe, pickOne} from "@/lib/helpers";

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
            <span className="font-bold text-amber-700 dark:text-amber-400">
                {value.text}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
                [{value.pool}]
            </span>
            <button
                type="button"
                onClick={() => onSwap(reroll(pools, value))}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1 cursor-pointer transition-colors"
                title="Swap for a new motif"
            >
                ↻
            </button>
        </span>
    );
}
