const axios = require('axios');
const { getAllTrackers, findRowIndex, updateTrackerRow } = require('../../_sheets');

async function fetchRank(apiKey, keyword, domain, country) {
  const res = await axios.get('https://serpapi.com/search.json', {
    params: { q: keyword, gl: country, hl: 'en', num: 100, api_key: apiKey },
    timeout: 25000,
  });
  const data = res.data;
  if (data.error) throw new Error(data.error);
  if (!Array.isArray(data.organic_results)) return -1;
  for (let i = 0; i < data.organic_results.length; i++) {
    const link = (data.organic_results[i].link || '').toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (link === domain || link === `www.${domain}` || link.endsWith(`.${domain}`)) {
      return i + 1;
    }
  }
  return -1;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const { apiKey } = req.body || {};
  if (!apiKey) return res.status(400).json({ error: 'apiKey is required' });

  try {
    const trackers = await getAllTrackers();
    const tracker = trackers.find(t => t.id === id);
    if (!tracker) return res.status(404).json({ error: 'Tracker not found' });

    const position = await fetchRank(apiKey, tracker.keyword, tracker.domain, tracker.country);
    const checkedAt = new Date().toISOString();
    const updated = { ...tracker, position, checkedAt };

    const rowIdx = await findRowIndex(id);
    if (rowIdx > 0) await updateTrackerRow(rowIdx, updated);
    res.json(updated);
  } catch (err) {
    const status = err?.response?.status || 500;
    res.status(status).json({ error: err.message });
  }
};
