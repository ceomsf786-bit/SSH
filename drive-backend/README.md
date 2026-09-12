# SNT Homework Drive Submission Backend

This folder contains the Google Apps Script backend for `submit-homework.html`.

## Architecture

Student Hub / homework document  
→ `submit-homework.html?grade=9&subject=Natural%20Science&key=TERM_KEY`  
→ student chooses name + homework date  
→ photos or typed answers are converted in the browser to **one PDF**  
→ Google Apps Script  
→ `SNT HOMEWORK SUBMISSIONS / Grade / Subject / Date / Student.pdf`

The Drive destination folder is already created:

- Folder: `SNT HOMEWORK SUBMISSIONS`
- Folder ID: `1IS-e-BS0cdEAYuiokx1M9leL8Sf-Hcfa`

## One-time Google Apps Script deployment

1. Open `script.google.com` and create a new project called **SNT Homework Upload Backend**.
2. Replace the default code with `Code.gs` from this folder.
3. In **Project Settings → Script properties**, add:
   - Property: `UPLOAD_KEY`
   - Value: a private random Term 4 key.
4. Choose **Deploy → New deployment → Web app**.
5. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Deploy and copy the `/exec` Web App URL.
7. Paste that URL into:
   - `assets/js/homework-submit-config.js`
   - `window.SNT_HOMEWORK_UPLOAD_ENDPOINT = "PASTE_EXEC_URL_HERE";`

## Homework link format

Use a link like:

`https://ceomsf786-bit.github.io/SSH/submit-homework.html?grade=9&subject=Natural%20Science&key=YOUR_TERM_KEY`

Optional future activity label:

`&task=Page%20100%20Activity%201`

The learner never types the subject or grade. Those are passed automatically in the homework link.

## Rules already enforced

- Student name comes from the existing Student Hub `list_grade_students` RPC.
- Subject + grade come from the URL.
- Learner chooses the homework date.
- Submission can be typed answers or multiple JPG/PNG images.
- Everything is converted to one PDF before upload.
- Maximum 8 images.
- Maximum 5 MB per image.
- Maximum 10 MB final PDF.
- Existing submission filename is never overwritten.
- Duplicate submission returns **Already submitted**.
- Teacher can reset manually by deleting the learner PDF from the Drive date folder.
- Google Drive credentials are never exposed in GitHub Pages.
