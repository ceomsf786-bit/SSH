/* MASTER CSV AUTO ALLOCATE */
function normText(v){return String(v??"").trim().toLowerCase().replace(/\s+/g," ")}
function adminFillMasterCsvSubjects(){
  const grade=Number($("admMasterCsvDefaultGrade")?.value||6);
  const select=$("admMasterCsvDefaultSubject");
  if(!select)return;
  const list=(adminState.subjects||[]).filter(s=>Number(s.grade_level)===grade && s.active!==false);
  if(!list.length){
    select.innerHTML='<option value="">No subjects found for this grade</option>';
    return;
  }
  select.innerHTML=list.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
}
function adminMasterSubjectId(row){
  const defaultGrade=Number($("admMasterCsvDefaultGrade")?.value||6);
  const defaultSubjectId=$("admMasterCsvDefaultSubject")?.value||"";
  const grade=Number(row.grade||row.grade_level||defaultGrade);
  const subjectName=String(row.subject||row.subject_name||"").trim();
  if(subjectName){
    const match=(adminState.subjects||[]).find(s=>Number(s.grade_level)===grade && normText(s.name)===normText(subjectName));
    if(match)return {subject_id:match.id, grade, subject_name:match.name};
    return {subject_id:null, grade, subject_name:subjectName, error:`Subject not found: Grade ${grade} - ${subjectName}`};
  }
  const def=(adminState.subjects||[]).find(s=>String(s.id)===String(defaultSubjectId));
  if(def)return {subject_id:def.id, grade:Number(def.grade_level), subject_name:def.name};
  return {subject_id:null, grade, subject_name:"", error:"Choose default subject first."};
}
function adminMasterOptions(row){
  const opts=[];
  ["a","b","c","d","e"].forEach(letter=>{
    const v=row["option_"+letter] || row["option_"+letter.toUpperCase()] || "";
    if(String(v).trim()) opts.push({value:letter.toUpperCase(),label:String(v).trim()});
  });
  if(opts.length)return opts;
  if(row.options_json)return JSON.parse(row.options_json);
  if(row.options)return JSON.parse(row.options);
  return null;
}
function adminMasterCorrect(row){
  if(row.correct_answer_json)return JSON.parse(row.correct_answer_json);
  const c=String(row.correct_answer||row.answer||"").trim();
  return c || null;
}
function adminDownloadMasterCsvTemplate(){
  downloadCsvFile("SNT-one-master-auto-allocate-template.csv", [{
    grade:"6",
    subject:"Natural Science",
    term:"Term 1",
    topic:"Life and Living",
    unit:"Unit 1",
    quiz_title:"Life and Living Unit 1 Quiz",
    display_label:"Unit 1 Quiz",
    quiz_code:"",
    time_limit_minutes:"15",
    question_no:"1",
    question_type:"mcq",
    question:"Type question here",
    image_url:"",
    option_a:"Answer A",
    option_b:"Answer B",
    option_c:"Answer C",
    option_d:"Answer D",
    option_e:"Answer E",
    correct_answer:"A",
    marks:"1",
    explanation:"",
    active:"true"
  }]);
}
function adminRenderMasterCsvReport(report){
  const box=$("adminMasterCsvReport"); if(!box)return;
  const ok=report.filter(r=>r.status==="success").length;
  const fail=report.filter(r=>r.status!=="success").length;
  box.innerHTML=`<div class="mini-note"><span>${fail?"⚠️":"✅"}</span><span><strong>Upload result:</strong> ${ok} row(s) successful, ${fail} row(s) failed.</span></div>`+
    `<table class="admin-table"><thead><tr><th>Row</th><th>Status</th><th>Subject</th><th>Quiz</th><th>Question no.</th><th>Message</th></tr></thead><tbody>${report.slice(0,200).map(r=>`<tr><td>${r.row}</td><td>${r.status}</td><td>${escapeHtml(r.subject||"")}</td><td>${escapeHtml(r.quiz||"")}</td><td>${escapeHtml(r.question_no||"")}</td><td>${escapeHtml(r.message||"")}</td></tr>`).join("")}</tbody></table>`;
}
async function adminImportMasterCsvAutoAllocate(){
  if(!requireAdmin())return;
  if(!adminState.subjects.length) await adminLoadSubjects();
  adminFillMasterCsvSubjects();
  const file=$("admMasterCsvFile")?.files[0];
  if(!file){adminMsg("Choose a master CSV file first.",true);return}
  adminMsg("Importing master CSV... please wait.");
  if($("adminMasterCsvReport")) $("adminMasterCsvReport").innerHTML='<div class="loader">Importing CSV...</div>';
  const parsed=parseCsvSimple(await file.text());
  if(parsed.length<2){adminMsg("CSV is empty or missing rows.",true);adminRenderMasterCsvReport([{row:"-",status:"failed",message:"CSV is empty or missing rows."}]);return}
  const headers=parsed[0].map(h=>h.trim());
  const rows=parsed.slice(1).map((rowArr,i)=>{
    const row={}; headers.forEach((h,idx)=>row[h]=(rowArr[idx]??"").trim());
    row.__row_number=i+2;
    return row;
  }).filter(r=>Object.values(r).some(v=>String(v).trim()!==""));
  const groups=new Map();
  const report=[];
  for(const row of rows){
    const subj=adminMasterSubjectId(row);
    const term=String(row.term||"").trim();
    const topic=String(row.topic||row.chapter||row.chapter_topic||"").trim();
    const unit=String(row.unit||"").trim();
    const quizTitle=String(row.quiz_title||row.quiz||"").trim();
    const question=String(row.question||"").trim();
    const qno=Number(row.question_no||row.no||0);
    if(subj.error){report.push({row:row.__row_number,status:"failed",subject:subj.subject_name,quiz:quizTitle,question_no:row.question_no,message:subj.error});continue}
    if(!term || !topic || !unit || !quizTitle){report.push({row:row.__row_number,status:"failed",subject:subj.subject_name,quiz:quizTitle,question_no:row.question_no,message:"Missing term, topic, unit or quiz_title."});continue}
    if(!question){report.push({row:row.__row_number,status:"failed",subject:subj.subject_name,quiz:quizTitle,question_no:row.question_no,message:"Missing question text."});continue}
    if(!qno){report.push({row:row.__row_number,status:"failed",subject:subj.subject_name,quiz:quizTitle,question_no:row.question_no,message:"Missing/invalid question_no."});continue}
    const key=[subj.subject_id,term,topic,unit,quizTitle].join("||");
    if(!groups.has(key)) groups.set(key,{subject_id:subj.subject_id,subject_name:subj.subject_name,term,topic,unit,quizTitle,display_label:row.display_label||row.quiz_display_name||null,quiz_code:row.quiz_code||row.code||null,time_limit_minutes:row.time_limit_minutes||row.time_limit||null,rows:[]});
    groups.get(key).rows.push(row);
  }
  let success=0, failed=report.length, quizCount=0;
  for(const group of groups.values()){
    let quizId;
    try{
      quizId=await adminRpc("admin_upsert_quiz_auto",{
        p_token:adminState.token,
        p_subject_id:group.subject_id,
        p_title:group.quizTitle,
        p_display_label:group.display_label||null,
        p_description:`${group.term} • ${group.topic} • ${group.unit}`,
        p_time_limit_minutes:group.time_limit_minutes?Number(group.time_limit_minutes):null,
        p_display_order:100,
        p_active:true,
        p_term:group.term,
        p_topic:group.topic,
        p_unit:group.unit
      });
      quizCount++;
    }catch(e){
      group.rows.forEach(row=>{failed++;report.push({row:row.__row_number,status:"failed",subject:group.subject_name,quiz:group.quizTitle,question_no:row.question_no,message:"Quiz create/update failed: "+e.message})});
      continue;
    }
    for(const row of group.rows){
      try{
        const options=adminMasterOptions(row);
        const correct=adminMasterCorrect(row);
        const accepted=row.accepted_answers_json?JSON.parse(row.accepted_answers_json):[];
        await adminRpc("admin_upsert_question_auto",{
          p_token:adminState.token,
          p_quiz_id:quizId,
          p_question_no:Number(row.question_no||row.no||1),
          p_question_type:row.question_type||"mcq",
          p_question:row.question,
          p_term:group.term,
          p_topic:group.topic,
          p_unit:group.unit,
          p_image_url:row.image_url||null,
          p_options:options,
          p_correct_answer:correct,
          p_marks:Number(row.marks||1),
          p_accepted_answers:accepted,
          p_explanation:row.explanation||null,
          p_active:String(row.active||"true").toLowerCase()!=="false"
        });
        success++;
        report.push({row:row.__row_number,status:"success",subject:group.subject_name,quiz:group.quizTitle,question_no:row.question_no,message:"Saved"});
      }catch(e){
        failed++;
        report.push({row:row.__row_number,status:"failed",subject:group.subject_name,quiz:group.quizTitle,question_no:row.question_no,message:e.message});
      }
    }
  }
  adminRenderMasterCsvReport(report);
  adminMsg(`Master CSV complete: ${success} question row(s) saved, ${failed} failed, ${quizCount} quiz group(s) processed.`, failed>0);
  await adminLoadQuizzes();
  await adminLoadQuestions();
}

