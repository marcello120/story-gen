"use client";

import type {Beat, Entity, Modifier, MotifValue, Place, PoolData, Story} from "@/lib/types";
import EntityDisplay from "./EntityDisplay";
import PlaceDisplay from "./PlaceDisplay";
import Motif from "./Motif";
import ModifierList from "./ModifierList";

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

function updateMotifInArray(arr: MotifValue[], index: number, newValue: MotifValue): MotifValue[] {
    return arr.map((v, i) => (i === index ? newValue : v));
}

function updateModInArray(arr: Modifier[], index: number, newValue: MotifValue): Modifier[] {
    return arr.map((m, i) => (i === index ? {...m, value: newValue} : m));
}

// ---------------------------------------------------------------------------
// Render helpers for common patterns
// ---------------------------------------------------------------------------

function MotifLine({label, value, pools, onSwap}: {label: string; value: MotifValue; pools: PoolData; onSwap: (v: MotifValue) => void}) {
    return (
        <div className="mb-1">
            <span className="text-gray-600 dark:text-gray-400">{label}:</span>{" "}
            <Motif value={value} pools={pools} onSwap={onSwap} />
        </div>
    );
}

function TextLine({label, text}: {label: string; text: string}) {
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
                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    title="Re-roll this beat"
                >
                    Re-roll
                </button>
            </div>
            <div className="space-y-0.5">
                <BeatContent beat={beat} story={story} pools={pools} update={update} />
            </div>
        </div>
    );
}

