"use client";

import type {Entity, MotifValue, PoolData} from "@/lib/types";
import Motif from "./Motif";
import ModifierList from "./ModifierList";

interface EntityDisplayProps {
    label: string;
    entity: Entity;
    suffix?: string;
    pools: PoolData;
    onNameSwap: (newValue: MotifValue) => void;
    onModSwap: (modIndex: number, newValue: MotifValue) => void;
}

export default function EntityDisplay({label, entity, suffix, pools, onNameSwap, onModSwap}: EntityDisplayProps) {
    return (
        <div className="mb-1">
            <div>
                <span className="text-gray-600 dark:text-gray-400">{label}:</span>{" "}
                <Motif value={entity.name} pools={pools} onSwap={onNameSwap} />
                {suffix && <span className="text-gray-500 dark:text-gray-400"> — {suffix}</span>}
            </div>
            <ModifierList mods={entity.mods} pools={pools} onModSwap={onModSwap} />
        </div>
    );
}
