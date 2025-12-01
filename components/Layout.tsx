import React from 'react';
import Icon from './Icon';

export default function Layout({children}: {children: React.ReactNode}) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">EveryDay</div>
        <div className="top-actions">
          <button className="icon-btn" aria-label="Search"><Icon name="search" /></button>
          <button className="icon-btn" aria-label="Settings"><Icon name="settings" /></button>
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="bottom-nav">
        <button className="nav-btn"><Icon name="home" /><span>Home</span></button>
        <button className="nav-btn"><Icon name="bell" /><span>Feed</span></button>
        <button className="nav-btn"><Icon name="discover" /><span>Discover</span></button>
        <button className="nav-btn"><Icon name="user" /><span>Profile</span></button>
      </nav>
    </div>
  );
}
