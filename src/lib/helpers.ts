import type {
    BeingSubcategory,
    Entity,
    Modifier,
    ModifierDef,
    MotifPool,
    MotifValue,
    Place,
    PoolData,
} from "./types";

// ---------------------------------------------------------------------------
// Randomness primitives
// ---------------------------------------------------------------------------

export function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function maybe(probability = 0.5): boolean {
    return Math.random() < probability;
}

export function pickOne<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Motif picking
// ---------------------------------------------------------------------------

export function pick(pools: PoolData, pool: MotifPool): MotifValue {
    const arr = pools[pool] ?? [];
    const text = arr.length > 0 ? pickOne(arr) : `[unknown ${pool}]`;
    return {text, pool};
}

export function pickBeing(pools: PoolData, preferred?: BeingSubcategory): MotifValue {
    if (preferred && maybe(0.7)) {
        return {...pick(pools, preferred), preferred};
    }
    return {...pick(pools, "Being"), preferred};
}

export function pickAny(pools: PoolData, ...motifPools: MotifPool[]): MotifValue {
    return pick(pools, pickOne(motifPools));
}

const SUPERNATURAL_SUBS: readonly BeingSubcategory[] = [
    "Witch/Sorcerer", "Deity", "Monster", "Spirit",
];

export function pickSupernatural(pools: PoolData): MotifValue {
    return pickBeing(pools, pickOne(SUPERNATURAL_SUBS));
}

export function pickAnyMotif(pools: PoolData): MotifValue {
    return pickAny(pools, "Event", "Condition", "Outcome", "Action", "Object", "Place", "Origin", "Attribute");
}

// ---------------------------------------------------------------------------
// Modifier application
// ---------------------------------------------------------------------------

export function applyModifiers(pools: PoolData, pool: readonly ModifierDef[], count: number): Modifier[] {
    count = Math.min(count, pool.length);
    const used = new Set<number>();
    const results: Modifier[] = [];
    for (let i = 0; i < count; i++) {
        let idx: number;
        let attempts = 0;
        do {
            idx = randInt(0, pool.length - 1);
            attempts++;
        } while (used.has(idx) && attempts < 50);
        used.add(idx);
        results.push({label: pool[idx].label, value: pool[idx].picker(pools)});
    }
    return results;
}

// ---------------------------------------------------------------------------
// Cross-referencing
// ---------------------------------------------------------------------------

export interface NamedWithMods {
    name: string | MotifValue;
    mods: Modifier[];
}

export function pickModifierOf(...entities: NamedWithMods[]): string | null {
    const withMods = entities.filter((e) => e.mods.length > 0);
    if (withMods.length === 0) return null;
    const entity = pickOne(withMods);
    const mod = pickOne(entity.mods);
    const name = typeof entity.name === "string" ? entity.name : entity.name.text;
    return `${name}'s "${mod.label}: ${mod.value.text}"`;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function makeEntity(pools: PoolData, name: MotifValue, modPool: readonly ModifierDef[], modCount: number): Entity {
    return {name, mods: applyModifiers(pools, modPool, modCount)};
}

export function makePlace(pools: PoolData, modPool: readonly ModifierDef[], modCount: number): Place {
    return {
        name: pick(pools, "Place"),
        origin: pick(pools, "Origin"),
        mods: applyModifiers(pools, modPool, modCount),
    };
}
