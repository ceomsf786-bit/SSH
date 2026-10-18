/**
 * SNT Homework Submission - Google Apps Script backend
 *
 * Deployment:
 *   Execute as: Me
 *   Who has access: Anyone
 */

const ROOT_FOLDER_ID = '1LtM8wopuS0Yd5kAq3hsUYLuDvUZ5u6rl';
const RETURN_URL = 'https://ceomsf786-bit.github.io/SSH/submit-homework.html';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const UPLOAD_KEY = 'SNT-T4-HOMEWORK-2026-ENK';

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (String(p.action || '') === 'track') {
    if (String(p.upload_key || '') !== UPLOAD_KEY) {
      return ContentService.createTextOutput('ignored');
    }
    const events = ['page_open', 'student_selected', 'submission_attempt', 'client_error'];
    if (events.indexOf(String(p.event || '')) !== -1) {
      try {
        logActivityEvent_({
          event: p.event, visit_id: p.visit_id, student: p.student,
          grade: p.grade, subject: p.subject, week: p.week,
          status: p.event === 'client_error' ? 'error' : 'observed'
        });
      } catch (err) { console.error('Activity tracking error:', err); }
    }
    return ContentService.createTextOutput('ok');
  }
  return HtmlService.createHtmlOutput('SNT Homework Submission backend is online.');
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const uploadKey = String(p.upload_key || '');

    if (!uploadKey || uploadKey !== UPLOAD_KEY) {
      return redirectResult_('error', p, 'Invalid homework submission link.');
    }

    const grade = String(p.grade || '').trim();
    const subject = cleanText_(p.subject, 80);
    const task = cleanText_(p.task, 80);
    const student = cleanText_(p.student, 80);
    const activityDate = String(p.activity_date || '').trim();
    const mimeType = String(p.mime_type || '').trim();
    const originalFileName = cleanText_(p.file_name, 180);
    const base64 = String(p.file_base64 || '').replace(/^data:[^;]+;base64,/, '');

    if (!/^(?:[4-9]|1[0-2])$/.test(grade)) {
      return redirectResult_('error', p, 'Invalid grade.');
    }
    if (!subject || !student || !/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
      return redirectResult_('error', p, 'Student, subject or homework date is missing.');
    }
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedMimeTypes.indexOf(mimeType) === -1 || !base64) {
      return redirectResult_('error', p, 'Please submit a PDF, DOC or DOCX homework file.');
    }

    const bytes = Utilities.base64Decode(base64);
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
      return redirectResult_('error', p, 'The homework file is too large.');
    }

    const submittedAt = new Date();
    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const studentFolder = getOrCreateFolder_(root, safeSegment_(student));

    // Every hand-in receives a unique filename. Existing submissions never block a new one.
    const extension = extensionFor_(mimeType, originalFileName);
    const fileName = buildFileName_(activityDate, subject, task, submittedAt, extension);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = studentFolder.createFile(blob);

    file.setDescription(
      `SNT Homework Submission\nStudent: ${student}\nGrade: ${grade}\nSubject: ${subject}\nHomework date: ${activityDate}` +
      (task ? `\nActivity: ${task}` : '') +
      `\nSubmitted: ${submittedAt.toISOString()}`
    );

    // Drive is the primary store; audit is best effort after a confirmed save.
    try {
      logActivityEvent_({
        event: 'submission_success', visit_id: p.visit_id,
        student: student, grade: grade, subject: subject, week: task,
        status: 'submitted', drive_file_id: file.getId(),
        drive_file_name: file.getName()
      });
    } catch (auditError) {
      console.error('PDF saved but Sheets activity log failed:', auditError);
    }

    return redirectResult_('success', p, '');
  } catch (error) {
    console.error(error);
    const failed = (e && e.parameter) || {};
    if (String(failed.upload_key || '') === UPLOAD_KEY) {
      try {
        logActivityEvent_({
          event: 'submission_failed', visit_id: failed.visit_id,
          student: failed.student, grade: failed.grade,
          subject: failed.subject, week: failed.task, status: 'error',
          detail: String(error && error.message || error).slice(0, 240)
        });
      } catch (auditError) {
        console.error('Could not log upload failure:', auditError);
      }
    }
    return redirectResult_(
      'error',
      (e && e.parameter) || {},
      'Submission could not be saved. Please tell your teacher.'
    );
  }
}

function getOrCreateFolder_(parent, name) {
  const existing = parent.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : parent.createFolder(name);
}

function buildFileName_(date, subject, task, submittedAt, extension) {
  const taskPart = task ? `__${safeSegment_(task)}` : '';
  const timePart = Utilities.formatDate(
    submittedAt || new Date(),
    'Africa/Johannesburg',
    'HHmmss-SSS'
  );
  const ext = String(extension || 'pdf').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'pdf';
  return `${date}__${safeSegment_(subject)}${taskPart}__${timePart}.${ext}`;
}

function extensionFor_(mimeType, originalFileName) {
  const name = String(originalFileName || '').toLowerCase();
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) return 'docx';
  if (mimeType === 'application/msword' || name.endsWith('.doc')) return 'doc';
  return 'bin';
}

function safeSegment_(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|#%{}\[\]]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'Homework';
}

function cleanText_(value, maxLen) {
  return String(value || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen || 80);
}

