import type {NextApiRequest, NextApiResponse} from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Placeholder calendar events
  res.status(200).json({events: [{id: '1', title: 'Team sync', time: '2025-11-26T10:00:00Z'}]});
}
