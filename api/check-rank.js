const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { return res.status(405).json({ error: 'Method not allowed' }); }

  const { apiKey, keyword, country = 'us', domain } = req.body || {};

  if (!apiKey || !keyword || !domain) {
    return res.status(400).json({
      error: 'Missing required fields: apiKey, keyword, domain',
    });
  }

  const cleanDomain = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: { q: keyword, gl: country, hl: 'en', num: 100, api_key: apiKey },
      timeout: 25000,
      headers: { Accept: 'application/json', 'User-Agent': 'RankPulse/1.0' },
    });

    const data = response.data;

    if (data.error) {
      return res.status(400).json({ error: data.error });
    }

    let position = -1;
    if (Array.isArray(data.organic_results)) {
      for (let i = 0; i < data.organic_results.length; i++) {
        const link = data.organic_results[i].link || '';
        const rd = link.toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0];
        if (
          rd === cleanDomain ||
          rd === `www.${cleanDomain}` ||
          cleanDomain === `www.${rd}` ||
          rd.endsWith(`.${cleanDomain}`)
        ) {
          position = i + 1;
          break;
        }
      }
    }

    return res.status(200).json({
      success: true,
      position,
      keyword,
      domain: cleanDomain,
      country,
      totalResults: data.search_information?.total_results ?? null,
      checkedAt: new Date().toISOString(),
    });

  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request timed out. Try again.' });
    }
    if (err.response) {
      return res.status(err.response.status).json({
        error: `SerpAPI error ${err.response.status}`,
        details: err.response.data,
      });
    }
    if (err.request) {
      return res.status(503).json({ error: 'Cannot reach SerpAPI. Check your key and connection.' });
    }
    return res.status(500).json({ error: err.message });
  }
};
