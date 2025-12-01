import fs from 'fs';
import path from 'path';

type Ingredient = { id: string; title: string; section: string };
type Recipe = { id: string; title: string; link?: string; instructions?: string[]; ingredients: Ingredient[]; planned?: boolean; createdAt?: string; updatedAt?: string };
type Item = { id: string; title: string; done?: boolean; createdAt?: string; updatedAt?: string };

const DATA_DIR = path.join(process.cwd(), 'data');
const RECIPES_FILE = path.join(DATA_DIR, 'backend_recipes.json');
const GROCERY_FILE = path.join(DATA_DIR, 'backend_grocery.json');

function ensureDataDir(){
  try{ fs.mkdirSync(DATA_DIR, { recursive: true }); }catch(e){}
}

function readJson<T>(file: string, fallback: T): T{
  try{
    if(fs.existsSync(file)){
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw) as T;
    }
  }catch(e){ /* ignore */ }
  return fallback;
}

// Persist only in production or when explicitly enabled via BACKEND_PERSIST=1
const SHOULD_PERSIST = process.env.BACKEND_PERSIST === '1' || process.env.NODE_ENV === 'production';
function writeJson(file: string, data: any){
  if(!SHOULD_PERSIST) return;
  try{
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  }catch(e){ console.error('writeJson error', e); }
}

function uid(){ return Math.random().toString(36).slice(2,9); }

ensureDataDir();

let recipes: Recipe[] = readJson<Recipe[]>(RECIPES_FILE, []);
let grocery: Record<string, Item[]> = readJson<Record<string, Item[]>>(GROCERY_FILE, {});

function persist(){
  if(!SHOULD_PERSIST) return;
  writeJson(RECIPES_FILE, recipes);
  writeJson(GROCERY_FILE, grocery);
}

export default {
  // Recipes
  async listRecipes(){
    return recipes;
  },
  async getRecipe(id: string){
    return recipes.find(r=>r.id===id) || null;
  },
  async createRecipe(payload: Partial<Recipe>){
    const now = new Date().toISOString();
    // Preserve client-provided id when present so client and server stay in sync
    const rec: Recipe = { id: (payload.id as string) || uid(), title: (payload.title||'Untitled'), link: payload.link, instructions: payload.instructions || [], ingredients: payload.ingredients || [], planned: !!payload.planned, createdAt: now, updatedAt: now };
    recipes = [rec, ...recipes];
    persist();
    return rec;
  },
  async updateRecipe(id: string, payload: Partial<Recipe>){
    const now = new Date().toISOString();
    recipes = recipes.map(r => r.id === id ? {...r, ...payload, updatedAt: now} : r);
    persist();
    return recipes.find(r=>r.id===id) || null;
  },
  async deleteRecipe(id: string){
    const prev = recipes.length;
    recipes = recipes.filter(r=>r.id!==id);
    persist();
    return prev !== recipes.length;
  },
  // push ingredients into grocery lists (by section)
  async pushIngredientsToGrocery(recipeId: string){
    const rec = recipes.find(r=>r.id===recipeId);
    if(!rec) throw new Error('not found');
    if(!rec.ingredients || !rec.ingredients.length) return 0;
    rec.ingredients.forEach(ing => {
      const sec = ing.section || 'Pantry';
      if(!grocery[sec]) grocery[sec] = [];
      grocery[sec].unshift({ id: uid(), title: ing.title, done: false, createdAt: new Date().toISOString() });
    });
    persist();
    return rec.ingredients.length;
  },

  // Grocery
  async getGroceryLists(){
    return grocery;
  },
  async addGroceryItem(section: string, title: string){
    const it: Item = { id: uid(), title, done: false, createdAt: new Date().toISOString() };
    if(!grocery[section]) grocery[section] = [];
    grocery[section].unshift(it);
    persist();
    return it;
  },
  async updateGroceryItem(section: string, id: string, patch: Partial<Item>){
    if(!grocery[section]) return null;
    grocery[section] = grocery[section].map(it => it.id === id ? {...it, ...patch, updatedAt: new Date().toISOString()} : it);
    persist();
    return grocery[section].find(it=>it.id===id) || null;
  },
  async deleteGroceryItem(section: string, id: string){
    if(!grocery[section]) return false;
    const before = grocery[section].length;
    grocery[section] = grocery[section].filter(it=>it.id!==id);
    persist();
    return before !== grocery[section].length;
  }
}
