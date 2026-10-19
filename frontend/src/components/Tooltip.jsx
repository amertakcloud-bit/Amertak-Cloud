

import { useState, useRef, useEffect, Children } from "react";
import '../styles/tooltip.css';
import { datalist, span } from "motion/react-client";

export default function Tooltip({children, text, position = "right", delay = 500 }) {
    const [ visable, setVisable] = useState(false);
    const timeRef = useRef(null);

    const handleMouseEnter = () => {
        timeRef.current = setTimeout(() => {
            setVisable(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        clearTimeout(timeRef.current);
        setVisable(false);
    };

    useEffect(() => {
        return () => clearTimeout(timeRef.current);
    }, []);

    return (
        <span
        className="tooltip-wrapper"
        >
        {children}

        {visable && text && (
            <span
            className={`custom-tooltip tooltip-${position}`}
            >
                {text}
            </span>
        )}
        </span>
    );
}