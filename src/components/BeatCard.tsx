"use client";

import type {Beat, Entity, Modifier, ModifierDef, MotifValue, Place, PoolData, Story} from "@/lib/types";
import type {ReactNode} from "react";
import {CHARACTER_MODIFIERS, PLACE_MODIFIERS} from "@/lib/modifiers";
import {makeEntity, maybe, pick, pickAny, pickAnyMotif, pickBeing, pickModifierOf, pickOne, pickSupernatural, randInt} from "@/lib/helpers";
import EntityDisplay from "./EntityDisplay";
import PlaceDisplay from "./PlaceDisplay";
import Motif from "./Motif";
import ModifierList from "./ModifierList";
import RemoveButton from "./RemoveButton";
import MotifArrayEditor from "./MotifArrayEditor";
import EntityArrayEditor from "./EntityArrayEditor";
import AddButton from "./AddButton";
import AddModifierDropdown from "./AddModifierDropdown";
import {
    Sword, Users, Skull, BookOpen, MapPin, Globe,
    Zap, Megaphone, Link2, EyeOff, CornerDownRight,
    Sparkles, Gem, Lightbulb, Flame, Target,
    Shield, Swords, Heart, Ban, Key, Trophy,
    Route, Flag, MinusCircle, UserX, ArrowUp, ArrowDown,
    FlaskConical, Gift, Star, MessageSquareWarning,
} from "lucide-react";

const ICON_CLASS = "inline w-4 h-4 align-baseline";

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

type Updater = (fn: (b: Beat) => Beat) => void;

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
// Prop-builder helpers — reduce repetitive callback wiring
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function entityFieldProps(field: string, update: Updater, pools: PoolData) {
    return {
        pools,
        onNameSwap: (v: MotifValue) => update((b) => ({...b, [field]: updateEntityName((b as any)[field], v)} as Beat)),
        onModSwap: (i: number, v: MotifValue) => update((b) => ({...b, [field]: updateEntityMod((b as any)[field], i, v)} as Beat)),
        onModRemove: (i: number) => update((b) => ({...b, [field]: removeEntityMod((b as any)[field], i)} as Beat)),
        onModAdd: (mod: Modifier) => update((b) => ({...b, [field]: addEntityMod((b as any)[field], mod)} as Beat)),
        modDefs: CHARACTER_MODIFIERS,
        maxMods: CHARACTER_MODIFIERS.length,
    };
}

function placeFieldProps(field: string, update: Updater, pools: PoolData) {
    return {
        pools,
        onNameSwap: (v: MotifValue) => update((b) => ({...b, [field]: updatePlaceName((b as any)[field], v)} as Beat)),
        onOriginSwap: (v: MotifValue) => update((b) => ({...b, [field]: updatePlaceOrigin((b as any)[field], v)} as Beat)),
        onModSwap: (i: number, v: MotifValue) => update((b) => ({...b, [field]: updatePlaceMod((b as any)[field], i, v)} as Beat)),
        onModRemove: (i: number) => update((b) => ({...b, [field]: removePlaceMod((b as any)[field], i)} as Beat)),
        onModAdd: (mod: Modifier) => update((b) => ({...b, [field]: addPlaceMod((b as any)[field], mod)} as Beat)),
        modDefs: PLACE_MODIFIERS,
        maxMods: PLACE_MODIFIERS.length,
    };
}

function motifArrayFieldProps(field: string, update: Updater, pools: PoolData, addPicker: () => MotifValue, maxItems: number) {
    return {
        pools,
        onSwap: (i: number, v: MotifValue) => update((b) => ({...b, [field]: updateMotifInArray((b as any)[field], i, v)} as Beat)),
        onRemove: (i: number) => update((b) => ({...b, [field]: removeFromMotifArray((b as any)[field], i)} as Beat)),
        onAdd: () => update((b) => ({...b, [field]: [...(b as any)[field], addPicker()]} as Beat)),
        maxItems,
    };
}

