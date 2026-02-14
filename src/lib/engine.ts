import type {
    Beat,
    CallToAdventureBeat,
    CaveBeat,
    ElixirBeat,
    Entity,
    Modifier,
    MotifValue,
    OrdealBeat,
    OrdinaryWorldBeat,
    MentorBeat,
    Place,
    PoolData,
    RefusalBeat,
    ResurrectionBeat,
    RewardBeat,
    RoadBackBeat,
    Story,
    TestsBeat,
    ThresholdBeat,
} from "./types";
import {
    applyModifiers,
    makeEntity,
    makePlace,
    maybe,
    pick,
    pickAny,
    pickAnyMotif,
    pickBeing,
    pickModifierOf,
    pickOne,
    pickSupernatural,
    randInt,
} from "./helpers";
import {CHARACTER_MODIFIERS, PLACE_MODIFIERS} from "./modifiers";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function randomCharMod(pools: PoolData): Modifier {
    const def = pickOne(CHARACTER_MODIFIERS);
    return {label: def.label, value: def.picker(pools)};
}

// ---------------------------------------------------------------------------
// Per-beat generation functions
// ---------------------------------------------------------------------------

function generateOrdinaryWorld(pools: PoolData): OrdinaryWorldBeat {
    const hero = makeEntity(pools, pickBeing(pools, "Human"), CHARACTER_MODIFIERS, randInt(2, 5));
    const companion = makeEntity(pools, pickBeing(pools, "Human"), CHARACTER_MODIFIERS, randInt(1, 3));
    const villain = makeEntity(pools, pickBeing(pools), CHARACTER_MODIFIERS, randInt(2, 4));

    if (maybe()) {
        const sharedTrait: Modifier = {
            label: "hero and villain share the trait",
            value: pick(pools, "Condition"),
        };
        hero.mods.push(sharedTrait);
        villain.mods.push(sharedTrait);
    }

    const originalWorld = makePlace(pools, PLACE_MODIFIERS, randInt(2, 5));

    return {type: "ordinary-world", title: "The Ordinary World", hero, companion, villain, originalWorld};
}

function generateCallToAdventure(
    pools: PoolData,
    hero: Entity,
    villain: Entity,
    originalWorld: Place,
): CallToAdventureBeat {
    const inciting = maybe() ? pickAny(pools, "Event", "Condition", "Outcome", "Action") : null;
    const herald = maybe() ? pickBeing(pools, maybe() ? "Spirit" : "Animal") : null;
    const hasToDoWith: MotifValue[] = Array.from({length: randInt(1, 3)}, () => pickAnyMotif(pools));
    const lie = maybe() ? pickAnyMotif(pools) : null;
    const becauseOf = maybe()
        ? pickModifierOf(hero, {name: originalWorld.name, mods: originalWorld.mods}, villain)
        : null;

    return {type: "call-to-adventure", title: "The Call to Adventure", inciting, herald, hasToDoWith, lie, becauseOf};
}

function generateRefusal(
    pools: PoolData,
    hero: Entity,
    companion: Entity,
    villain: Entity,
): RefusalBeat {
    const place: MotifValue | null = pick(pools, "Place");
    const dissuade = maybe() ? makeEntity(pools, pickBeing(pools), CHARACTER_MODIFIERS, randInt(0, 3)) : null;
    const hasToDoWith: MotifValue[] = Array.from({length: randInt(1, 3)}, () => pickAnyMotif(pools));
    const becauseOf = maybe() ? pickModifierOf(hero, companion, villain) : null;

    return {type: "refusal", title: "Refusal of the Call", place, dissuade, hasToDoWith, becauseOf};
}

function generateMentor(
    pools: PoolData,
    hero: Entity,
    villain: Entity,
    otherWorld: Place,
): MentorBeat {
    const mentor = makeEntity(pools, pickSupernatural(pools), CHARACTER_MODIFIERS, randInt(1, 3));
    const place = pick(pools, "Place");
    const supernaturalBeing = maybe() ? pickSupernatural(pools) : null;
    const talismans: MotifValue[] = Array.from({length: randInt(1, 3)}, () => pick(pools, "Object"));
    const learnsAbout = pickModifierOf(villain, otherWorld, hero)
        ?? pickAny(pools, "Event", "Condition", "Outcome", "Action", "Attribute").text;
    const trial = maybe() ? pickAny(pools, "Event", "Condition", "Outcome", "Action") : null;

    const heroGainsMod = maybe() ? randomCharMod(pools) : null;
    const heroLosesMod = maybe() ? randomCharMod(pools) : null;

    return {type: "mentor", title: "Meeting the Mentor", mentor, place, supernaturalBeing, talismans, learnsAbout, trial, heroGainsMod, heroLosesMod};
}

