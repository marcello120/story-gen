interface RemoveButtonProps {
    onClick: () => void;
    title?: string;
}

export default function RemoveButton({onClick, title = "Remove"}: RemoveButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="text-xl text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded px-3 cursor-pointer transition-colors border border-gray-300/20 dark:border-gray-600/20"
            title={title}
        >
            x
        </button>
    );
}
