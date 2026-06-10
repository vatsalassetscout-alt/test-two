const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { return res.status(405).json({ error: 'Method not allowed' }); }

  const { apiKey, keyword, country = 'in', domain } = req.body || {};

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

  let position = -1;
  let totalResultsCounted = 0;
  let totalResults = null;
  
  // Define how many pages you want to check deep (e.g., 3 pages = top ~30 positions)
  const MAX_PAGES = 3; 

  try {
    // Loop through search pages sequentially using the 'start' parameter
    for (let page = 0; page < MAX_PAGES; page++) {
      const startOffset = page * 10; // Page 0 = start 0, Page 1 = start 10, Page 2 = start 20

      const response = await axios.get('https://serpapi.com/search.json', {
        params: { 
          q: keyword, 
          gl: country, 
          hl: 'en', 
          start: startOffset, // Changed from num: 100 to dynamic pagination offset
          api_key: apiKey 
        },
        timeout: 8000, // Reduced single request timeout to allow room for multiple page checks
        headers: { Accept: 'application/json', 'User-Agent': 'RankPulse/1.0' },
      });

      const data = response.data;

      if (data.error) {
        return res.status(400).json({ error: data.error });
      }

      // Capture the global total results metadata on the first run
      if (page === 0) {
        totalResults = data.search_information?.total_results ?? null;
      }

      if (Array.isArray(data.organic_results) && data.organic_results.length > 0) {
        let domainFound = false;

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
            // Calculate absolute position across pages using SerpApi's exact position tracker
            position = data.organic_results[i].position || (startOffset + i + 1);
            domainFound = true;
            break;
          }
        }

        if (domainFound) break; // Break out of the page loop if domain is found

        // Keep track of total items scanned across loops
        totalResultsCounted += data.organic_results.length;
      } else {
        // Break out of the loop if Google runs out of search results early
        break; 
      }
    }

    return res.status(200).json({
      success: true,
      position,
      keyword,
      domain: cleanDomain,
      country,
      totalResults: totalResults,
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
