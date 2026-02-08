"use client";

import {useState, useRef, useEffect} from "react";
import type {Modifier, ModifierDef, PoolData} from "@/lib/types";

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
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearch("");
                }}
                className="text-x text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-1.5 py-0.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
                + Add modifier
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
                            placeholder="Search modifiers..."
                            className="w-full text-sm px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-amber-400 dark:focus:border-amber-500"
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
                                    className="w-full text-left text-sm px-3 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer transition-colors"
                                >
                                    {def.label}
                                </button>
                            </li>
                        ))}
                        {filtered.length === 0 && (
                            <li className="text-gray-400 dark:text-gray-500 p-3 text-sm text-center">
                                No matches
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
