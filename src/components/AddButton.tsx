interface AddButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
}

export default function AddButton({label, onClick, disabled, className = ""}: AddButtonProps) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`text-xl btn-add border rounded px-1.5 py-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        >
            + Add {label}
        </button>
    );
}
