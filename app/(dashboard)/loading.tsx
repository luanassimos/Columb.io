import React from 'react';

export default function Loading() {
  return (
    <div className="space-y-6 animate-loading-delay">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2.5 w-1/3">
          {/* Page Title */}
          <div className="h-8 rounded-lg skeleton-pulse w-full"></div>
          {/* Page Subtitle */}
          <div className="h-4 rounded-lg skeleton-pulse w-2/3"></div>
        </div>
        {/* Actions Button */}
        <div className="h-10 rounded-lg skeleton-pulse w-28"></div>
      </div>

      {/* Main Content Area Skeleton - Matches the 4-step workflow pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card rounded-2xl border border-[#D8E0EA] p-6 space-y-4 bg-white/50">
            <div className="flex justify-between items-start">
              <div className="h-10 w-10 rounded-xl skeleton-pulse"></div>
              <div className="h-4 w-4 rounded-full skeleton-pulse"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 rounded-lg skeleton-pulse w-1/2"></div>
              <div className="h-6 rounded-lg skeleton-pulse w-1/3"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Big Card / Table List Skeleton */}
      <div className="glass-card rounded-2xl border border-[#D8E0EA] p-6 space-y-4 bg-white/50">
        <div className="h-6 rounded-lg skeleton-pulse w-1/4"></div>
        <div className="space-y-3 pt-2">
          <div className="h-12 rounded-xl skeleton-pulse w-full"></div>
          <div className="h-12 rounded-xl skeleton-pulse w-full"></div>
          <div className="h-12 rounded-xl skeleton-pulse w-full"></div>
        </div>
      </div>
    </div>
  );
}
