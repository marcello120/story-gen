"use client";

import type {Entity, Modifier, ModifierDef, MotifValue, PoolData} from "@/lib/types";
import type {ReactNode} from "react";
import EntityDisplay from "./EntityDisplay";
import AddButton from "./AddButton";

interface EntityArrayEditorProps {
    groupLabel: string;
    entities: Entity[];
    icon?: ReactNode;
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
                                              icon,
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
            <span className="text-xl label-text font-medium">{icon}{icon && " "}{groupLabel}</span>
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
            <AddButton label={singularLabel} onClick={onEntityAdd} disabled={atMax} className="ml-4 mt-1"/>
        </div>
    );
}
