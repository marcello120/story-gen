"use client";

import type {Beat, Entity, Modifier, MotifValue, Place, PoolData, Story} from "@/lib/types";
import {CHARACTER_MODIFIERS, PLACE_MODIFIERS} from "@/lib/modifiers";
import {makeEntity, pick, pickAny, pickAnyMotif, pickBeing, pickModifierOf, pickSupernatural, randInt} from "@/lib/helpers";
import EntityDisplay from "./EntityDisplay";
import PlaceDisplay from "./PlaceDisplay";
import Motif from "./Motif";
import ModifierList from "./ModifierList";
import RemoveButton from "./RemoveButton";
import MotifArrayEditor from "./MotifArrayEditor";
import EntityArrayEditor from "./EntityArrayEditor";

interface BeatCardProps {
    beat: Beat;
    beatIndex: number;
    story: Story;
    pools: PoolData;
    onStoryUpdate: (story: Story) => void;
    onReroll: () => void;
}

// ---------------------------------------------------------------------------
// Immutable update helpers
// ---------------------------------------------------------------------------

function updateBeat(story: Story, beatIndex: number, updater: (beat: Beat) => Beat): Story {
    const beats = story.beats.map((b, i) => (i === beatIndex ? updater(b) : b));
    return {...story, beats};
}

function updateEntityName(entity: Entity, newName: MotifValue): Entity {
    return {...entity, name: newName};
}

function updateEntityMod(entity: Entity, modIndex: number, newValue: MotifValue): Entity {
    const mods = entity.mods.map((m, i) => (i === modIndex ? {...m, value: newValue} : m));
    return {...entity, mods};
}

function removeEntityMod(entity: Entity, modIndex: number): Entity {
    return {...entity, mods: entity.mods.filter((_, i) => i !== modIndex)};
}

function addEntityMod(entity: Entity, mod: Modifier): Entity {
    return {...entity, mods: [...entity.mods, mod]};
}

function updatePlaceName(place: Place, newName: MotifValue): Place {
    return {...place, name: newName};
}

function updatePlaceOrigin(place: Place, newOrigin: MotifValue): Place {
    return {...place, origin: newOrigin};
}

function updatePlaceMod(place: Place, modIndex: number, newValue: MotifValue): Place {
    const mods = place.mods.map((m, i) => (i === modIndex ? {...m, value: newValue} : m));
    return {...place, mods};
}

function removePlaceMod(place: Place, modIndex: number): Place {
    return {...place, mods: place.mods.filter((_, i) => i !== modIndex)};
}

function addPlaceMod(place: Place, mod: Modifier): Place {
    return {...place, mods: [...place.mods, mod]};
}

function updateMotifInArray(arr: MotifValue[], index: number, newValue: MotifValue): MotifValue[] {
    return arr.map((v, i) => (i === index ? newValue : v));
}

function removeFromMotifArray(arr: MotifValue[], index: number): MotifValue[] {
    return arr.filter((_, i) => i !== index);
}

function updateModInArray(arr: Modifier[], index: number, newValue: MotifValue): Modifier[] {
    return arr.map((m, i) => (i === index ? {...m, value: newValue} : m));
}

function removeFromModArray(arr: Modifier[], index: number): Modifier[] {
    return arr.filter((_, i) => i !== index);
}

function removeFromEntityArray(arr: Entity[], index: number): Entity[] {
    return arr.filter((_, i) => i !== index);
}

// ---------------------------------------------------------------------------
// Render helpers for common patterns
// ---------------------------------------------------------------------------

function MotifLine({label, value, pools, onSwap}: {
    label: string;
    value: MotifValue;
    pools: PoolData;
    onSwap: (v: MotifValue) => void
}) {
    return (
        <div className="mb-1">
            <span className="text-gray-600 dark:text-gray-400">{label}:</span>{" "}
            <Motif value={value} pools={pools} onSwap={onSwap}/>
        </div>
    );
}