function entityArrayFieldProps(field: string, update: Updater, pools: PoolData, addPicker: () => Entity, maxEntities: number) {
    return {
        pools,
        onNameSwap: (ei: number, v: MotifValue) => update((b) => {
            const arr = [...(b as any)[field]]; arr[ei] = updateEntityName(arr[ei], v);
            return {...b, [field]: arr} as Beat;
        }),
        onModSwap: (ei: number, mi: number, v: MotifValue) => update((b) => {
            const arr = [...(b as any)[field]]; arr[ei] = updateEntityMod(arr[ei], mi, v);
            return {...b, [field]: arr} as Beat;
        }),
        onModRemove: (ei: number, mi: number) => update((b) => {
            const arr = [...(b as any)[field]]; arr[ei] = removeEntityMod(arr[ei], mi);
            return {...b, [field]: arr} as Beat;
        }),
        onModAdd: (ei: number, mod: Modifier) => update((b) => {
            const arr = [...(b as any)[field]]; arr[ei] = addEntityMod(arr[ei], mod);
            return {...b, [field]: arr} as Beat;
        }),
        onEntityRemove: (ei: number) => update((b) => ({...b, [field]: removeFromEntityArray((b as any)[field], ei)} as Beat)),
        onEntityAdd: () => update((b) => ({...b, [field]: [...(b as any)[field], addPicker()]} as Beat)),
        maxEntities,
        modDefs: CHARACTER_MODIFIERS,
        maxModsPerEntity: CHARACTER_MODIFIERS.length,
    };
}

