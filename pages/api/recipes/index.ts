import { NextApiRequest, NextApiResponse } from 'next';
import storage from '../../../lib/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    if(req.method === 'GET'){
      const list = await storage.listRecipes();
      res.status(200).json({ items: list });
      return;
    }

    if(req.method === 'POST'){
      const body = req.body || {};
      const created = await storage.createRecipe(body);
      res.status(201).json(created);
      return;
    }

    res.setHeader('Allow', ['GET','POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }catch(e:any){
    console.error(e);
    res.status(500).json({ error: e?.message || 'server error' });
  }
}
