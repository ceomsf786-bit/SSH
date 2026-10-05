/**
 * SNT Homework Submission - Google Apps Script backend
 *
 * Deployment:
 *   Execute as: Me
 *   Who has access: Anyone
 */

const ROOT_FOLDER_ID = '1LtM8wopuS0Yd5kAq3hsUYLuDvUZ5u6rl';
const RETURN_URL = 'https://ceomsf786-bit.github.io/SSH/submit-homework.html';
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const UPLOAD_KEY = 'SNT-T4-HOMEWORK-2026-ENK';

function doGet() {
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
    const base64 = String(p.file_base64 || '').replace(/^data:application\/pdf;base64,/, '');

    if (!/^(?:[4-9]|1[0-2])$/.test(grade)) {
      return redirectResult_('error', p, 'Invalid grade.');
    }
    if (!subject || !student || !/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) {
      return redirectResult_('error', p, 'Student, subject or homework date is missing.');
    }
    if (mimeType !== 'application/pdf' || !base64) {
      return redirectResult_('error', p, 'The homework PDF is missing.');
    }

    const bytes = Utilities.base64Decode(base64);
    if (!bytes.length || bytes.length > MAX_PDF_BYTES) {
      return redirectResult_('error', p, 'The homework file is too large.');
    }

    const submittedAt = new Date();
    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const studentFolder = getOrCreateFolder_(root, safeSegment_(student));

    // Every hand-in receives a unique filename. Existing submissions never block a new one.
    const fileName = buildFileName_(activityDate, subject, task, submittedAt);
    const blob = Utilities.newBlob(bytes, 'application/pdf', fileName);
    const file = studentFolder.createFile(blob);

    file.setDescription(
      `SNT Homework Submission\nStudent: ${student}\nGrade: ${grade}\nSubject: ${subject}\nHomework date: ${activityDate}` +
      (task ? `\nActivity: ${task}` : '') +
      `\nSubmitted: ${submittedAt.toISOString()}`
    );

    return redirectResult_('success', p, '');
  } catch (error) {
    console.error(error);
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

function buildFileName_(date, subject, task, submittedAt) {
  const taskPart = task ? `__${safeSegment_(task)}` : '';
  const timePart = Utilities.formatDate(
    submittedAt || new Date(),
    'Africa/Johannesburg',
    'HHmmss-SSS'
  );
  return `${date}__${safeSegment_(subject)}${taskPart}__${timePart}.pdf`;
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