/* SUBJECTS */
async function adminLoadSubjects(){
  if(!requireAdmin())return; fillAdminGrades();
  const d=await adminRpc("admin_list_subjects",{p_token:adminState.token,p_grade:null});
  adminState.subjects=d||[];
  adminRenderSubjectsTable();
  adminFillSubjectDropdowns();
  adminFillMasterCsvSubjects();
}
function adminRenderSubjectsTable(){
  const search=($("admSubjectSearch")?.value||"").toLowerCase().trim();
  const rows=(adminState.subjects||[]).filter(s=>!search || [s.grade_level,s.name,s.icon,s.active].join(" ").toLowerCase().includes(search));
  $("adminSubjectsTable").innerHTML=`<table class="admin-table"><thead><tr><th>Grade</th><th>Subject</th><th>Icon</th><th>Order</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${s.grade_level}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.icon||"")}</td><td>${s.display_order}</td><td>${s.active}</td><td><button class="small-btn" onclick="adminEditSubject('${s.id}')">Edit</button><button class="small-btn danger" onclick="adminDeleteSubject('${s.id}')">Delete</button></td></tr>`).join("")}</tbody></table>`;
}
function adminFillSubjectDropdowns(){
  const opts=adminState.subjects.map(s=>`<option value="${s.id}">Grade ${s.grade_level} - ${escapeHtml(s.name)}</option>`).join("");
  if($("admQuizSubject"))$("admQuizSubject").innerHTML=opts;
  if($("admLinkSubject"))$("admLinkSubject").innerHTML=opts;
  if($("admStudentLinkSubject"))$("admStudentLinkSubject").innerHTML=`<option value="">General / no subject</option>`+opts;
  if($("admFilterSubject"))$("admFilterSubject").innerHTML=`<option value="">All subjects</option>`+opts;
}
function adminEditSubject(id){const s=adminState.subjects.find(x=>String(x.id)===String(id)); if(!s)return; $("admSubjectId").value=s.id; $("admSubjectGrade").value=s.grade_level; $("admSubjectName").value=s.name; $("admSubjectIcon").value=s.icon||""; $("admSubjectOrder").value=s.display_order; $("admSubjectActive").value=String(s.active)}
function adminClearSubjectForm(){$("admSubjectId").value="";$("admSubjectGrade").value="6";$("admSubjectName").value="";$("admSubjectIcon").value="";$("admSubjectOrder").value="100";$("admSubjectActive").value="true"}
async function adminSaveSubject(){if(!requireAdmin())return;await adminRpc("admin_upsert_subject",{p_token:adminState.token,p_subject_id:$("admSubjectId").value||null,p_grade_level:Number($("admSubjectGrade").value),p_name:$("admSubjectName").value.trim(),p_icon:$("admSubjectIcon").value.trim()||"📘",p_display_order:Number($("admSubjectOrder").value||100),p_active:$("admSubjectActive").value==="true"});adminMsg("Subject saved.");adminClearSubjectForm();await adminLoadSubjects();if(state.student)await loadSubjects()}
async function adminDeleteSubject(id){if(!confirm("Delete subject, quizzes and questions?"))return;await adminRpc("admin_delete_subject",{p_token:adminState.token,p_subject_id:id});adminMsg("Subject deleted.");await adminLoadSubjects();if(state.student)await loadSubjects()}

/* QUIZZES */
async function adminLoadQuizzes(){
  if(!requireAdmin())return; if(!adminState.subjects.length)await adminLoadSubjects();
  const d=await adminRpc("admin_list_quizzes",{p_token:adminState.token,p_subject_id:null});
  adminState.quizzes=d||[];
  adminFillQuizDropdowns();
  adminFillQuizMetaFilters();
  adminRefreshPracticeSelectors();
  adminRenderQuizzesTable();
}
function adminFillQuizMetaFilters(){
  const gradeSel=$("admQuizFilterGrade");
  if(gradeSel && gradeSel.dataset.filled!=="1"){
    gradeSel.innerHTML='<option value="">Choose grade</option>'+[11,10,9,8,7,6,5,4].map(g=>`<option value="${g}">Grade ${g}</option>`).join("");
    gradeSel.dataset.filled="1";
  }
  adminRefreshQuizFilterOptions();
}
function adminRefreshQuizFilterOptions(){
  const g=$("admQuizFilterGrade")?.value||"";
  const currentSubject=$("admQuizFilterSubject")?.value||"";
  const subjectSel=$("admQuizFilterSubject"), termSel=$("admQuizFilterTerm"), topicSel=$("admQuizFilterTopic"), unitSel=$("admQuizFilterUnit");
  const gradeSubjects=g?(adminState.subjects||[]).filter(s=>Number(s.grade_level)===Number(g)):[];
  if(subjectSel){
    subjectSel.innerHTML=g?'<option value="">All subjects in grade</option>'+gradeSubjects.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join(""):'<option value="">Choose grade first</option>';
    if(g && gradeSubjects.some(s=>String(s.id)===String(currentSubject)))subjectSel.value=currentSubject;
  }
  const subjectId=subjectSel?.value||"";
  const base=(adminState.quizzes||[]).filter(q=>(!g||Number(q.grade_level)===Number(g))&&(!subjectId||String(q.subject_id)===String(subjectId)));
  const oldTerm=termSel?.value||"", oldTopic=topicSel?.value||"", oldUnit=unitSel?.value||"";
  const terms=uniqueClean(base.map(q=>q.term));
  if(termSel){termSel.innerHTML='<option value="">All terms</option>'+terms.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");if(terms.includes(oldTerm))termSel.value=oldTerm}
  const term=termSel?.value||"";
  const topics=uniqueClean(base.filter(q=>!term||String(q.term||"")===term).map(q=>q.topic));
  if(topicSel){topicSel.innerHTML='<option value="">All topics</option>'+topics.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");if(topics.includes(oldTopic))topicSel.value=oldTopic}
  const topic=topicSel?.value||"";
  const units=uniqueClean(base.filter(q=>(!term||String(q.term||"")===term)&&(!topic||String(q.topic||"")===topic)).map(q=>q.unit));
  if(unitSel){unitSel.innerHTML='<option value="">All units</option>'+units.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");if(units.includes(oldUnit))unitSel.value=oldUnit}
}
function adminQuizFilterGradeChanged(){
  if($("admQuizFilterSubject"))$("admQuizFilterSubject").value="";
  if($("admQuizFilterTerm"))$("admQuizFilterTerm").value="";
  if($("admQuizFilterTopic"))$("admQuizFilterTopic").value="";
  if($("admQuizFilterUnit"))$("admQuizFilterUnit").value="";
  adminRefreshQuizFilterOptions();
  adminRenderQuizzesTable();
}
function adminQuizFilterChanged(){
  adminRefreshQuizFilterOptions();
  adminRenderQuizzesTable();
}
function adminFilteredQuizzes(){
  const g=$("admQuizFilterGrade")?.value||"", s=$("admQuizFilterSubject")?.value||"", t=$("admQuizFilterTerm")?.value||"", topic=$("admQuizFilterTopic")?.value||"", u=$("admQuizFilterUnit")?.value||"";
  if(!g)return [];
  return (adminState.quizzes||[]).filter(q=>Number(q.grade_level)===Number(g) && (!s || String(q.subject_id)===String(s)) && (!t || String(q.term||"")===t) && (!topic || String(q.topic||"")===topic) && (!u || String(q.unit||"")===u));
}
function adminRenderQuizzesTable(){
  const grade=$("admQuizFilterGrade")?.value||"";
  if(!grade){$("adminQuizzesTable").innerHTML='<div class="empty-admin-state">Choose a grade to display its quizzes.</div>';return}
  const rows=adminFilteredQuizzes();
  if(!rows.length){$("adminQuizzesTable").innerHTML='<div class="empty-admin-state">No quizzes match the selected grade and filters.</div>';return}
  $("adminQuizzesTable").innerHTML=`<table class="admin-table"><thead><tr><th>Grade</th><th>Subject</th><th>Term</th><th>Topic</th><th>Unit</th><th>Quiz</th><th>Display name</th><th>Questions</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(q=>`<tr><td>${q.grade_level}</td><td>${escapeHtml(q.subject_name)}</td><td>${escapeHtml(q.term||"")}</td><td>${escapeHtml(q.topic||"")}</td><td>${escapeHtml(q.unit||"")}</td><td>${escapeHtml(quizName(q))}</td><td>${escapeHtml(q.display_label||"")}</td><td>${q.question_total}</td><td>${q.active}</td><td><button class="small-btn" onclick="adminEditQuiz('${q.id}')">Edit</button><button class="small-btn dark" onclick="adminExportQuizPdf('${q.id}')">PDF Q+A</button><button class="small-btn" onclick="adminPrefillPracticeQuiz('${q.id}')">Allocate</button><button class="small-btn danger" onclick="adminDeleteQuiz('${q.id}')">Delete</button></td></tr>`).join("")}</tbody></table>`;
}
function adminFillQuizDropdowns(){
  const opts=adminState.quizzes.map(q=>`<option value="${q.id}">G${q.grade_level} ${escapeHtml(q.subject_name)} - ${escapeHtml(q.term||"")} ${escapeHtml(q.topic||"")} ${escapeHtml(q.unit||"")} - ${escapeHtml(q.display_label||q.title)}</option>`).join("");
  if($("admQuestionQuiz")) $("admQuestionQuiz").innerHTML=opts; if($("admQuestionCsvQuiz")) $("admQuestionCsvQuiz").innerHTML=opts;
  if($("admFilterQuiz")) $("admFilterQuiz").innerHTML=`<option value="">All quizzes</option>`+opts;
  adminRefreshPracticeSelectors();
}
function adminEditQuiz(id){const q=adminState.quizzes.find(x=>String(x.id)===String(id)); if(!q)return; $("admQuizId").value=q.id; $("admQuizSubject").value=q.subject_id; $("admQuizTitle").value=q.title; $("admQuizDisplayLabel").value=q.display_label||""; $("admQuizCode").value=q.quiz_code||""; $("admQuizTerm").value=q.term||""; $("admQuizTopic").value=q.topic||""; $("admQuizUnit").value=q.unit||""; $("admQuizDescription").value=q.description||""; $("admQuizTime").value=q.time_limit_minutes||""; $("admQuizOrder").value=q.display_order; $("admQuizActive").value=String(q.active)}
function adminClearQuizForm(){$("admQuizId").value="";$("admQuizTitle").value="";$("admQuizDisplayLabel").value="";$("admQuizCode").value="";$("admQuizTerm").value="";$("admQuizTopic").value="";$("admQuizUnit").value="";$("admQuizDescription").value="";$("admQuizTime").value="";$("admQuizOrder").value="100";$("admQuizActive").value="true"}
async function adminSaveQuiz(){if(!requireAdmin())return;await adminRpc("admin_upsert_quiz",{p_token:adminState.token,p_quiz_id:$("admQuizId").value||null,p_subject_id:$("admQuizSubject").value,p_title:$("admQuizTitle").value.trim(),p_display_label:$("admQuizDisplayLabel").value.trim()||null,p_quiz_code:cleanQuizCode($("admQuizCode").value)||null,p_description:$("admQuizDescription").value.trim(),p_time_limit_minutes:$("admQuizTime").value?Number($("admQuizTime").value):null,p_display_order:Number($("admQuizOrder").value||100),p_active:$("admQuizActive").value==="true",p_term:$("admQuizTerm").value.trim()||null,p_topic:$("admQuizTopic").value.trim()||null,p_unit:$("admQuizUnit").value.trim()||null});adminMsg("Quiz saved.");adminClearQuizForm();await adminLoadQuizzes();if(state.student&&state.selectedSubject)await loadQuizzes()}
async function adminDeleteQuiz(id){if(!confirm("Delete quiz and questions?"))return;await adminRpc("admin_delete_quiz",{p_token:adminState.token,p_quiz_id:id});adminMsg("Quiz deleted.");await adminLoadQuizzes()}



function adminFillManagedGradeSelectors(){
  ["admPracticeGrade","admRevisionGrade"].forEach(id=>{
    const el=$(id); if(!el || el.dataset.filled==="1")return;
    el.innerHTML='<option value="">Choose grade</option>'+[11,10,9,8,7,6,5,4].map(g=>`<option value="${g}">Grade ${g}</option>`).join("");
    el.dataset.filled="1";
  });
}
function adminPreparePracticeWork(){
  adminFillManagedGradeSelectors();
  adminRefreshPracticeSelectors();
  if($("adminPracticeTable") && !$("admPracticeGrade")?.value)$("adminPracticeTable").innerHTML='<div class="empty-admin-state">Choose a grade to load or allocate practice work.</div>';
}
function adminRefreshPracticeSelectors(){
  const grade=$("admPracticeGrade")?.value||"";
  const studentSel=$("admPracticeStudent"), quizSel=$("admPracticeQuiz");
  if(studentSel){
    const students=grade?adminSortStudents(adminState.students).filter(s=>adminStudentHasGrade(s,grade)):[];
    studentSel.innerHTML=grade?'<option value="">Choose student</option>'+students.map(s=>`<option value="${s.student_id}">${escapeHtml(s.full_name)} (${escapeHtml(s.learner_code)})</option>`).join(""):'<option value="">Choose grade first</option>';
  }
  if(quizSel){
    const quizzes=grade?(adminState.quizzes||[]).filter(q=>Number(q.grade_level)===Number(grade)):[];
    quizSel.innerHTML=grade?'<option value="">Text / link only — no quiz</option>'+quizzes.map(q=>`<option value="${q.id}">${escapeHtml(q.subject_name)} — ${escapeHtml(q.term||"")} ${escapeHtml(q.display_label||q.title)}</option>`).join(""):'<option value="">Choose grade first</option>';
  }
}
function adminPracticeGradeChanged(){
  adminRefreshPracticeSelectors();
  adminClearPracticeForm(false);
  if($("adminPracticeTable"))$("adminPracticeTable").innerHTML='<div class="empty-admin-state">Click “Load selected grade” to display its practice work.</div>';
}
function adminPrefillPracticeQuiz(quizId){
  const q=(adminState.quizzes||[]).find(x=>String(x.id)===String(quizId));
  if(q && $("admPracticeGrade")){
    $("admPracticeGrade").value=String(q.grade_level);
    adminRefreshPracticeSelectors();
  }
  if($("admPracticeQuiz")) $("admPracticeQuiz").value=quizId;
  if($("admPracticeDate") && !$("admPracticeDate").value) $("admPracticeDate").value=new Date().toISOString().slice(0,10);
  adminMsg("Quiz selected in Practice Work. Choose a student and click Save practice work.");
}
function adminClearPracticeForm(clearGrade=true){
  if($("admPracticeId")) $("admPracticeId").value="";
  if(clearGrade && $("admPracticeGrade")) $("admPracticeGrade").value="";
  if($("admPracticeStudent")) $("admPracticeStudent").value="";
  if($("admPracticeQuiz")) $("admPracticeQuiz").value="";
  if($("admPracticeDate")) $("admPracticeDate").value="";
  if($("admPracticeText")) $("admPracticeText").value="";
  if($("admPracticeUrl")) $("admPracticeUrl").value="";
  if($("admPracticeLinkLabel")) $("admPracticeLinkLabel").value="";
  if($("admPracticeActive")) $("admPracticeActive").value="true";
  adminRefreshPracticeSelectors();
}
async function adminLoadPracticeWork(){
  if(!requireAdmin())return;
  const grade=$("admPracticeGrade")?.value||"";
  if(!grade){adminMsg("Choose a grade before loading Practice Work.",true);return}
  if(!adminState.students.length) await adminLoadStudents();
  if(!adminState.quizzes.length) await adminLoadQuizzes();
  try{
    let rows;
    const v2=await sb.rpc("admin_list_practice_work_v2",{p_token:adminState.token,p_grade:Number(grade),p_limit:300});
    if(v2.error){
      rows=await adminRpc("admin_list_practice_work",{p_token:adminState.token,p_limit:300});
      rows=(rows||[]).filter(p=>Number(p.grade_level)===Number(grade));
    }else{
      rows=v2.data||[];
    }
    adminState.practiceWork=rows||[];
    if(!$("adminPracticeTable"))return;
    if(!adminState.practiceWork.length){$("adminPracticeTable").innerHTML='<div class="empty-admin-state">No practice work found for this grade.</div>';return}
    $("adminPracticeTable").innerHTML=`<table class="admin-table"><thead><tr><th>Date</th><th>Student</th><th>Grade</th><th>Subject</th><th>Quiz</th><th>Text</th><th>Link</th><th>Active</th><th>Action</th></tr></thead><tbody>${adminState.practiceWork.map(p=>{
      const parsed=parsePracticeWorkText(p.practice_text);
      const link=safeExternalUrl(p.practice_url);
      const linkLabel=parsed.linkLabel||"Open";
      return `<tr><td>${escapeHtml(formatDateShort(p.assigned_date)||"")}</td><td>${escapeHtml(p.full_name||"")}</td><td>${p.grade_level||""}</td><td>${escapeHtml(p.subject_name||"")}</td><td>${escapeHtml(p.quiz_title||"")}</td><td>${escapeHtml(shortText(parsed.text,80))}</td><td>${link?`<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel)} ↗</a>`:""}</td><td>${p.active}</td><td><button class="small-btn danger" onclick="adminDeletePracticeWork('${p.id}')">Delete</button></td></tr>`;
    }).join("")}</tbody></table>`;
  }catch(e){adminMsg("Could not load Practice Work: "+e.message,true)}
}
async function adminSavePracticeWork(){
  if(!requireAdmin())return;
  const grade=$("admPracticeGrade")?.value||"";
  const studentId=$("admPracticeStudent")?.value;
  const quizId=$("admPracticeQuiz")?.value||null;
  const visiblePracticeText=($("admPracticeText")?.value||"").trim();
  const rawUrl=($("admPracticeUrl")?.value||"").trim();
  const url=rawUrl?safeExternalUrl(rawUrl):null;
  const linkLabel=cleanPracticeLinkLabel($("admPracticeLinkLabel")?.value||"");
  const practiceText=buildPracticeWorkStoredText(visiblePracticeText,linkLabel,url);
  const date=$("admPracticeDate")?.value||new Date().toISOString().slice(0,10);
  if(!grade){adminMsg("Choose a grade.",true);return}
  if(!studentId){adminMsg("Choose a student.",true);return}
  if(rawUrl&&!url){adminMsg("Use a complete http:// or https:// practice link.",true);return}
  if(linkLabel&&!url){adminMsg("Add an outside link or clear the outside-link button wording.",true);return}
  if(!quizId && !visiblePracticeText && !url){adminMsg("Choose a quiz, type practice text, or add a link.",true);return}
  const v2=await sb.rpc("admin_upsert_practice_work_v2",{p_token:adminState.token,p_id:$("admPracticeId")?.value||null,p_student_id:studentId,p_grade_level:Number(grade),p_quiz_id:quizId,p_practice_text:practiceText,p_practice_url:url,p_assigned_date:date,p_active:$("admPracticeActive")?.value==="true"});
  if(v2.error){
    if(url){adminMsg("Practice links need the supplied Supabase SQL patch.",true);return}
    await adminRpc("admin_upsert_practice_work",{p_token:adminState.token,p_id:$("admPracticeId")?.value||null,p_student_id:studentId,p_quiz_id:quizId,p_practice_text:practiceText,p_assigned_date:date,p_active:$("admPracticeActive")?.value==="true"});
  }
  adminMsg("Practice work saved.");
  adminClearPracticeForm(false);
  await adminLoadPracticeWork();
}
async function adminDeletePracticeWork(id){
  if(!requireAdmin())return;
  if(!confirm("Delete this practice work item?"))return;
  await adminRpc("admin_delete_practice_work",{p_token:adminState.token,p_id:id});
  adminMsg("Practice work deleted.");
  await adminLoadPracticeWork();
}

function formatAnswerForPdf(value){
  if(value===null || value===undefined) return "";
  if(typeof value==="string") return value;
  try{return JSON.stringify(value,null,2)}catch(e){return String(value)}
}
async function adminExportQuizPdf(quizId){
  if(!requireAdmin())return;
  const q=(adminState.quizzes||[]).find(x=>String(x.id)===String(quizId));
  const rows=await adminRpc("admin_list_questions",{p_token:adminState.token,p_quiz_id:quizId});
  if(!rows || !rows.length){adminMsg("No questions found for this quiz.",true);return}
  const title=quizName(q||{});
  const subject=q?`${q.grade_level?"Grade "+q.grade_level+" • ":""}${q.subject_name||""}`:"";
  const meta=q?[q.term,q.topic,q.unit].filter(Boolean).join(" • "):"";
  const body=`<html><head><title>${escapeHtml(title)} - Q and A</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#111827;padding:24px;line-height:1.45}.header{border-bottom:3px solid #111827;margin-bottom:18px;padding-bottom:10px}.brand{font-weight:900;font-size:24px}.sub{color:#555;font-size:13px}.q{border:1px solid #d1d5db;border-radius:14px;padding:14px;margin:12px 0;break-inside:avoid}.q h3{margin:0 0 8px}.answer{background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:10px;white-space:pre-wrap}.options{margin:8px 0;padding-left:20px}.marks{float:right;font-weight:bold}.img{max-width:100%;border-radius:10px;border:1px solid #e5e7eb;margin:8px 0}@media print{button{display:none}.q{page-break-inside:avoid}}</style></head><body><button onclick="window.print()" style="padding:10px 14px;border-radius:10px;margin-bottom:12px">Print / Save as PDF</button><div class="header"><div class="brand">SNT Student Hub - Quiz Questions & Answers</div><h1>${escapeHtml(title)}</h1><div class="sub">${escapeHtml(subject)} ${meta?" • "+escapeHtml(meta):""} ${q?.quiz_code?" • Code: "+escapeHtml(q.quiz_code):""}</div></div>${rows.map(r=>`<div class="q"><span class="marks">${Number(r.marks||1)} mark(s)</span><h3>Q${escapeHtml(r.question_no)}. ${escapeHtml(r.question||"")}</h3>${r.image_url?`<img class="img" src="${escapeHtml(r.image_url)}">`:""}${Array.isArray(r.options)?`<ol class="options" type="A">${r.options.map(o=>`<li>${escapeHtml(o.label||o.value||"")}</li>`).join("")}</ol>`:""}<p><b>Correct answer:</b></p><div class="answer">${escapeHtml(formatAnswerForPdf(r.correct_answer))}</div>${r.explanation?`<p><b>Explanation:</b> ${escapeHtml(r.explanation)}</p>`:""}</div>`).join("")}<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`;
  const w=window.open("","_blank");
  if(!w){adminMsg("Popup blocked. Allow popups to export PDF.",true);return}
  w.document.open();w.document.write(body);w.document.close();
}

