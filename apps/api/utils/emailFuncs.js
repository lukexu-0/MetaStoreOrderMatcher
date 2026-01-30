function extractOrderTrackingToNewSheet() {
  const userId = 'me';
  const fromFilter = 'from:store@email.meta.com';
  const startMs = Date.UTC(2025, 9, 1);
  const endMs = Date.UTC(2026, 0, 1);
  const state = getRunState_();
  const resumeMessageId = state.runComplete ? '' : state.resumeMessageId;
  const incrementalAfterMs = state.runComplete ? state.latestProcessedMs : 0;
  const query = buildQuery_(fromFilter, startMs, endMs, incrementalAfterMs);

  setRunComplete_(false);

  Logger.log('Starting extraction.');
  Logger.log('Query: %s', query);
  const messageIds = listAllMessageIds_(userId, query);
  Logger.log('Message IDs found: %s', messageIds.length);

  const sheetInfo = getOrCreateSheet_(state);
  const spreadsheet = sheetInfo.spreadsheet;
  const sheet = sheetInfo.sheet;
  if (sheetInfo.isNew) {
    sheet
      .getRange(1, 1, 1, 3)
      .setValues([['Total Quantity', 'Tracking Number', 'Email Date']]);
    Logger.log('Sheet created: %s', spreadsheet.getUrl());
  } else {
    Logger.log('Resuming sheet: %s', spreadsheet.getUrl());
  }

  let startIndex = 0;
  if (resumeMessageId) {
    const resumeIndex = messageIds.indexOf(resumeMessageId);
    if (resumeIndex >= 0) {
      startIndex = resumeIndex + 1;
    }
  }

  let nextRow = sheetInfo.nextRow;
  let maxProcessedMs = state.latestProcessedMs || 0;
  let processedCount = 0;
  let lastProcessedMessageId = '';
  let lastProcessedMs = 0;

  for (let i = startIndex; i < messageIds.length; i++) {
    const metadata = Gmail.Users.Messages.get(userId, messageIds[i], {
      format: 'metadata',
      metadataHeaders: ['Subject', 'Date']
    });
    const internalMs = Number(metadata.internalDate);

    if (!isTargetSubject_(getHeaderValue_(metadata.payload.headers, 'Subject'))) {
      continue;
    }
    if (!isWithinDateRange_(internalMs, startMs, endMs)) {
      continue;
    }

    const full = Gmail.Users.Messages.get(userId, metadata.id, {
      format: 'full'
    });
    const body = getHtmlOrTextBody_(userId, full.id, full.payload);
    const row = [
      extractTotalQuantity_(body),
      extractTrackingNumber_(body),
      formatEmailDate_(internalMs)
    ];
    sheet.getRange(nextRow, 1, 1, 3).setValues([row]);
    nextRow += 1;

    processedCount += 1;
    lastProcessedMessageId = metadata.id;
    lastProcessedMs = internalMs;
    if (internalMs > maxProcessedMs) maxProcessedMs = internalMs;

    if (processedCount === 1 || processedCount % 50 === 0) {
      saveCheckpoint_(
        lastProcessedMessageId,
        lastProcessedMs,
        maxProcessedMs,
        spreadsheet.getId(),
        sheet.getSheetId(),
        nextRow
      );
      if (processedCount % 50 === 0) {
        Logger.log('Processed %s messages; checkpoint saved.', processedCount);
      }
    }
  }

  if (processedCount > 0) {
    saveCheckpoint_(
      lastProcessedMessageId,
      lastProcessedMs,
      maxProcessedMs,
      spreadsheet.getId(),
      sheet.getSheetId(),
      nextRow
    );
  }
  finalizeRunState_(maxProcessedMs);
  Logger.log('Sheet URL: %s', spreadsheet.getUrl());
}

function buildQuery_(fromFilter, startMs, endMs, incrementalAfterMs) {
  const baseAfter = 'after:' + formatDateForQuery_(startMs - 86400000);
  const baseBefore = 'before:' + formatDateForQuery_(endMs);
  let query = 'subject:"Your order #" "is on the way" ' + fromFilter + ' ';
  if (incrementalAfterMs && incrementalAfterMs > startMs) {
    query += 'after:' + formatDateForQuery_(incrementalAfterMs) + ' ';
  } else {
    query += baseAfter + ' ';
  }
  query += baseBefore;
  return query.trim();
}

