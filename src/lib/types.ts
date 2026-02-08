// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type Category =
    | "Action"
    | "Place"
    | "Event"
    | "Object"
    | "Origin"
    | "Attribute"
    | "Condition"
    | "Outcome";

export type BeingSubcategory =
    | "Human"
    | "Spirit"
    | "Animal"
    | "Deity"
    | "Monster"
    | "Witch/Sorcerer";

/** Any valid key for the motif lookup map */
export type MotifPool = Category | BeingSubcategory | "Being";

/** Pre-processed motif data: pool key → motif name strings */
export type PoolData = Record<string, string[]>;

// ---------------------------------------------------------------------------
// Story value types — each carries pool metadata for swapping
// ---------------------------------------------------------------------------

/** A motif value that remembers its source pool */
export interface MotifValue {
    text: string;
    pool: MotifPool;
    preferred?: BeingSubcategory;
}

export interface Modifier {
    label: string;
    value: MotifValue;
}

export interface Entity {
    name: MotifValue;
    mods: Modifier[];
}

export interface Place {
    name: MotifValue;
    origin: MotifValue;
    mods: Modifier[];
}

// ---------------------------------------------------------------------------
// Modifier definition
// ---------------------------------------------------------------------------

export interface ModifierDef {
    label: string;
    picker: (pools: PoolData) => MotifValue;
}

// ---------------------------------------------------------------------------
// Beat types — discriminated union
// ---------------------------------------------------------------------------

export interface OrdinaryWorldBeat {
    type: "ordinary-world";
    title: "The Ordinary World";
    hero: Entity;
    companion: Entity;
    villain: Entity;
    originalWorld: Place;
}

export interface CallToAdventureBeat {
    type: "call-to-adventure";
    title: "The Call to Adventure";
    inciting: MotifValue | null;
    herald: MotifValue | null;
    hasToDoWith: MotifValue[];
    lie: MotifValue | null;
    becauseOf: string | null;
}

export interface RefusalBeat {
    type: "refusal";
    title: "Refusal of the Call";
    place: MotifValue;
    hasToDoWith: MotifValue[];
    becauseOf: string | null;
}

export interface MentorBeat {
    type: "mentor";
    title: "Meeting the Mentor";
    mentor: Entity;
    place: MotifValue;
    supernaturalBeing: MotifValue | null;
    talismans: MotifValue[];
    learnsAbout: string | null;
    trial: MotifValue | null;
}

export interface ThresholdBeat {
    type: "threshold";
    title: "Crossing the First Threshold";
    hasToDoWith: MotifValue | null;
    otherWorld: Place;
}

export interface TestsBeat {
    type: "tests";
    title: "Tests, Allies, and Enemies";
    tests: MotifValue[];
    allies: Entity[];
    enemies: Entity[];
}

export interface CaveBeat {
    type: "cave";
    title: "Approach to the Inmost Cave";
    place: MotifValue;
    toRescue: MotifValue[];
    toGetTalisman: MotifValue | null;
    cursedBane: MotifValue | null;
    toUndergo: MotifValue | null;
}

export interface OrdealBeat {
    type: "ordeal";
    title: "The Ordeal";
    place: MotifValue;
    placeMods: Modifier[];
    hasToDoWith: MotifValue[];
    hingesOn: string[];
}

export interface RewardBeat {
    type: "reward";
    title: "Reward";
    reward: MotifValue;
    heroBecomes: MotifValue;
    hasToDoWith: MotifValue;
    lossOf: string | null;
}

export interface RoadBackBeat {
    type: "road-back";
    title: "The Road Back to Original World";
    place: MotifValue;
    placeMods: Modifier[];
    accompaniedBy: MotifValue;
}

export interface ResurrectionBeat {
    type: "resurrection";
    title: "The Resurrection";
    contendWith: MotifValue;
    toAchieve: MotifValue;
}

export type Beat =
    | OrdinaryWorldBeat
    | CallToAdventureBeat
    | RefusalBeat
    | MentorBeat
    | ThresholdBeat
    | TestsBeat
    | CaveBeat
    | OrdealBeat
    | RewardBeat
    | RoadBackBeat
    | ResurrectionBeat;

// ---------------------------------------------------------------------------
// Story — the top-level structure
// ---------------------------------------------------------------------------

export interface Story {
    beats: Beat[];
    // Shared entities referenced across beats
    hero: Entity;
    villain: Entity;
    companion: Entity;
    originalWorld: Place;
    otherWorld: Place;
    allies: Entity[];
    talismans: MotifValue[];
}
