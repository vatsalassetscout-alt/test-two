const { google } = require('googleapis');

// ─── CHANGE THESE IF NEEDED ───────────────────────────────────────────────
const SPREADSHEET_ID = '1GhLMTjKZh2t-pMTLPUKIGkG47phWn2FNh823-phqhAs';
const SHEET_NAME     = 'RankPulse'; // change if your sheet tab is named differently
// ──────────────────────────────────────────────────────────────────────────

const RANGE = `${SHEET_NAME}!A:F`;

function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getAllTrackers() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
  });
  const rows = (res.data.values || []).slice(1); // skip header row
  return rows
    .filter(r => r[0])
    .map(r => ({
      id: r[0],
      domain: r[1] || '',
      keyword: r[2] || '',
      country: r[3] || 'us',
      position: r[4] !== undefined && r[4] !== '' ? Number(r[4]) : null,
      checkedAt: r[5] || null,
    }));
}

async function appendTracker(tracker) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        tracker.id,
        tracker.domain,
        tracker.keyword,
        tracker.country,
        tracker.position ?? '',
        tracker.checkedAt || '',
      ]],
    },
  });
}

async function findRowIndex(id) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) return i + 1; // 1-based row number
  }
  return -1;
}

async function updateTrackerRow(rowIndex, tracker) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${rowIndex}:F${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        tracker.id,
        tracker.domain,
        tracker.keyword,
        tracker.country,
        tracker.position ?? '',
        tracker.checkedAt || '',
      ]],
    },
  });
}

async function deleteTrackerRow(rowIndex) {
  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetId = meta.data.sheets.find(
    s => s.properties.title === SHEET_NAME
  )?.properties.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-based
            endIndex: rowIndex,
          },
        },
      }],
    },
  });
}

module.exports = { getAllTrackers, appendTracker, findRowIndex, updateTrackerRow, deleteTrackerRow };
