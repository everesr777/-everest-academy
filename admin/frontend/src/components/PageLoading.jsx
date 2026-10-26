import React, { useEffect, useState } from "react";
import { getActionRequestCount, subscribeAction } from "../api.js";
import LoadingIndicator from "./LoadingIndicator";

/**
 * In-page "loading" placeholder.
 *
 * Every action now shows the global loading overlay (see ActionGuard), so a
 * page-level placeholder at the same moment looked like two loaders stacked on
 * top of each other. This hides the placeholder while the global overlay is on
 * screen, and keeps it for the cases where nothing else gives feedback
 * (a hard refresh, a retry that no click started, …).
 *
 * Usage: <PageLoading /> or <PageLoading><p>…</p></PageLoading>
 */
export default function PageLoading({ children, full = false }) {
  const [hidden, setHidden] = useState(() => getActionRequestCount() > 0);

  useEffect(() => {
    let timer = null;
    const onChange = (count) => {
      if (count > 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        setHidden(true);
      } else if (!timer) {
        // Small delay so a finishing request never flashes the placeholder
        // for a single frame right before the page renders its data.
        timer = setTimeout(() => { timer = null; setHidden(false); }, 200);
      }
    };
    onChange(getActionRequestCount());
    const unsub = subscribeAction(onChange);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (hidden) return null;
  if (children) return <>{children}</>;
  return <LoadingIndicator full={full} />;
}