function generateThreshold(pools: PoolData, otherWorld: Place): ThresholdBeat {
    const hasToDoWith = maybe() ? pickAnyMotif(pools) : null;
    const companionConflict = maybe() ? pickAny(pools, "Object", "Outcome", "Event", "Action", "Condition", "Attribute") : null;
    return {type: "threshold", title: "Crossing the First Threshold", hasToDoWith, companionConflict, otherWorld};
}

function generateTests(pools: PoolData): TestsBeat {
    const tests: MotifValue[] = Array.from(
        {length: randInt(1, 3)}, () => pickAny(pools, "Event", "Condition", "Outcome", "Action"),
    );
    const allies: Entity[] = Array.from(
        {length: randInt(1, 3)},
        () => makeEntity(pools, pickBeing(pools), CHARACTER_MODIFIERS, randInt(0, 3)),
    );
    const enemies: Entity[] = Array.from(
        {length: randInt(1, 3)},
        () => makeEntity(pools, pickBeing(pools), CHARACTER_MODIFIERS, randInt(0, 3)),
    );
    return {type: "tests", title: "Tests, Allies, and Enemies", tests, allies, enemies};
}

function generateCave(pools: PoolData, allies: Entity[]): CaveBeat {
    const place = pick(pools, "Place");
    const toRescue: MotifValue[] = Array.from(
        {length: randInt(0, 2)},
        () => maybe() ? pickBeing(pools) : pickOne(allies).name,
    );
    const toGetTalisman = maybe() ? pick(pools, "Object") : null;
    const cursedBane = maybe() ? pick(pools, "Object") : null;
    const toUndergo = maybe() ? pickAny(pools, "Event", "Condition", "Outcome", "Action") : null;

    return {type: "cave", title: "Approach to the Inmost Cave", place, toRescue, toGetTalisman, cursedBane, toUndergo};
}

function generateOrdeal(
    pools: PoolData,
    hero: Entity,
    villain: Entity,
    talismans: MotifValue[],
): OrdealBeat {
    const place = pick(pools, "Place");
    const placeMods = applyModifiers(pools, PLACE_MODIFIERS, randInt(0, 2));
    const hasToDoWith: MotifValue[] = Array.from({length: randInt(0, 2)}, () => pickAnyMotif(pools));
    const hingesOn: string[] = Array.from(
        {length: randInt(0, 2)},
        () => pickModifierOf(villain, hero) ?? `**${talismans[0]?.text ?? "unknown talisman"}**`,
    );

    const heroGainsMod = maybe() ? randomCharMod(pools) : null;
    const heroLosesMod = maybe() ? randomCharMod(pools) : null;

    return {type: "ordeal", title: "The Ordeal", place, placeMods, hasToDoWith, hingesOn, heroGainsMod, heroLosesMod};
}

function generateReward(
    pools: PoolData,
    allies: Entity[],
    talismans: MotifValue[],
): RewardBeat {
    const reward = pick(pools, "Object");
    const heroBecomes = maybe() ? pickBeing(pools) : pick(pools, "Condition");
    const hasToDoWith = pickAnyMotif(pools);
    const lossOf = maybe()
        ? (maybe() ? pickOne(allies).name.text : (talismans.length > 0 ? pickOne(talismans).text : null))
        : null;

    return {type: "reward", title: "Reward", reward, heroBecomes, hasToDoWith, lossOf};
}

function generateRoadBack(pools: PoolData): RoadBackBeat {
    const place = pick(pools, "Place");
    const placeMods = applyModifiers(pools, PLACE_MODIFIERS, randInt(1, 3));
    const accompaniedBy: MotifValue | null = maybe() ? pick(pools, "Object") : pickBeing(pools);
    const originalWorldMod = maybe() ? (() => {
        const def = pickOne(PLACE_MODIFIERS);
        return {label: def.label, value: def.picker(pools)};
    })() : null;

    return {type: "road-back", title: "The Road Back to Original World", place, placeMods, accompaniedBy, originalWorldMod};
}

function generateResurrection(pools: PoolData): ResurrectionBeat {
    const contendWith = pickAny(pools, "Being", "Event", "Condition", "Outcome", "Action");
    const toAchieve = pickAny(pools, "Being", "Outcome", "Event", "Condition", "Action");

    const heroGainsMod = maybe() ? randomCharMod(pools) : null;
    const heroLosesMod = maybe() ? randomCharMod(pools) : null;

    return {type: "resurrection", title: "The Resurrection", contendWith, toAchieve, heroGainsMod, heroLosesMod};
}