function formatDateForQuery_(ms) {
  const date = new Date(ms);
  const tz = Session.getScriptTimeZone();
  return Utilities.formatDate(date, tz, 'yyyy/MM/dd');
}

function listAllMessageIds_(userId, query) {
  const messages = [];
  let pageToken;
  do {
    const response = Gmail.Users.Messages.list(userId, {
      q: query,
      maxResults: 500,
      pageToken: pageToken
    });
    if (response.messages && response.messages.length) {
      messages.push.apply(messages, response.messages);
    }
    pageToken = response.nextPageToken;
  } while (pageToken);
  return messages.map((message) => message.id);
}

function isTargetSubject_(subject) {
  if (!subject) return false;
  const normalized = subject.trim();
  return /^Your order #\d+ is on the way$/.test(normalized);
}

function isWithinDateRange_(internalDate, startMs, endMs) {
  if (!internalDate) return false;
  const ms = Number(internalDate);
  return ms >= startMs && ms < endMs;
}

function extractTrackingNumber_(html) {
  if (!html) return '';
  const match = html.match(/trackNums=([A-Za-z0-9]+)/);
  return match ? match[1] : '';
}

function extractTotalQuantity_(html) {
  if (!html) return 0;

  const divRegex = /<div[^>]*>\s*Quantity:\s*(\d+)\s*<\/div>/gi;
  const quantities = [];
  let match;
  while ((match = divRegex.exec(html)) !== null) {
    quantities.push(parseInt(match[1], 10));
  }
  if (quantities.length) {
    return sum_(quantities);
  }

  const fallbackRegex = /Quantity:\s*(\d+)/gi;
  const fallback = [];
  while ((match = fallbackRegex.exec(html)) !== null) {
    fallback.push(parseInt(match[1], 10));
  }
  if (!fallback.length) return 0;

  const deduped = dedupeIfRepeated_(fallback);
  return sum_(deduped);
}

function dedupeIfRepeated_(values) {
  if (values.length % 2 !== 0) return values;
  const half = values.length / 2;
  const first = values.slice(0, half).join(',');
  const second = values.slice(half).join(',');
  return first === second ? values.slice(half) : values;
}

function sum_(values) {
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i];
  }
  return total;
}

function getHeaderValue_(headers, name) {
  if (!headers || !headers.length) return '';
  const target = name.toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if ((header.name || '').toLowerCase() === target) {
      return header.value || '';
    }
  }
  return '';
}

function getRunState_() {
  const props = PropertiesService.getScriptProperties();
  const latestProcessedMs = Number(
    props.getProperty('orderTrackingLatestProcessedMs') || '0'
  );
  const nextRow = Number(props.getProperty('orderTrackingNextRow') || '2');
  return {
    latestProcessedMs: Number.isFinite(latestProcessedMs) ? latestProcessedMs : 0,
    resumeMessageId: props.getProperty('orderTrackingResumeMessageId') || '',
    resumeMs: Number(props.getProperty('orderTrackingResumeMs') || '0') || 0,
    runComplete: props.getProperty('orderTrackingRunComplete') === 'true',
    spreadsheetId: props.getProperty('orderTrackingSpreadsheetId') || '',
    sheetId: Number(props.getProperty('orderTrackingSheetId') || '0') || 0,
    nextRow: Number.isFinite(nextRow) && nextRow > 1 ? nextRow : 2
  };
}

function setRunComplete_(isComplete) {
  PropertiesService.getScriptProperties().setProperty(
    'orderTrackingRunComplete',
    String(!!isComplete)
  );
}

