"use client";

import {useState, useRef, useEffect} from "react";
import type {Modifier, ModifierDef, PoolData} from "@/lib/types";
import AddButton from "./AddButton";

interface AddModifierDropdownProps {
    availableModDefs: ModifierDef[];
    pools: PoolData;
    onAdd: (mod: Modifier) => void;
    disabled?: boolean;
}

export default function AddModifierDropdown({availableModDefs, pools, onAdd, disabled}: AddModifierDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const filtered = availableModDefs.filter((d) =>
        d.label.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="relative inline-block" ref={ref}>
            <AddButton
                label="modifier"
                disabled={disabled}
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearch("");
                }}
            />
            {isOpen && (
                <div className="absolute z-10 mt-1 w-64 dropdown-panel rounded-lg overflow-hidden">
                    <div className="p-2" style={{borderBottom: "1px solid var(--border-light)"}}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
                            placeholder="Search modifiers..."
                            className="w-full text-sm px-2 py-1 rounded dropdown-input"
                        />
                    </div>
                    <ul className="max-h-48 overflow-y-auto">
                        {filtered.map((def) => (
                            <li key={def.label}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onAdd({label: def.label, value: def.picker(pools)});
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left text-sm px-3 py-1.5 dropdown-item cursor-pointer"
                                >
                                    {def.label}
                                </button>
                            </li>
                        ))}
                        {filtered.length === 0 && (
                            <li className="label-text p-3 text-sm text-center">
                                No matches
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