function generateElixir(pools: PoolData): ElixirBeat {
    const elixir = pick(pools, "Object");
    const returnsTo = pick(pools, "Place");
    const transformation = maybe() ? pickBeing(pools) : pick(pools, "Condition");
    const resolution = pickAny(pools, "Outcome", "Event", "Condition");

    return {type: "elixir", title: "Return with the Elixir", elixir, returnsTo, transformation, resolution};
}

// ---------------------------------------------------------------------------
// Full story generation
// ---------------------------------------------------------------------------

export function generateStory(pools: PoolData): Story {
    const beat1 = generateOrdinaryWorld(pools);
    const {hero, companion, villain, originalWorld} = beat1;

    // Generate Other World early (needed by mentor beat's "learns about")
    const otherWorld = makePlace(pools, PLACE_MODIFIERS, randInt(1, 3));

    const beat2 = generateCallToAdventure(pools, hero, villain, originalWorld);
    const beat3 = generateRefusal(pools, hero, companion, villain);
    const beat4 = generateMentor(pools, hero, villain, otherWorld);

    const beat5 = generateThreshold(pools, otherWorld);
    const beat6 = generateTests(pools);
    const {allies} = beat6;
    const talismans = beat4.talismans;

    const beat7 = generateCave(pools, allies);
    const beat8 = generateOrdeal(pools, hero, villain, talismans);
    const beat9 = generateReward(pools, allies, talismans);
    const beat10 = generateRoadBack(pools);
    const beat11 = generateResurrection(pools);
    const beat12 = generateElixir(pools);

    return {
        beats: [beat1, beat2, beat3, beat4, beat5, beat6, beat7, beat8, beat9, beat10, beat11, beat12],
        hero, villain, companion, originalWorld, otherWorld, allies, talismans,
    };
}

// ---------------------------------------------------------------------------
// Beat regeneration
// ---------------------------------------------------------------------------

/** Regenerate a single beat. If beat 1 changes, all subsequent beats are regenerated too. */
export function regenerateBeat(story: Story, beatIndex: number, pools: PoolData): Story {
    // Beat 0 (Ordinary World) changes the core entities — cascade everything
    if (beatIndex === 0) {
        return generateStory(pools);
    }

    const {hero, villain, companion, originalWorld, allies, talismans} = story;
    let otherWorld = story.otherWorld;
    const beats: Beat[] = [...story.beats];
    let currentAllies = allies;
    let currentTalismans = talismans;

    // For beats 1-10, regenerate the target beat and update dependencies
    for (let i = beatIndex; i < beats.length; i++) {
        // Only regenerate the target beat, unless dependencies changed
        if (i > beatIndex) {
            // Beats that depend on allies/talismans need updating if beat 5 (tests) was re-rolled
            const dependsOnAllies = i >= 6; // cave, ordeal, reward
            const alliesChanged = beatIndex === 5;
            const talismanChanged = beatIndex === 3;

            if (!dependsOnAllies || (!alliesChanged && !talismanChanged)) {
                continue;
            }
        }

        switch (i) {
            case 1:
                beats[1] = generateCallToAdventure(pools, hero, villain, originalWorld);
                break;
            case 2:
                beats[2] = generateRefusal(pools, hero, companion, villain);
                break;
            case 3: {
                otherWorld = (i === beatIndex) ? makePlace(pools, PLACE_MODIFIERS, randInt(1, 3)) : otherWorld;
                beats[3] = generateMentor(pools, hero, villain, otherWorld);
                currentTalismans = (beats[3] as MentorBeat).talismans;
                break;
            }
            case 4:
                beats[4] = generateThreshold(pools, otherWorld);
                break;
            case 5: {
                beats[5] = generateTests(pools);
                currentAllies = (beats[5] as TestsBeat).allies;
                break;
            }
            case 6:
                beats[6] = generateCave(pools, currentAllies);
                break;
            case 7:
                beats[7] = generateOrdeal(pools, hero, villain, currentTalismans);
                break;
            case 8:
                beats[8] = generateReward(pools, currentAllies, currentTalismans);
                break;
            case 9:
                beats[9] = generateRoadBack(pools);
                break;
            case 10:
                beats[10] = generateResurrection(pools);
                break;
            case 11:
                beats[11] = generateElixir(pools);
                break;
        }
    }

    return {
        ...story,
        beats,
        otherWorld,
        allies: currentAllies,
        talismans: currentTalismans,
    };
}
