import { NextApiRequest, NextApiResponse } from 'next';
import storage from '../../../lib/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const { id } = req.query as { id: string };
    const section = req.query.section as string | undefined;
    if(!id || !section) return res.status(400).json({ error: 'missing id or section' });

    if(req.method === 'PUT' || req.method === 'PATCH'){
      const updated = await storage.updateGroceryItem(section, id, req.body || {});
      return res.status(200).json(updated);
    }

    if(req.method === 'DELETE'){
      const ok = await storage.deleteGroceryItem(section, id);
      return res.status(ok ? 200 : 404).json({ deleted: ok });
    }

    res.setHeader('Allow', ['PUT','PATCH','DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }catch(e:any){
    console.error(e);
    res.status(500).json({ error: e?.message || 'server error' });
  }
}
