function init(){
  if(CONFIG_NEEDED){$("configBanner").classList.add("show");setStatus("Demo mode — Supabase config needed")}else{setStatus("Connected to Supabase")}
  renderGradeButtons(); bindEvents();
}
function bindEvents(){
  $("loginBtn").addEventListener("click",login); $("logoutBtn").addEventListener("click",logout); $("avatarInput").addEventListener("change",uploadAvatar);
  $("tabGrade").addEventListener("click",()=>setLeaderboardScope("grade")); $("tabSubject").addEventListener("click",()=>setLeaderboardScope("subject")); $("tabQuiz").addEventListener("click",()=>setLeaderboardScope("quiz"));
}
function renderGradeButtons(){const box=$("gradeGrid");box.innerHTML="";for(let g=4;g<=11;g++){const btn=document.createElement("button");btn.className="grade-btn";btn.textContent=`Grade ${g}`;btn.onclick=()=>chooseGrade(g);box.appendChild(btn)}}
async function chooseGrade(grade){
  state.grade=grade; document.querySelectorAll(".grade-btn").forEach(btn=>btn.classList.toggle("active",btn.textContent===`Grade ${grade}`));
  $("mainTitle").textContent=`Grade ${grade}`; $("mainHint").textContent="Login to open Student Hub."; await loadStudentsForGrade();
}
async function loadStudentsForGrade(){
  const select=$("studentSelect"); select.innerHTML=`<option value="">Loading approved learners...</option>`;
  if(CONFIG_NEEDED){const names=demo.students[state.grade]||[`Demo Grade ${state.grade} Learner`];select.innerHTML=`<option value="">Select approved learner</option>`+names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");return}
  const {data,error}=await sb.rpc("list_grade_students",{p_grade:state.grade});
  if(error){select.innerHTML=`<option value="">Could not load learners</option>`;alert(error.message);return}
  if(!data||data.length===0){select.innerHTML=`<option value="">No approved learners for Grade ${state.grade}</option>`;return}
  select.innerHTML=`<option value="">Select approved learner</option>`+data.map(row=>`<option value="${escapeHtml(row.full_name)}">${escapeHtml(row.full_name)}</option>`).join("");
}
async function login(){
  if(!state.grade){alert("Please choose a grade first.");return}
  const fullName=$("studentSelect").value; const code=$("learnerCode").value.trim(); if(!fullName||!code){alert("Please choose your name and enter your code.");return}
  if(CONFIG_NEEDED){state.student={student_id:"demo-student",full_name:fullName,grade_level:state.grade,avatar_url:""};state.previewMode=false;showLoggedIn();await openQuizDashboard();return}
  const {data,error}=await sb.rpc("login_student",{p_grade:state.grade,p_full_name:fullName,p_learner_code:code});
  if(error){alert("Login failed: "+error.message);return} if(!data||data.length===0){alert("Access denied. Check name, grade and learner code.");return}
  state.student=data[0];state.learnerCode=code;
    state.previewMode=false;
    try{await sb.rpc("log_student_session",{p_student_id:state.student.student_id,p_grade:state.grade,p_event_type:"login"});}catch(e){}showLoggedIn();await openQuizDashboard();
}
function showLoggedIn(){
  $("profileBox").classList.add("show");$("avatarUploadBox").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");$("profileName").textContent=state.student.full_name;$("profileMeta").textContent=gradeLabel()+(state.previewMode?" • Teacher preview":"");renderAvatar(state.student.avatar_url);resetWorkArea();
}
function renderAvatar(url){$("avatarBox").innerHTML=url?`<img src="${escapeHtml(url)}" alt="Avatar">`:"👤"}
function showQuizArea(show){
  const lower=$("lowerArea");
  if(!lower)return;
  lower.classList.toggle("leader-only", !show);
}
function resetWorkArea(){
  showQuizArea(false);
  $("workArea").innerHTML=`<h2>Quizzes</h2><p class="hint">Choose a subject first. Quizzes under that subject will appear here.</p><div class="loader">No quiz selected yet.</div>`;
}
async function backToSubjects(){
  state.selectedSubject=null;state.selectedQuiz=null;state.quizzes=[];state.resourceLinks=[];state.personalLinks=[];state.progress=[];state.questions=[];state.answers={};state.qIndex=0;
  resetWorkArea();
  await loadSubjects();
  setLeaderboardScope("grade");
}
async function logout(){
  state.student=null;state.learnerCode=null;state.previewMode=false;state.subjects=[];state.selectedSubject=null;state.quizzes=[];state.resourceLinks=[];state.selectedQuiz=null;state.questions=[];state.answers={};
  $("profileBox").classList.remove("show");$("avatarUploadBox").classList.add("hidden");$("logoutBtn").classList.add("hidden");$("learnerCode").value="";
  $("mainTitle").textContent="Choose your access";$("mainHint").textContent="Students see a dashboard with Quizzes and Tasks. Teachers use the Teacher tab on the left.";$("subjectArea").innerHTML=`<div class="loader">Login first to open Student Hub.</div>`;resetWorkArea();$("leaderboard").innerHTML=`<div class="loader">Login to view leaderboard.</div>`;
}
async function uploadAvatar(event){
  const file=event.target.files[0]; if(!file||!state.student)return;
  if(file.size>700*1024){alert("Please upload a smaller image. Recommended: under 700 KB.");event.target.value="";return}
  if(!file.type.startsWith("image/")){alert("Please choose an image file.");event.target.value="";return}
  if(CONFIG_NEEDED){const localUrl=URL.createObjectURL(file);state.student.avatar_url=localUrl;renderAvatar(localUrl);alert("Demo avatar updated. Real upload works after Supabase is connected.");return}
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase(); const path=`${state.grade}/${state.student.student_id}-${Date.now()}.${ext}`;
  const {error:uploadError}=await sb.storage.from("avatars").upload(path,file,{cacheControl:"3600",upsert:true}); if(uploadError){alert("Avatar upload failed: "+uploadError.message);return}
  const {data:pub}=sb.storage.from("avatars").getPublicUrl(path); const publicUrl=pub.publicUrl;
  const {error:updateError}=await sb.rpc("update_student_avatar",{p_student_id:state.student.student_id,p_avatar_url:publicUrl}); if(updateError){alert("Avatar saved in storage but profile update failed: "+updateError.message);return}
  state.student.avatar_url=publicUrl;renderAvatar(publicUrl);await loadLeaderboard();
}
async function loadSubjects(){
  $("subjectArea").innerHTML=`<div class="loader">Loading subjects...</div>`;
  if(CONFIG_NEEDED){state.subjects=demo.subjects.map(s=>({...s,grade_level:state.grade}));await loadStudentPersonalLinks(null);await loadStudentMessages();await loadStudentProgress();await loadStudentPracticeWork();renderSubjects();return}
  const {data,error}=await sb.rpc("get_subjects",{p_student_id:state.student.student_id,p_grade:state.grade});
  if(error){$("subjectArea").innerHTML=`<div class="loader">Could not load subjects: ${escapeHtml(error.message)}</div>`;return}
  state.subjects=data||[];await loadStudentPersonalLinks(null);await loadStudentMessages();await loadStudentProgress();await loadStudentPracticeWork();renderSubjects();
}
function renderSubjects(){
  state.selectedSubject=null;state.selectedQuiz=null;state.quizzes=[];state.resourceLinks=[];state.resourceTerm="";state.questions=[];state.answers={};state.qIndex=0;
  $("mainTitle").textContent=`${gradeLabel()} subjects`;
  $("mainHint").textContent="Choose a subject to view resources and quizzes.";
  resetWorkArea();
  if(state.subjects.length===0){$("subjectArea").innerHTML=`<div class="loader">No subjects active for ${gradeLabel()} yet. Add them in Supabase.</div>`;return}
  $("subjectArea").innerHTML=`${renderStudentSubjectScoreSummary()}<div class="subject-grid">${state.subjects.map(s=>`<div class="subject" onclick="selectSubject('${s.id}')"><div><div class="icon">${escapeHtml(s.icon||"📘")}</div><div class="subject-title">${escapeHtml(s.name)}</div><div class="subject-meta">${gradeLabel()} • resources & quizzes</div></div></div>`).join("")}</div>${renderStudentPersonalLinks("⭐ My personal student links")}${renderStudentMessages()}${renderPracticeWork()}${renderReviewReminders()}`;
}

async function openQuizFromRevision(subjectId, quizId){
  if(!state.student){alert("Login first.");return}
  if(!state.subjects || !state.subjects.length){await loadSubjects();}
  const subject=(state.subjects||[]).find(s=>String(s.id)===String(subjectId));
  if(!subject){alert("This subject is not active for your grade anymore. Please tell your teacher.");return}
  state.selectedSubject=subject;
  state.selectedQuiz=null;
  state.resourceLinks=[];
  state.personalLinks=[];
  state.questions=[];
  state.answers={};
  state.qIndex=0;
  state.quizFilters={term:"",topic:"",unit:""};
  resetWorkArea();
  $("mainTitle").textContent=`${escapeHtml(subject.name)} quizzes`;
  $("mainHint").textContent=`${gradeLabel()} • opening quiz...`;
  $("subjectArea").innerHTML=`<div class="subject-back-row"><button class="btn2" onclick="backToSubjects()">← Back to subjects</button><span class="badge blue">${escapeHtml(gradeLabel())}</span></div><div class="loader">Opening quiz...</div>`;
  await loadQuizzes();
  const q=(state.quizzes||[]).find(x=>String(x.id)===String(quizId));
  if(!q){alert("Quiz not found or not active. Please tell your teacher.");return}
  await startQuiz(quizId);
}
async function studentOpenQuizByCode(){
  if(!state.student){alert("Login first, then type the quiz code.");return}
  const code=cleanQuizCode($("studentQuizCode")?.value);
  if(code.length!==6){alert("Type the 6-character quiz code.");return}
  if(CONFIG_NEEDED){
    alert("Quiz code opens the exact quiz when Supabase is connected.");
    return;
  }
  try{
    const {data,error}=await sb.rpc("get_quiz_by_code",{p_student_id:state.student.student_id,p_grade:state.grade,p_quiz_code:code});
    if(error){alert("Quiz code error: "+error.message);return}
    if(!data || !data.length){alert("No active quiz found for this code in your grade.");return}
    await openQuizFromRevision(data[0].subject_id,data[0].quiz_id);
  }catch(e){
    alert("Could not open quiz code: "+e.message);
  }
}

async function selectSubject(subjectId){
  state.selectedSubject=state.subjects.find(s=>String(s.id)===String(subjectId));state.selectedQuiz=null;state.resourceLinks=[];state.resourceTerm="";state.personalLinks=[];state.questions=[];state.answers={};state.qIndex=0;state.quizFilters={term:"",topic:"",unit:""};
  resetWorkArea();
  $("mainTitle").textContent=`${escapeHtml(state.selectedSubject.name)} resources & quizzes`;
  $("mainHint").textContent=`${gradeLabel()} • resources appear first, then quizzes.`;
  $("subjectArea").innerHTML=`<div class="subject-back-row"><button class="btn2" onclick="backToSubjects()">← Back to subjects</button><span class="badge blue">${escapeHtml(gradeLabel())}</span></div><div class="loader">Loading quizzes...</div>`;
  await loadQuizzes();
  setLeaderboardScope("subject");
}
async function loadQuizzes(){
  if(CONFIG_NEEDED){
    state.quizzes=demo.quizzes;
    state.resourceLinks=demo.resourceLinks;
    renderQuizzes();
    await loadLeaderboard();
    return;
  }

  const {data,error}=await sb.rpc("get_quizzes",{p_student_id:state.student.student_id,p_grade:state.grade,p_subject_id:state.selectedSubject.id});
  if(error){$("subjectArea").innerHTML=`<div class="subject-back-row"><button class="btn2" onclick="backToSubjects()">← Back to subjects</button></div><div class="loader">Could not load quizzes: ${escapeHtml(error.message)}</div>`;return}
  state.quizzes=data||[];

  await loadResourceLinks();
  renderQuizzes();
  await loadLeaderboard();
}
async function loadResourceLinks(){
  state.resourceLinks=[];
  if(CONFIG_NEEDED){state.resourceLinks=(demo.resourceLinks||[]).map(x=>({...x,term:null}));return}
  let response=await sb.rpc("get_resource_links_v2",{p_student_id:state.student.student_id,p_grade:state.grade,p_subject_id:state.selectedSubject.id});
  if(response.error){
    console.warn("Resources v2 unavailable, using current resources:", response.error.message);
    response=await sb.rpc("get_resource_links",{p_student_id:state.student.student_id,p_grade:state.grade,p_subject_id:state.selectedSubject.id});
  }
  if(response.error){
    console.warn("Could not load resources:", response.error.message);
    state.resourceLinks=[];
    return;
  }
  state.resourceLinks=(response.data||[]).map(x=>({...x,term:x.term||null}));
}



async function loadStudentMessages(){
  state.messages=[];
  if(!state.student || !state.grade) return;
  if(CONFIG_NEEDED){
    state.messages=[{sender_role:"teacher",message_text:"Welcome. Use this box to message your teacher.",created_at:new Date().toISOString(),read_by_teacher:true}];
    return;
  }
  try{
    const {data,error}=await sb.rpc("get_student_messages",{p_student_id:state.student.student_id,p_grade:state.grade});
    if(error){console.warn("Could not load messages:", error.message);state.messages=[];return}
    state.messages=data||[];
  }catch(e){console.warn("Messages error", e.message);state.messages=[]}
}
function renderStudentMessages(){
  const rows=(state.messages||[]).slice(0,20);
  return `<div class="message-box"><h3>💬 Message teacher</h3><p class="hint">Send a message to your teacher. Replies will appear here with date and time.</p><div class="message-list">${rows.length?rows.map(m=>`<div class="msg ${m.sender_role==="teacher"?"teacher":"student"}"><div class="msg-meta">${m.sender_role==="teacher"?"Teacher":"Me"} • ${escapeHtml(new Date(m.created_at).toLocaleString())}</div><div class="msg-text">${escapeHtml(m.message_text)}</div></div>`).join(""):`<div class="mini-note"><span>💬</span><span>No messages yet.</span></div>`}</div><textarea class="message-input" id="studentMessageText" placeholder="Type your message to teacher here"></textarea><div class="admin-actions"><button class="btn2" onclick="studentSendMessage()">Send message</button><button class="btn2" onclick="studentRefreshHome()">Check for teacher reply / refresh links</button></div></div>`;
}

async function studentRefreshHome(){
  await loadStudentPersonalLinks(null);
  await loadStudentMessages();
  await loadStudentProgress();
  await loadStudentPracticeWork();
  renderSubjects();
}

async function studentSendMessage(){
  if(state.previewMode){alert("Teacher preview mode: messages are blocked so student records are not changed.");return}
  const text=($("studentMessageText")?.value||"").trim();
  if(!text){alert("Type a message first.");return}
  if(CONFIG_NEEDED){state.messages.unshift({sender_role:"student",message_text:text,created_at:new Date().toISOString(),read_by_teacher:false});renderSubjects();return}
  const {error}=await sb.rpc("student_send_message",{p_student_id:state.student.student_id,p_grade:state.grade,p_message:text});
  if(error){alert("Message failed: "+error.message);return}
  await loadStudentMessages();
  renderSubjects();
}

async function loadStudentPersonalLinks(subjectId=null){
  state.personalLinks=[];
  if(!state.student || !state.grade) return;
  if(CONFIG_NEEDED){
    const all=demo.personalLinks||[];
    state.personalLinks=subjectId ? all.filter(l=>!l.subject_id || String(l.subject_id)===String(subjectId)) : all;
    return;
  }
  try{
    const {data,error}=await sb.rpc("get_student_personal_links",{
      p_student_id:state.student.student_id,
      p_grade:state.grade,
      p_subject_id:subjectId
    });
    if(error){console.warn("Could not load personal links:", error.message);state.personalLinks=[];return}
    state.personalLinks=data||[];
  }catch(e){console.warn("Personal links error", e.message);state.personalLinks=[]}
}
function renderStudentPersonalLinks(titleText="⭐ My personal links"){
  if(!state.personalLinks || state.personalLinks.length===0) return "";
  return `<div class="personal-link-section"><h3>${titleText}</h3><p class="hint">These links were added specially for you by your teacher.</p><div class="personal-link-grid">${state.personalLinks.map(link=>`<a class="personal-link-card" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" onclick="recordStudentPersonalLinkClick('${link.id}')"><div class="personal-link-icon">${escapeHtml(link.icon||"⭐")}</div><div><div class="personal-link-title">${escapeHtml(link.title)}</div><div class="personal-link-desc">${escapeHtml(link.description||"Open your personal resource")} ↗</div></div></a>`).join("")}</div></div>`;
}
async function recordStudentPersonalLinkClick(studentLinkId){
  try{
    if(!sb || !state.student || !studentLinkId)return;
    await sb.rpc("log_student_personal_link_click",{
      p_student_id:state.student.student_id,
      p_student_resource_link_id:studentLinkId
    });
  }catch(e){console.warn("Personal link click not logged", e.message)}
}


async function loadStudentPracticeWork(){
  state.practiceWork=[];
  if(!state.student || !state.grade) return;
  if(CONFIG_NEEDED){
    state.practiceWork=[{id:"demo-practice",assigned_date:new Date().toISOString().slice(0,10),practice_text:"Complete your teacher allocated practice quiz today.",practice_url:"https://example.com",quiz_id:"fractions",subject_id:"math",subject_name:"Math",quiz_title:"Fractions Quick Challenge"}];
    return;
  }
  try{
    let response=await sb.rpc("get_student_practice_work_v2",{p_student_id:state.student.student_id,p_grade:state.grade});
    if(response.error){
      console.warn("Practice Work v2 unavailable, using current Practice Work:",response.error.message);
      response=await sb.rpc("get_student_practice_work",{p_student_id:state.student.student_id,p_grade:state.grade});
    }
    if(response.error){console.warn("Could not load practice work:", response.error.message);state.practiceWork=[];return}
    state.practiceWork=response.data||[];
  }catch(e){console.warn("Practice work error", e.message);state.practiceWork=[]}
}
function renderPracticeWork(){
  const rows=(state.practiceWork||[]);
  if(!rows.length){
    return `<div class="review-section"><h3>Practice work</h3><div class="mini-note"><span>🧠</span><span>Teacher-allocated quizzes, links or practice notes will appear here by date.</span></div></div>`;
  }
  return `<div class="review-section"><h3>Practice work</h3><p class="hint">These items were allocated specially to you by your teacher.</p>${rows.map(p=>{
    const parsed=parsePracticeWorkText(p.practice_text);
    const link=safeExternalUrl(p.practice_url);
    const linkLabel=parsed.linkLabel||"Open outside resource";
    return `<div class="practice-card" data-practice-id="${escapeHtml(p.id)}" onclick="handlePracticeCardClick(event,'${escapeJs(p.id)}')"><div><span class="practice-date">${escapeHtml(formatDateShort(p.assigned_date)||"No date")}</span><div class="quiz-title">${escapeHtml(p.quiz_title||"Practice work")}</div>${parsed.text?`<div class="sub">${escapeHtml(parsed.text)}</div>`:""}${p.subject_name?`<div class="badges"><span class="badge blue">${escapeHtml(p.subject_name)}</span></div>`:""}${link?`<a class="btn2 practice-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel)} ↗</a>`:""}<div class="practice-open-feedback" role="status" aria-live="polite">${p.openedLocally?"Opened · not completed":"Click this card to record opening"}</div></div><div>${p.quiz_id?`<button class="btn-dark practice-quiz" onclick="openQuizFromPractice('${escapeJs(p.id)}','${escapeJs(p.subject_id||"")}','${escapeJs(p.quiz_id)}')">Open quiz ▶</button>`:""}</div></div>`;
  }).join("")}</div>`;
}
function handlePracticeCardClick(event,practiceId){
  const kind=event.target.closest(".practice-link")?"link":event.target.closest(".practice-quiz")?"quiz":"card";
  void recordPracticeClick(practiceId,kind);
}
async function recordPracticeClick(practiceId,kind){
  if(CONFIG_NEEDED || state.previewMode || !state.student || !state.learnerCode || !practiceId)return;
  try{
    const {error}=await sb.rpc("log_student_practice_click",{
      p_student_id:String(state.student.student_id),p_grade:state.grade,
      p_full_name:state.student.full_name,p_learner_code:state.learnerCode,
      p_practice_id:String(practiceId),p_click_kind:kind
    });
    if(error)throw error;
    const item=(state.practiceWork||[]).find(p=>String(p.id)===String(practiceId));
    if(item)item.openedLocally=true;
    const card=[...document.querySelectorAll(".practice-card")].find(el=>el.dataset.practiceId===String(practiceId));
    if(card)card.querySelector(".practice-open-feedback").textContent="Opened · not completed";
  }catch(e){
    console.warn("Practice click was not saved:",e.message);
    const card=[...document.querySelectorAll(".practice-card")].find(el=>el.dataset.practiceId===String(practiceId));
    if(card)card.querySelector(".practice-open-feedback").textContent="Opening not saved — please try again";
  }
}
async function openQuizFromPractice(practiceId, subjectId, quizId){
  if(!quizId){return}
  if(subjectId){
    await openQuizFromRevision(subjectId, quizId);return
  }
  alert("This practice quiz has no subject link. Please tell your teacher to refresh/re-save the practice item.");
}

async function loadStudentProgress(){
  state.progress=[];
  state.subjectScoreSummary=[];
  state.revisionControls=[];
  if(!state.student || !state.grade) return;
  if(CONFIG_NEEDED){state.progress=demo.progress||[];return}
  try{
    const {data,error}=await sb.rpc("get_student_quiz_progress",{p_student_id:state.student.student_id,p_grade:state.grade});
    if(error){console.warn("Could not load progress:", error.message);state.progress=[];return}
    state.progress=data||[];
    try{
      const controls=await sb.rpc("get_student_revision_controls_v2",{p_student_id:state.student.student_id,p_grade:state.grade});
      if(!controls.error){
        state.revisionControls=controls.data||[];
        const map=new Map(state.revisionControls.map(c=>[String(c.quiz_id),c]));
        state.progress=state.progress.filter(p=>{
          const c=map.get(String(p.quiz_id));
          return !c || c.active!==false;
        }).map(p=>{
          const c=map.get(String(p.quiz_id));
          if(!c || !c.next_review_at)return p;
          const today=new Date(); today.setHours(0,0,0,0);
          const dueDate=new Date(String(c.next_review_at).slice(0,10)+"T00:00:00");
          return {...p,next_review_at:c.next_review_at,review_status:dueDate<=today?"review_due":"review_later"};
        });
      }
    }catch(controlError){console.warn("Revision controls unavailable:",controlError.message)}
    try{
      const overview=await sb.rpc("get_student_subject_score_overview_v2",{p_student_id:state.student.student_id,p_grade:state.grade});
      if(!overview.error)state.subjectScoreSummary=overview.data||[];
    }catch(overviewError){console.warn("Subject score overview unavailable:",overviewError.message)}
  }catch(e){console.warn("Progress error", e.message);state.progress=[]}
}
function renderStudentSubjectScoreSummary(){
  const exact=(state.subjectScoreSummary||[]);
  if(exact.length){
    const cards=[...exact].sort((a,b)=>String(a.subject_name||"").localeCompare(String(b.subject_name||""))).map(r=>`<div class="subject-score-card"><div class="subject-score-name">${escapeHtml(r.subject_name||"Subject")}</div><div class="subject-score-metrics"><span class="subject-score-metric">Average ${Number(r.average_percentage||0).toFixed(0)}%</span><span class="subject-score-metric">Last ${Number(r.last_percentage||0).toFixed(0)}%</span></div><div class="sub">${escapeHtml(r.last_quiz_title||"Latest quiz")} • ${escapeHtml(formatDateShort(r.last_submitted_at)||"")}</div></div>`).join("");
    return `<div class="review-section subject-score-summary"><h3>My quiz score overview</h3><p class="hint">Average includes all active quiz attempts in each subject.</p><div class="subject-score-grid">${cards}</div></div>`;
  }
  const completed=(state.progress||[]).filter(p=>Number(p.attempts||0)>0);
  if(!completed.length){
    return `<div class="review-section subject-score-summary"><h3>My quiz score overview</h3><div class="mini-note"><span>📊</span><span>Your subject averages and latest scores will appear after you complete quizzes.</span></div></div>`;
  }
  const groups=new Map();
  completed.forEach(p=>{
    const key=String(p.subject_id||p.subject_name||"subject");
    if(!groups.has(key))groups.set(key,{name:p.subject_name||"Subject",rows:[]});
    groups.get(key).rows.push(p);
  });
  const cards=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(g=>{
    const percentages=g.rows.map(r=>Number(r.last_percentage??r.best_percentage??0)).filter(Number.isFinite);
    const average=percentages.length?percentages.reduce((a,b)=>a+b,0)/percentages.length:0;
    const latest=[...g.rows].sort((a,b)=>new Date(b.last_submitted_at||0)-new Date(a.last_submitted_at||0))[0];
    const last=Number(latest?.last_percentage??latest?.best_percentage??0);
    return `<div class="subject-score-card"><div class="subject-score-name">${escapeHtml(g.name)}</div><div class="subject-score-metrics"><span class="subject-score-metric">Average ${average.toFixed(0)}%</span><span class="subject-score-metric">Last ${last.toFixed(0)}%</span></div><div class="sub">${escapeHtml(latest?.quiz_title||"Latest quiz")} • ${escapeHtml(formatDateShort(latest?.last_submitted_at)||"")}</div></div>`;
  }).join("");
  return `<div class="review-section subject-score-summary"><h3>My quiz score overview</h3><p class="hint">Average uses the latest score from each completed quiz in the subject.</p><div class="subject-score-grid">${cards}</div></div>`;
}
function getQuizProgress(quizId){
  return (state.progress||[]).find(p=>String(p.quiz_id)===String(quizId));
}
function formatDateShort(value){
  if(!value) return "";
  try{return new Date(value).toLocaleDateString()}catch(e){return ""}
}
function renderReviewReminders(){
  const completed=(state.progress||[]).filter(p=>Number(p.attempts||0)>0);
  if(!completed.length){
    return `<div class="review-section"><h3>My revision list</h3><div class="mini-note"><span>📚</span><span>Complete a quiz and your spaced-repetition reminders will appear here.</span></div></div>`;
  }
  const filter=state.reviewFilter||"all";
  let rows=completed;
  if(filter==="due") rows=completed.filter(p=>p.review_status==="review_due");
  if(filter==="later") rows=completed.filter(p=>p.review_status!=="review_due");
  rows=rows.slice(0,12);
  const opt=(v,t)=>`<option value="${v}" ${filter===v?"selected":""}>${t}</option>`;
  return `<div class="review-section"><h3>My revision list</h3><div class="filter-row compact"><div><label>Show</label><select onchange="state.reviewFilter=this.value;renderSubjects()">${opt("all","All completed quizzes")}${opt("due","Due now only")}${opt("later","Later only")}</select></div></div><table class="admin-table"><thead><tr><th>Quiz</th><th>Attempts</th><th>Best</th><th>Next review</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${escapeHtml(p.subject_name)} — ${escapeHtml(p.quiz_title)}</td><td>${p.attempts||0}</td><td>${Number(p.best_percentage||0).toFixed(0)}%</td><td>${formatDateShort(p.next_review_at)||"not set"}</td><td>${p.review_status==="review_due"?"🔔 Do again now":"✅ Later"}</td><td><button class="small-btn dark" onclick="openQuizFromRevision('${p.subject_id}','${p.quiz_id}')">${p.review_status==="review_due"?"Do it again":"Open quiz"}</button></td></tr>`).join("")}</tbody></table></div>`;
}
function renderQuizProgress(qid){
  const p=getQuizProgress(qid);
  if(!p || Number(p.attempts||0)===0){
    return `<div class="quiz-progress-line">Not completed yet</div>`;
  }
  const due=p.review_status==="review_due";
  return `<div class="quiz-progress-line">Completed ${p.attempts} time(s) • Best ${Number(p.best_percentage||0).toFixed(0)}% • Last done ${formatDateShort(p.last_submitted_at)}</div><div class="badges"><span class="badge ${due?"red":"yellow"}">${due?"🔔 Do again now":"Next review: "+formatDateShort(p.next_review_at)}</span></div>`;
}

function renderResourceLinks(){
  if(!state.resourceLinks||state.resourceLinks.length===0){return ""}
  const standardTerms=["Term 1","Term 2","Term 3","Term 4"];
  const actual=uniqueClean(state.resourceLinks.map(x=>x.term));
  const terms=uniqueClean([...standardTerms,...actual]);
  const selected=state.resourceTerm||"";
  const visible=state.resourceLinks.filter(link=>{
    const term=String(link.term||"").trim();
    return !term || (!!selected && term===selected);
  });
  const options=`<option value="">Choose term</option>`+terms.map(v=>`<option value="${escapeHtml(v)}" ${selected===v?"selected":""}>${escapeHtml(v)}</option>`).join("");
  const cards=visible.length?`<div class="resource-grid">${visible.map(link=>{
    const url=safeExternalUrl(link.url);
    if(!url)return "";
    return `<a class="resource-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" onclick="recordResourceClick('${link.id}')"><div class="resource-icon">${escapeHtml(link.icon||"🔗")}</div><div><div class="resource-title">${escapeHtml(link.title)}</div><div class="resource-desc">${escapeHtml(link.description||"Open resource in a new tab")} ↗</div>${link.term?`<div class="sub">${escapeHtml(link.term)}</div>`:`<div class="sub">All terms</div>`}</div></a>`;
  }).join("")}</div>`:`<div class="mini-note"><span>📚</span><span>${selected?"No extra resources for this term.":"Choose a term. Resources marked for all terms are shown automatically."}</span></div>`;
  return `<div class="resource-section"><h3>Resources</h3><p class="hint">Resources are shown before quizzes for ${escapeHtml(state.selectedSubject.name)}. Items marked “All terms” remain available in every term.</p><div class="resource-filter"><div><label>Term</label><select onchange="state.resourceTerm=this.value;renderQuizzes()">${options}</select></div></div>${cards}</div>`;
}
function uniqueClean(values){return [...new Set((values||[]).map(v=>String(v||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function quizMetaLabel(q){const parts=[q.term,q.topic,q.unit].map(v=>String(v||"").trim()).filter(Boolean);return parts.length?parts.join(" • "):""}
function filteredStudentQuizzes(){
  return (state.quizzes||[]).filter(q=>{
    const f=state.quizFilters||{};
    return (!f.term || String(q.term||"")===f.term) && (!f.topic || String(q.topic||"")===f.topic) && (!f.unit || String(q.unit||"")===f.unit);
  });
}
function renderStudentQuizFilters(){
  const terms=uniqueClean(state.quizzes.map(q=>q.term));
  const topics=uniqueClean(state.quizzes.filter(q=>!state.quizFilters.term || q.term===state.quizFilters.term).map(q=>q.topic));
  const units=uniqueClean(state.quizzes.filter(q=>(!state.quizFilters.term || q.term===state.quizFilters.term)&&(!state.quizFilters.topic || q.topic===state.quizFilters.topic)).map(q=>q.unit));
  if(!terms.length && !topics.length && !units.length) return "";
  const opt=(arr,label,selected)=>`<option value="">All ${label}</option>`+arr.map(v=>`<option value="${escapeHtml(v)}" ${selected===v?"selected":""}>${escapeHtml(v)}</option>`).join("");
  return `<div class="review-section"><h3>Filter quizzes</h3><div class="filter-row compact"><div><label>Term</label><select onchange="state.quizFilters.term=this.value;state.quizFilters.topic='';state.quizFilters.unit='';renderQuizzes()">${opt(terms,"terms",state.quizFilters.term)}</select></div><div><label>Chapter / Topic</label><select onchange="state.quizFilters.topic=this.value;state.quizFilters.unit='';renderQuizzes()">${opt(topics,"topics",state.quizFilters.topic)}</select></div><div><label>Unit</label><select onchange="state.quizFilters.unit=this.value;renderQuizzes()">${opt(units,"units",state.quizFilters.unit)}</select></div></div></div>`;
}
function renderQuizzes(){
  const backRow=`<div class="subject-back-row"><button class="btn2" onclick="backToSubjects()">← Back to subjects</button><span class="badge blue">${escapeHtml(gradeLabel())}</span></div>`;
  const resourcesHtml=renderResourceLinks();
  if(state.quizzes.length===0){$("subjectArea").innerHTML=`${backRow}${resourcesHtml}<p class="hint">No active quizzes yet. Upload quizzes/questions in Supabase.</p><div class="loader">No quizzes found for ${escapeHtml(state.selectedSubject.name)}.</div>`;return}
  const filtersHtml=renderStudentQuizFilters();
  const quizzes=filteredStudentQuizzes();
  if(!quizzes.length){$("subjectArea").innerHTML=`${backRow}${resourcesHtml}${filtersHtml}<div class="loader">No quizzes match this term/topic/unit filter.</div>`;return}
  $("subjectArea").innerHTML=`${backRow}${resourcesHtml}${filtersHtml}<div class="quiz-list">${quizzes.map(q=>`<div class="quiz-item"><div><div class="quiz-title">${escapeHtml(q.display_label||q.title)}</div><div class="sub">${escapeHtml(q.description||"Quiz practice")} • ${q.question_total||0} questions • ${q.time_limit_minutes||"No"} min</div>${quizMetaLabel(q)?`<div class="sub">${escapeHtml(quizMetaLabel(q))}</div>`:""}<div class="badges"><span class="badge green">Self marking</span><span class="badge blue">Live results</span><span class="badge orange">5-option MCQ ready</span></div>${renderQuizProgress(q.id)}</div><button class="btn-dark" onclick="startQuiz('${q.id}')">Start / Revise ▶</button></div>`).join("")}</div>`;
}

function renderQuizTimerHtml(){
  if(!state.selectedQuiz || !Number(state.selectedQuiz.time_limit_minutes||0)) return "";
  return `<div class="mini-note" style="background:#fff7ed;border-color:#fed7aa;color:#9a3412;margin:10px 0"><span>⏱️</span><span><strong>Time left:</strong> <span id="quizTimerText">--:--</span></span></div>`;
}
function clearQuizTimer(){
  if(state.quizTimerInterval){clearInterval(state.quizTimerInterval);state.quizTimerInterval=null;}
}
function startQuizTimer(){
  clearQuizTimer();
  state.timerExpired=false;
  if(!state.selectedQuiz || !Number(state.selectedQuiz.time_limit_minutes||0)) return;
  updateQuizTimer();
  state.quizTimerInterval=setInterval(updateQuizTimer,1000);
}
function updateQuizTimer(){
  if(!state.quizDeadlineAt)return;
  const left=Math.max(0, Math.floor((state.quizDeadlineAt-Date.now())/1000));
  const m=Math.floor(left/60), s=left%60;
  const el=$("quizTimerText");
  if(el) el.textContent=`${m}:${String(s).padStart(2,"0")}`;
  if(left<=0 && !state.timerExpired){
    state.timerExpired=true;
    clearQuizTimer();
    alert("Time is up. Your quiz will submit now.");
    submitQuiz(true);
  }
}

async function startQuiz(quizId){
  state.selectedQuiz=state.quizzes.find(q=>String(q.id)===String(quizId));state.answers={};state.qIndex=0;state.quizSubmitting=false;state.quizStartedAt=new Date().toISOString();state.quizDeadlineAt=state.selectedQuiz&&Number(state.selectedQuiz.time_limit_minutes||0)?Date.now()+Number(state.selectedQuiz.time_limit_minutes)*60*1000:null;showQuizArea(true);$("workArea").innerHTML=`<h2>${escapeHtml(quizName(state.selectedQuiz))}</h2><div class="loader">Loading questions...</div>`;
  if(CONFIG_NEEDED){state.questions=demo.questions;renderQuestion();startQuizTimer();$("workArea").scrollIntoView({behavior:"smooth",block:"start"});setLeaderboardScope("quiz");return}
  const {data,error}=await sb.rpc("get_questions",{p_student_id:state.student.student_id,p_quiz_id:state.selectedQuiz.id});
  if(error){$("workArea").innerHTML=`<div class="loader">Could not load questions: ${escapeHtml(error.message)}</div>`;return}
  state.questions=data||[]; if(state.questions.length===0){$("workArea").innerHTML=`<div class="loader">No questions found for this quiz.</div>`;return}
  renderQuestion();startQuizTimer();$("workArea").scrollIntoView({behavior:"smooth",block:"start"});setLeaderboardScope("quiz");
}
function renderQuestion(){
  const q=state.questions[state.qIndex];const total=state.questions.length;const progress=Math.round(((state.qIndex+1)/total)*100);
  $("workArea").innerHTML=`<div class="quiz-screen"><div class="quiz-screen-inner"><h2>${escapeHtml(quizName(state.selectedQuiz))}</h2><div class="sub" style="color:#cbd5e1">Question ${state.qIndex+1} of ${total} • ${escapeHtml(q.question_type)}</div>${renderQuizTimerHtml()}<div class="progress-wrap"><div class="progress-bar" style="width:${progress}%"></div></div><div class="question-card"><h3>${escapeHtml(q.question)}</h3>${q.image_url?`<img class="question-image" src="${escapeHtml(q.image_url)}" alt="Question image">`:""}${renderAnswerInput(q)}</div><div class="quiz-nav"><button class="btn2" onclick="prevQuestion()" ${state.qIndex===0?"disabled":""}>← Back</button>${state.qIndex<total-1?`<button class="btn2" onclick="nextQuestion()">Next →</button>`:`<button class="btn" style="width:auto;margin-top:0" onclick="submitQuiz()">${state.previewMode?"Preview only":"Submit quiz ✅"}</button>`}</div></div></div>`;
}
function renderAnswerInput(q){
  const current=state.answers[q.question_id];
  if(q.question_type==="mcq"||q.question_type==="mcq_image"){const options=Array.isArray(q.options)?q.options:[];return `<div class="answers">${options.map(opt=>`<button class="answer-btn ${current===opt.value?"selected":""}" onclick="saveAnswer('${q.question_id}', '${escapeJs(opt.value)}')">${escapeHtml(opt.value)}. ${escapeHtml(opt.label)}</button>`).join("")}</div>`}
  if(q.question_type==="true_false"){return `<div class="answers"><button class="answer-btn ${current==="true"?"selected":""}" onclick="saveAnswer('${q.question_id}', 'true')">True</button><button class="answer-btn ${current==="false"?"selected":""}" onclick="saveAnswer('${q.question_id}', 'false')">False</button></div>`}
  if(q.question_type==="missing_word"||q.question_type==="short_exact"){return `<div class="answers"><input class="text-answer" value="${escapeHtml(current||"")}" placeholder="Type your answer..." oninput="saveAnswerNoRender('${q.question_id}', this.value)"></div>`}
  if(q.question_type==="multi_select"){const selected=Array.isArray(current)?current:[];const options=Array.isArray(q.options)?q.options:[];return `<div class="answers">${options.map(opt=>`<label class="check-answer"><input type="checkbox" ${selected.includes(opt.value)?"checked":""} onchange="toggleMulti('${q.question_id}', '${escapeJs(opt.value)}', this.checked)"> ${escapeHtml(opt.label)}</label>`).join("")}</div>`}
  if(q.question_type==="match"){const left=q.options?.left||[];const right=q.options?.right||[];const answerObj=current||{};return `<div class="answers">${left.map(term=>`<div class="match-row"><div class="match-term">${escapeHtml(term)}</div><select onchange="saveMatch('${q.question_id}', '${escapeJs(term)}', this.value)"><option value="">Choose match</option>${right.map(choice=>`<option value="${escapeHtml(choice)}" ${answerObj[term]===choice?"selected":""}>${escapeHtml(choice)}</option>`).join("")}</select></div>`).join("")}</div>`}
  return `<div class="loader">Unsupported question type: ${escapeHtml(q.question_type)}</div>`;
}
function saveAnswer(questionId,answer){state.answers[questionId]=answer;renderQuestion()}
function saveAnswerNoRender(questionId,answer){state.answers[questionId]=answer}
function toggleMulti(questionId,value,checked){const arr=Array.isArray(state.answers[questionId])?[...state.answers[questionId]]:[];if(checked&&!arr.includes(value))arr.push(value);if(!checked){const idx=arr.indexOf(value);if(idx>=0)arr.splice(idx,1)}state.answers[questionId]=arr}
function saveMatch(questionId,term,value){const obj=state.answers[questionId]||{};obj[term]=value;state.answers[questionId]=obj}
function nextQuestion(){if(state.qIndex<state.questions.length-1){state.qIndex++;renderQuestion()}}
function prevQuestion(){if(state.qIndex>0){state.qIndex--;renderQuestion()}}
async function submitQuiz(force=false){
  if(state.previewMode){alert("Teacher preview mode: quiz submission is blocked so stats are not affected.");state.quizSubmitting=false;return}
  const unanswered=state.questions.filter(q=>state.answers[q.question_id]===undefined||state.answers[q.question_id]==="");if(unanswered.length>0 && !force){const ok=confirm(`You have ${unanswered.length} unanswered question(s). Submit anyway?`);if(!ok)return}
  const answerArray=state.questions.map(q=>({question_id:q.question_id,answer:state.answers[q.question_id]??null}));
  if(state.quizSubmitting)return; state.quizSubmitting=true; clearQuizTimer(); if(CONFIG_NEEDED){const percent=Math.floor(70+Math.random()*25);renderResult({score:percent,total:100,percentage:percent});state.quizSubmitting=false;return}
  const {data,error}=await sb.rpc("submit_attempt",{p_student_id:state.student.student_id,p_quiz_id:state.selectedQuiz.id,p_answers:answerArray,p_started_at:state.quizStartedAt});if(error){state.quizSubmitting=false;alert("Submit failed: "+error.message);return}
  await loadStudentProgress();await loadStudentPracticeWork();renderQuizzes();renderResult(data[0]);await loadLeaderboard();state.quizSubmitting=false;
}
function formatDuration(seconds){seconds=Number(seconds||0);const m=Math.floor(seconds/60),s=Math.max(0,Math.round(seconds%60));return `${m} min ${String(s).padStart(2,"0")} sec`}
function renderResult(result){
  $("workArea").innerHTML=`<div class="result-card"><div style="font-size:52px">${result.percentage>=80?"🏆":result.percentage>=50?"⭐":"📚"}</div><h2>Quiz submitted!</h2><p class="hint">${escapeHtml(quizName(state.selectedQuiz))} • ${escapeHtml(state.selectedSubject.name)}</p><div class="big-score">${Number(result.percentage).toFixed(0)}%</div><p><strong>Score:</strong> ${Number(result.score).toFixed(1)} / ${Number(result.total).toFixed(1)}</p>${result.duration_seconds!==undefined&&result.duration_seconds!==null?`<p><strong>Time taken:</strong> ${formatDuration(result.duration_seconds)}</p>`:""}<button class="btn2" onclick="selectSubject('${state.selectedSubject.id}')">Back to ${escapeHtml(state.selectedSubject.name)} quizzes</button></div>`;
}
function setLeaderboardScope(scope){
  state.leaderboardScope=scope;["tabGrade","tabSubject","tabQuiz"].forEach(id=>$(id).classList.remove("active"));if(scope==="grade")$("tabGrade").classList.add("active");if(scope==="subject")$("tabSubject").classList.add("active");if(scope==="quiz")$("tabQuiz").classList.add("active");loadLeaderboard();
}
async function loadLeaderboard(){
  if(!state.student){$("leaderboard").innerHTML=`<div class="loader">Login to view leaderboard.</div>`;return}
  if(CONFIG_NEEDED){renderLeaderboard(demo.leaderboard);return}
  const {data,error}=await sb.rpc("get_leaderboard",{p_grade:state.grade,p_scope:state.leaderboardScope,p_subject_id:state.leaderboardScope==="subject"&&state.selectedSubject?state.selectedSubject.id:null,p_quiz_id:state.leaderboardScope==="quiz"&&state.selectedQuiz?state.selectedQuiz.id:null,p_limit:10});
  if(error){$("leaderboard").innerHTML=`<div class="loader">Could not load leaderboard: ${escapeHtml(error.message)}</div>`;return}
  renderLeaderboard(data||[]);
}
function renderLeaderboard(rows){
  if(!rows.length){$("leaderboard").innerHTML=`<div class="loader">No results yet. Be the first to submit a quiz!</div>`;return}
  $("leaderboard").innerHTML=rows.map(row=>{const rankClass=row.rank_no===1?"gold":row.rank_no===2?"silver":row.rank_no===3?"bronze":"";const rankIcon=row.rank_no===1?"🏆":row.rank_no===2?"🥈":row.rank_no===3?"🥉":row.rank_no;const avatarHtml=row.avatar_url?`<img class="mini-avatar" src="${escapeHtml(row.avatar_url)}" alt="">`:`<div class="rank ${rankClass}">${rankIcon}</div>`;return `<div class="leader">${avatarHtml}<div><div class="name">${escapeHtml(row.full_name)}</div><div class="sub">${row.quizzes_completed||0} quiz result(s)</div></div><div class="score">${Number(row.average_percentage||0).toFixed(0)}%</div></div>`}).join("");
}
