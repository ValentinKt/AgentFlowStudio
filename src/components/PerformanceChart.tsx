import React from 'react';
import { motion } from 'framer-motion';

interface PerformanceChartProps {
  data: number[];
  color?: string;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, color = '#14B8A6' }) => {
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - val
  }));

  const pathData = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  return (
    <div className="w-full h-12 relative group">
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </defs>
        </defs>
        
        {/* Area fill */}
        <motion.path
          initial={{ d: `M 0 100 L 0 100 L 100 100 L 100 100 Z` }}
          animate={{ d: `${pathData} L 100 100 L 0 100 Z` }}
          transition={{ duration: 1, ease: "easeOut" }}
          fill="url(#gradient)"
        />

        {/* Line */}
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1 + i * 0.1 }}
            cx={p.x}
            cy={p.y}
            r="2"
            fill="white"
            stroke={color}
            strokeWidth="2"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        ))}
      </svg>
    </div>
  );
};

export default PerformanceChart;
