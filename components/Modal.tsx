import React from 'react';

export default function Modal({children, open, onClose}:{children: React.ReactNode; open:boolean; onClose:()=>void}){
  if(!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* Scrollable non-fixed wrapper — keeps the iOS input accessory bar
          anchored to the keyboard instead of floating to the top of the screen */}
      <div className="modal-scroll-wrap">
        <div className="modal" onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}
