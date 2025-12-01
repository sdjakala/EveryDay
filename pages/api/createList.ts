import type {NextApiRequest, NextApiResponse} from 'next';
import fs from 'fs';
import path from 'path';

const LISTS_FILE = path.join(process.cwd(), 'data', 'lists.json');

type List = {id: string; name: string; tasks: string[]};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const {name} = req.body;
  if (!name) return res.status(400).json({error: 'name required'});

  const lists: List[] = fs.existsSync(LISTS_FILE) ? JSON.parse(fs.readFileSync(LISTS_FILE, 'utf-8')) : [];
  const newList: List = {id: Date.now().toString(), name, tasks: []};
  lists.push(newList);
  fs.writeFileSync(LISTS_FILE, JSON.stringify(lists, null, 2));
  res.status(201).json(newList);
}
