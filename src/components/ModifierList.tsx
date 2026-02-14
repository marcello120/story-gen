"use client";

import type {Modifier, ModifierDef, MotifValue, PoolData} from "@/lib/types";
import Motif from "./Motif";
import RemoveButton from "./RemoveButton";
import AddModifierDropdown from "./AddModifierDropdown";

interface ModifierListProps {
    mods: Modifier[];
    pools: PoolData;
    onModSwap: (modIndex: number, newValue: MotifValue) => void;
    onModRemove: (modIndex: number) => void;
    onModAdd: (mod: Modifier) => void;
    modDefs: readonly ModifierDef[];
    maxMods: number;
    indent?: boolean;
}

export default function ModifierList({mods, pools, onModSwap, onModRemove, onModAdd, modDefs, maxMods, indent = false}: ModifierListProps) {
    const usedLabels = new Set(mods.map((m) => m.label));
    const availableModDefs = modDefs.filter((d) => !usedLabels.has(d.label));
    const atMax = mods.length >= maxMods || availableModDefs.length === 0;
    const ml = indent ? "ml-8" : "ml-6";

    return (
        <div>
            {mods.length > 0 && (
                <ul className={ml}>
                    {mods.map((mod, i) => (
                        <li key={i} className="text-sm flex items-baseline gap-1" style={{color: "var(--foreground)"}}>
                            <span className="label-text">{mod.label}:</span>{" "}
                            <Motif value={mod.value} pools={pools} onSwap={(v) => onModSwap(i, v)} />
                            <RemoveButton onClick={() => onModRemove(i)} title="Remove this modifier" />
                        </li>
                    ))}
                </ul>
            )}
            <div className={`${ml} mt-1`}>
                <AddModifierDropdown
                    availableModDefs={availableModDefs}
                    pools={pools}
                    onAdd={onModAdd}
                    disabled={atMax}
                />
            </div>
        </div>
    );
}
