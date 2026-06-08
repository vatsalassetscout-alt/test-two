const { getAllTrackers } = require('../_sheets');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rows = await getAllTrackers();
    res.json({
      total:    rows.length,
      top3:     rows.filter(r => r.position !== null && r.position >= 1 && r.position <= 3).length,
      top10:    rows.filter(r => r.position !== null && r.position >= 1 && r.position <= 10).length,
      notFound: rows.filter(r => r.position === -1).length,
      pending:  rows.filter(r => r.position === null).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
