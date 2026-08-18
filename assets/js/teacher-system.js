/* EXPORT + CSV IMPORT + TEACHERS */
function downloadCsvFile(filename, rows){
  if(!rows || rows.length===0){alert("No data to export.");return}
  const headers=Object.keys(rows[0]);
  const csv=[headers.join(",")].concat(rows.map(row=>headers.map(h=>{
    let v=row[h] ?? "";
    v=String(v).replaceAll('"','""');
    return `"${v}"`;
  }).join(","))).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
async function adminExportResultsCsv(){
  if(!requireAdmin())return;
  const args=adminFilterArgs();
  delete args.p_activity_type;
  delete args.p_limit;
  const rows=await adminRpc("admin_score_summary",{...args,p_limit:1000});
  const exportRows=(rows||[]).map(r=>({
    student:r.full_name, learner_code:r.learner_code, grade:r.grade_level, subject:r.subject_name, quiz:r.quiz_title,
    attempts:r.attempts, latest_percentage:Number(r.latest_percentage||0).toFixed(0), best_percentage:Number(r.best_percentage||0).toFixed(0), average_percentage:Number(r.average_percentage||0).toFixed(0),
    total_score:Number(r.total_score||0).toFixed(1), total_possible:Number(r.total_possible||0).toFixed(1), last_submitted_at:r.last_submitted_at||""
  }));
  downloadCsvFile("SNT-results-export.csv", exportRows);
}
function parseCsvSimple(text){
  const rows=[]; let row=[], cell="", inQuotes=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(c==='"' && inQuotes && n==='"'){cell+='"';i++;continue}
    if(c==='"'){inQuotes=!inQuotes;continue}
    if(c==="," && !inQuotes){row.push(cell);cell="";continue}
    if((c==="\n"||c==="\r") && !inQuotes){if(c==="\r"&&n==="\n")i++;row.push(cell);cell="";if(row.some(x=>x.trim()!==""))rows.push(row);row=[];continue}
    cell+=c;
  }
  row.push(cell); if(row.some(x=>x.trim()!==""))rows.push(row); return rows;
}
function adminDownloadQuestionCsvTemplate(){
  downloadCsvFile("SNT-question-import-template.csv", [{quiz_id:"",term:"Term 1",topic:"Chapter / Topic",unit:"Unit 1",question_no:"1",question_type:"mcq",question:"Type question here",image_url:"",options_json:'[{"value":"A","label":"Answer A"},{"value":"B","label":"Answer B"},{"value":"C","label":"Answer C"},{"value":"D","label":"Answer D"},{"value":"E","label":"Answer E"}]',correct_answer_json:'"A"',marks:"1",accepted_answers_json:"[]",explanation:"",active:"true"}]);
}
async function adminImportQuestionsCsv(){
  if(!requireAdmin())return;
  const file=$("admQuestionCsvFile")?.files[0]; if(!file){adminMsg("Choose a CSV file first.",true);return}
  const defaultQuiz=$("admQuestionCsvQuiz")?.value;
  const parsed=parseCsvSimple(await file.text());
  if(parsed.length<2){adminMsg("CSV is empty or missing rows.",true);return}
  const headers=parsed[0].map(h=>h.trim()); let count=0;
  for(const row of parsed.slice(1)){
    const obj={}; headers.forEach((h,i)=>obj[h]=(row[i]??"").trim());
    const quizId=obj.quiz_id || defaultQuiz; if(!quizId || !obj.question) continue;
    let options=null, correct=null, accepted=[];
    try{options=obj.options_json?JSON.parse(obj.options_json):null; correct=obj.correct_answer_json?JSON.parse(obj.correct_answer_json):null; accepted=obj.accepted_answers_json?JSON.parse(obj.accepted_answers_json):[]}catch(e){adminMsg("CSV JSON error near question "+(obj.question_no||"?")+": "+e.message,true);return}
    await adminRpc("admin_upsert_question",{p_token:adminState.token,p_question_id:null,p_quiz_id:quizId,p_question_no:Number(obj.question_no||1),p_question_type:obj.question_type||"mcq",p_question:obj.question,p_term:obj.term||null,p_topic:obj.topic||null,p_unit:obj.unit||null,p_image_url:obj.image_url||null,p_options:options,p_correct_answer:correct,p_marks:Number(obj.marks||1),p_accepted_answers:accepted,p_explanation:obj.explanation||null,p_active:String(obj.active||"true").toLowerCase()!=="false"});
    count++;
  }
  adminMsg(`Imported ${count} question(s).`); await adminLoadQuestions();
}
async function adminLoadTeachers(){
  if(!requireAdmin())return;
  const rows=await adminRpc("admin_list_teachers",{p_token:adminState.token});
  adminState.teachers=rows||[];
  adminRenderTeachersTable();
}
function adminRenderTeachersTable(){
  const search=($("admTeacherSearch")?.value||"").toLowerCase().trim();
  const rows=(adminState.teachers||[]).filter(t=>!search || [t.full_name,t.email,t.active].join(" ").toLowerCase().includes(search));
  $("adminTeachersTable").innerHTML=`<table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${escapeHtml(t.full_name)}</td><td>${escapeHtml(t.email)}</td><td>${t.active}</td><td><button class="small-btn" onclick="adminEditTeacher('${t.id}', this.dataset.name, this.dataset.email, '${t.active}')" data-name="${escapeHtml(t.full_name)}" data-email="${escapeHtml(t.email)}">Edit</button></td></tr>`).join("")}</tbody></table>`;
}
function adminEditTeacher(id,name,email,active){$("admTeacherId").value=id;$("admTeacherName").value=name;$("admTeacherEmail").value=email;$("admTeacherCode").value="";$("admTeacherActive").value=String(active)}
function adminClearTeacherForm(){$("admTeacherId").value="";$("admTeacherName").value="";$("admTeacherEmail").value="";$("admTeacherCode").value="";$("admTeacherActive").value="true"}
async function adminSaveTeacher(){
  if(!requireAdmin())return;
  await adminRpc("admin_upsert_teacher",{p_token:adminState.token,p_teacher_id:$("admTeacherId").value||null,p_full_name:$("admTeacherName").value.trim(),p_email:$("admTeacherEmail").value.trim(),p_teacher_code:$("admTeacherCode").value.trim()||null,p_active:$("admTeacherActive").value==="true"});
  adminMsg("Teacher saved."); adminClearTeacherForm(); await adminLoadTeachers();
}
async function adminAttachImageUrlManual(){
  if(!requireAdmin())return;
  const qid=$("admImageQuestion")?.value; const url=$("admImageUrlManual")?.value.trim();
  if(!qid){adminMsg("Choose a question first.",true);return}
  if(!url){adminMsg("Paste an image URL first.",true);return}
  await adminRpc("admin_attach_image_to_question",{p_token:adminState.token,p_question_id:qid,p_image_url:url});
  $("admUploadedImageUrl").value=url;
  adminMsg("Image URL attached to question.");
  await adminLoadImageQuestions();
}
