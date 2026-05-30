const axios = require('axios');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { apiKey, keyword, country, domain } = req.body;

    // Validate required fields
    if (!apiKey || !keyword || !domain) {
        return res.status(400).json({ 
            error: 'Missing required parameters',
            required: ['apiKey', 'keyword', 'domain'],
            received: { 
                hasApiKey: !!apiKey, 
                hasKeyword: !!keyword, 
                hasDomain: !!domain 
            }
        });
    }

    try {
        // Clean domain for matching
        const cleanDomain = domain.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .split('/')[0];

        console.log(`[Vercel] Checking: "${keyword}" on ${cleanDomain} (${country})`);

        // Call SerpAPI
        const url = 'https://serpapi.com/search.json';
        const params = {
            q: keyword,
            gl: country,
            hl: 'en',
            num: 100,
            api_key: apiKey
        };

        const response = await axios.get(url, { 
            params,
            timeout: 25000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'RankPulse-Tracker/1.0'
            }
        });
        
        const data = response.data;

        // Check for API errors
        if (data.error) {
            console.error('SerpAPI error:', data.error);
            return res.status(400).json({ error: data.error });
        }

        // Find position of domain in organic results
        let position = -1;
        let foundAtIndex = -1;
        
        if (data.organic_results && Array.isArray(data.organic_results)) {
            for (let i = 0; i < data.organic_results.length; i++) {
                const result = data.organic_results[i];
                if (result.link) {
                    let resultDomain = result.link.toLowerCase()
                        .replace(/^https?:\/\//, '')
                        .replace(/^www\./, '')
                        .split('/')[0];
                    
                    // Check various domain match patterns
                    if (resultDomain === cleanDomain || 
                        resultDomain === `www.${cleanDomain}` ||
                        cleanDomain === `www.${resultDomain}` ||
                        resultDomain.endsWith(`.${cleanDomain}`)) {
                        position = i + 1;
                        foundAtIndex = i;
                        console.log(`[Vercel] Found at position ${position}`);
                        break;
                    }
                }
            }
        }

        // Prepare response
        const responseData = {
            success: true,
            position: position,
            keyword: keyword,
            domain: cleanDomain,
            country: country,
            totalResults: data.search_information?.total_results || 0,
            topResult: data.organic_results && data.organic_results[0] ? {
                title: data.organic_results[0].title,
                link: data.organic_results[0].link,
                snippet: data.organic_results[0].snippet
            } : null,
            checkedAt: new Date().toISOString()
        };

        console.log(`[Vercel] Returning position ${position} for "${keyword}"`);
        res.status(200).json(responseData);

    } catch (error) {
        console.error('[Vercel] Error:', error.message);
        
        // Handle different error types
        if (error.code === 'ECONNABORTED') {
            res.status(504).json({ error: 'Request timeout. Please try again.' });
        } else if (error.response) {
            res.status(error.response.status).json({ 
                error: `SerpAPI error: ${error.response.status}`,
                details: error.response.data
            });
        } else if (error.request) {
            res.status(503).json({ error: 'Cannot reach SerpAPI. Check your API key and internet connection.' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
};
