"use client";

import type {Place, Modifier, ModifierDef, MotifValue, PoolData} from "@/lib/types";
import type {ReactNode} from "react";
import Motif from "./Motif";
import ModifierList from "./ModifierList";

interface PlaceDisplayProps {
    label: string;
    place: Place;
    suffix?: string;
    icon?: ReactNode;
    pools: PoolData;
    onNameSwap: (newValue: MotifValue) => void;
    onOriginSwap: (newValue: MotifValue) => void;
    onModSwap: (modIndex: number, newValue: MotifValue) => void;
    onModRemove: (modIndex: number) => void;
    onModAdd: (mod: Modifier) => void;
    modDefs: readonly ModifierDef[];
    maxMods: number;
}

export default function PlaceDisplay({label, place, suffix, icon, pools, onNameSwap, onOriginSwap, onModSwap, onModRemove, onModAdd, modDefs, maxMods}: PlaceDisplayProps) {
    return (
        <div className="mb-1">
            <div>
                <span className="text-xl label-text">{icon}{icon && " "}{label}:</span>{" "}
                <Motif value={place.name} pools={pools} onSwap={onNameSwap} />
                {" "}
                <span className="label-text">(</span>
                <Motif value={place.origin} pools={pools} onSwap={onOriginSwap} />
                <span className="label-text">)</span>
                {suffix && <span className="label-text"> — {suffix}</span>}
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
