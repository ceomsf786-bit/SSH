/* TEACHER ADMIN PANEL */
const adminState = { token:null, teacherName:null, students:[], subjects:[], quizzes:[], questions:[], resourceLinks:[], studentLinks:[], messages:[], images:[], practiceWork:[], revisionRows:[] };

function toggleAdminPanel(){
  $("adminPanel").classList.toggle("show");
  $("adminPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
function adminMsg(text,isError=false){
  const b=$("adminMsg");
  b.textContent=text;
  b.style.background=isError?"#fee2e2":"#f0fdf4";
  b.style.color=isError?"#991b1b":"#166534";
  b.style.borderColor=isError?"#fecaca":"#bbf7d0";
  b.classList.add("show");
}
function fillAdminGrades(){
  const normal=["admStudentGrade","admSubjectGrade","admStudentLinkGrade","admMasterCsvDefaultGrade","admBroadcastGrade"];
  normal.forEach(id=>{
    const e=$(id); if(!e || e.dataset.filled==="1") return;
    let h=""; for(let g=4; g<=11; g++) h += `<option value="${g}">Grade ${g}</option>`;
    e.innerHTML=h; e.dataset.filled="1";
  });
  const allGrade=$("admFilterGrade");
  if(allGrade && allGrade.dataset.filled!=="1"){
    let h=`<option value="">All grades</option>`;
    for(let g=4; g<=11; g++) h += `<option value="${g}">Grade ${g}</option>`;
    allGrade.innerHTML=h; allGrade.dataset.filled="1";
  }
}
async function adminRpc(fn,args={}){
  if(!sb){adminMsg("Supabase is not connected.",true);return null}
  const {data,error}=await sb.rpc(fn,args);
  if(error){adminMsg(error.message,true);throw error}
  return data;
}
async function adminLogin(){
  fillAdminGrades();
  const email=$("adminEmail").value.trim();
  const code=$("adminCode").value.trim();
  if(!email || !code){adminMsg("Enter teacher email and code.",true);return}
  try{
    const d=await adminRpc("teacher_login",{p_email:email,p_teacher_code:code});
    if(!d || !d.length){adminMsg("Admin login failed.",true);return}
    adminState.token=d[0].token;
    adminState.teacherName=d[0].teacher_name;
    $("adminTeacherName").textContent=adminState.teacherName;
    $("adminLoginArea").classList.add("hidden");
    $("adminDashboard").classList.remove("hidden");
    adminMsg("Teacher login successful.");
    await adminLoadSubjects();
    await adminLoadStudents();
    await adminLoadTeachers();
    await adminLoadQuizzes();
    await adminRefreshUnreadMessages();
  }catch(e){}
}
function adminLogout(){
  adminState.token=null;
  $("adminDashboard").classList.add("hidden");
  $("adminLoginArea").classList.remove("hidden");
  adminMsg("Logged out.");
}
function requireAdmin(){
  if(!adminState.token){adminMsg("Login as teacher first.",true);return false}
  return true;
}
function showAdminTab(tab){
  ["Students","Activity","Messages","Links","StudentLinks","Subjects","Quizzes","Revision","Questions"].forEach(n=>{
    const low=n.toLowerCase();
    const tabEl=$("adminTab"+n), sectionEl=$("adminSection"+n);
    if(tabEl)tabEl.classList.toggle("active",low===tab);
    if(sectionEl)sectionEl.classList.toggle("show",low===tab);
  });
  if(tab==="students"){adminLoadStudents();adminLoadTeachers();}
  if(tab==="messages")adminLoadMessages();
  if(tab==="links")adminLoadResourceLinks();
  if(tab==="studentlinks")adminLoadStudentPersonalLinksAdmin();
  if(tab==="subjects")adminLoadSubjects();
  if(tab==="quizzes"){adminLoadQuizzes();adminPreparePracticeWork();}
  if(tab==="revision")adminPrepareRevisionControl();
  if(tab==="questions")adminLoadQuestions();
}
function safeJson(t,f=null){t=(t||"").trim();return t?JSON.parse(t):f}
function shortText(t,n=70){t=String(t??"");return t.length>n?t.slice(0,n)+"...":t}

async function recordResourceClick(resourceLinkId){
  try{
    if(!sb || !state.student || !resourceLinkId)return;
    await sb.rpc("log_resource_click",{p_student_id:state.student.student_id,p_resource_link_id:resourceLinkId});
  }catch(e){console.warn("Link click not logged",e.message)}
}

/* STUDENTS */
function adminStudentGradesArray(student){
  return String(student?.grades||"").split(/[^0-9]+/).map(Number).filter(g=>g>=4&&g<=11);
}
function adminStudentHighestGrade(student){
  const grades=adminStudentGradesArray(student);
  return grades.length?Math.max(...grades):0;
}
function adminStudentHasGrade(student,grade){
  return adminStudentGradesArray(student).includes(Number(grade));
}
function adminSortStudents(rows){
  return [...(rows||[])].sort((a,b)=>adminStudentHighestGrade(b)-adminStudentHighestGrade(a) || String(a.full_name||"").localeCompare(String(b.full_name||"")));
}
async function adminLoadStudents(){
  if(!requireAdmin())return; fillAdminGrades();
  const d=await adminRpc("admin_list_students",{p_token:adminState.token});
  adminState.students=adminSortStudents(d||[]);
  adminFillStudentDropdowns();
  adminRenderStudentsTable();
  adminFillFilterDropdowns();
  adminFillManagedGradeSelectors();
}
function adminFillStudentDropdowns(){
  const sorted=adminSortStudents(adminState.students);
  const opts=sorted.map(s=>`<option value="${s.student_id}">G${adminStudentHighestGrade(s)||"?"} — ${escapeHtml(s.full_name)} (${escapeHtml(s.learner_code)})</option>`).join("");
  if($("admStudentLinkStudent")) $("admStudentLinkStudent").innerHTML=opts;
  if($("admMessageStudent")) $("admMessageStudent").innerHTML=`<option value="">All students</option>`+opts;
  if($("admFilterStudent")) $("admFilterStudent").innerHTML=`<option value="">All students</option>`+opts;
  adminRefreshPracticeSelectors();
  adminRefreshRevisionStudentOptions();
}
function adminRenderStudentsTable(){
  const search=($("admStudentSearch")?.value||"").toLowerCase().trim();
  const rows=adminSortStudents(adminState.students).filter(s=>{
    const hay=[s.full_name,s.learner_code,s.grades].join(" ").toLowerCase();
    return !search || hay.includes(search);
  });
  $("adminStudentsTable").innerHTML=`<table class="admin-table"><thead><tr><th>Name</th><th>Code</th><th>Grades</th><th>Active</th><th>Avatar</th><th>Actions</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${escapeHtml(s.full_name)}</td><td>${escapeHtml(s.learner_code)}</td><td>${escapeHtml(s.grades||"")}</td><td>${s.active}</td><td>${s.avatar_url?"Yes":"No"}</td><td><button class="small-btn" onclick="adminEditStudent('${s.student_id}')">Edit</button><button class="small-btn" onclick="adminOpenMessagesForStudent('${s.student_id}')">Messages</button><button class="small-btn dark" onclick="adminPreviewStudent('${s.student_id}')">Preview page</button><button class="small-btn" onclick="adminClearAvatar('${s.student_id}')">Delete avatar</button><button class="small-btn danger" onclick="adminDeleteStudent('${s.student_id}')">Delete</button></td></tr>`).join("")}</tbody></table>`;
}
function adminEditStudent(id){
  const s=adminState.students.find(x=>String(x.student_id)===String(id)); if(!s)return;
  $("admStudentId").value=s.student_id; $("admStudentName").value=s.full_name; $("admStudentCode").value=s.learner_code; $("admStudentGrade").value=s.first_grade||6; $("admStudentActive").value=String(s.active);
}
function adminClearStudentForm(){$("admStudentId").value="";$("admStudentName").value="";$("admStudentCode").value="";$("admStudentGrade").value="6";$("admStudentActive").value="true"}
async function adminSaveStudent(){
  if(!requireAdmin())return;
  try{
    await adminRpc("admin_upsert_student",{p_token:adminState.token,p_student_id:$("admStudentId").value||null,p_full_name:$("admStudentName").value.trim(),p_learner_code:$("admStudentCode").value.trim(),p_grade_level:Number($("admStudentGrade").value),p_active:$("admStudentActive").value==="true"});
    adminMsg("Student saved."); adminClearStudentForm(); await adminLoadStudents(); if(state.grade) await loadStudentsForGrade();
  }catch(e){}
}
async function adminDeleteStudent(id){if(!requireAdmin()||!confirm("Delete this student and results?"))return;await adminRpc("admin_delete_student",{p_token:adminState.token,p_student_id:id});adminMsg("Student deleted.");await adminLoadStudents();if(state.grade)await loadStudentsForGrade()}
async function adminClearAvatar(id){if(!requireAdmin())return;await adminRpc("admin_clear_student_avatar",{p_token:adminState.token,p_student_id:id});adminMsg("Avatar removed from profile.");await adminLoadStudents()}

async function adminPreviewStudent(id){
  if(!requireAdmin())return;
  const s=(adminState.students||[]).find(x=>String(x.student_id)===String(id));
  if(!s){adminMsg("Student not found.",true);return}
  const grade=Number(s.first_grade || String(s.grades||"").match(/\d+/)?.[0] || 4);
  state.grade=grade;
  state.student={student_id:s.student_id,full_name:s.full_name,grade_level:grade,avatar_url:s.avatar_url||""};
  state.previewMode=true;
  document.querySelectorAll(".grade-btn").forEach(btn=>btn.classList.toggle("active",btn.textContent===`Grade ${grade}`));
  showLoggedIn();
  await openQuizDashboard();
  window.scrollTo({top:0,behavior:"smooth"});
  adminMsg("Teacher preview opened for "+s.full_name+". Quiz submission is blocked.");
}
