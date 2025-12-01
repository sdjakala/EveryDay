import React, {useEffect, useState} from 'react';

type ModuleMeta = {name: string; description: string; enabled: boolean; minRank: number};

export default function Admin() {
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then(u => setUserRank(u.rank))
      .catch(() => setUserRank(0));
  }, []);

  useEffect(() => {fetchModules();}, []);

  async function fetchModules() {
    const res = await fetch('/api/modules');
    const data = await res.json();
    setModules(data);
  }

  async function toggleModule(idx:number) {
    const copy = [...modules];
    copy[idx].enabled = !copy[idx].enabled;
    // post full replacement
    await fetch('/api/modules', {method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(copy)});
    setModules(copy);
  }

  if (userRank === null) return <div className="container">Checking permissions...</div>;
  if (userRank < 5) return <div className="container">Insufficient permissions to view admin.</div>;

  return (
    <div className="container">
      <h1>Admin — Modules</h1>
      {modules.map((m, i) => (
        <div key={m.name} className="module-card admin-toggle">
          <div style={{flex:1}}>
            <strong>{m.name}</strong> — {m.description} (minRank {m.minRank})
          </div>
          <div>
            <label>
              <input type="checkbox" checked={m.enabled} onChange={() => toggleModule(i)} /> Enabled
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
