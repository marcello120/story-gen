"use client";

import type {Entity, Modifier, ModifierDef, MotifValue, PoolData} from "@/lib/types";
import Motif from "./Motif";
import RemoveButton from "./RemoveButton";
import ModifierList from "./ModifierList";

interface EntityDisplayProps {
    label: string;
    entity: Entity;
    suffix?: string;
    pools: PoolData;
    onNameSwap: (newValue: MotifValue) => void;
    onModSwap: (modIndex: number, newValue: MotifValue) => void;
    onModRemove: (modIndex: number) => void;
    onModAdd: (mod: Modifier) => void;
    modDefs: readonly ModifierDef[];
    maxMods: number;
    onRemove?: () => void;
    removeTitle?: string;
}

export default function EntityDisplay({label, entity, suffix, pools, onNameSwap, onModSwap, onModRemove, onModAdd, modDefs, maxMods, onRemove, removeTitle}: EntityDisplayProps) {
    return (
        <div className="mb-1">
            <div className="flex items-baseline gap-1">
                <div>
                    {label && <span className="text-gray-600 dark:text-gray-400">{label}:</span>}{" "}
                    <Motif value={entity.name} pools={pools} onSwap={onNameSwap} />
                    {suffix && <span className="text-gray-500 dark:text-gray-400"> — {suffix}</span>}
                </div>
                {onRemove && <RemoveButton onClick={onRemove} title={removeTitle} />}
            </div>
            <ModifierList
                mods={entity.mods}
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
