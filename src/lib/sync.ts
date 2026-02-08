import type {
    Beat,
    CallToAdventureBeat,
    Entity,
    MentorBeat,
    Modifier,
    OrdealBeat,
    OrdinaryWorldBeat,
    Place,
    RefusalBeat,
    Story,
    TestsBeat,
    ThresholdBeat,
} from "./types";

// ---------------------------------------------------------------------------
// Derived-field sync: keeps "Because of", "Learns about", "Hinges on"
// in sync with source entity names and modifier values.
// ---------------------------------------------------------------------------

/** Regex matching the output of pickModifierOf: `{name}'s "{label}: {value}"` */
const DERIVED_RE = /^(.+)'s "(.+): (.+)"$/;

interface NamedSource {
    name: string;
    mods: Modifier[];
}

function entitySource(e: Entity): NamedSource {
    return {name: e.name.text, mods: e.mods};
}

function placeSource(p: Place): NamedSource {
    return {name: p.name.text, mods: p.mods};
}

function formatDerived(name: string, label: string, value: string): string {
    return `${name}'s "${label}: ${value}"`;
}

/**
 * Try to resolve a derived string against old/new source entity pairs.
 *
 * Returns:
 *  - updated string  → mod still exists, rebuilt with current name/value
 *  - null            → mod was removed, caller should drop the entry
 *  - undefined       → couldn't parse or match, leave as-is
 */
function resolveDerived(
    text: string,
    oldSources: NamedSource[],
    newSources: NamedSource[],
): string | null | undefined {
    const m = DERIVED_RE.exec(text);
    if (!m) return undefined;

    const [, parsedName, parsedLabel] = m;

    // Pass 1: match by entity name + mod label
    for (let i = 0; i < oldSources.length; i++) {
        if (oldSources[i].name !== parsedName) continue;
        if (!oldSources[i].mods.some((mod) => mod.label === parsedLabel)) continue;

        const newMod = newSources[i].mods.find((mod) => mod.label === parsedLabel);
        if (!newMod) return null; // mod removed
        return formatDerived(newSources[i].name, newMod.label, newMod.value.text);
    }

    // Pass 2: for entities whose name changed, match by label + old value
    const parsedValue = m[3];
    for (let i = 0; i < oldSources.length; i++) {
        if (oldSources[i].name === newSources[i].name) continue; // name unchanged, already tried
        const oldMod = oldSources[i].mods.find(
            (mod) => mod.label === parsedLabel && mod.value.text === parsedValue,
        );
        if (!oldMod) continue;

        const newMod = newSources[i].mods.find((mod) => mod.label === parsedLabel);
        if (!newMod) return null;
        return formatDerived(newSources[i].name, newMod.label, newMod.value.text);
    }

    return undefined;
}

function sourcesChanged(a: NamedSource[], b: NamedSource[]): boolean {
    for (let i = 0; i < a.length; i++) {
        if (a[i].name !== b[i].name) return true;
        if (a[i].mods.length !== b[i].mods.length) return true;
        for (let j = 0; j < a[i].mods.length; j++) {
            const am = a[i].mods[j];
            const bm = b[i].mods[j];
            if (am.label !== bm.label || am.value.text !== bm.value.text) return true;
        }
    }
    return false;
}

/**
 * Synchronise a story after an edit:
 * 1. Keeps top-level shared entities in sync with their source beats.
 * 2. Updates derived string fields when source entity names/mods change.
 */
export function syncStory(oldStory: Story, newStory: Story): Story {
    const newBeat0 = newStory.beats[0] as OrdinaryWorldBeat;
    const newBeat3 = newStory.beats[3] as MentorBeat;
    const newBeat4 = newStory.beats[4] as ThresholdBeat;
    const newBeat5 = newStory.beats[5] as TestsBeat;

    // Always sync top-level shared entities from their source beats
    let result: Story = {
        ...newStory,
        hero: newBeat0.hero,
        villain: newBeat0.villain,
        companion: newBeat0.companion,
        originalWorld: newBeat0.originalWorld,
        otherWorld: newBeat4.otherWorld,
        allies: newBeat5.allies,
        talismans: newBeat3.talismans,
    };

    // Build old/new source pairs for derived-field sync
    const oldBeat0 = oldStory.beats[0] as OrdinaryWorldBeat;
    const oldBeat4 = oldStory.beats[4] as ThresholdBeat;

    const oldSources: NamedSource[] = [
        entitySource(oldBeat0.hero),
        entitySource(oldBeat0.villain),
        entitySource(oldBeat0.companion),
        placeSource(oldBeat0.originalWorld),
        placeSource(oldBeat4.otherWorld),
    ];
    const newSources: NamedSource[] = [
        entitySource(newBeat0.hero),
        entitySource(newBeat0.villain),
        entitySource(newBeat0.companion),
        placeSource(newBeat0.originalWorld),
        placeSource(newBeat4.otherWorld),
    ];

    if (!sourcesChanged(oldSources, newSources)) return result;

    const beats = [...result.beats];

    // Beat 1 — call-to-adventure.becauseOf
    const beat1 = beats[1] as CallToAdventureBeat;
    if (beat1.becauseOf) {
        const r = resolveDerived(beat1.becauseOf, oldSources, newSources);
        if (r !== undefined) beats[1] = {...beat1, becauseOf: r};
    }

    // Beat 2 — refusal.becauseOf
    const beat2 = beats[2] as RefusalBeat;
    if (beat2.becauseOf) {
        const r = resolveDerived(beat2.becauseOf, oldSources, newSources);
        if (r !== undefined) beats[2] = {...beat2, becauseOf: r};
    }

    // Beat 3 — mentor.learnsAbout
    const beat3 = beats[3] as MentorBeat;
    if (beat3.learnsAbout) {
        const lr = resolveDerived(beat3.learnsAbout, oldSources, newSources);
        if (lr !== undefined) beats[3] = {...beat3, learnsAbout: lr};
    }

    // Beat 7 — ordeal.hingesOn[]
    const beat7 = beats[7] as OrdealBeat;
    if (beat7.hingesOn.length > 0) {
        const updated: string[] = [];
        for (const h of beat7.hingesOn) {
            const r = resolveDerived(h, oldSources, newSources);
            if (r === undefined) updated.push(h);      // couldn't match — keep
            else if (r !== null) updated.push(r);       // updated
            // r === null → mod removed, drop entry
        }
        beats[7] = {...beat7, hingesOn: updated};
    }

    return {...result, beats};
}
