import {useState} from "react";

interface RerollButtonProps {
    onClick: () => void;
    title?: string;
}

export default function RerollButton({onClick, title = "Swap for a new motif"}: RerollButtonProps) {
    const [spinning, setSpinning] = useState(false);

    const handleClick = () => {
        setSpinning(true);
        onClick();
        setTimeout(() => setSpinning(false), 900);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className="text-lg btn-outline rounded px-3 cursor-pointer shadow-md"
            title={title}
        >
            <span className={`inline-block ${spinning ? "animate-spin duration-1000" : ""}`}>↻</span>
        </button>
    );
}