function modListFieldProps(field: string, update: Updater, pools: PoolData, modDefs: readonly ModifierDef[]) {
    return {
        pools,
        onModSwap: (i: number, v: MotifValue) => update((b) => ({...b, [field]: updateModInArray((b as any)[field], i, v)} as Beat)),
        onModRemove: (i: number) => update((b) => ({...b, [field]: removeFromModArray((b as any)[field], i)} as Beat)),
        onModAdd: (mod: Modifier) => update((b) => ({...b, [field]: [...(b as any)[field], mod]} as Beat)),
        modDefs,
        maxMods: modDefs.length,
    };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Reusable display components
// ---------------------------------------------------------------------------

function MotifLine({label, value, icon, pools, onSwap}: {
    label: string;
    value: MotifValue;
    icon?: ReactNode;
    pools: PoolData;
    onSwap: (v: MotifValue) => void
}) {
    return (
        <div className="mb-1">
            <span className="text-xl label-text">{icon}{icon && " "}{label}:</span>{" "}
            <Motif value={value} pools={pools} onSwap={onSwap}/>
        </div>
    );
}

function TextLine({label, text, icon}: { label: string; text: string; icon?: ReactNode }) {
    return (
        <div className="mb-1">
            <span className="text-xl label-text">{icon}{icon && " "}{label}:</span>{" "}
            <span style={{color: "var(--foreground)"}}>{text}</span>
        </div>
    );
}

function OptionalMotif({label, value, icon, pools, onSwap, onRemove, onAdd}: {
    label: string;
    value: MotifValue | null;
    icon?: ReactNode;
    pools: PoolData;
    onSwap: (v: MotifValue) => void;
    onRemove: () => void;
    onAdd: () => void;
}) {
    if (value) {
        return (
            <div className="mb-1 flex items-baseline gap-1">
                <span className="text-xl label-text">{icon}{icon && " "}{label}:</span>{" "}
                <Motif value={value} pools={pools} onSwap={onSwap}/>
                <RemoveButton onClick={onRemove} title={`Remove ${label.toLowerCase()}`}/>
            </div>
        );
    }
    return <AddButton label={label.toLowerCase()} onClick={onAdd}/>;
}

function OptionalText({label, value, icon, onRemove, onAdd}: {
    label: string;
    value: string | null;
    icon?: ReactNode;
    onRemove: () => void;
    onAdd: () => void;
}) {
    if (value) {
        return (
            <div className="mb-1 flex items-baseline gap-1">
                <span className="text-xl label-text">{icon}{icon && " "}{label}:</span>{" "}
                <span style={{color: "var(--foreground)"}}>{value}</span>
                <RemoveButton onClick={onRemove} title={`Remove ${label.toLowerCase()}`}/>
            </div>
        );
    }
    return <AddButton label={label.toLowerCase()} onClick={onAdd}/>;
}

function TextArrayEditor({label, items, icon, onRemove, onAdd, maxItems}: {
    label: string;
    items: string[];
    icon?: ReactNode;
    onRemove: (index: number) => void;
    onAdd: () => void;
    maxItems: number;
}) {
    return (
        <div>
            {items.map((text, i) => (
                <div key={i} className="mb-1 flex items-baseline gap-1">
                    <span className="text-xl label-text">{icon}{icon && " "}{label}:</span>{" "}
                    <span style={{color: "var(--foreground)"}}>{text}</span>
                    <RemoveButton onClick={() => onRemove(i)} title={`Remove ${label.toLowerCase()}`}/>
                </div>
            ))}
            {items.length < maxItems && (
                <AddButton label={label.toLowerCase()} onClick={onAdd}/>
            )}
        </div>
    );
}

function OptionalModifier({label, mod, icon, field, pools, update, modDefs}: {
    label: string;
    mod: Modifier | null;
    icon?: ReactNode;
    field: string;
    pools: PoolData;
    update: Updater;
    modDefs: readonly ModifierDef[];
}) {
    if (mod) {
        return (
            <div className="mb-1 flex items-baseline gap-1">
                <span className="text-xl label-text">{icon}{icon && " "}{label}:</span>{" "}
                <span className="label-text">{mod.label}:</span>{" "}
                <Motif value={mod.value} pools={pools} onSwap={(v) =>
                    update((b) => ({...b, [field]: {...(b as any)[field], value: v}} as Beat))
                }/>
                <RemoveButton onClick={() => update((b) => ({...b, [field]: null} as Beat))}
                              title={`Remove ${label.toLowerCase()}`}/>
            </div>
        );
    }
    return (
        <div className="mb-1 flex items-baseline gap-1">
            <span className="text-xl label-text">{icon}{icon && " "}{label}:</span>{" "}
            <AddModifierDropdown
                availableModDefs={[...modDefs]}
                pools={pools}
                onAdd={(newMod) => update((b) => ({...b, [field]: newMod} as Beat))}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Beat content renderers
// ---------------------------------------------------------------------------

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export default function BeatCard({beat, beatIndex, story, pools, onStoryUpdate, onReroll}: BeatCardProps) {
    const update = (updater: (b: Beat) => Beat) => onStoryUpdate(updateBeat(story, beatIndex, updater));

    return (
        <div className="rounded-lg paper-card p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                    <span className="beat-marker">{ROMAN[beatIndex] ?? beatIndex + 1}</span>
                    <h2 className="text-2xl font-semibold beat-title">{beat.title}</h2>
                </div>
                <button
                    type="button"
                    onClick={onReroll}
                    className="text-xs px-2 py-1 rounded btn-outline cursor-pointer"
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
    update: Updater;
}) {
    switch (beat.type) {
        case "ordinary-world":
            return <OrdinaryWorldContent beat={beat} pools={pools} update={update}/>;
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
            return <RewardContent beat={beat} story={story} pools={pools} update={update}/>;
        case "road-back":
            return <RoadBackContent beat={beat} pools={pools} update={update}/>;
        case "resurrection":
            return <ResurrectionContent beat={beat} pools={pools} update={update}/>;
        case "elixir":
            return <ElixirContent beat={beat} pools={pools} update={update}/>;
    }
}

// ---------------------------------------------------------------------------
// Individual beat renderers
// ---------------------------------------------------------------------------

function OrdinaryWorldContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "ordinary-world" }>;
    pools: PoolData;
    update: Updater;
}) {
    return (
        <>
            <EntityDisplay label="Hero" entity={beat.hero}
                           icon={<Sword className={ICON_CLASS}/>}
                           {...entityFieldProps("hero", update, pools)}/>
            <EntityDisplay label="Initial Companion" entity={beat.companion} suffix=""
                           icon={<Users className={ICON_CLASS}/>}
                           {...entityFieldProps("companion", update, pools)}/>
            <EntityDisplay label="Villain" entity={beat.villain}
                           icon={<Skull className={ICON_CLASS}/>}
                           {...entityFieldProps("villain", update, pools)}/>
            <PlaceDisplay label="Original World" place={beat.originalWorld} suffix=""
                          icon={<MapPin className={ICON_CLASS}/>}
                          {...placeFieldProps("originalWorld", update, pools)}/>
        </>
    );
}

function CallToAdventureContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "call-to-adventure" }>;
    story: Story;
    pools: PoolData;
    update: Updater;
}) {
    const ordinaryWorld = story.beats[0] as Extract<Beat, { type: "ordinary-world" }>;

    return (
        <>
            <OptionalMotif label="Inciting" value={beat.inciting} pools={pools}
                           icon={<Zap className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, inciting: v} as Beat))}
                           onRemove={() => update((b) => ({...b, inciting: null} as Beat))}
                           onAdd={() => update((b) => ({...b, inciting: pickAny(pools, "Event", "Condition", "Outcome", "Action")} as Beat))}/>
            <OptionalMotif label="Herald" value={beat.herald} pools={pools}
                           icon={<Megaphone className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, herald: v} as Beat))}
                           onRemove={() => update((b) => ({...b, herald: null} as Beat))}
                           onAdd={() => update((b) => ({...b, herald: pickBeing(pools)} as Beat))}/>
            <MotifArrayEditor label="Has something to do with" items={beat.hasToDoWith}
                              icon={<Link2 className={ICON_CLASS}/>}
                              {...motifArrayFieldProps("hasToDoWith", update, pools, () => pickAnyMotif(pools), 5)}/>
            <OptionalMotif label="Lie told about" value={beat.lie} pools={pools}
                           icon={<EyeOff className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, lie: v} as Beat))}
                           onRemove={() => update((b) => ({...b, lie: null} as Beat))}
                           onAdd={() => update((b) => ({...b, lie: pickAnyMotif(pools)} as Beat))}/>
            <OptionalText label="Because of" value={beat.becauseOf}
                          icon={<CornerDownRight className={ICON_CLASS}/>}
                          onRemove={() => update((b) => ({...b, becauseOf: null} as Beat))}
                          onAdd={() => {
                              const value = pickModifierOf(
                                  ordinaryWorld.hero,
                                  {name: ordinaryWorld.originalWorld.name, mods: ordinaryWorld.originalWorld.mods},
                                  ordinaryWorld.villain,
                              );
                              if (value) update((b) => ({...b, becauseOf: value} as Beat));
                          }}/>
        </>
    );
}

function RefusalContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "refusal" }>;
    story: Story;
    pools: PoolData;
    update: Updater;
}) {
    const ordinaryWorld = story.beats[0] as Extract<Beat, { type: "ordinary-world" }>;

    return (
        <>
            <OptionalMotif label="Happens at Place" value={beat.place} pools={pools}
                           icon={<MapPin className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, place: v} as Beat))}
                           onRemove={() => update((b) => ({...b, place: null} as Beat))}
                           onAdd={() => update((b) => ({...b, place: pick(pools, "Place")} as Beat))}/>
            {beat.dissuade ? (
                <div className="flex items-start gap-1">
                    <EntityDisplay label="Dissuader" entity={beat.dissuade}
                                   icon={<Users className={ICON_CLASS}/>}
                                   {...entityFieldProps("dissuade", update, pools)}
                                   onRemove={() => update((b) => ({...b, dissuade: null} as Beat))}
                                   removeTitle="Remove dissuade"/>
                </div>
            ) : (
                <AddButton label="dissuade" onClick={() => update((b) => ({
                    ...b,
                    dissuade: makeEntity(pools, pickBeing(pools), CHARACTER_MODIFIERS, randInt(0, 3))
                } as Beat))}/>
            )}
            <MotifArrayEditor label="Has something to do with" items={beat.hasToDoWith}
                              icon={<Link2 className={ICON_CLASS}/>}
                              {...motifArrayFieldProps("hasToDoWith", update, pools, () => pickAnyMotif(pools), 5)}/>
            <OptionalText label="Because of" value={beat.becauseOf}
                          icon={<CornerDownRight className={ICON_CLASS}/>}
                          onRemove={() => update((b) => ({...b, becauseOf: null} as Beat))}
                          onAdd={() => {
                              const value = pickModifierOf(
                                  ordinaryWorld.hero, ordinaryWorld.companion, ordinaryWorld.villain,
                              );
                              if (value) update((b) => ({...b, becauseOf: value} as Beat));
                          }}/>
        </>
    );
}

function MentorContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "mentor" }>;
    story: Story;
    pools: PoolData;
    update: Updater;
}) {
    const ordinaryWorld = story.beats[0] as Extract<Beat, { type: "ordinary-world" }>;
    const threshold = story.beats[4] as Extract<Beat, { type: "threshold" }>;

    return (
        <>
            <EntityDisplay label="Mentor" entity={beat.mentor}
                           icon={<BookOpen className={ICON_CLASS}/>}
                           {...entityFieldProps("mentor", update, pools)}/>
            <MotifLine label="Place" value={beat.place} pools={pools}
                       icon={<MapPin className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, place: v} as Beat))}/>
            <OptionalMotif label="Supernatural Being" value={beat.supernaturalBeing} pools={pools}
                           icon={<Sparkles className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, supernaturalBeing: v} as Beat))}
                           onRemove={() => update((b) => ({...b, supernaturalBeing: null} as Beat))}
                           onAdd={() => update((b) => ({...b, supernaturalBeing: pickSupernatural(pools)} as Beat))}/>
            <MotifArrayEditor label="Talisman gained" items={beat.talismans}
                              icon={<Gem className={ICON_CLASS}/>}
                              {...motifArrayFieldProps("talismans", update, pools, () => pick(pools, "Object"), 5)}/>
            <OptionalText label="Learns about" value={beat.learnsAbout}
                          icon={<Lightbulb className={ICON_CLASS}/>}
                          onRemove={() => update((b) => ({...b, learnsAbout: null} as Beat))}
                          onAdd={() => {
                              const value = pickModifierOf(ordinaryWorld.villain, threshold.otherWorld, ordinaryWorld.hero)
                                  ?? pickAny(pools, "Event", "Condition", "Outcome", "Action", "Attribute").text;
                              update((b) => ({...b, learnsAbout: value} as Beat));
                          }}/>
            <OptionalMotif label="Trial" value={beat.trial} pools={pools}
                           icon={<Flame className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, trial: v} as Beat))}
                           onRemove={() => update((b) => ({...b, trial: null} as Beat))}
                           onAdd={() => update((b) => ({...b, trial: pickAny(pools, "Event", "Condition", "Outcome", "Action")} as Beat))}/>
            <OptionalModifier label="Hero gains modifier" mod={beat.heroGainsMod}
                              icon={<ArrowUp className={ICON_CLASS}/>}
                              field="heroGainsMod" pools={pools} update={update}
                              modDefs={CHARACTER_MODIFIERS}/>
            <OptionalModifier label="Hero loses modifier" mod={beat.heroLosesMod}
                              icon={<ArrowDown className={ICON_CLASS}/>}
                              field="heroLosesMod" pools={pools} update={update}
                              modDefs={CHARACTER_MODIFIERS}/>
        </>
    );
}

function ThresholdContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "threshold" }>;
    pools: PoolData;
    update: Updater;
}) {
    return (
        <>
            <OptionalMotif label="Has something to do with" value={beat.hasToDoWith} pools={pools}
                           icon={<Link2 className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, hasToDoWith: v} as Beat))}
                           onRemove={() => update((b) => ({...b, hasToDoWith: null} as Beat))}
                           onAdd={() => update((b) => ({...b, hasToDoWith: pickAnyMotif(pools)} as Beat))}/>
            <OptionalMotif label="Companion conflict regarding" value={beat.companionConflict} pools={pools}
                           icon={<MessageSquareWarning className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, companionConflict: v} as Beat))}
                           onRemove={() => update((b) => ({...b, companionConflict: null} as Beat))}
                           onAdd={() => update((b) => ({...b, companionConflict: pickAny(pools, "Object", "Outcome", "Event", "Action", "Condition", "Attribute")} as Beat))}/>
            <PlaceDisplay label="Other World" place={beat.otherWorld} suffix=""
                          icon={<Globe className={ICON_CLASS}/>}
                          {...placeFieldProps("otherWorld", update, pools)}/>
        </>
    );
}

function TestsContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "tests" }>;
    pools: PoolData;
    update: Updater;
}) {
    const newAlly = () => makeEntity(pools, pickBeing(pools), CHARACTER_MODIFIERS, randInt(0, 3));
    const newEnemy = () => makeEntity(pools, pickBeing(pools), CHARACTER_MODIFIERS, randInt(0, 3));

    return (
        <>
            <MotifArrayEditor label="Test" items={beat.tests}
                              icon={<Target className={ICON_CLASS}/>}
                              {...motifArrayFieldProps("tests", update, pools, () => pickAny(pools, "Event", "Condition", "Outcome", "Action"), 5)}/>
            <EntityArrayEditor groupLabel="Allies" entities={beat.allies}
                               icon={<Shield className={ICON_CLASS}/>}
                               {...entityArrayFieldProps("allies", update, pools, newAlly, 5)}/>
            <EntityArrayEditor groupLabel="Enemies" entities={beat.enemies}
                               icon={<Swords className={ICON_CLASS}/>}
                               {...entityArrayFieldProps("enemies", update, pools, newEnemy, 5)}/>
        </>
    );
}

function CaveContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "cave" }>;
    pools: PoolData;
    update: Updater;
}) {
    return (
        <>
            <MotifLine label="Place" value={beat.place} pools={pools}
                       icon={<MapPin className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, place: v} as Beat))}/>
            <MotifArrayEditor label="To Rescue" items={beat.toRescue}
                              icon={<Heart className={ICON_CLASS}/>}
                              {...motifArrayFieldProps("toRescue", update, pools, () => pickBeing(pools), 4)}/>
            <OptionalMotif label="To Get Object (Talisman)" value={beat.toGetTalisman} pools={pools}
                           icon={<Gem className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, toGetTalisman: v} as Beat))}
                           onRemove={() => update((b) => ({...b, toGetTalisman: null} as Beat))}
                           onAdd={() => update((b) => ({...b, toGetTalisman: pick(pools, "Object")} as Beat))}/>
            <OptionalMotif label="Cursed (Bane)" value={beat.cursedBane} pools={pools}
                           icon={<Ban className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, cursedBane: v} as Beat))}
                           onRemove={() => update((b) => ({...b, cursedBane: null} as Beat))}
                           onAdd={() => update((b) => ({...b, cursedBane: pick(pools, "Object")} as Beat))}/>
            <OptionalMotif label="To Undergo" value={beat.toUndergo} pools={pools}
                           icon={<Flame className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, toUndergo: v} as Beat))}
                           onRemove={() => update((b) => ({...b, toUndergo: null} as Beat))}
                           onAdd={() => update((b) => ({...b, toUndergo: pickAny(pools, "Event", "Condition", "Outcome", "Action")} as Beat))}/>
        </>
    );
}

function OrdealContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "ordeal" }>;
    story: Story;
    pools: PoolData;
    update: Updater;
}) {
    const ordinaryWorld = story.beats[0] as Extract<Beat, { type: "ordinary-world" }>;

    return (
        <>
            <MotifLine label="Confronts Villain(s) at Place" value={beat.place} pools={pools}
                       icon={<Swords className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, place: v} as Beat))}/>
            <ModifierList mods={beat.placeMods}
                          {...modListFieldProps("placeMods", update, pools, PLACE_MODIFIERS)}/>
            <MotifArrayEditor label="Has something to do with" items={beat.hasToDoWith}
                              icon={<Link2 className={ICON_CLASS}/>}
                              {...motifArrayFieldProps("hasToDoWith", update, pools, () => pickAnyMotif(pools), 4)}/>
            <TextArrayEditor
                label="Hinges on"
                icon={<Key className={ICON_CLASS}/>}
                items={beat.hingesOn}
                onRemove={(i) => update((b) => ({
                    ...b,
                    hingesOn: (b as Extract<Beat, { type: "ordeal" }>).hingesOn.filter((_, idx) => idx !== i)
                } as Beat))}
                onAdd={() => {
                    const value = pickModifierOf(ordinaryWorld.villain, ordinaryWorld.hero);
                    if (value) {
                        update((b) => ({
                            ...b,
                            hingesOn: [...(b as Extract<Beat, { type: "ordeal" }>).hingesOn, value]
                        } as Beat));
                    }
                }}
                maxItems={2}
            />
            <OptionalModifier label="Hero gains modifier" mod={beat.heroGainsMod}
                              icon={<ArrowUp className={ICON_CLASS}/>}
                              field="heroGainsMod" pools={pools} update={update}
                              modDefs={CHARACTER_MODIFIERS}/>
            <OptionalModifier label="Hero loses modifier" mod={beat.heroLosesMod}
                              icon={<ArrowDown className={ICON_CLASS}/>}
                              field="heroLosesMod" pools={pools} update={update}
                              modDefs={CHARACTER_MODIFIERS}/>
        </>
    );
}

