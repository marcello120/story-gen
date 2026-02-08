import type {ModifierDef} from "./types";
import {maybe, pick, pickAny, pickBeing} from "./helpers";

export const CHARACTER_MODIFIERS: readonly ModifierDef[] = [
    {label: "used to be a", picker: (p) => pickBeing(p)},
    {label: "can turn into", picker: (p) => pickBeing(p, maybe() ? "Spirit" : "Monster")},
    {label: "defined by", picker: (p) => pickAny(p, "Event", "Condition", "Outcome", "Action")},
    {label: "is opposed to", picker: (p) => pickBeing(p)},
    {label: "loves", picker: (p) => pickBeing(p)},
    {label: "later revealed to be", picker: (p) => pickBeing(p)},
    {label: "owns", picker: (p) => (maybe() ? pick(p, "Object") : pick(p, "Animal"))},
    {label: "wants", picker: (p) => pick(p, "Object")},
    {label: "can only be defeated by", picker: (p) => pickAny(p, "Object", "Outcome", "Action")},
    {label: "burdened by", picker: (p) => pickAny(p, "Condition", "Action")},
    {label: "empowered by", picker: (p) => pick(p, "Object")},
    {label: "survivor of", picker: (p) => pickAny(p, "Event", "Action")},
    {label: "born from", picker: (p) => pick(p, "Origin")},
    {label: "bound to", picker: (p) => pick(p, "Place")},
    {label: "seeker of", picker: (p) => pick(p, "Outcome")},
    {label: "vulnerable to", picker: (p) => pickAny(p, "Object", "Condition")},
    {label: "plans", picker: (p) => pickAny(p, "Event", "Condition", "Outcome", "Action")},
    {label: "servant of", picker: (p) => pickBeing(p)},
];

export const PLACE_MODIFIERS: readonly ModifierDef[] = [
    {label: "looking for", picker: (p) => pick(p, "Object")},
    {label: "missing", picker: (p) => pickAny(p, "Object", "Outcome", "Event", "Condition")},
    {label: "fearing", picker: (p) => pickAny(p, "Object", "Outcome", "Event", "Condition")},
    {label: "defined by", picker: (p) => pickAny(p, "Object", "Outcome", "Event", "Condition")},
    {label: "run by", picker: (p) => pickBeing(p)},
    {label: "opposes", picker: (p) => pickBeing(p)},
    {label: "fears", picker: (p) => pickAny(p, "Object", "Outcome", "Event", "Condition")},
    {label: "everyone has", picker: (p) => pickAny(p, "Object", "Outcome", "Event", "Condition")},
    {label: "no one has", picker: (p) => pickAny(p, "Object", "Outcome", "Event", "Condition")},
    {label: "has", picker: (p) => pickAny(p, "Object", "Outcome", "Event", "Condition", "Action", "Origin", "Attribute")},
    {label: "for", picker: (p) => pickAny(p, "Event", "Condition", "Outcome")},
    {label: "haunted by", picker: (p) => (maybe() ? pick(p, "Spirit") : pick(p, "Event"))},
    {label: "guards", picker: (p) => pick(p, "Object")},
    {label: "forbidden to", picker: (p) => (maybe() ? pick(p, "Human") : pickBeing(p))},
    {label: "transformed by", picker: (p) => (maybe() ? pick(p, "Origin") : pick(p, "Event"))},
    {label: "requires", picker: (p) => pick(p, "Object")},
    {label: "suffering from", picker: (p) => pick(p, "Condition")},
];
