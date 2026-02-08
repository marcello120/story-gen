"use client";

import type {Entity, Modifier, ModifierDef, MotifValue, PoolData} from "@/lib/types";
import EntityDisplay from "./EntityDisplay";

interface EntityArrayEditorProps {
    groupLabel: string;
    entities: Entity[];
    pools: PoolData;
    onNameSwap: (entityIndex: number, newValue: MotifValue) => void;
    onModSwap: (entityIndex: number, modIndex: number, newValue: MotifValue) => void;
    onModRemove: (entityIndex: number, modIndex: number) => void;
    onModAdd: (entityIndex: number, mod: Modifier) => void;
    onEntityRemove: (entityIndex: number) => void;
    onEntityAdd: () => void;
    maxEntities: number;
    modDefs: readonly ModifierDef[];
    maxModsPerEntity: number;
}

export default function EntityArrayEditor({
                                              groupLabel,
                                              entities,
                                              pools,
                                              onNameSwap,
                                              onModSwap,
                                              onModRemove,
                                              onModAdd,
                                              onEntityRemove,
                                              onEntityAdd,
                                              maxEntities,
                                              modDefs,
                                              maxModsPerEntity,
                                          }: EntityArrayEditorProps) {
    const atMax = entities.length >= maxEntities;
    const lowerLabel = groupLabel.toLowerCase();
    const singularLabel =
        lowerLabel === "allies" ? "ally" :
            lowerLabel === "enemies" ? "enemy" :
                lowerLabel.slice(0, -1);
    return (
        <div className="mt-2">
            <span className="text-gray-600 dark:text-gray-400 font-medium">{groupLabel}</span>
            {entities.map((entity, ei) => (
                <div key={ei} className="ml-4">
                    <EntityDisplay
                        label=""
                        entity={entity}
                        pools={pools}
                        onNameSwap={(v) => onNameSwap(ei, v)}
                        onModSwap={(mi, v) => onModSwap(ei, mi, v)}
                        onModRemove={(mi) => onModRemove(ei, mi)}
                        onModAdd={(mod) => onModAdd(ei, mod)}
                        modDefs={modDefs}
                        maxMods={maxModsPerEntity}
                        onRemove={() => onEntityRemove(ei)}
                        removeTitle={`Remove ${singularLabel}`}
                    />
                </div>
            ))}
            <button
                type="button"
                disabled={atMax}
                onClick={onEntityAdd}
                className="ml-4 mt-1 text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                + Add {singularLabel}
            </button>
        </div>
    );
}
