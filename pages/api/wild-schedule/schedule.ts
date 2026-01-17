import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  const { team = 'MIN', season = '20252026' } = req.query;

  try {
    const apiUrl = `https://api-web.nhle.com/v1/club-schedule-season/${team}/${season}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Add CORS headers to allow frontend access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=60');
    
    return res.status(200).json(data);
    
  } catch (error: any) {
    console.error('Failed to fetch NHL schedule:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch schedule',
      message: error.message 
    });
  }
}