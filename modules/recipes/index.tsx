import React, {useEffect, useState} from 'react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';

type Ingredient = { id: string; title: string; section: string };

type Recipe = {
  id: string;
  title: string;
  link?: string;
  instructions?: string[]; // now an ordered list of steps
  ingredients: Ingredient[];
  planned?: boolean;
};

function uid() { return Math.random().toString(36).slice(2,9); }

export default function RecipesModule(){
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const raw = localStorage.getItem('recipes');
      if (raw) {
        const parsed = JSON.parse(raw);
        // migrate older shape: ingredients might be string[] and instructions might be a blob string
        return parsed.map((r: any) => ({
          ...r,
          ingredients: (r.ingredients || []).map((it: any) => typeof it === 'string' ? { id: uid(), title: it, section: 'Pantry' } : it),
          instructions: Array.isArray(r.instructions) ? r.instructions : (typeof r.instructions === 'string' ? (r.instructions || '').split('\n').map((s:string)=>s.trim()).filter(Boolean) : undefined)
        }));
      }
    } catch(e){ console.error(e); }
    return [];
  });

  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  // instructions are now an ordered list of steps
  const [instructionsSteps, setInstructionsSteps] = useState<string[]>([]);
  const [newStepText, setNewStepText] = useState('');
  const [newIngredient, setNewIngredient] = useState('');
  const [formIngredients, setFormIngredients] = useState<Ingredient[]>([]);
  const SECTIONS = ['Produce','Meat','Dairy','Frozen','Bakery','Pantry','Other'];
  const [newIngredientSection, setNewIngredientSection] = useState('Pantry');
  const [editingFormIndex, setEditingFormIndex] = useState<number | null>(null);
  const [editingFormTitle, setEditingFormTitle] = useState('');
  const [editingFormSection, setEditingFormSection] = useState('Pantry');
  const [formPlanned, setFormPlanned] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPlannedOnly, setShowPlannedOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRecipeIndex, setEditingRecipeIndex] = useState<number | null>(null);
  const [editingRecipeTitle, setEditingRecipeTitle] = useState('');
  const [editingRecipeSection, setEditingRecipeSection] = useState('Pantry');
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  

  useEffect(()=>{ try{ localStorage.setItem('recipes', JSON.stringify(recipes)); }catch(e){ console.error(e); } }, [recipes]);

  // Try to keep server in sync when possible. Best-effort: call API endpoints and fall back to localStorage.
  async function apiCreateRecipe(rec: Recipe){
    try{
      await fetch('/api/recipes', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(rec) });
    }catch(e){ /* ignore - offline fallback */ }
  }
  async function apiUpdateRecipe(id:string, rec: Partial<Recipe>){
    try{
      await fetch(`/api/recipes/${encodeURIComponent(id)}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(rec) });
    }catch(e){ /* ignore */ }
  }
  async function apiDeleteRecipe(id:string){
    try{
      await fetch(`/api/recipes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }catch(e){ /* ignore */ }
  }
  async function apiPushIngredients(id:string){
    try{
      const res = await fetch(`/api/recipes/${encodeURIComponent(id)}/push`, { method: 'POST' });
      if(res.ok) return true;
    }catch(e){ /* ignore */ }
    return false;
  }

  function addIngredient(){
    const txt = newIngredient.trim();
    if(!txt) return;
    const ing: Ingredient = { id: uid(), title: txt, section: newIngredientSection };
    if(editingId){
      setRecipes(r => r.map(rc => rc.id === editingId ? {...rc, ingredients: [...rc.ingredients, ing]} : rc));
    } else {
      setFormIngredients(prev => [...prev, ing]);
    }
    setNewIngredient('');
  }

  function createRecipe(){
    const id = uid();
    const rec: Recipe = {id, title: title.trim() || 'Untitled', link: link.trim() || undefined, instructions: instructionsSteps.length ? instructionsSteps : undefined, ingredients: formIngredients, planned: formPlanned};
    setRecipes(r => [rec, ...r]);
    apiCreateRecipe(rec);
    setTitle(''); setLink(''); setInstructionsSteps([]); setNewStepText(''); setNewIngredient('');
    setFormIngredients([]);
    setShowForm(false);
  }

  // keep server in sync when deleting
  function removeRecipeWithSync(id: string){
    setRecipes(r => r.filter(x=>x.id!==id));
    apiDeleteRecipe(id);
  }

  function startEdit(r: Recipe){
    setEditingId(r.id); setTitle(r.title); setLink(r.link||''); setNewStepText(''); setNewIngredient('');
    const instr: any = (r as any).instructions;
    setInstructionsSteps(Array.isArray(instr) ? instr : (typeof instr === 'string' ? (instr || '').split('\n').map((s: string) => s.trim()).filter(Boolean) : []));
    setFormIngredients((r.ingredients || []).map((it:any) => typeof it === 'string' ? { id: uid(), title: it, section: 'Pantry' } : it));
    setFormPlanned(!!r.planned);
    setShowForm(true);
  }

  function saveEdit(){
    if(!editingId) return;
    setRecipes(r => r.map(rc => rc.id === editingId ? {...rc, title: title.trim() || 'Untitled', link: link.trim() || undefined, instructions: instructionsSteps.length ? instructionsSteps : undefined, ingredients: formIngredients, planned: formPlanned} : rc));
    apiUpdateRecipe(editingId, { title: title.trim() || 'Untitled', link: link.trim() || undefined, instructions: instructionsSteps.length ? instructionsSteps : undefined, ingredients: formIngredients, planned: formPlanned } ).catch(()=>{});
    setEditingId(null); setTitle(''); setLink(''); setInstructionsSteps([]); setNewStepText(''); setNewIngredient('');
    setFormIngredients([]);
    setShowForm(false);
  }

  // Steps helpers
  function addStep(){
    const t = newStepText.trim();
    if(!t) return;
    setInstructionsSteps(s => [...s, t]);
    setNewStepText('');
  }
  function removeStep(idx: number){ setInstructionsSteps(s => s.filter((_,i)=>i!==idx)); }
  function moveStepUp(idx: number){ if(idx <= 0) return; setInstructionsSteps(s => { const copy = [...s]; const tmp = copy[idx-1]; copy[idx-1] = copy[idx]; copy[idx] = tmp; return copy; }); }
  function moveStepDown(idx: number){ setInstructionsSteps(s => { if(idx >= s.length-1) return s; const copy = [...s]; const tmp = copy[idx+1]; copy[idx+1] = copy[idx]; copy[idx] = tmp; return copy; }); }

  function addIngredientToRecipe(recipeId: string){
    const txt = newIngredient.trim();
    if(!txt) return;
    const ing: Ingredient = { id: uid(), title: txt, section: newIngredientSection };
    // If we're currently editing the same recipe in the form, update the formIngredients
    if(editingId && editingId === recipeId && showForm){
      setFormIngredients(prev => [...prev, ing]);
    } else {
      setRecipes(r => r.map(rc => rc.id === recipeId ? {...rc, ingredients: [...rc.ingredients, ing]} : rc));
    }
    setNewIngredient('');
  }

  function removeIngredient(recipeId:string, idx:number){
    setRecipes(r => r.map(rc => rc.id === recipeId ? {...rc, ingredients: rc.ingredients.filter((_,i)=>i!==idx)} : rc));
  }

  function updateIngredientInRecipe(recipeId: string, idx: number, title: string, section: string){
    setRecipes(r => r.map(rc => rc.id === recipeId ? {...rc, ingredients: rc.ingredients.map((ing, i) => i===idx ? {...ing, title, section} : ing)} : rc));
    // best-effort server update
    const rec = recipes.find(x => x.id === recipeId);
    if(rec) apiUpdateRecipe(recipeId, { ingredients: rec.ingredients.map((ing,i)=> i===idx ? {...ing, title, section} : ing) }).catch(()=>{});
  }

  function pushIngredientsToGrocery(recipeId:string){
    const rec = recipes.find(r=>r.id===recipeId);
    if(!rec) return;
    // Try API push first; if it fails, fall back to localStorage push
    apiPushIngredients(recipeId).then(ok => {
      if(ok){
        try{ window.dispatchEvent(new CustomEvent('grocery-updated')); }catch(e){ console.warn('grocery dispatch failed', e); }
        const msg = `Added ${rec.ingredients.length} ingredient${rec.ingredients.length === 1 ? '' : 's'} to Grocery`;
        setPushMessage(msg);
        setTimeout(() => setPushMessage(null), 3000);
        setRecipes(r => r.map(rc => rc.id === recipeId ? {...rc, planned: true} : rc));
      } else {
        // fallback to local behavior
        try{
          const raw = localStorage.getItem('groceryLists');
          let lists: Record<string, any[]> = {};
          if(raw) lists = JSON.parse(raw);
          // add each ingredient into its configured section and dedupe per-section
          const modified = new Set<string>();
          rec.ingredients.forEach(i => {
            const section = (i && (i as any).section) || 'Pantry';
            if(!lists[section]) lists[section] = [];
            lists[section].push({ id: uid(), title: (i as any).title || String(i), done: false });
            modified.add(section);
          });
          // dedupe titles inside modified sections
          modified.forEach(section => {
            const seen = new Set<string>();
            lists[section] = lists[section].filter((it: any) => {
              if(seen.has(it.title)) return false;
              seen.add(it.title);
              return true;
            });
          });
          localStorage.setItem('groceryLists', JSON.stringify(lists));
          try { window.dispatchEvent(new CustomEvent('grocery-updated')); } catch (e) { console.warn('grocery dispatch failed', e); }
          const msg = `Added ${rec.ingredients.length} ingredient${rec.ingredients.length === 1 ? '' : 's'} to Grocery`;
          setPushMessage(msg);
          setTimeout(() => setPushMessage(null), 3000);
          setRecipes(r => r.map(rc => rc.id === recipeId ? {...rc, planned: true} : rc));
        }catch(e){ console.error(e); }
      }
    });
  }

  return (
    <div className="module-card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3>Recipes</h3>
        <div style={{display:'flex',gap:8}}>
            <button className="icon-btn" title="New" onClick={()=>{ setEditingId(null); setTitle(''); setLink(''); setInstructionsSteps([]); setNewStepText(''); setNewIngredient(''); }}><Icon name="plus" /></button>
            <button
              className={`toggle-btn ${showPlannedOnly ? 'active' : ''}`}
              title={showPlannedOnly ? 'Showing planned only' : 'Show planned only'}
              aria-pressed={showPlannedOnly}
              onClick={() => setShowPlannedOnly(s => !s)}
              style={{marginLeft:8}}
            >
              <span className="icon"><Icon name="heart" /></span>
              <span style={{fontSize:13}}>{showPlannedOnly ? 'Planned' : 'Planned'}</span>
            </button>
        </div>
      </div>

      <div style={{marginTop:10}}>
        <div>
          <button className="task-add-btn" onClick={()=>{ setShowForm(true); setEditingId(null); setTitle(''); setLink(''); setInstructionsSteps([]); setNewStepText(''); setFormIngredients([]); setFormPlanned(false); }}>Create Recipe</button>
        </div>
      </div>

      {/* Modal for create / edit form */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setFormIngredients([]); setNewIngredient(''); setTitle(''); setLink(''); setInstructionsSteps([]); setNewStepText(''); setEditingId(null); setFormPlanned(false); }}>
        <div style={{padding:12, maxWidth:700}}>
          <h3 style={{marginTop:0}}>{editingId ? 'Edit Recipe' : 'New Recipe'}</h3>
          <input className="task-input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
          <input className="task-input" placeholder="Link (optional)" value={link} onChange={e=>setLink(e.target.value)} style={{marginTop:8}} />
          {/* Steps editor: ordered, add/remove/reorder */}
          <div style={{marginTop:8}}>
            <strong style={{fontSize:13}}>Steps</strong>
            <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
              <input className="task-input" placeholder="New step..." value={newStepText} onChange={e=>setNewStepText(e.target.value)} onKeyDown={e=> e.key === 'Enter' ? addStep() : null} />
              <button className="task-add-btn" onClick={addStep}><Icon name="plus" /> <span style={{marginLeft:6}}>Add Step</span></button>
            </div>
            <ol style={{marginTop:8,paddingLeft:18}}>
              {instructionsSteps.map((s,idx) => (
                <li key={idx} style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                  <span style={{flex:1}}>{s}</span>
                  <div style={{display:'flex',gap:6}}>
                    <button className="task-action-btn" type="button" onClick={()=>moveStepUp(idx)} title="Move up"><Icon name="chev-left" /></button>
                    <button className="task-action-btn" type="button" onClick={()=>moveStepDown(idx)} title="Move down"><Icon name="chev-right" /></button>
                    <button className="task-action-btn" type="button" onClick={()=>removeStep(idx)} title="Remove"><Icon name="trash" /></button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center',flexWrap:'wrap'}}>
            <input className="task-input" placeholder="Add ingredient..." value={newIngredient} onChange={e=>setNewIngredient(e.target.value)} onKeyDown={e=> e.key === 'Enter' ? (editingId ? addIngredientToRecipe(editingId) : addIngredient()) : null} />
                    <button
                      type="button"
                      className={`toggle-btn ${formPlanned ? 'active' : ''}`}
                      onClick={() => setFormPlanned(p => !p)}
                      title={formPlanned ? 'Planned' : 'Mark planned'}
                      aria-pressed={formPlanned}
                    >
                      <span className="icon"><Icon name="heart" /></span>
                      <span style={{fontSize:12}}>{formPlanned ? 'Planned' : 'Plan'}</span>
                    </button>
            <select className="grocery-select" value={newIngredientSection} onChange={e=>setNewIngredientSection(e.target.value)}>
              {SECTIONS.map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="task-add-btn" onClick={()=> editingId ? addIngredientToRecipe(editingId) : addIngredient()}><Icon name="plus" /> <span style={{marginLeft:6}}>Add</span></button>
          </div>
          <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap'}}>
            {formIngredients.map((ing, i) => (
              <div key={ing.id} style={{background:'rgba(255,255,255,0.03)',padding:'6px 10px',borderRadius:8,display:'flex',alignItems:'center',gap:8}}>
                {editingFormIndex === i ? (
                  <>
                    <input value={editingFormTitle} onChange={e=>setEditingFormTitle(e.target.value)} className="task-input" style={{minWidth:120}} />
                    <select className="grocery-select" value={editingFormSection} onChange={e=>setEditingFormSection(e.target.value)}>
                      {SECTIONS.map(s=> <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="button" className="task-action-btn" onClick={()=>{ setFormIngredients(fi => fi.map((f,idx)=> idx===i ? {...f, title: editingFormTitle, section: editingFormSection} : f)); setEditingFormIndex(null); }}><Icon name="check" /></button>
                    <button type="button" className="task-action-btn" onClick={()=> setEditingFormIndex(null)}><Icon name="chev-left" /></button>
                  </>
                ) : (
                  <>
                    <span style={{fontSize:13}}>{ing.title}</span>
                    <em style={{fontSize:12,color:'var(--muted)'}}>{ing.section}</em>
                    <button type="button" className="task-action-btn" onClick={()=>{ setEditingFormIndex(i); setEditingFormTitle(ing.title); setEditingFormSection(ing.section); }}><Icon name="edit" /></button>
                    <button type="button" className="task-action-btn" onClick={()=> setFormIngredients(fi => fi.filter((_,idx)=>idx!==i))}><Icon name="trash" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:12}}>
                {editingId ? (
              <>
                <button className="task-add-btn" onClick={saveEdit}>Save</button>
                    <button className="task-action-btn" onClick={()=>{ setEditingId(null); setTitle(''); setLink(''); setInstructionsSteps([]); setNewStepText(''); setFormIngredients([]); setShowForm(false); setFormPlanned(false); }}>Cancel</button>
              </>
            ) : (
              <>
                <button className="task-add-btn" onClick={createRecipe}>Create Recipe</button>
                    <button className="task-action-btn" onClick={()=>{ setShowForm(false); setFormIngredients([]); setNewIngredient(''); setTitle(''); setLink(''); setInstructionsSteps([]); setNewStepText(''); setFormPlanned(false); }}>Close</button>
              </>
            )}
          </div>
        </div>
      </Modal>

      <div style={{marginTop:12}}>
            {recipes.length === 0 ? <div style={{color:'var(--muted)'}}>No recipes yet</div> : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {recipes.filter(r => !showPlannedOnly || r.planned).map(r => (
              <div key={r.id} className="recipe-list-row" style={{padding:10,background:'rgba(255,255,255,0.02)',borderRadius:8}}>
                {expandedId === r.id ? (
                  // Expanded layout: stack title, instructions, then ingredients vertically
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                      <div onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                        <strong style={{fontSize:16}}>{r.title}</strong>
                        {r.link ? <a href={r.link} target="_blank" rel="noreferrer" style={{color:'var(--accent)',fontSize:13}}>View</a> : null}
                      </div>
                          <div style={{display:'flex',gap:8,alignItems:'center'}}>
                            <button
                              className={`toggle-btn ${r.planned ? 'active' : ''}`}
                              title={r.planned ? 'Planned' : 'Mark planned'}
                              aria-pressed={!!r.planned}
                              onClick={() => setRecipes(list => list.map(x => x.id === r.id ? {...x, planned: !x.planned} : x))}
                            >
                              <span className="icon"><Icon name="heart" /></span>
                              <span style={{fontSize:12}}>{r.planned ? 'Planned' : 'Plan'}</span>
                            </button>
                            <button className="task-action-btn" onClick={()=>startEdit(r)} title="Edit"><Icon name="edit" /></button>
                            <button className="task-action-btn" onClick={()=>removeRecipeWithSync(r.id)} title="Delete"><Icon name="trash" /></button>
                          </div>
                    </div>

                    <div>
                      <strong style={{fontSize:13}}>Instructions</strong>
                      <div style={{color:'var(--muted)',marginTop:6}}>
                        {Array.isArray(r.instructions) ? (
                          <ol style={{margin:0,paddingLeft:18}}>
                            {r.instructions.map((s, i) => (<li key={i} style={{marginTop:6}}>{s}</li>))}
                          </ol>
                        ) : (
                          <div style={{whiteSpace:'pre-wrap'}}>{(r.instructions as any) || ''}</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <strong style={{fontSize:13}}>Ingredients</strong>
                      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:6}}>
                        {r.ingredients.map((ing,idx) => (
                          <div key={ing.id} style={{background:'rgba(255,255,255,0.03)',padding:'6px 10px',borderRadius:8,display:'flex',alignItems:'center',gap:8}}>
                            {editingRecipeIndex === idx ? (
                              <>
                                <input value={editingRecipeTitle} onChange={e=>setEditingRecipeTitle(e.target.value)} className="task-input" style={{minWidth:120}} />
                                <select className="grocery-select" value={editingRecipeSection} onChange={e=>setEditingRecipeSection(e.target.value)}>
                                  {SECTIONS.map(s=> <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button className="task-action-btn" onClick={()=>{ updateIngredientInRecipe(r.id, idx, editingRecipeTitle, editingRecipeSection); setEditingRecipeIndex(null); }}><Icon name="check" /></button>
                                <button className="task-action-btn" onClick={()=> setEditingRecipeIndex(null)}><Icon name="chev-left" /></button>
                              </>
                            ) : (
                              <>
                                <span style={{fontSize:13}}>{ing.title}</span>
                                <em style={{fontSize:12,color:'var(--muted)'}}>{ing.section}</em>
                                <div style={{marginLeft:'auto',display:'flex',gap:8}}>
                                  <button className="task-action-btn" onClick={()=>{ setEditingRecipeIndex(idx); setEditingRecipeTitle(ing.title); setEditingRecipeSection(ing.section); }}><Icon name="edit" /></button>
                                  <button className="task-action-btn" onClick={()=>removeIngredient(r.id, idx)}><Icon name="trash" /></button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                        <div style={{marginTop:8}}>
                          <button className="task-add-btn" onClick={()=>pushIngredientsToGrocery(r.id)}>Add ingredients to Grocery</button>
                          {pushMessage ? <div style={{marginTop:8,color:'var(--accent)',fontSize:13}}>{pushMessage}</div> : null}
                        </div>
                    </div>
                  </div>
                ) : (
                  // Compact row layout when not expanded
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                    <div style={{flex:1,display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=> setExpandedId(expandedId===r.id ? null : r.id)}>
                                      <strong>{r.title}</strong>
                      {r.link ? <a href={r.link} target="_blank" rel="noreferrer" style={{color:'var(--accent)',fontSize:13}}>View</a> : null}
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <button
                          className={`toggle-btn small ${r.planned ? 'active' : ''}`}
                          title={r.planned ? 'Planned' : 'Mark planned'}
                          aria-pressed={!!r.planned}
                          onClick={() => setRecipes(list => list.map(x => x.id === r.id ? {...x, planned: !x.planned} : x))}
                        >
                          <span className="icon"><Icon name="heart" /></span>
                        </button>
                        <button className="task-action-btn" onClick={()=>startEdit(r)} title="Edit"><Icon name="edit" /></button>
                        <button className="task-action-btn" onClick={()=>removeRecipeWithSync(r.id)} title="Delete"><Icon name="trash" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
