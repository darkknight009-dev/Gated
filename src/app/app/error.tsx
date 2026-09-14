"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ProductError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="empty-view"><div><AlertTriangle size={25} /><h2>Gated hit a closed gate.</h2><p>Your Gmail data is safe and nothing was deleted. Try loading this view again.</p><button className="btn btn-primary" onClick={reset}><RefreshCw size={13} />Try again</button></div></div>;
}
