

import { use, useEffect } from "react";
import { useLocation } from "react-router-dom";
import AOS from "aos"

export default function AOSRefresh() {
    const { pathname } = useLocation();

    useEffect(() => {
        AOS.refreshHard();
    }, [pathname])

    return null;
}