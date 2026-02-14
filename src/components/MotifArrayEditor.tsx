"use client";

import type {MotifValue, PoolData} from "@/lib/types";
import type {ReactNode} from "react";
import Motif from "./Motif";
import RemoveButton from "./RemoveButton";
import AddButton from "./AddButton";

interface MotifArrayEditorProps {
    label: string;
    items: MotifValue[];
    icon?: ReactNode;
    pools: PoolData;
    onSwap: (index: number, newValue: MotifValue) => void;
    onRemove: (index: number) => void;
    onAdd: () => void;
    maxItems: number;
}

export default function MotifArrayEditor({label, items, icon, pools, onSwap, onRemove, onAdd, maxItems}: MotifArrayEditorProps) {
    const atMax = items.length >= maxItems;

    return (
        <div>
            {items.map((m, i) => (
                <div key={i} className="mb-1 flex items-baseline gap-1">
                    <span className="text-xl label-text">{icon}{icon && " "}{label}:</span>{" "}
                    <Motif value={m} pools={pools} onSwap={(v) => onSwap(i, v)} />
                    <RemoveButton onClick={() => onRemove(i)} />
                </div>
            ))}
            <AddButton label={label.toLowerCase()} onClick={onAdd} disabled={atMax}/>
        </div>
    );
}