function BeatContent({beat, story, pools, update}: {beat: Beat; story: Story; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    switch (beat.type) {
        case "ordinary-world":
            return <OrdinaryWorldContent beat={beat} story={story} pools={pools} update={update} />;
        case "call-to-adventure":
            return <CallToAdventureContent beat={beat} pools={pools} update={update} />;
        case "refusal":
            return <RefusalContent beat={beat} pools={pools} update={update} />;
        case "mentor":
            return <MentorContent beat={beat} pools={pools} update={update} />;
        case "threshold":
            return <ThresholdContent beat={beat} pools={pools} update={update} />;
        case "tests":
            return <TestsContent beat={beat} pools={pools} update={update} />;
        case "cave":
            return <CaveContent beat={beat} pools={pools} update={update} />;
        case "ordeal":
            return <OrdealContent beat={beat} pools={pools} update={update} />;
        case "reward":
            return <RewardContent beat={beat} pools={pools} update={update} />;
        case "road-back":
            return <RoadBackContent beat={beat} pools={pools} update={update} />;
        case "resurrection":
            return <ResurrectionContent beat={beat} pools={pools} update={update} />;
    }
}

// ---------------------------------------------------------------------------
// Individual beat renderers
// ---------------------------------------------------------------------------

function OrdinaryWorldContent({beat, story, pools, update}: {beat: Extract<Beat, {type: "ordinary-world"}>; story: Story; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
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
            />
            <EntityDisplay
                label="Initial Companion" entity={beat.companion} suffix="Helper" pools={pools}
                onNameSwap={(v) => update((b) => ({...b, companion: updateEntityName((b as typeof beat).companion, v)} as Beat))}
                onModSwap={(i, v) => update((b) => ({...b, companion: updateEntityMod((b as typeof beat).companion, i, v)} as Beat))}
            />
            <EntityDisplay
                label="Villain" entity={beat.villain} pools={pools}
                onNameSwap={(v) => update((b) => ({...b, villain: updateEntityName((b as typeof beat).villain, v)} as Beat))}
                onModSwap={(i, v) => update((b) => ({...b, villain: updateEntityMod((b as typeof beat).villain, i, v)} as Beat))}
            />
            <PlaceDisplay
                label="Original World" place={beat.originalWorld} suffix="Original World" pools={pools}
                onNameSwap={(v) => update((b) => ({...b, originalWorld: updatePlaceName((b as typeof beat).originalWorld, v)} as Beat))}
                onOriginSwap={(v) => update((b) => ({...b, originalWorld: updatePlaceOrigin((b as typeof beat).originalWorld, v)} as Beat))}
                onModSwap={(i, v) => update((b) => ({...b, originalWorld: updatePlaceMod((b as typeof beat).originalWorld, i, v)} as Beat))}
            />
        </>
    );
}

function CallToAdventureContent({beat, pools, update}: {beat: Extract<Beat, {type: "call-to-adventure"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            {beat.inciting && (
                <MotifLine label="Inciting" value={beat.inciting} pools={pools}
                    onSwap={(v) => update((b) => ({...b, inciting: v} as Beat))} />
            )}
            {beat.herald && (
                <MotifLine label="Herald" value={beat.herald} pools={pools}
                    onSwap={(v) => update((b) => ({...b, herald: v} as Beat))} />
            )}
            {beat.hasToDoWith.map((m, i) => (
                <MotifLine key={i} label="Has something to do with" value={m} pools={pools}
                    onSwap={(v) => update((b) => ({...b, hasToDoWith: updateMotifInArray((b as typeof beat).hasToDoWith, i, v)} as Beat))} />
            ))}
            {beat.lie && (
                <MotifLine label="Lie told about" value={beat.lie} pools={pools}
                    onSwap={(v) => update((b) => ({...b, lie: v} as Beat))} />
            )}
            {beat.becauseOf && <TextLine label="Because of" text={beat.becauseOf} />}
        </>
    );
}

function RefusalContent({beat, pools, update}: {beat: Extract<Beat, {type: "refusal"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            <MotifLine label="Happens at Place" value={beat.place} pools={pools}
                onSwap={(v) => update((b) => ({...b, place: v} as Beat))} />
            {beat.hasToDoWith.map((m, i) => (
                <MotifLine key={i} label="Has something to do with" value={m} pools={pools}
                    onSwap={(v) => update((b) => ({...b, hasToDoWith: updateMotifInArray((b as typeof beat).hasToDoWith, i, v)} as Beat))} />
            ))}
            {beat.becauseOf && <TextLine label="Because of" text={beat.becauseOf} />}
        </>
    );
}

function MentorContent({beat, pools, update}: {beat: Extract<Beat, {type: "mentor"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            <EntityDisplay
                label="Mentor" entity={beat.mentor} pools={pools}
                onNameSwap={(v) => update((b) => ({...b, mentor: updateEntityName((b as typeof beat).mentor, v)} as Beat))}
                onModSwap={(i, v) => update((b) => ({...b, mentor: updateEntityMod((b as typeof beat).mentor, i, v)} as Beat))}
            />
            <MotifLine label="Place" value={beat.place} pools={pools}
                onSwap={(v) => update((b) => ({...b, place: v} as Beat))} />
            {beat.supernaturalBeing && (
                <MotifLine label="Supernatural Being" value={beat.supernaturalBeing} pools={pools}
                    onSwap={(v) => update((b) => ({...b, supernaturalBeing: v} as Beat))} />
            )}
            {beat.talismans.map((t, i) => (
                <MotifLine key={i} label="Talisman gained" value={t} pools={pools}
                    onSwap={(v) => update((b) => ({...b, talismans: updateMotifInArray((b as typeof beat).talismans, i, v)} as Beat))} />
            ))}
            <TextLine label="Learns about" text={beat.learnsAbout} />
            {beat.trial && (
                <MotifLine label="Trial" value={beat.trial} pools={pools}
                    onSwap={(v) => update((b) => ({...b, trial: v} as Beat))} />
            )}
        </>
    );
}

function ThresholdContent({beat, pools, update}: {beat: Extract<Beat, {type: "threshold"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            {beat.hasToDoWith && (
                <MotifLine label="Has something to do with" value={beat.hasToDoWith} pools={pools}
                    onSwap={(v) => update((b) => ({...b, hasToDoWith: v} as Beat))} />
            )}
            <PlaceDisplay
                label="Other World" place={beat.otherWorld} suffix="Other World" pools={pools}
                onNameSwap={(v) => update((b) => ({...b, otherWorld: updatePlaceName((b as typeof beat).otherWorld, v)} as Beat))}
                onOriginSwap={(v) => update((b) => ({...b, otherWorld: updatePlaceOrigin((b as typeof beat).otherWorld, v)} as Beat))}
                onModSwap={(i, v) => update((b) => ({...b, otherWorld: updatePlaceMod((b as typeof beat).otherWorld, i, v)} as Beat))}
            />
        </>
    );
}

function TestsContent({beat, pools, update}: {beat: Extract<Beat, {type: "tests"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            <div className="mb-1">
                <span className="text-gray-600 dark:text-gray-400">Tests:</span>{" "}
                {beat.tests.map((t, i) => (
                    <span key={i}>
                        {i > 0 && <span className="text-gray-400">, </span>}
                        <Motif value={t} pools={pools}
                            onSwap={(v) => update((b) => ({...b, tests: updateMotifInArray((b as typeof beat).tests, i, v)} as Beat))} />
                    </span>
                ))}
            </div>
            <div className="mt-2">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Allies:</span>
                {beat.allies.map((ally, ai) => (
                    <div key={ai} className="ml-4">
                        <EntityDisplay
                            label="" entity={ally} pools={pools}
                            onNameSwap={(v) => update((b) => {
                                const allies = [...(b as typeof beat).allies];
                                allies[ai] = updateEntityName(allies[ai], v);
                                return {...b, allies} as Beat;
                            })}
                            onModSwap={(mi, v) => update((b) => {
                                const allies = [...(b as typeof beat).allies];
                                allies[ai] = updateEntityMod(allies[ai], mi, v);
                                return {...b, allies} as Beat;
                            })}
                        />
                    </div>
                ))}
            </div>
            <div className="mt-2">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Enemies:</span>
                {beat.enemies.map((enemy, ei) => (
                    <div key={ei} className="ml-4">
                        <EntityDisplay
                            label="" entity={enemy} pools={pools}
                            onNameSwap={(v) => update((b) => {
                                const enemies = [...(b as typeof beat).enemies];
                                enemies[ei] = updateEntityName(enemies[ei], v);
                                return {...b, enemies} as Beat;
                            })}
                            onModSwap={(mi, v) => update((b) => {
                                const enemies = [...(b as typeof beat).enemies];
                                enemies[ei] = updateEntityMod(enemies[ei], mi, v);
                                return {...b, enemies} as Beat;
                            })}
                        />
                    </div>
                ))}
            </div>
        </>
    );
}

function CaveContent({beat, pools, update}: {beat: Extract<Beat, {type: "cave"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            <MotifLine label="Place" value={beat.place} pools={pools}
                onSwap={(v) => update((b) => ({...b, place: v} as Beat))} />
            {beat.toRescue.map((r, i) => (
                <MotifLine key={i} label="To Rescue" value={r} pools={pools}
                    onSwap={(v) => update((b) => ({...b, toRescue: updateMotifInArray((b as typeof beat).toRescue, i, v)} as Beat))} />
            ))}
            {beat.toGetTalisman && (
                <MotifLine label="To Get Object (Talisman)" value={beat.toGetTalisman} pools={pools}
                    onSwap={(v) => update((b) => ({...b, toGetTalisman: v} as Beat))} />
            )}
            {beat.cursedBane && (
                <MotifLine label="Cursed (Bane)" value={beat.cursedBane} pools={pools}
                    onSwap={(v) => update((b) => ({...b, cursedBane: v} as Beat))} />
            )}
            {beat.toUndergo && (
                <MotifLine label="To Undergo" value={beat.toUndergo} pools={pools}
                    onSwap={(v) => update((b) => ({...b, toUndergo: v} as Beat))} />
            )}
        </>
    );
}

function OrdealContent({beat, pools, update}: {beat: Extract<Beat, {type: "ordeal"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            <MotifLine label="Confronts Villain(s) at Place" value={beat.place} pools={pools}
                onSwap={(v) => update((b) => ({...b, place: v} as Beat))} />
            {beat.placeMods.length > 0 && (
                <ModifierList mods={beat.placeMods} pools={pools}
                    onModSwap={(i, v) => update((b) => ({...b, placeMods: updateModInArray((b as typeof beat).placeMods, i, v)} as Beat))} />
            )}
            {beat.hasToDoWith.map((m, i) => (
                <MotifLine key={i} label="Has something to do with" value={m} pools={pools}
                    onSwap={(v) => update((b) => ({...b, hasToDoWith: updateMotifInArray((b as typeof beat).hasToDoWith, i, v)} as Beat))} />
            ))}
            {beat.hingesOn.map((h, i) => (
                <TextLine key={i} label="Hinges on" text={h} />
            ))}
        </>
    );
}

function RewardContent({beat, pools, update}: {beat: Extract<Beat, {type: "reward"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            <MotifLine label="Reward" value={beat.reward} pools={pools}
                onSwap={(v) => update((b) => ({...b, reward: v} as Beat))} />
            <MotifLine label="Hero becomes" value={beat.heroBecomes} pools={pools}
                onSwap={(v) => update((b) => ({...b, heroBecomes: v} as Beat))} />
            <MotifLine label="Has something to do with" value={beat.hasToDoWith} pools={pools}
                onSwap={(v) => update((b) => ({...b, hasToDoWith: v} as Beat))} />
            {beat.lossOf && <TextLine label="Loss of" text={beat.lossOf} />}
        </>
    );
}

function RoadBackContent({beat, pools, update}: {beat: Extract<Beat, {type: "road-back"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            <MotifLine label="Goes through Place" value={beat.place} pools={pools}
                onSwap={(v) => update((b) => ({...b, place: v} as Beat))} />
            <ModifierList mods={beat.placeMods} pools={pools}
                onModSwap={(i, v) => update((b) => ({...b, placeMods: updateModInArray((b as typeof beat).placeMods, i, v)} as Beat))} />
            <MotifLine label="Accompanied by" value={beat.accompaniedBy} pools={pools}
                onSwap={(v) => update((b) => ({...b, accompaniedBy: v} as Beat))} />
        </>
    );
}

function ResurrectionContent({beat, pools, update}: {beat: Extract<Beat, {type: "resurrection"}>; pools: PoolData; update: (fn: (b: Beat) => Beat) => void}) {
    return (
        <>
            <MotifLine label="Has to contend with" value={beat.contendWith} pools={pools}
                onSwap={(v) => update((b) => ({...b, contendWith: v} as Beat))} />
            <MotifLine label="To achieve" value={beat.toAchieve} pools={pools}
                onSwap={(v) => update((b) => ({...b, toAchieve: v} as Beat))} />
        </>
    );
}
