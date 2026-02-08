interface RerollButtonProps {
    onClick: () => void;
    title?: string;
}

export default function RerollButton({onClick, title = "Swap for a new motif"}: RerollButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="text-xl text-gray-500 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-3 cursor-pointer transition-colors border border-gray-300/20 dark:border-gray-600/20"
            title={title}
        >
            ↻
        </button>
    );
}
