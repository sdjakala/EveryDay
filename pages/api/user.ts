import type {NextApiRequest, NextApiResponse} from 'next';
import {getMockUser} from '../../lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = getMockUser(req);
  res.status(200).json(user);
}
