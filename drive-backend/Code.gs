/**
 * SNT Homework Submission - Google Apps Script backend
 *
 * Deployment:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Required Script Property:
 *   UPLOAD_KEY = a private random term key
 */

const ROOT_FOLDER_ID = '1IS-e-BS0cdEAYuiokx1M9leL8Sf-Hcfa';
const RETURN_URL = 'https://ceomsf786-bit.github.io/SSH/submit-homework.html';
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function doGet() {
  return HtmlService.createHtmlOutput('SNT Homework Submission backend is online.');
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const uploadKey = String(p.upload_key || '');
    const expectedKey = PropertiesService.getScriptProperties().getProperty('UPLOAD_KEY');

    if (!expectedKey) {
      return redirectResult_('error', p, 'Teacher setup is incomplete.');
    }
    if (!uploadKey || uploadKey !== expectedKey) {
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

    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const gradeFolder = getOrCreateFolder_(root, `Grade ${grade}`);
    const subjectFolder = getOrCreateFolder_(gradeFolder, safeSegment_(subject));
    const dateFolder = getOrCreateFolder_(subjectFolder, activityDate);

    const fileName = buildFileName_(activityDate, grade, subject, task, student);

    // No resubmissions: never overwrite an existing learner/date/subject/activity PDF.
    if (dateFolder.getFilesByName(fileName).hasNext()) {
      return redirectResult_('duplicate', p, '');
    }

    const blob = Utilities.newBlob(bytes, 'application/pdf', fileName);
    const file = dateFolder.createFile(blob);
    file.setDescription(
      `SNT Homework Submission\nStudent: ${student}\nGrade: ${grade}\nSubject: ${subject}\nHomework date: ${activityDate}` +
      (task ? `\nActivity: ${task}` : '') +
      `\nSubmitted: ${new Date().toISOString()}`
    );

    return redirectResult_('success', p, '');
  } catch (error) {
    console.error(error);
    return redirectResult_('error', (e && e.parameter) || {}, 'Submission could not be saved. Please tell your teacher.');
  }
}

function getOrCreateFolder_(parent, name) {
  const existing = parent.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : parent.createFolder(name);
}

function buildFileName_(date, grade, subject, task, student) {
  const taskPart = task ? `__${safeSegment_(task)}` : '';
  return `${date}__Grade-${grade}__${safeSegment_(subject)}${taskPart}__${safeSegment_(student)}.pdf`;
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
