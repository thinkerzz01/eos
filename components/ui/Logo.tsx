'use client';

import React, { useState } from 'react';

interface LogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export function Logo({
  variant = 'dark',
  size = 'md',
  showTagline = true,
}: LogoProps) {
  const [imageError, setImageError] = useState(false);
  const isDarkBg = variant === 'dark';

  // Path to user logo image in public directory
  const logoPath = isDarkBg ? '/logo-dark.png' : '/logo-light.png';

  if (!imageError) {
    return (
      <div className="flex items-center gap-2.5">
        <img
          src={logoPath}
          alt="Thinkerzz Logo"
          onError={() => setImageError(true)}
          className={`${
            size === 'sm' ? 'h-7' : size === 'lg' ? 'h-12' : 'h-9'
          } w-auto object-contain`}
        />
      </div>
    );
  }

  // Fallback rendering if logo image file is not found
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className={`rounded-xl flex items-center justify-center shrink-0 shadow-md ${
          size === 'sm'
            ? 'w-8 h-8'
            : size === 'lg'
            ? 'w-12 h-12 rounded-2xl'
            : 'w-10 h-10'
        } bg-gradient-to-tr from-[#5B47D6] via-[#7C6BF0] to-[#F5A623]`}
      >
        <svg
          className={`${
            size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'
          }`}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M12 2L3 7l9 5 9-5-9-5z" fill="#FFFFFF" />
          <path
            d="M3 12l9 5 9-5M3 17l9 5 9-5"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div>
        <div
          className={`font-heading font-black tracking-wider leading-none ${
            isDarkBg ? 'text-white' : 'text-slate-900'
          } ${
            size === 'sm'
              ? 'text-sm'
              : size === 'lg'
              ? 'text-2xl'
              : 'text-lg'
          }`}
        >
          THINKERZZ
        </div>
        {showTagline && (
          <div
            className={`tracking-widest uppercase font-bold mt-1 ${
              isDarkBg ? 'text-[#8B8FA8]' : 'text-[#5B47D6]'
            } ${
              size === 'sm'
                ? 'text-[8.5px]'
                : size === 'lg'
                ? 'text-xs'
                : 'text-xs'
            }`}
          >
            Question · Think · Achieve
          </div>
        )}
      </div>
    </div>
  );
}
