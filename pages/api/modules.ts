import type {NextApiRequest, NextApiResponse} from 'next';
import fs from 'fs';
import path from 'path';

const MODULES_FILE = path.join(process.cwd(), 'data', 'modules.json');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const json = fs.readFileSync(MODULES_FILE, 'utf-8');
    return res.status(200).json(JSON.parse(json));
  }

  if (req.method === 'POST') {
    // Accept full replacement array
    const data = req.body;
    try {
      fs.writeFileSync(MODULES_FILE, JSON.stringify(data, null, 2));
      return res.status(200).json({ok: true});
    } catch (err) {
      return res.status(500).json({error: 'Failed to write modules'});
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end('Method Not Allowed');
}
