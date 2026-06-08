const { findRowIndex, deleteTrackerRow } = require('../../_sheets');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  try {
    const rowIdx = await findRowIndex(id);
    if (rowIdx < 0) return res.status(404).json({ error: 'Tracker not found' });
    await deleteTrackerRow(rowIdx);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
