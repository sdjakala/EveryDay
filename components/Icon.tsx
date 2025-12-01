import React from 'react';

type Props = {name: string; className?: string; size?: number};

export default function Icon({name, className, size = 18}: Props) {
  const common = {width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg'};

  switch (name) {
    case 'search':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="6" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 2.27 18.7l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82L4.3 4.27A2 2 0 1 1 7.13 1.44l.06.06A1.65 1.65 0 0 0 9 1.83c.4-.08.8-.13 1.21-.13s.81.05 1.21.13c.48.11.92.33 1.3.64l.06.06A2 2 0 1 1 19.73 4.3l-.06.06a1.65 1.65 0 0 0-.33 1.82c.11.4.16.81.16 1.21s-.05.81-.16 1.21c-.11.48-.33.92-.64 1.3l-.06.06A1.65 1.65 0 0 0 19.4 15z" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'discover':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10v6a2 2 0 0 1-2 2h-6" />
          <path d="M3 14V8a2 2 0 0 1 2-2h6" />
          <path d="M8 21l4-9 4 9" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.78 0L12 5.58l-1.02-0.98a5.5 5.5 0 1 0-7.78 7.78L12 21.5l8.8-9.12a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case 'comment':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case 'chev-left':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      );
    case 'chev-right':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 1.1-.9 2-2 2h-1v7l-6-3-6 3v-7H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v5z" />
        </svg>
      );
    case 'unpin':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 1.1-.9 2-2 2h-1v7l-6-3-6 3v-7H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v5z" />
          <path d="M3 3l18 18" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4h6l3 3v6" />
          <path d="M3 21l6-2 10-10 2-6-6 2-10 10-2 6z" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common} className={className} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      );
    default:
      return <svg {...common} className={className} />;
  }
}
