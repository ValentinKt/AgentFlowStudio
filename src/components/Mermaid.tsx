import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

    if (ref.current) {
      ref.current.innerHTML = '';
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      mermaid.render(id, chart).then((result) => {
        if (ref.current) {
          ref.current.innerHTML = result.svg;
        }
      });
    }
  }, [chart]);

  return <div key={chart} ref={ref} className="flex justify-center p-4 bg-white rounded-xl border border-slate-100 shadow-inner" />;
};

export default Mermaid;
