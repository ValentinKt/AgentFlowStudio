import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
}

let mermaidInitialized = false;
let mermaidRenderSeq = 0;

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: true,
        theme: 'base',
        themeVariables: {
          primaryColor: '#14b8a6',
          primaryTextColor: '#fff',
          primaryBorderColor: '#0d9488',
          lineColor: '#94a3b8',
          secondaryColor: '#f1f5f9',
          tertiaryColor: '#fff',
        },
        securityLevel: 'loose',
      });
      mermaidInitialized = true;
    }

    const container = ref.current;
    setError(null);

    if (!container) return;
    const trimmed = chart?.trim() ?? '';
    if (trimmed.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '';
    const renderToken = (mermaidRenderSeq += 1);
    let cancelled = false;
    const id = `mermaid-${renderToken}-${Math.random().toString(36).slice(2, 11)}`;

    mermaid
      .render(id, trimmed)
      .then((result) => {
        if (cancelled) return;
        if (renderToken !== mermaidRenderSeq) return;
        if (ref.current) {
          ref.current.innerHTML = result.svg;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (renderToken !== mermaidRenderSeq) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        if (ref.current) {
          ref.current.innerHTML = '';
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
        <div className="text-xs font-bold text-amber-900">Mermaid syntax error</div>
        <div className="mt-1 text-[11px] text-amber-900/90 break-words">{error}</div>
        <pre className="mt-3 p-3 bg-white rounded-lg border border-amber-100 text-[10px] text-slate-700 overflow-x-auto whitespace-pre-wrap">
          {chart}
        </pre>
      </div>
    );
  }

  return <div key={chart} ref={ref} className="flex justify-center p-4 bg-white rounded-xl border border-slate-100 shadow-inner" />;
};

export default Mermaid;