function TextLine({label, text}: { label: string; text: string }) {
    return (
        <div className="mb-1">
            <span className="text-gray-600 dark:text-gray-400">{label}:</span>{" "}
            <span className="text-gray-800 dark:text-gray-200">{text}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Beat content renderers
// ---------------------------------------------------------------------------

export default function BeatCard({beat, beatIndex, story, pools, onStoryUpdate, onReroll}: BeatCardProps) {
    const update = (updater: (b: Beat) => Beat) => onStoryUpdate(updateBeat(story, beatIndex, updater));

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{beat.title}</h2>
                <button
                    type="button"
                    onClick={onReroll}
                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer transition-colors"
                    title="Re-roll this beat"
                >
                    ↻ Re-roll
                </button>
            </div>
            <div className="space-y-0.5">
                <BeatContent beat={beat} story={story} pools={pools} update={update}/>
            </div>
        </div>
    );
}

function BeatContent({beat, story, pools, update}: {
    beat: Beat;
    story: Story;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    switch (beat.type) {
        case "ordinary-world":
            return <OrdinaryWorldContent beat={beat} story={story} pools={pools} update={update}/>;
        case "call-to-adventure":
            return <CallToAdventureContent beat={beat} story={story} pools={pools} update={update}/>;
        case "refusal":
            return <RefusalContent beat={beat} story={story} pools={pools} update={update}/>;
        case "mentor":
            return <MentorContent beat={beat} story={story} pools={pools} update={update}/>;
        case "threshold":
            return <ThresholdContent beat={beat} pools={pools} update={update}/>;
        case "tests":
            return <TestsContent beat={beat} pools={pools} update={update}/>;
        case "cave":
            return <CaveContent beat={beat} pools={pools} update={update}/>;
        case "ordeal":
            return <OrdealContent beat={beat} story={story} pools={pools} update={update}/>;
        case "reward":
            return <RewardContent beat={beat} pools={pools} update={update}/>;
        case "road-back":
            return <RoadBackContent beat={beat} pools={pools} update={update}/>;
        case "resurrection":
            return <ResurrectionContent beat={beat} pools={pools} update={update}/>;
    }
}

// ---------------------------------------------------------------------------
// Individual beat renderers
// ---------------------------------------------------------------------------

function OrdinaryWorldContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "ordinary-world" }>;
    story: Story;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    const updateAndSync = (updater: (b: typeof beat) => typeof beat) => {
        update((b) => {
            const updated = updater(b as typeof beat);
            // Sync shared entities
            return updated;
        });
    };

    return (
        <>
            <EntityDisplay
                label="Hero" entity={beat.hero} pools={pools}
                onNameSwap={(v) => updateAndSync((b) => ({...b, hero: updateEntityName(b.hero, v)}))}
                onModSwap={(i, v) => updateAndSync((b) => ({...b, hero: updateEntityMod(b.hero, i, v)}))}
                onModRemove={(i) => updateAndSync((b) => ({...b, hero: removeEntityMod(b.hero, i)}))}
                onModAdd={(mod) => updateAndSync((b) => ({...b, hero: addEntityMod(b.hero, mod)}))}
                modDefs={CHARACTER_MODIFIERS}
                maxMods={CHARACTER_MODIFIERS.length}
            />
            <EntityDisplay
                label="Initial Companion" entity={beat.companion} suffix="Helper" pools={pools}
                onNameSwap={(v) => update((b) => ({
                    ...b,
                    companion: updateEntityName((b as typeof beat).companion, v)
                } as Beat))}
                onModSwap={(i, v) => update((b) => ({
                    ...b,
                    companion: updateEntityMod((b as typeof beat).companion, i, v)
                } as Beat))}
                onModRemove={(i) => update((b) => ({
                    ...b,
                    companion: removeEntityMod((b as typeof beat).companion, i)
                } as Beat))}
                onModAdd={(mod) => update((b) => ({
                    ...b,
                    companion: addEntityMod((b as typeof beat).companion, mod)
                } as Beat))}
                modDefs={CHARACTER_MODIFIERS}
                maxMods={CHARACTER_MODIFIERS.length}
            />
            <EntityDisplay
                label="Villain" entity={beat.villain} pools={pools}
                onNameSwap={(v) => update((b) => ({
                    ...b,
                    villain: updateEntityName((b as typeof beat).villain, v)
                } as Beat))}
                onModSwap={(i, v) => update((b) => ({
                    ...b,
                    villain: updateEntityMod((b as typeof beat).villain, i, v)
                } as Beat))}
                onModRemove={(i) => update((b) => ({
                    ...b,
                    villain: removeEntityMod((b as typeof beat).villain, i)
                } as Beat))}
                onModAdd={(mod) => update((b) => ({
                    ...b,
                    villain: addEntityMod((b as typeof beat).villain, mod)
                } as Beat))}
                modDefs={CHARACTER_MODIFIERS}
                maxMods={CHARACTER_MODIFIERS.length}
            />
            <PlaceDisplay
                label="Original World" place={beat.originalWorld} suffix="Original World" pools={pools}
                onNameSwap={(v) => update((b) => ({
                    ...b,
                    originalWorld: updatePlaceName((b as typeof beat).originalWorld, v)
                } as Beat))}
                onOriginSwap={(v) => update((b) => ({
                    ...b,
                    originalWorld: updatePlaceOrigin((b as typeof beat).originalWorld, v)
                } as Beat))}
                onModSwap={(i, v) => update((b) => ({
                    ...b,
                    originalWorld: updatePlaceMod((b as typeof beat).originalWorld, i, v)
                } as Beat))}
                onModRemove={(i) => update((b) => ({
                    ...b,
                    originalWorld: removePlaceMod((b as typeof beat).originalWorld, i)
                } as Beat))}
                onModAdd={(mod) => update((b) => ({
                    ...b,
                    originalWorld: addPlaceMod((b as typeof beat).originalWorld, mod)
                } as Beat))}
                modDefs={PLACE_MODIFIERS}
                maxMods={PLACE_MODIFIERS.length}
            />
        </>
    );
}

function CallToAdventureContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "call-to-adventure" }>;
    story: Story;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    const ordinaryWorld = story.beats[0] as Extract<Beat, { type: "ordinary-world" }>;

    return (
        <>
            {beat.inciting ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Inciting:</span>{" "}
                    <Motif value={beat.inciting} pools={pools}
                           onSwap={(v) => update((b) => ({...b, inciting: v} as Beat))}/>
                    <RemoveButton onClick={() => update((b) => ({...b, inciting: null} as Beat))}
                                  title="Remove inciting"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => update((b) => ({
                        ...b, inciting: pickAny(pools, "Event", "Condition", "Outcome", "Action")
                    } as Beat))}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add inciting
                </button>
            )}
            {beat.herald ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Herald:</span>{" "}
                    <Motif value={beat.herald} pools={pools}
                           onSwap={(v) => update((b) => ({...b, herald: v} as Beat))}/>
                    <RemoveButton onClick={() => update((b) => ({...b, herald: null} as Beat))}
                                  title="Remove herald"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => update((b) => ({...b, herald: pickBeing(pools)} as Beat))}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add herald
                </button>
            )}
            <MotifArrayEditor
                label="Has something to do with"
                items={beat.hasToDoWith}
                pools={pools}
                onSwap={(i, v) => update((b) => ({
                    ...b,
                    hasToDoWith: updateMotifInArray((b as typeof beat).hasToDoWith, i, v)
                } as Beat))}
                onRemove={(i) => update((b) => ({
                    ...b,
                    hasToDoWith: removeFromMotifArray((b as typeof beat).hasToDoWith, i)
                } as Beat))}
                onAdd={() => update((b) => ({
                    ...b,
                    hasToDoWith: [...(b as typeof beat).hasToDoWith, pickAnyMotif(pools)]
                } as Beat))}
                maxItems={5}
            />
            {beat.lie ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Lie told about:</span>{" "}
                    <Motif value={beat.lie} pools={pools}
                           onSwap={(v) => update((b) => ({...b, lie: v} as Beat))}/>
                    <RemoveButton onClick={() => update((b) => ({...b, lie: null} as Beat))}
                                  title="Remove lie"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => update((b) => ({...b, lie: pickAnyMotif(pools)} as Beat))}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add lie told about
                </button>
            )}
            {beat.becauseOf ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Because of:</span>{" "}
                    <span className="text-gray-800 dark:text-gray-200">{beat.becauseOf}</span>
                    <RemoveButton onClick={() => update((b) => ({...b, becauseOf: null} as Beat))}
                                  title="Remove because of"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        const value = pickModifierOf(
                            ordinaryWorld.hero,
                            {name: ordinaryWorld.originalWorld.name, mods: ordinaryWorld.originalWorld.mods},
                            ordinaryWorld.villain,
                        );
                        if (value) update((b) => ({...b, becauseOf: value} as Beat));
                    }}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add because of
                </button>
            )}
        </>
    );
}

function RefusalContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "refusal" }>;
    story: Story;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    const ordinaryWorld = story.beats[0] as Extract<Beat, { type: "ordinary-world" }>;

    return (
        <>
            <MotifLine label="Happens at Place" value={beat.place} pools={pools}
                       onSwap={(v) => update((b) => ({...b, place: v} as Beat))}/>
            <MotifArrayEditor
                label="Has something to do with"
                items={beat.hasToDoWith}
                pools={pools}
                onSwap={(i, v) => update((b) => ({
                    ...b,
                    hasToDoWith: updateMotifInArray((b as typeof beat).hasToDoWith, i, v)
                } as Beat))}
                onRemove={(i) => update((b) => ({
                    ...b,
                    hasToDoWith: removeFromMotifArray((b as typeof beat).hasToDoWith, i)
                } as Beat))}
                onAdd={() => update((b) => ({
                    ...b,
                    hasToDoWith: [...(b as typeof beat).hasToDoWith, pickAnyMotif(pools)]
                } as Beat))}
                maxItems={5}
            />
            {beat.becauseOf ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Because of:</span>{" "}
                    <span className="text-gray-800 dark:text-gray-200">{beat.becauseOf}</span>
                    <RemoveButton onClick={() => update((b) => ({...b, becauseOf: null} as Beat))}
                                  title="Remove because of"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        const value = pickModifierOf(
                            ordinaryWorld.hero, ordinaryWorld.companion, ordinaryWorld.villain,
                        );
                        if (value) update((b) => ({...b, becauseOf: value} as Beat));
                    }}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add because of
                </button>
            )}
        </>
    );
}

function MentorContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "mentor" }>;
    story: Story;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    const ordinaryWorld = story.beats[0] as Extract<Beat, { type: "ordinary-world" }>;
    const threshold = story.beats[4] as Extract<Beat, { type: "threshold" }>;

    return (
        <>
            <EntityDisplay
                label="Mentor" entity={beat.mentor} pools={pools}
                onNameSwap={(v) => update((b) => ({
                    ...b,
                    mentor: updateEntityName((b as typeof beat).mentor, v)
                } as Beat))}
                onModSwap={(i, v) => update((b) => ({
                    ...b,
                    mentor: updateEntityMod((b as typeof beat).mentor, i, v)
                } as Beat))}
                onModRemove={(i) => update((b) => ({
                    ...b,
                    mentor: removeEntityMod((b as typeof beat).mentor, i)
                } as Beat))}
                onModAdd={(mod) => update((b) => ({
                    ...b,
                    mentor: addEntityMod((b as typeof beat).mentor, mod)
                } as Beat))}
                modDefs={CHARACTER_MODIFIERS}
                maxMods={CHARACTER_MODIFIERS.length}
            />
            <MotifLine label="Place" value={beat.place} pools={pools}
                       onSwap={(v) => update((b) => ({...b, place: v} as Beat))}/>
            {beat.supernaturalBeing ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Supernatural Being:</span>{" "}
                    <Motif value={beat.supernaturalBeing} pools={pools}
                           onSwap={(v) => update((b) => ({...b, supernaturalBeing: v} as Beat))}/>
                    <RemoveButton onClick={() => update((b) => ({...b, supernaturalBeing: null} as Beat))}
                                  title="Remove supernatural being"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => update((b) => ({...b, supernaturalBeing: pickSupernatural(pools)} as Beat))}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add supernatural being
                </button>
            )}
            <MotifArrayEditor
                label="Talisman gained"
                items={beat.talismans}
                pools={pools}
                onSwap={(i, v) => update((b) => ({
                    ...b,
                    talismans: updateMotifInArray((b as typeof beat).talismans, i, v)
                } as Beat))}
                onRemove={(i) => update((b) => ({
                    ...b,
                    talismans: removeFromMotifArray((b as typeof beat).talismans, i)
                } as Beat))}
                onAdd={() => update((b) => ({
                    ...b,
                    talismans: [...(b as typeof beat).talismans, pick(pools, "Object")]
                } as Beat))}
                maxItems={5}
            />
            {beat.learnsAbout ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Learns about:</span>{" "}
                    <span className="text-gray-800 dark:text-gray-200">{beat.learnsAbout}</span>
                    <RemoveButton onClick={() => update((b) => ({...b, learnsAbout: null} as Beat))}
                                  title="Remove learns about"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        const value = pickModifierOf(ordinaryWorld.villain, threshold.otherWorld, ordinaryWorld.hero)
                            ?? pickAny(pools, "Event", "Condition", "Outcome", "Action", "Attribute").text;
                        update((b) => ({...b, learnsAbout: value} as Beat));
                    }}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add learns about
                </button>
            )}
            {beat.trial ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Trial:</span>{" "}
                    <Motif value={beat.trial} pools={pools}
                           onSwap={(v) => update((b) => ({...b, trial: v} as Beat))}/>
                    <RemoveButton onClick={() => update((b) => ({...b, trial: null} as Beat))}
                                  title="Remove trial"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => update((b) => ({
                        ...b, trial: pickAny(pools, "Event", "Condition", "Outcome", "Action")
                    } as Beat))}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add trial
                </button>
            )}
        </>
    );
}

function ThresholdContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "threshold" }>;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    return (
        <>
            {beat.hasToDoWith && (
                <MotifLine label="Has something to do with" value={beat.hasToDoWith} pools={pools}
                           onSwap={(v) => update((b) => ({...b, hasToDoWith: v} as Beat))}/>
            )}
            <PlaceDisplay
                label="Other World" place={beat.otherWorld} suffix="Other World" pools={pools}
                onNameSwap={(v) => update((b) => ({
                    ...b,
                    otherWorld: updatePlaceName((b as typeof beat).otherWorld, v)
                } as Beat))}
                onOriginSwap={(v) => update((b) => ({
                    ...b,
                    otherWorld: updatePlaceOrigin((b as typeof beat).otherWorld, v)
                } as Beat))}
                onModSwap={(i, v) => update((b) => ({
                    ...b,
                    otherWorld: updatePlaceMod((b as typeof beat).otherWorld, i, v)
                } as Beat))}
                onModRemove={(i) => update((b) => ({
                    ...b,
                    otherWorld: removePlaceMod((b as typeof beat).otherWorld, i)
                } as Beat))}
                onModAdd={(mod) => update((b) => ({
                    ...b,
                    otherWorld: addPlaceMod((b as typeof beat).otherWorld, mod)
                } as Beat))}
                modDefs={PLACE_MODIFIERS}
                maxMods={PLACE_MODIFIERS.length}
            />
        </>
    );
}

function TestsContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "tests" }>;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    return (
        <>
            <MotifArrayEditor
                label="Test"
                items={beat.tests}
                pools={pools}
                onSwap={(i, v) => update((b) => ({
                    ...b,
                    tests: updateMotifInArray((b as typeof beat).tests, i, v)
                } as Beat))}
                onRemove={(i) => update((b) => ({
                    ...b,
                    tests: removeFromMotifArray((b as typeof beat).tests, i)
                } as Beat))}
                onAdd={() => update((b) => ({
                    ...b,
                    tests: [...(b as typeof beat).tests, pickAny(pools, "Event", "Condition", "Outcome", "Action")]
                } as Beat))}
                maxItems={5}
            />
            <EntityArrayEditor
                groupLabel="Allies"
                entities={beat.allies}
                pools={pools}
                onNameSwap={(ei, v) => update((b) => {
                    const allies = [...(b as typeof beat).allies];
                    allies[ei] = updateEntityName(allies[ei], v);
                    return {...b, allies} as Beat;
                })}
                onModSwap={(ei, mi, v) => update((b) => {
                    const allies = [...(b as typeof beat).allies];
                    allies[ei] = updateEntityMod(allies[ei], mi, v);
                    return {...b, allies} as Beat;
                })}
                onModRemove={(ei, mi) => update((b) => {
                    const allies = [...(b as typeof beat).allies];
                    allies[ei] = removeEntityMod(allies[ei], mi);
                    return {...b, allies} as Beat;
                })}
                onModAdd={(ei, mod) => update((b) => {
                    const allies = [...(b as typeof beat).allies];
                    allies[ei] = addEntityMod(allies[ei], mod);
                    return {...b, allies} as Beat;
                })}
                onEntityRemove={(ei) => update((b) => ({
                    ...b,
                    allies: removeFromEntityArray((b as typeof beat).allies, ei)
                } as Beat))}
                onEntityAdd={() => update((b) => ({
                    ...b,
                    allies: [...(b as typeof beat).allies, makeEntity(pools, pickBeing(pools), CHARACTER_MODIFIERS, randInt(0, 3))]
                } as Beat))}
                maxEntities={5}
                modDefs={CHARACTER_MODIFIERS}
                maxModsPerEntity={CHARACTER_MODIFIERS.length}
            />
            <EntityArrayEditor
                groupLabel="Enemies"
                entities={beat.enemies}
                pools={pools}
                onNameSwap={(ei, v) => update((b) => {
                    const enemies = [...(b as typeof beat).enemies];
                    enemies[ei] = updateEntityName(enemies[ei], v);
                    return {...b, enemies} as Beat;
                })}
                onModSwap={(ei, mi, v) => update((b) => {
                    const enemies = [...(b as typeof beat).enemies];
                    enemies[ei] = updateEntityMod(enemies[ei], mi, v);
                    return {...b, enemies} as Beat;
                })}
                onModRemove={(ei, mi) => update((b) => {
                    const enemies = [...(b as typeof beat).enemies];
                    enemies[ei] = removeEntityMod(enemies[ei], mi);
                    return {...b, enemies} as Beat;
                })}
                onModAdd={(ei, mod) => update((b) => {
                    const enemies = [...(b as typeof beat).enemies];
                    enemies[ei] = addEntityMod(enemies[ei], mod);
                    return {...b, enemies} as Beat;
                })}
                onEntityRemove={(ei) => update((b) => ({
                    ...b,
                    enemies: removeFromEntityArray((b as typeof beat).enemies, ei)
                } as Beat))}
                onEntityAdd={() => update((b) => ({
                    ...b,
                    enemies: [...(b as typeof beat).enemies, makeEntity(pools, pickBeing(pools), CHARACTER_MODIFIERS, randInt(0, 3))]
                } as Beat))}
                maxEntities={5}
                modDefs={CHARACTER_MODIFIERS}
                maxModsPerEntity={CHARACTER_MODIFIERS.length}
            />
        </>
    );
}

function CaveContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "cave" }>;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    return (
        <>
            <MotifLine label="Place" value={beat.place} pools={pools}
                       onSwap={(v) => update((b) => ({...b, place: v} as Beat))}/>
            <MotifArrayEditor
                label="To Rescue"
                items={beat.toRescue}
                pools={pools}
                onSwap={(i, v) => update((b) => ({
                    ...b,
                    toRescue: updateMotifInArray((b as typeof beat).toRescue, i, v)
                } as Beat))}
                onRemove={(i) => update((b) => ({
                    ...b,
                    toRescue: removeFromMotifArray((b as typeof beat).toRescue, i)
                } as Beat))}
                onAdd={() => update((b) => ({
                    ...b,
                    toRescue: [...(b as typeof beat).toRescue, pickBeing(pools)]
                } as Beat))}
                maxItems={4}
            />
            {beat.toGetTalisman ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">To Get Object (Talisman):</span>{" "}
                    <Motif value={beat.toGetTalisman} pools={pools}
                           onSwap={(v) => update((b) => ({...b, toGetTalisman: v} as Beat))}/>
                    <RemoveButton onClick={() => update((b) => ({...b, toGetTalisman: null} as Beat))}
                                  title="Remove to get object"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => update((b) => ({...b, toGetTalisman: pick(pools, "Object")} as Beat))}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add to get object
                </button>
            )}
            {beat.cursedBane ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Cursed (Bane):</span>{" "}
                    <Motif value={beat.cursedBane} pools={pools}
                           onSwap={(v) => update((b) => ({...b, cursedBane: v} as Beat))}/>
                    <RemoveButton onClick={() => update((b) => ({...b, cursedBane: null} as Beat))}
                                  title="Remove cursed bane"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => update((b) => ({...b, cursedBane: pick(pools, "Object")} as Beat))}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add cursed bane
                </button>
            )}
            {beat.toUndergo ? (
                <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">To Undergo:</span>{" "}
                    <Motif value={beat.toUndergo} pools={pools}
                           onSwap={(v) => update((b) => ({...b, toUndergo: v} as Beat))}/>
                    <RemoveButton onClick={() => update((b) => ({...b, toUndergo: null} as Beat))}
                                  title="Remove to undergo"/>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => update((b) => ({
                        ...b, toUndergo: pickAny(pools, "Event", "Condition", "Outcome", "Action")
                    } as Beat))}
                    className="text-s text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add to undergo
                </button>
            )}
        </>
    );
}

function OrdealContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "ordeal" }>;
    story: Story;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    const ordinaryWorld = story.beats[0] as Extract<Beat, { type: "ordinary-world" }>;

    const generateHingesOn = (): string | null => {
        return pickModifierOf(ordinaryWorld.villain, ordinaryWorld.hero);
    };

    return (
        <>
            <MotifLine label="Confronts Villain(s) at Place" value={beat.place} pools={pools}
                       onSwap={(v) => update((b) => ({...b, place: v} as Beat))}/>
            <ModifierList mods={beat.placeMods} pools={pools}
                          onModSwap={(i, v) => update((b) => ({
                              ...b,
                              placeMods: updateModInArray((b as typeof beat).placeMods, i, v)
                          } as Beat))}
                          onModRemove={(i) => update((b) => ({
                              ...b,
                              placeMods: removeFromModArray((b as typeof beat).placeMods, i)
                          } as Beat))}
                          onModAdd={(mod) => update((b) => ({
                              ...b,
                              placeMods: [...(b as typeof beat).placeMods, mod]
                          } as Beat))}
                          modDefs={PLACE_MODIFIERS}
                          maxMods={PLACE_MODIFIERS.length}
            />
            <MotifArrayEditor
                label="Has something to do with"
                items={beat.hasToDoWith}
                pools={pools}
                onSwap={(i, v) => update((b) => ({
                    ...b,
                    hasToDoWith: updateMotifInArray((b as typeof beat).hasToDoWith, i, v)
                } as Beat))}
                onRemove={(i) => update((b) => ({
                    ...b,
                    hasToDoWith: removeFromMotifArray((b as typeof beat).hasToDoWith, i)
                } as Beat))}
                onAdd={() => update((b) => ({
                    ...b,
                    hasToDoWith: [...(b as typeof beat).hasToDoWith, pickAnyMotif(pools)]
                } as Beat))}
                maxItems={4}
            />
            {beat.hingesOn.map((h, i) => (
                <div key={i} className="mb-1 flex items-baseline gap-1">
                    <span className="text-gray-600 dark:text-gray-400">Hinges on:</span>{" "}
                    <span className="text-gray-800 dark:text-gray-200">{h}</span>
                    <RemoveButton
                        onClick={() => update((b) => ({
                            ...b,
                            hingesOn: (b as typeof beat).hingesOn.filter((_, idx) => idx !== i)
                        } as Beat))}
                        title="Remove hinges on"
                    />
                </div>
            ))}
            {beat.hingesOn.length < 2 && (
                <button
                    type="button"
                    onClick={() => {
                        const value = generateHingesOn();
                        if (value) {
                            update((b) => ({
                                ...b,
                                hingesOn: [...(b as typeof beat).hingesOn, value]
                            } as Beat));
                        }
                    }}
                    className="text-x text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                    + Add hinges on
                </button>
            )}
        </>
    );
}

function RewardContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "reward" }>;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    return (
        <>
            <MotifLine label="Reward" value={beat.reward} pools={pools}
                       onSwap={(v) => update((b) => ({...b, reward: v} as Beat))}/>
            <MotifLine label="Hero becomes" value={beat.heroBecomes} pools={pools}
                       onSwap={(v) => update((b) => ({...b, heroBecomes: v} as Beat))}/>
            <MotifLine label="Has something to do with" value={beat.hasToDoWith} pools={pools}
                       onSwap={(v) => update((b) => ({...b, hasToDoWith: v} as Beat))}/>
            {beat.lossOf && <TextLine label="Loss of" text={beat.lossOf}/>}
        </>
    );
}

function RoadBackContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "road-back" }>;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    return (
        <>
            <MotifLine label="Goes through Place" value={beat.place} pools={pools}
                       onSwap={(v) => update((b) => ({...b, place: v} as Beat))}/>
            <ModifierList mods={beat.placeMods} pools={pools}
                          onModSwap={(i, v) => update((b) => ({
                              ...b,
                              placeMods: updateModInArray((b as typeof beat).placeMods, i, v)
                          } as Beat))}
                          onModRemove={(i) => update((b) => ({
                              ...b,
                              placeMods: removeFromModArray((b as typeof beat).placeMods, i)
                          } as Beat))}
                          onModAdd={(mod) => update((b) => ({
                              ...b,
                              placeMods: [...(b as typeof beat).placeMods, mod]
                          } as Beat))}
                          modDefs={PLACE_MODIFIERS}
                          maxMods={PLACE_MODIFIERS.length}
            />
            <MotifLine label="Accompanied by" value={beat.accompaniedBy} pools={pools}
                       onSwap={(v) => update((b) => ({...b, accompaniedBy: v} as Beat))}/>
        </>
    );
}

function ResurrectionContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "resurrection" }>;
    pools: PoolData;
    update: (fn: (b: Beat) => Beat) => void
}) {
    return (
        <>
            <MotifLine label="Has to contend with" value={beat.contendWith} pools={pools}
                       onSwap={(v) => update((b) => ({...b, contendWith: v} as Beat))}/>
            <MotifLine label="To achieve" value={beat.toAchieve} pools={pools}
                       onSwap={(v) => update((b) => ({...b, toAchieve: v} as Beat))}/>
        </>
    );
}
