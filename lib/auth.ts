import {NextApiRequest} from 'next';

export function getMockUser(req?: NextApiRequest) {
  // In real app, read token/cookie and validate with Azure AD B2C.
  // Here we return a demo user; allow overriding via header for testing: x-user-rank
  const rankHeader = req?.headers['x-user-rank'];
  const rank = rankHeader ? Number(rankHeader) : 1;
  return {id: '1', name: 'Demo User', rank};
}

export function requireRank(userRank: number, minRank: number) {
  return userRank >= minRank;
}
