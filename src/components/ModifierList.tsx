"use client";

import type {Modifier, MotifValue, PoolData} from "@/lib/types";
import Motif from "./Motif";

interface ModifierListProps {
    mods: Modifier[];
    pools: PoolData;
    onModSwap: (modIndex: number, newValue: MotifValue) => void;
    indent?: boolean;
}

export default function ModifierList({mods, pools, onModSwap, indent = false}: ModifierListProps) {
    if (mods.length === 0) return null;
    return (
        <ul className={indent ? "ml-8" : "ml-6"}>
            {mods.map((mod, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-gray-500 dark:text-gray-400">{mod.label}:</span>{" "}
                    <Motif value={mod.value} pools={pools} onSwap={(v) => onModSwap(i, v)} />
                </li>
            ))}
        </ul>
    );
}
