"use client";

import type {Place, Modifier, ModifierDef, MotifValue, PoolData} from "@/lib/types";
import Motif from "./Motif";
import ModifierList from "./ModifierList";

interface PlaceDisplayProps {
    label: string;
    place: Place;
    suffix?: string;
    pools: PoolData;
    onNameSwap: (newValue: MotifValue) => void;
    onOriginSwap: (newValue: MotifValue) => void;
    onModSwap: (modIndex: number, newValue: MotifValue) => void;
    onModRemove: (modIndex: number) => void;
    onModAdd: (mod: Modifier) => void;
    modDefs: readonly ModifierDef[];
    maxMods: number;
}

export default function PlaceDisplay({label, place, suffix, pools, onNameSwap, onOriginSwap, onModSwap, onModRemove, onModAdd, modDefs, maxMods}: PlaceDisplayProps) {
    return (
        <div className="mb-1">
            <div>
                <span className="text-gray-600 dark:text-gray-400">{label}:</span>{" "}
                <Motif value={place.name} pools={pools} onSwap={onNameSwap} />
                {" "}
                <span className="text-gray-500 dark:text-gray-400">(</span>
                <Motif value={place.origin} pools={pools} onSwap={onOriginSwap} />
                <span className="text-gray-500 dark:text-gray-400">)</span>
                {suffix && <span className="text-gray-500 dark:text-gray-400"> — {suffix}</span>}
            </div>
            <ModifierList
                mods={place.mods}
                pools={pools}
                onModSwap={onModSwap}
                onModRemove={onModRemove}
                onModAdd={onModAdd}
                modDefs={modDefs}
                maxMods={maxMods}
            />
        </div>
    );
}
