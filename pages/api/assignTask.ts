import type {NextApiRequest, NextApiResponse} from 'next';
import fs from 'fs';
import path from 'path';

const LISTS_FILE = path.join(process.cwd(), 'data', 'lists.json');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const {listId, taskTitle, assignedTo, rankRequired} = req.body;
  if (!listId || !taskTitle) return res.status(400).json({error: 'listId and taskTitle required'});

  // Simple user rank enforcement: in real app, verify authenticated user
  const userRank = req.body.userRank ?? 0;
  if (userRank < (rankRequired ?? 0)) return res.status(403).json({error: 'Insufficient rank'});

  const lists = fs.existsSync(LISTS_FILE) ? JSON.parse(fs.readFileSync(LISTS_FILE, 'utf-8')) : [];
  const list = lists.find((l:any) => l.id === listId);
  if (!list) return res.status(404).json({error: 'List not found'});

  const task = {id: Date.now().toString(), title: taskTitle, assignedTo, rankRequired: rankRequired ?? 0};
  list.tasks.push(task);
  fs.writeFileSync(LISTS_FILE, JSON.stringify(lists, null, 2));
  res.status(201).json(task);
}