function redirectResult_(status, p, message) {
  const query = [
    `grade=${encodeURIComponent(String(p.grade || ''))}`,
    `subject=${encodeURIComponent(String(p.subject || ''))}`,
    `task=${encodeURIComponent(String(p.task || ''))}`,
    `key=${encodeURIComponent(String(p.upload_key || ''))}`,
    `status=${encodeURIComponent(status)}`,
    `student=${encodeURIComponent(String(p.student || ''))}`,
    `date=${encodeURIComponent(String(p.activity_date || ''))}`,
    `message=${encodeURIComponent(String(message || ''))}`
  ].join('&');

  const target = `${RETURN_URL}?${query}`;
  const safeTarget = JSON.stringify(target);
  return HtmlService.createHtmlOutput(
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<p>Returning to SNT...</p>` +
    `<script>window.location.replace(${safeTarget});</script>`
  );
}


/*
 * Private school activity log. Run setupActivityLog() once as the script owner
 * to grant Sheets permission and obtain the spreadsheet link.
 * No IP addresses, browser fingerprints or homework answer text are collected.
 */
const ACTIVITY_PROPERTY = 'SNT_ACTIVITY_LOG_SPREADSHEET_ID';
const ACTIVITY_COLUMNS = [
  'Timestamp (South Africa)', 'Event', 'Visit ID', 'Student ID',
  'Student name', 'Grade', 'Subject', 'Week', 'Status',
  'Drive File ID', 'Drive File Name', 'Details'
];

function setupActivityLog() {
  const log = getActivitySheet_();
  console.log('Activity register ready: ' + log.getParent().getUrl());
  return log.getParent().getUrl();
}

function checkActivityLog() {
  const log = getActivitySheet_();
  console.log('Activity register: ' + log.getParent().getUrl());
  console.log('Logged events: ' + Math.max(0, log.getLastRow() - 1));
}

function getActivitySheet_() {
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty(ACTIVITY_PROPERTY);
  if (id) {
    const existing = SpreadsheetApp.openById(id).getSheetByName('Events');
    if (!existing) throw new Error('Missing Events sheet in activity register.');
    return existing;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const again = properties.getProperty(ACTIVITY_PROPERTY);
    if (again) {
      const existing = SpreadsheetApp.openById(again).getSheetByName('Events');
      if (!existing) throw new Error('Missing Events sheet in activity register.');
      return existing;
    }

    // Stored in the Apps Script owner's PRIVATE My Drive, not student folders.
    const spreadsheet = SpreadsheetApp.create('SNT HOMEWORK ACTIVITY REGISTER');
    spreadsheet.setSpreadsheetTimeZone('Africa/Johannesburg');
    const log = spreadsheet.getSheets()[0];
    log.setName('Events');
    log.getRange(1, 1, 1, 12).setValues([ACTIVITY_COLUMNS]);
    log.setFrozenRows(1);
    log.getRange(1, 1, 1, 12).setFontWeight('bold')
      .setBackground('#17365D').setFontColor('#FFFFFF');
    log.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    log.getRange('D:E').setNumberFormat('@');

    const overview = spreadsheet.insertSheet('Overview');
    overview.getRange('A1').setValue('SNT Homework Activity - Overview').setFontWeight('bold');
    overview.getRange('A3:B7').setValues([
      ['Page visits', '=COUNTIF(Events!B2:B,"page_open")'],
      ['Learner selections', '=COUNTIF(Events!B2:B,"student_selected")'],
      ['Submission attempts', '=COUNTIF(Events!B2:B,"submission_attempt")'],
      ['Successful submissions', '=COUNTIF(Events!B2:B,"submission_success")'],
      ['Failed submissions', '=COUNTIF(Events!B2:B,"submission_failed")+COUNTIF(Events!B2:B,"client_error")']
    ]);
    overview.getRange('A9').setValue('Successful submissions by learner');
    overview.getRange('A10').setFormula(
      "=QUERY(Events!A1:L,\"select E, count(E), max(A) where B = 'submission_success' and E is not null group by E label E 'Learner', count(E) 'Submissions', max(A) 'Last submitted'\",1)"
    );
    overview.getRange('C:C').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    overview.setColumnWidths(1, 3, 215);
    properties.setProperty(ACTIVITY_PROPERTY, spreadsheet.getId());
    console.log('Created private activity register: ' + spreadsheet.getUrl());
    return log;
  } finally {
    lock.releaseLock();
  }
}

function logActivityEvent_(data) {
  const types = ['page_open', 'student_selected', 'submission_attempt',
    'submission_success', 'submission_failed', 'client_error'];
  if (types.indexOf(String(data.event || '')) === -1) return;

  const log = getActivitySheet_();
  const clean = function(value, max) {
    const result = cleanText_(value || '', max);
    // Prevent student-supplied values being evaluated as Sheets formulas.
    return /^[=+@-]/.test(result) ? "'" + result : result;
  };
  const row = [
    new Date(), clean(data.event, 40), clean(data.visit_id, 100),
    clean(data.student, 80), clean(data.student, 80), clean(data.grade, 4),
    clean(data.subject, 80), clean(data.week, 40), clean(data.status, 40),
    clean(data.drive_file_id, 150), clean(data.drive_file_name, 220),
    clean(data.detail, 240)
  ];
  log.appendRow(row);
}

/**
 * Optional diagnostic. Run manually inside Apps Script if Drive permissions need checking.
 */
function checkDriveAccess() {
  console.log('Effective user: ' + Session.getEffectiveUser().getEmail());
  console.log('Testing folder ID: ' + ROOT_FOLDER_ID);

  try {
    const folder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    console.log('SUCCESS - Folder found: ' + folder.getName());
  } catch (error) {
    console.log('FAILED - ' + error.toString());
  }
}