function saveCheckpoint_(
  messageId,
  messageMs,
  latestProcessedMs,
  spreadsheetId,
  sheetId,
  nextRow
) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('orderTrackingResumeMessageId', messageId || '');
  props.setProperty('orderTrackingResumeMs', String(messageMs || 0));
  if (latestProcessedMs) {
    props.setProperty('orderTrackingLatestProcessedMs', String(latestProcessedMs));
  }
  if (spreadsheetId) {
    props.setProperty('orderTrackingSpreadsheetId', spreadsheetId);
  }
  if (sheetId) {
    props.setProperty('orderTrackingSheetId', String(sheetId));
  }
  if (nextRow) {
    props.setProperty('orderTrackingNextRow', String(nextRow));
  }
}

function finalizeRunState_(latestProcessedMs) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('orderTrackingRunComplete', 'true');
  props.setProperty('orderTrackingResumeMessageId', '');
  props.setProperty('orderTrackingResumeMs', '0');
  props.setProperty('orderTrackingSpreadsheetId', '');
  props.setProperty('orderTrackingSheetId', '0');
  props.setProperty('orderTrackingNextRow', '2');
  if (latestProcessedMs) {
    props.setProperty('orderTrackingLatestProcessedMs', String(latestProcessedMs));
  }
}

function getOrCreateSheet_(state) {
  if (!state.runComplete && state.spreadsheetId && state.sheetId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(state.spreadsheetId);
      const sheet = spreadsheet.getSheetById(state.sheetId);
      if (sheet) {
        return {
          spreadsheet: spreadsheet,
          sheet: sheet,
          nextRow: state.nextRow,
          isNew: false
        };
      }
    } catch (e) {
      // Fall through to create new sheet.
    }
  }

  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMdd_HHmm'
  );
  const sheetName = 'Order Tracking ' + timestamp;
  const spreadsheet = SpreadsheetApp.create(sheetName);
  return {
    spreadsheet: spreadsheet,
    sheet: spreadsheet.getSheets()[0],
    nextRow: 2,
    isNew: true
  };
}

function formatEmailDate_(internalMs) {
  if (!internalMs) return '';
  return Utilities.formatDate(
    new Date(internalMs),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss'
  );
}

function getHtmlOrTextBody_(userId, messageId, payload) {
  const htmlPart = findFirstPartByMimeType_(payload, 'text/html');
  const htmlBody = getBodyFromPart_(userId, messageId, htmlPart);
  if (htmlBody) return htmlBody;

  const textPart = findFirstPartByMimeType_(payload, 'text/plain');
  const textBody = getBodyFromPart_(userId, messageId, textPart);
  if (textBody) return textBody;

  return getBodyFromPart_(userId, messageId, payload) || '';
}

function findFirstPartByMimeType_(part, targetMimeType) {
  if (!part) return null;

  if ((part.mimeType || '').toLowerCase() === targetMimeType.toLowerCase()) {
    return part;
  }

  if (part.parts && part.parts.length) {
    for (let i = 0; i < part.parts.length; i++) {
      const found = findFirstPartByMimeType_(part.parts[i], targetMimeType);
      if (found) return found;
    }
  }

  return null;
}

function getBodyFromPart_(userId, messageId, part) {
  if (!part || !part.body) return '';

  if (part.body.data != null) {
    const decoded = decodeGmailBodyData_(part.body.data);
    if (decoded) return decoded;
  }

  if (typeof part.body.attachmentId === 'string' && part.body.attachmentId) {
    const att = Gmail.Users.Messages.Attachments.get(
      userId,
      messageId,
      part.body.attachmentId
    );
    if (att && att.data != null) {
      const decoded = decodeGmailBodyData_(att.data);
      if (decoded) return decoded;
    }
  }

  return '';
}

function decodeGmailBodyData_(data) {
  if (data == null) return '';

  if (typeof data === 'string') {
    return base64UrlDecodeToString_(data);
  }

  if (Array.isArray(data)) {
    const bytes = data.map((b) => (b < 0 ? b + 256 : b));
    return Utilities.newBlob(bytes).getDataAsString('UTF-8');
  }

  try {
    return Utilities.newBlob(data).getDataAsString('UTF-8');
  } catch (e) {
    return '';
  }
}

function base64UrlDecodeToString_(b64url) {
  if (typeof b64url !== 'string' || !b64url.length) return '';

  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  const bytes = Utilities.base64Decode(padded);
  return Utilities.newBlob(bytes).getDataAsString('UTF-8');
}
