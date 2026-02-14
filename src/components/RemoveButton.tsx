interface RemoveButtonProps {
    onClick: () => void;
    title?: string;
}

export default function RemoveButton({onClick, title = "Remove"}: RemoveButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="text-lg btn-outline-destructive rounded px-3 cursor-pointer"
            title={title}
        >
            x
        </button>
    );
}