function adminOpenQuizByCode(){
  if(!requireAdmin())return;
  const code=cleanQuizCode($("admOpenQuizCode")?.value);
  if(code.length!==6){adminMsg("Type the 6-character quiz code.",true);return}
  const q=(adminState.quizzes||[]).find(x=>String(x.quiz_code||"").toUpperCase()===code);
  if(!q){adminMsg("No quiz found with code "+code+". Click Refresh and try again.",true);return}
  showAdminTab("quizzes");
  adminEditQuiz(q.id);
  adminMsg("Quiz loaded into edit form: "+q.title);
}


/* SPACED REPETITION CONTROL */
function adminPrepareRevisionControl(){
  adminFillManagedGradeSelectors();
  adminRefreshRevisionStudentOptions();
  if($("adminRevisionTable") && !$("admRevisionGrade")?.value)$("adminRevisionTable").innerHTML='<div class="empty-admin-state">Choose a grade and student to manage spaced repetition reminders.</div>';
}
function adminRefreshRevisionStudentOptions(){
  const grade=$("admRevisionGrade")?.value||"";
  const select=$("admRevisionStudent");
  if(!select)return;
  const rows=grade?adminSortStudents(adminState.students).filter(s=>adminStudentHasGrade(s,grade)):[];
  select.innerHTML=grade?'<option value="">Choose student</option>'+rows.map(s=>`<option value="${s.student_id}">${escapeHtml(s.full_name)} (${escapeHtml(s.learner_code)})</option>`).join(""):'<option value="">Choose grade first</option>';
}
function adminRevisionGradeChanged(){
  adminRefreshRevisionStudentOptions();
  if($("adminRevisionTable"))$("adminRevisionTable").innerHTML='<div class="empty-admin-state">Choose a student, then load the revision list.</div>';
}
async function adminLoadRevisionControl(){
  if(!requireAdmin())return;
  const grade=$("admRevisionGrade")?.value||"";
  const studentId=$("admRevisionStudent")?.value||"";
  if(!grade||!studentId){adminMsg("Choose a grade and student.",true);return}
  try{
    adminState.revisionRows=await adminRpc("admin_list_student_revision_v2",{p_token:adminState.token,p_grade:Number(grade),p_student_id:studentId});
    adminRenderRevisionControl();
  }catch(e){
    adminMsg("Spaced repetition control needs the supplied Supabase SQL patch: "+e.message,true);
  }
}
function adminRenderRevisionControl(){
  const rows=adminState.revisionRows||[];
  if(!rows.length){$("adminRevisionTable").innerHTML='<div class="empty-admin-state">This learner has not completed any quizzes yet.</div>';return}
  $("adminRevisionTable").innerHTML=`<table class="admin-table"><thead><tr><th>Subject</th><th>Quiz</th><th>Attempts</th><th>Best</th><th>Last</th><th>Repeat date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>{
    const active=r.reminder_active!==false;
    const date=String(r.effective_next_review_at||"").slice(0,10);
    return `<tr class="${active?"":"inactive-row"}"><td>${escapeHtml(r.subject_name||"")}</td><td>${escapeHtml(r.quiz_title||"")}</td><td>${r.attempts||0}</td><td>${Number(r.best_percentage||0).toFixed(0)}%</td><td>${Number(r.last_percentage||0).toFixed(0)}%</td><td><input class="revision-date" type="date" id="revDate_${r.quiz_id}" value="${escapeHtml(date)}"></td><td>${active?"Active":"Removed"}</td><td><button class="small-btn" onclick="adminSaveRevisionDate('${r.student_id}','${r.quiz_id}',${active})">Save date</button><button class="small-btn" onclick="adminResetRevisionDate('${r.student_id}','${r.quiz_id}',${active})">Automatic date</button><button class="small-btn ${active?"danger":"dark"}" onclick="adminSetRevisionActive('${r.student_id}','${r.quiz_id}',${active?"false":"true"})">${active?"Remove":"Reinstate"}</button></td></tr>`;
  }).join("")}</tbody></table>`;
}
async function adminSaveRevisionDate(studentId,quizId,active){
  const date=$("revDate_"+quizId)?.value||null;
  await adminRpc("admin_upsert_revision_control_v2",{p_token:adminState.token,p_student_id:studentId,p_quiz_id:quizId,p_next_review_at:date,p_active:active});
  adminMsg("Repeat date saved.");
  await adminLoadRevisionControl();
}
async function adminResetRevisionDate(studentId,quizId,active){
  await adminRpc("admin_upsert_revision_control_v2",{p_token:adminState.token,p_student_id:studentId,p_quiz_id:quizId,p_next_review_at:null,p_active:active});
  adminMsg("Automatic spaced-repetition date restored.");
  await adminLoadRevisionControl();
}
async function adminSetRevisionActive(studentId,quizId,active){
  await adminRpc("admin_upsert_revision_control_v2",{p_token:adminState.token,p_student_id:studentId,p_quiz_id:quizId,p_next_review_at:$("revDate_"+quizId)?.value||null,p_active:active});
  adminMsg(active?"Revision reminder reinstated.":"Revision reminder removed. Quiz scores were not affected.");
  await adminLoadRevisionControl();
}
