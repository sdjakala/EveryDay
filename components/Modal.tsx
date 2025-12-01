import React from 'react';

export default function Modal({children, open, onClose}:{children: React.ReactNode; open:boolean; onClose:()=>void}){
  if(!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
