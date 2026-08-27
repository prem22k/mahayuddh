import React from "react";

export function DPPattern({ className = "w-full h-full opacity-30" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="19" height="19" rx="3" fill="white" fillOpacity="0.12" />
        </pattern>
      </defs>
      <rect width="200" height="140" fill="url(#dp-grid)" />
      {/* Active DP computation path */}
      <path
        d="M 20 20 L 60 20 L 60 60 L 100 60 L 100 100 L 160 100"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 4"
        fillOpacity="0.8"
      />
      <circle cx="160" cy="100" r="6" fill="#fa586a" />
      <circle cx="100" cy="60" r="4" fill="white" />
      <circle cx="60" cy="20" r="4" fill="white" />
    </svg>
  );
}

export function GraphPattern({ className = "w-full h-full opacity-35" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="40" y1="40" x2="100" y2="30" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
      <line x1="100" y1="30" x2="160" y2="50" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
      <line x1="40" y1="40" x2="70" y2="100" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
      <line x1="70" y1="100" x2="130" y2="110" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
      <line x1="100" y1="30" x2="130" y2="110" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
      <line x1="160" y1="50" x2="130" y2="110" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
      
      <circle cx="40" cy="40" r="8" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="2" />
      <circle cx="100" cy="30" r="10" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="2" />
      <circle cx="160" cy="50" r="7" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="2" />
      <circle cx="70" cy="100" r="9" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="2" />
      <circle cx="130" cy="110" r="11" fill="#fa586a" fillOpacity="0.8" stroke="white" strokeWidth="2" />
    </svg>
  );
}

export function TreePattern({ className = "w-full h-full opacity-35" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="100" y1="20" x2="55" y2="60" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
      <line x1="100" y1="20" x2="145" y2="60" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
      <line x1="55" y1="60" x2="30" y2="105" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
      <line x1="55" y1="60" x2="75" y2="105" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
      <line x1="145" y1="60" x2="125" y2="105" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
      <line x1="145" y1="60" x2="170" y2="105" stroke="white" strokeWidth="2" strokeOpacity="0.4" />

      <circle cx="100" cy="20" r="8" fill="white" fillOpacity="0.5" />
      <circle cx="55" cy="60" r="7" fill="white" fillOpacity="0.4" />
      <circle cx="145" cy="60" r="7" fill="#38ef7d" fillOpacity="0.7" />
      <circle cx="30" cy="105" r="6" fill="white" fillOpacity="0.3" />
      <circle cx="75" cy="105" r="6" fill="white" fillOpacity="0.3" />
      <circle cx="125" cy="105" r="6" fill="white" fillOpacity="0.3" />
      <circle cx="170" cy="105" r="6" fill="white" fillOpacity="0.3" />
    </svg>
  );
}

export function BinarySearchPattern({ className = "w-full h-full opacity-35" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 20 120 Q 80 110 100 70 T 180 20" stroke="white" strokeWidth="3" strokeOpacity="0.6" fill="none" />
      <line x1="100" y1="10" x2="100" y2="130" stroke="#fa586a" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="100" cy="70" r="7" fill="#fa586a" stroke="white" strokeWidth="2" />
      <rect x="20" y="115" width="40" height="15" rx="3" fill="white" fillOpacity="0.15" />
      <rect x="70" y="115" width="40" height="15" rx="3" fill="white" fillOpacity="0.3" />
      <rect x="120" y="115" width="40" height="15" rx="3" fill="white" fillOpacity="0.15" />
    </svg>
  );
}

export function SlidingWindowPattern({ className = "w-full h-full opacity-35" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="55" width="22" height="30" rx="4" fill="white" fillOpacity="0.15" />
      <rect x="42" y="55" width="22" height="30" rx="4" fill="white" fillOpacity="0.15" />
      <rect x="69" y="50" width="60" height="40" rx="6" fill="white" fillOpacity="0.3" stroke="#ffd60a" strokeWidth="2" />
      <rect x="134" y="55" width="22" height="30" rx="4" fill="white" fillOpacity="0.15" />
      <rect x="161" y="55" width="22" height="30" rx="4" fill="white" fillOpacity="0.15" />
      
      {/* Pointers */}
      <path d="M 75 102 L 75 92" stroke="#ffd60a" strokeWidth="3" strokeLinecap="round" />
      <path d="M 123 102 L 123 92" stroke="#ffd60a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function StackPattern({ className = "w-full h-full opacity-35" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="60" y="90" width="80" height="18" rx="4" fill="white" fillOpacity="0.4" />
      <rect x="65" y="68" width="70" height="18" rx="4" fill="white" fillOpacity="0.5" />
      <rect x="70" y="46" width="60" height="18" rx="4" fill="#fa586a" fillOpacity="0.8" />
      <path d="M 100 15 L 100 35 M 95 30 L 100 35 L 105 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
