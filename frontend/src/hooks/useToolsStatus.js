import { useEffect, useState } from "react";
import { toolsApi } from "../services/toolsApi";
import { useAuth } from "../context/AuthContext";

// Real server capabilities (GET /api/tools): which tools are online, whether the server has a
// Gemini key, upload limits… Refetched when the login state changes (server key = logged-in only).
export default function useToolsStatus() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    toolsApi
      .status()
      .then((r) => alive && setState({ loading: false, error: null, data: r.data }))
      .catch((e) => alive && setState({ loading: false, error: e, data: null }));
    return () => { alive = false; };
  }, [user?.id ?? user?._id ?? null]);

  return state;
}