function RewardContent({beat, story, pools, update}: {
    beat: Extract<Beat, { type: "reward" }>;
    story: Story;
    pools: PoolData;
    update: Updater;
}) {
    const tests = story.beats[5] as Extract<Beat, { type: "tests" }>;
    const mentor = story.beats[3] as Extract<Beat, { type: "mentor" }>;

    return (
        <>
            <MotifLine label="Reward" value={beat.reward} pools={pools}
                       icon={<Trophy className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, reward: v} as Beat))}/>
            <MotifLine label="Hero becomes" value={beat.heroBecomes} pools={pools}
                       icon={<Sparkles className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, heroBecomes: v} as Beat))}/>
            <MotifLine label="Has something to do with" value={beat.hasToDoWith} pools={pools}
                       icon={<Link2 className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, hasToDoWith: v} as Beat))}/>
            <OptionalText label="Loss of" value={beat.lossOf}
                          icon={<MinusCircle className={ICON_CLASS}/>}
                          onRemove={() => update((b) => ({...b, lossOf: null} as Beat))}
                          onAdd={() => {
                              const allies = tests.allies;
                              const talismans = mentor.talismans;
                              const value = maybe()
                                  ? (allies.length > 0 ? pickOne(allies).name.text : null)
                                  : (talismans.length > 0 ? pickOne(talismans).text : null);
                              if (value) update((b) => ({...b, lossOf: value} as Beat));
                          }}/>
        </>
    );
}

function RoadBackContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "road-back" }>;
    pools: PoolData;
    update: Updater;
}) {
    return (
        <>
            <MotifLine label="Goes through Place" value={beat.place} pools={pools}
                       icon={<Route className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, place: v} as Beat))}/>
            <ModifierList mods={beat.placeMods}
                          {...modListFieldProps("placeMods", update, pools, PLACE_MODIFIERS)}/>
            <OptionalMotif label="Accompanied by" value={beat.accompaniedBy} pools={pools}
                           icon={<Users className={ICON_CLASS}/>}
                           onSwap={(v) => update((b) => ({...b, accompaniedBy: v} as Beat))}
                           onRemove={() => update((b) => ({...b, accompaniedBy: null} as Beat))}
                           onAdd={() => update((b) => ({...b, accompaniedBy: maybe() ? pick(pools, "Object") : pickBeing(pools)} as Beat))}/>
            <OptionalModifier label="Original World gained modifier" mod={beat.originalWorldMod}
                              icon={<MapPin className={ICON_CLASS}/>}
                              field="originalWorldMod" pools={pools} update={update}
                              modDefs={PLACE_MODIFIERS}/>
        </>
    );
}

function ResurrectionContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "resurrection" }>;
    pools: PoolData;
    update: Updater;
}) {
    return (
        <>
            <MotifLine label="Has to contend with" value={beat.contendWith} pools={pools}
                       icon={<Swords className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, contendWith: v} as Beat))}/>
            <MotifLine label="To achieve" value={beat.toAchieve} pools={pools}
                       icon={<Flag className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, toAchieve: v} as Beat))}/>
            <OptionalModifier label="Hero gains modifier" mod={beat.heroGainsMod}
                              icon={<ArrowUp className={ICON_CLASS}/>}
                              field="heroGainsMod" pools={pools} update={update}
                              modDefs={CHARACTER_MODIFIERS}/>
            <OptionalModifier label="Hero loses modifier" mod={beat.heroLosesMod}
                              icon={<ArrowDown className={ICON_CLASS}/>}
                              field="heroLosesMod" pools={pools} update={update}
                              modDefs={CHARACTER_MODIFIERS}/>
        </>
    );
}

function ElixirContent({beat, pools, update}: {
    beat: Extract<Beat, { type: "elixir" }>;
    pools: PoolData;
    update: Updater;
}) {
    return (
        <>
            <MotifLine label="Elixir" value={beat.elixir} pools={pools}
                       icon={<FlaskConical className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, elixir: v} as Beat))}/>
            {/*<MotifLine label="Returns to" value={beat.returnsTo} pools={pools}*/}
            {/*           icon={<MapPin className={ICON_CLASS}/>}*/}
            {/*           onSwap={(v) => update((b) => ({...b, returnsTo: v} as Beat))}/>*/}
            <MotifLine label="Transformation" value={beat.transformation} pools={pools}
                       icon={<Sparkles className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, transformation: v} as Beat))}/>
            <MotifLine label="Resolution" value={beat.resolution} pools={pools}
                       icon={<Star className={ICON_CLASS}/>}
                       onSwap={(v) => update((b) => ({...b, resolution: v} as Beat))}/>
        </>
    );
}
