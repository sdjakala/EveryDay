import type {NextApiRequest, NextApiResponse} from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Placeholder that would fetch external news; here we return static sample items.
  res.status(200).json({items: ['Breaking: Example news item 1', 'Update: Example news item 2']});
}
