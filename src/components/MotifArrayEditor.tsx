"use client";

import type {MotifValue, PoolData} from "@/lib/types";
import Motif from "./Motif";
import RemoveButton from "./RemoveButton";

interface MotifArrayEditorProps {
    label: string;
    items: MotifValue[];
    pools: PoolData;
    onSwap: (index: number, newValue: MotifValue) => void;
    onRemove: (index: number) => void;
    onAdd: () => void;
    maxItems: number;
}

export default function MotifArrayEditor({label, items, pools, onSwap, onRemove, onAdd, maxItems}: MotifArrayEditorProps) {
    const atMax = items.length >= maxItems;

    return (
        <div>
            {items.map((m, i) => (
                <div key={i} className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">{label}:</span>{" "}
                    <Motif value={m} pools={pools} onSwap={(v) => onSwap(i, v)} />
                    <RemoveButton onClick={() => onRemove(i)} />
                </div>
            ))}
            <button
                type="button"
                disabled={atMax}
                onClick={onAdd}
                className="text-x text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                + Add {label.toLowerCase()}
            </button>
        </div>
    );
}
