/**
 * PatriotHacks — interest-list backend (the "hidden database").
 *
 * Paste this into the Apps Script editor of the Google Sheet you want to
 * collect emails in (Extensions → Apps Script), then deploy it as a Web
 * app (Deploy → New deployment → Web app; Execute as: Me; Who has access:
 * Anyone). Copy the resulting /exec URL into SIGNUP_ENDPOINT in
 * src/config.ts.
 *
 * Each signup appends a row:  [ timestamp, email ]
 * Only people you share the Sheet with can read it.
 */
function doPost(e) {
  var lock = LockService.getScriptLock()
  lock.waitLock(20000) // avoid two signups clobbering the same row
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()

    var email = e && e.parameter && e.parameter.email
      ? String(e.parameter.email).trim()
      : ''

    // Basic sanity check so junk doesn't fill the sheet.
    var looksValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    if (looksValid) {
      sheet.appendRow([new Date(), email])
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: looksValid }))
      .setMimeType(ContentService.MimeType.JSON)
  } finally {
    lock.releaseLock()
  }
}

// Lets you open the /exec URL in a browser to confirm it's deployed.
function doGet() {
  return ContentService
    .createTextOutput('PatriotHacks signup endpoint is live.')
    .setMimeType(ContentService.MimeType.TEXT)
}
