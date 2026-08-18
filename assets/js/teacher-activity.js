/* ACTIVITY */

function adminFillFilterDropdowns(){
  adminFillStudentDropdowns();
  adminFillSubjectDropdowns();
  adminFillQuizDropdowns();
}
function adminFilterArgs(){
  return {
    p_token:adminState.token,
    p_grade:$("admFilterGrade")?.value?Number($("admFilterGrade").value):null,
    p_student_id:$("admFilterStudent")?.value||null,
    p_subject_id:$("admFilterSubject")?.value||null,
    p_quiz_id:$("admFilterQuiz")?.value||null,
    p_activity_type:$("admFilterType")?.value||null,
    p_date_from:$("admFilterFrom")?.value||null,
    p_date_to:$("admFilterTo")?.value||null,
    p_limit:300
  };
}
async function adminLoadResultsActivity(){
  if(!requireAdmin())return;
  if(!adminState.students.length) await adminLoadStudents();
  if(!adminState.subjects.length) await adminLoadSubjects();
  if(!adminState.quizzes.length) await adminLoadQuizzes();
  const d=await adminRpc("admin_activity_report",adminFilterArgs());
  $("adminActivityTable").innerHTML=`<h3>Filtered activity</h3><table class="admin-table"><thead><tr><th>Time</th><th>Type</th><th>Student</th><th>Grade</th><th>Subject</th><th>Quiz / Item</th><th>Details</th></tr></thead><tbody>${(d||[]).map(r=>`<tr><td>${escapeHtml(new Date(r.activity_at).toLocaleString())}</td><td>${escapeHtml(r.activity_type)}</td><td>${escapeHtml(r.full_name||"")}</td><td>${r.grade_level||""}</td><td>${escapeHtml(r.subject_name||"")}</td><td>${escapeHtml(r.quiz_title||r.item_title||"")}</td><td>${escapeHtml(r.details||"")}</td></tr>`).join("")}</tbody></table>`;
}
async function adminLoadLinkActivity(){
  if(!requireAdmin())return;
  if($("admFilterType")) $("admFilterType").value="link";
  await adminLoadResultsActivity();
}
function adminBuildGroupedScoreTables(rows){
  rows=rows||[];
  const subjectMap=new Map();
  const studentMap=new Map();

  rows.forEach(r=>{
    const subjKey=[r.student_id,r.grade_level,r.subject_id].join("|");
    if(!subjectMap.has(subjKey)){
      subjectMap.set(subjKey,{full_name:r.full_name,grade_level:r.grade_level,subject_name:r.subject_name,attempts:0,total_score:0,total_possible:0,best:0,latest_at:null});
    }
    const s=subjectMap.get(subjKey);
    s.attempts += Number(r.attempts||0);
    s.total_score += Number(r.total_score||0);
    s.total_possible += Number(r.total_possible||0);
    s.best = Math.max(s.best, Number(r.best_percentage||0));
    if(!s.latest_at || new Date(r.last_submitted_at)>new Date(s.latest_at)) s.latest_at=r.last_submitted_at;

    const studKey=[r.student_id,r.grade_level].join("|");
    if(!studentMap.has(studKey)){
      studentMap.set(studKey,{full_name:r.full_name,grade_level:r.grade_level,attempts:0,total_score:0,total_possible:0,best:0,latest_at:null});
    }
    const st=studentMap.get(studKey);
    st.attempts += Number(r.attempts||0);
    st.total_score += Number(r.total_score||0);
    st.total_possible += Number(r.total_possible||0);
    st.best = Math.max(st.best, Number(r.best_percentage||0));
    if(!st.latest_at || new Date(r.last_submitted_at)>new Date(st.latest_at)) st.latest_at=r.last_submitted_at;
  });

  const overall=[...studentMap.values()];
  const subjects=[...subjectMap.values()];

  const pct=(a,b)=>b>0?((a/b)*100):0;
  const overallHtml=`<h3>Overall per student</h3><table class="admin-table"><thead><tr><th>Student</th><th>Grade</th><th>Total attempts</th><th>Overall average</th><th>Best quiz</th><th>Total score</th></tr></thead><tbody>${overall.map(r=>`<tr><td>${escapeHtml(r.full_name)}</td><td>${r.grade_level}</td><td>${r.attempts}</td><td><b>${pct(r.total_score,r.total_possible).toFixed(0)}%</b></td><td>${r.best.toFixed(0)}%</td><td>${r.total_score.toFixed(1)} / ${r.total_possible.toFixed(1)}</td></tr>`).join("")}</tbody></table>`;

  const subjectHtml=`<h3>Overall per subject per student</h3><table class="admin-table"><thead><tr><th>Student</th><th>Grade</th><th>Subject</th><th>Total attempts</th><th>Subject average</th><th>Best quiz</th><th>Total score</th></tr></thead><tbody>${subjects.map(r=>`<tr><td>${escapeHtml(r.full_name)}</td><td>${r.grade_level}</td><td>${escapeHtml(r.subject_name)}</td><td>${r.attempts}</td><td><b>${pct(r.total_score,r.total_possible).toFixed(0)}%</b></td><td>${r.best.toFixed(0)}%</td><td>${r.total_score.toFixed(1)} / ${r.total_possible.toFixed(1)}</td></tr>`).join("")}</tbody></table>`;

  return overallHtml + subjectHtml;
}

async function adminLoadAttemptManager(){
  if(!requireAdmin())return;
  const args=adminFilterArgs();
  delete args.p_activity_type;
  const rows=await adminRpc("admin_result_attempts",{...args,p_limit:500});
  $("adminActivityTable").innerHTML=`<h3>Quiz attempts: start/end time and score inclusion</h3><p class="hint">Set Active = false to remove an attempt from averages, progress and leaderboards without deleting it.</p><table class="admin-table"><thead><tr><th>Student</th><th>Grade</th><th>Subject</th><th>Quiz</th><th>Start</th><th>End</th><th>Time taken</th><th>Score</th><th>Active in score?</th><th>Action</th></tr></thead><tbody>${(rows||[]).map(r=>`<tr><td>${escapeHtml(r.full_name||"")}</td><td>${r.grade_level||""}</td><td>${escapeHtml(r.subject_name||"")}</td><td>${escapeHtml(r.quiz_title||"")}</td><td>${r.started_at?escapeHtml(new Date(r.started_at).toLocaleString()):""}</td><td>${r.submitted_at?escapeHtml(new Date(r.submitted_at).toLocaleString()):""}</td><td>${formatDuration(r.duration_seconds||0)}</td><td>${Number(r.percentage||0).toFixed(0)}% (${Number(r.score||0).toFixed(1)}/${Number(r.total||0).toFixed(1)})</td><td>${r.active?"true":"false"}</td><td><button class="small-btn ${r.active?"danger":""}" onclick="adminToggleResultActive('${r.result_id}', ${r.active?"false":"true"})">${r.active?"Remove from score":"Restore to score"}</button><button class="small-btn dark" onclick="adminViewAttemptPdf('${r.result_id}')">View / PDF</button></td></tr>`).join("")}</tbody></table>`;
}
async function adminToggleResultActive(resultId,makeActive){
  if(!requireAdmin())return;
  await adminRpc("admin_set_result_active",{p_token:adminState.token,p_result_id:resultId,p_active:makeActive});
  adminMsg(makeActive?"Attempt restored to scores.":"Attempt removed from scores.");
  await adminLoadAttemptManager();
}

async function adminLoadScoreSummary(){
  if(!requireAdmin())return;
  if(!adminState.students.length) await adminLoadStudents();
  if(!adminState.subjects.length) await adminLoadSubjects();
  if(!adminState.quizzes.length) await adminLoadQuizzes();
  const args=adminFilterArgs();
  delete args.p_activity_type;
  delete args.p_limit;
  const d=await adminRpc("admin_score_summary",{...args,p_limit:500});
  const rows=d||[];
  $("adminActivityTable").innerHTML=`<h3>Score summary</h3>${adminBuildGroupedScoreTables(rows)}<h3>All quiz scores</h3><table class="admin-table"><thead><tr><th>Student</th><th>Grade</th><th>Subject</th><th>Quiz</th><th>Attempts</th><th>Latest</th><th>Best</th><th>Average</th><th>Total score</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.full_name)}</td><td>${r.grade_level}</td><td>${escapeHtml(r.subject_name)}</td><td>${escapeHtml(r.quiz_title)}</td><td>${r.attempts}</td><td>${Number(r.latest_percentage||0).toFixed(0)}%</td><td>${Number(r.best_percentage||0).toFixed(0)}%</td><td><b>${Number(r.average_percentage||0).toFixed(0)}%</b></td><td>${Number(r.total_score||0).toFixed(1)} / ${Number(r.total_possible||0).toFixed(1)}</td></tr>`).join("")}</tbody></table>`;
}



async function adminViewAttemptPdf(resultId){
  if(!requireAdmin())return;
  const rows=await adminRpc("admin_get_result_review",{p_token:adminState.token,p_result_id:resultId});
  if(!rows || !rows.length){adminMsg("No answer details found for this attempt.",true);return}
  const first=rows[0];
  const body=`<html><head><title>Quiz attempt review</title><style>body{font-family:Arial;padding:20px;color:#111827}h1,h2{margin-bottom:4px}.q{border:1px solid #ddd;border-radius:10px;padding:12px;margin:10px 0}.small{color:#666;font-size:12px}pre{white-space:pre-wrap;background:#f8fafc;padding:8px;border-radius:8px}</style></head><body><h1>SNT Quiz Attempt Review</h1><div class="small">Student: ${escapeHtml(first.full_name||"")} • Quiz: ${escapeHtml(first.quiz_title||"")} • Submitted: ${first.submitted_at?escapeHtml(new Date(first.submitted_at).toLocaleString()):""}</div>${rows.map(r=>`<div class="q"><h3>Q${r.question_no}. ${escapeHtml(r.question||"")}</h3>${r.image_url?`<img src="${escapeHtml(r.image_url)}" style="max-width:100%;border-radius:10px">`:""}<p><b>Student answer:</b></p><pre>${escapeHtml(JSON.stringify(r.student_answer,null,2))}</pre><p><b>Correct answer:</b></p><pre>${escapeHtml(JSON.stringify(r.correct_answer,null,2))}</pre>${r.explanation?`<p><b>Explanation:</b> ${escapeHtml(r.explanation)}</p>`:""}</div>`).join("")}<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>`;
  const w=window.open("","_blank");
  if(!w){adminMsg("Popup blocked. Allow popups to export PDF.",true);return}
  w.document.open();w.document.write(body);w.document.close();
}

async function adminEditMessage(messageId,currentText){
  if(!requireAdmin())return;
  const newText=prompt("Edit message:", currentText||"");
  if(newText===null)return;
  const clean=newText.trim();
  if(!clean){adminMsg("Message cannot be blank.",true);return}
  await adminRpc("admin_update_message",{p_token:adminState.token,p_message_id:messageId,p_message:clean});
  adminMsg("Message updated.");
  await adminLoadMessages();
}

async function adminDeleteMessage(messageId){
  if(!requireAdmin())return;
  if(!confirm("Delete this message?"))return;
  await adminRpc("admin_delete_message",{p_token:adminState.token,p_message_id:messageId});
  adminMsg("Message deleted.");
  await adminLoadMessages();
}
async function adminSendBroadcastMessage(){
  if(!requireAdmin())return;
  const grade=Number($("admBroadcastGrade")?.value||0);
  const text=($("admBroadcastText")?.value||"").trim();
  if(!grade){adminMsg("Choose a grade.",true);return}
  if(!text){adminMsg("Type the broadcast message first.",true);return}
  if(!confirm(`Send this message to all active Grade ${grade} students?`))return;
  const d=await adminRpc("admin_send_message_to_all",{p_token:adminState.token,p_grade:grade,p_message:text});
  $("admBroadcastText").value="";
  const n=(d&&d[0]&&d[0].sent_count)?d[0].sent_count:0;
  adminMsg(`Broadcast sent to ${n} student(s).`);
  await adminLoadMessages();
}

/* MESSAGES */
function adminOpenMessagesForStudent(studentId){
  showAdminTab("messages");
  if($("admMessageStudent")) $("admMessageStudent").value=studentId;
  adminLoadMessages();
}
async function adminRefreshUnreadMessages(){
  if(!adminState.token)return;
  try{
    const d=await adminRpc("admin_unread_message_count",{p_token:adminState.token});
    const n=(d&&d[0]?Number(d[0].unread_count):0);
    if($("adminUnreadBadge")) $("adminUnreadBadge").innerHTML=n?`<span class="unread-dot">${n}</span>`:"";
  }catch(e){}
}
async function adminLoadMessages(){
  if(!requireAdmin())return;
  if(!adminState.students.length) await adminLoadStudents();
  const d=await adminRpc("admin_list_messages",{
    p_token:adminState.token,
    p_student_id:$("admMessageStudent")?.value||null,
    p_unread_only:$("admMessageUnread")?.value==="true",
    p_limit:200
  });
  adminState.messages=d||[];
  $("adminMessagesTable").innerHTML=`<div class="message-list">${adminState.messages.length?adminState.messages.map(m=>`<div class="msg ${m.sender_role==="teacher"?"teacher":"student"}"><div class="msg-meta">${escapeHtml(m.full_name)} • ${m.sender_role==="teacher"?"Teacher":"Student"} • ${escapeHtml(new Date(m.created_at).toLocaleString())}${!m.read_by_teacher&&m.sender_role==="student"?" • UNREAD":""}</div><div class="msg-text">${escapeHtml(m.message_text)}</div><div class="admin-actions"><button class="small-btn" onclick="adminEditMessage('${m.id||m.message_id}', this.dataset.text)" data-text="${escapeHtml(m.message_text)}">Edit</button><button class="small-btn danger" onclick="adminDeleteMessage('${m.id||m.message_id}')">Delete</button></div></div>`).join(""):`<div class="loader">No messages found.</div>`}</div>`;
  await adminRefreshUnreadMessages();
}
async function adminSendReply(){
  if(!requireAdmin())return;
  const studentId=$("admMessageStudent")?.value;
  const text=($("admReplyText")?.value||"").trim();
  if(!studentId){adminMsg("Choose one student to reply to.",true);return}
  if(!text){adminMsg("Type a reply first.",true);return}
  await adminRpc("admin_send_message",{p_token:adminState.token,p_student_id:studentId,p_message:text});
  $("admReplyText").value="";
  adminMsg("Reply sent.");
  await adminLoadMessages();
}
async function adminMarkMessagesRead(){
  if(!requireAdmin())return;
  await adminRpc("admin_mark_messages_read",{p_token:adminState.token,p_student_id:$("admMessageStudent")?.value||null});
  adminMsg("Messages marked read.");
  await adminLoadMessages();
}

/* LINKS */
/* MESSAGES */
function adminOpenMessagesForStudent(studentId){
  showAdminTab("messages");
  if($("admMessageStudent")) $("admMessageStudent").value=studentId;
  adminLoadMessages();
}
async function adminRefreshUnreadMessages(){
  if(!adminState.token)return;
  try{
    const d=await adminRpc("admin_unread_message_count",{p_token:adminState.token});
    const n=(d&&d[0]?Number(d[0].unread_count):0);
    if($("adminUnreadBadge")) $("adminUnreadBadge").innerHTML=n?`<span class="unread-dot">${n}</span>`:"";
  }catch(e){}
}
async function adminLoadMessages(){
  if(!requireAdmin())return;
  if(!adminState.students.length) await adminLoadStudents();
  const d=await adminRpc("admin_list_messages",{
    p_token:adminState.token,
    p_student_id:$("admMessageStudent")?.value||null,
    p_unread_only:$("admMessageUnread")?.value==="true",
    p_limit:200
  });
  adminState.messages=d||[];
  $("adminMessagesTable").innerHTML=`<div class="message-list">${adminState.messages.length?adminState.messages.map(m=>`<div class="msg ${m.sender_role==="teacher"?"teacher":"student"}"><div class="msg-meta">${escapeHtml(m.full_name)} • ${m.sender_role==="teacher"?"Teacher":"Student"} • ${escapeHtml(new Date(m.created_at).toLocaleString())}${!m.read_by_teacher&&m.sender_role==="student"?" • UNREAD":""}</div><div class="msg-text">${escapeHtml(m.message_text)}</div><div class="admin-actions"><button class="small-btn" onclick="adminEditMessage('${m.id||m.message_id}', this.dataset.text)" data-text="${escapeHtml(m.message_text)}">Edit</button><button class="small-btn danger" onclick="adminDeleteMessage('${m.id||m.message_id}')">Delete</button></div></div>`).join(""):`<div class="loader">No messages found.</div>`}</div>`;
  await adminRefreshUnreadMessages();
}
async function adminSendReply(){
  if(!requireAdmin())return;
  const studentId=$("admMessageStudent")?.value;
  const text=($("admReplyText")?.value||"").trim();
  if(!studentId){adminMsg("Choose one student to reply to.",true);return}
  if(!text){adminMsg("Type a reply first.",true);return}
  await adminRpc("admin_send_message",{p_token:adminState.token,p_student_id:studentId,p_message:text});
  $("admReplyText").value="";
  adminMsg("Reply sent.");
  await adminLoadMessages();
}
async function adminMarkMessagesRead(){
  if(!requireAdmin())return;
  await adminRpc("admin_mark_messages_read",{p_token:adminState.token,p_student_id:$("admMessageStudent")?.value||null});
  adminMsg("Messages marked read.");
  await adminLoadMessages();
}

/* LINKS */
async function adminLoadResourceLinks(){
  if(!requireAdmin())return;
  if(!adminState.subjects.length) await adminLoadSubjects();
  const v2=await sb.rpc("admin_list_resource_links_v2",{p_token:adminState.token});
  if(v2.error){
    adminState.resourceLinks=await adminRpc("admin_list_resource_links",{p_token:adminState.token});
  }else{
    adminState.resourceLinks=v2.data||[];
  }
  adminState.resourceLinks=(adminState.resourceLinks||[]).map(x=>({...x,term:x.term||null}));
  adminRenderResourceLinksTable();
}
function adminRenderResourceLinksTable(){
  const search=($("admLinkSearch")?.value||"").toLowerCase().trim();
  const rows=(adminState.resourceLinks||[]).filter(l=>!search || [l.grade_level,l.subject_name,l.term,l.title,l.url,l.description].join(" ").toLowerCase().includes(search));
  $("adminLinksTable").innerHTML=`<table class="admin-table"><thead><tr><th>Grade</th><th>Subject</th><th>Term</th><th>Resource</th><th>URL</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(l=>`<tr><td>${l.grade_level}</td><td>${escapeHtml(l.subject_name)}</td><td>${escapeHtml(l.term||"All terms")}</td><td>${escapeHtml(l.title)}</td><td>${escapeHtml(shortText(l.url,55))}</td><td>${l.active}</td><td><button class="small-btn" onclick="adminEditResourceLink('${l.id}')">Edit</button><button class="small-btn danger" onclick="adminDeleteResourceLink('${l.id}')">Delete</button></td></tr>`).join("")}</tbody></table>`;
}
function adminEditResourceLink(id){
  const l=adminState.resourceLinks.find(x=>String(x.id)===String(id)); if(!l)return;
  $("admLinkId").value=l.id;
  $("admLinkSubject").value=l.subject_id;
  $("admLinkTerm").value=l.term||"";
  $("admLinkTitle").value=l.title;
  $("admLinkUrl").value=l.url;
  $("admLinkDescription").value=l.description||"";
  $("admLinkIcon").value=l.icon||"🔗";
  $("admLinkOrder").value=l.display_order||100;
  $("admLinkActive").value=String(l.active);
}
function adminClearResourceLinkForm(){
  $("admLinkId").value="";
  $("admLinkTerm").value="";
  $("admLinkTitle").value="";
  $("admLinkUrl").value="";
  $("admLinkDescription").value="";
  $("admLinkIcon").value="🔗";
  $("admLinkOrder").value="100";
  $("admLinkActive").value="true";
}
async function adminSaveResourceLink(){
  if(!requireAdmin())return;
  const url=safeExternalUrl($("admLinkUrl").value);
  if(!url){adminMsg("Use a complete http:// or https:// resource link.",true);return}
  const v2=await sb.rpc("admin_upsert_resource_link_v2",{
    p_token:adminState.token,
    p_resource_link_id:$("admLinkId").value||null,
    p_subject_id:$("admLinkSubject").value,
    p_term:$("admLinkTerm").value||null,
    p_title:$("admLinkTitle").value.trim(),
    p_url:url,
    p_description:$("admLinkDescription").value.trim()||null,
    p_icon:$("admLinkIcon").value.trim()||"🔗",
    p_display_order:Number($("admLinkOrder").value||100),
    p_active:$("admLinkActive").value==="true"
  });
  if(v2.error){
    if($("admLinkTerm").value){adminMsg("Resource term support needs the supplied Supabase SQL patch.",true);return}
    await adminRpc("admin_upsert_resource_link",{
      p_token:adminState.token,p_resource_link_id:$("admLinkId").value||null,p_subject_id:$("admLinkSubject").value,
      p_title:$("admLinkTitle").value.trim(),p_url:url,p_description:$("admLinkDescription").value.trim()||null,
      p_icon:$("admLinkIcon").value.trim()||"🔗",p_display_order:Number($("admLinkOrder").value||100),p_active:$("admLinkActive").value==="true"
    });
  }
  adminMsg("Resource saved.");
  adminClearResourceLinkForm();
  await adminLoadResourceLinks();
  if(state.selectedSubject) await loadQuizzes();
}
async function adminDeleteResourceLink(id){
  if(!confirm("Delete this link?"))return;
  await adminRpc("admin_delete_resource_link",{p_token:adminState.token,p_resource_link_id:id});
  adminMsg("Resource deleted.");
  await adminLoadResourceLinks();
  if(state.selectedSubject) await loadQuizzes();
}


/* STUDENT-SPECIFIC LINKS */
async function adminLoadStudentPersonalLinksAdmin(){
  if(!requireAdmin())return;
  if(!adminState.students.length) await adminLoadStudents();
  if(!adminState.subjects.length) await adminLoadSubjects();
  const d=await adminRpc("admin_list_student_personal_links",{p_token:adminState.token});
  adminState.studentLinks=d||[];
  adminRenderStudentLinksTable();
}
function adminRenderStudentLinksTable(){
  const search=($("admStudentLinkSearch")?.value||"").toLowerCase().trim();
  const rows=(adminState.studentLinks||[]).filter(l=>!search || [l.full_name,l.grade_level,l.subject_name,l.title,l.url,l.description].join(" ").toLowerCase().includes(search));
  $("adminStudentLinksTable").innerHTML=`<table class="admin-table"><thead><tr><th>Student</th><th>Grade</th><th>Subject</th><th>Title</th><th>URL</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(l=>`<tr><td>${escapeHtml(l.full_name)}</td><td>${l.grade_level}</td><td>${escapeHtml(l.subject_name||"General")}</td><td>${escapeHtml(l.title)}</td><td>${escapeHtml(shortText(l.url,55))}</td><td>${l.active}</td><td><button class="small-btn" onclick="adminEditStudentPersonalLink('${l.id}')">Edit</button><button class="small-btn danger" onclick="adminDeleteStudentPersonalLink('${l.id}')">Delete</button></td></tr>`).join("")}</tbody></table>`;
}
function adminEditStudentPersonalLink(id){
  const l=adminState.studentLinks.find(x=>String(x.id)===String(id)); if(!l)return;
  $("admStudentLinkId").value=l.id;
  $("admStudentLinkStudent").value=l.student_id;
  $("admStudentLinkGrade").value=l.grade_level;
  $("admStudentLinkSubject").value=l.subject_id||"";
  $("admStudentLinkTitle").value=l.title;
  $("admStudentLinkUrl").value=l.url;
  $("admStudentLinkDescription").value=l.description||"";
  $("admStudentLinkIcon").value=l.icon||"⭐";
  $("admStudentLinkOrder").value=l.display_order||100;
  $("admStudentLinkActive").value=String(l.active);
}
function adminClearStudentPersonalLinkForm(){
  $("admStudentLinkId").value="";
  if($("admStudentLinkStudent").options.length) $("admStudentLinkStudent").selectedIndex=0;
  $("admStudentLinkGrade").value="6";
  $("admStudentLinkSubject").value="";
  $("admStudentLinkTitle").value="";
  $("admStudentLinkUrl").value="";
  $("admStudentLinkDescription").value="";
  $("admStudentLinkIcon").value="⭐";
  $("admStudentLinkOrder").value="100";
  $("admStudentLinkActive").value="true";
}
async function adminSaveStudentPersonalLink(){
  if(!requireAdmin())return;
  await adminRpc("admin_upsert_student_personal_link",{
    p_token:adminState.token,
    p_student_resource_link_id:$("admStudentLinkId").value||null,
    p_student_id:$("admStudentLinkStudent").value,
    p_grade_level:Number($("admStudentLinkGrade").value),
    p_subject_id:$("admStudentLinkSubject").value||null,
    p_title:$("admStudentLinkTitle").value.trim(),
    p_url:$("admStudentLinkUrl").value.trim(),
    p_description:$("admStudentLinkDescription").value.trim()||null,
    p_icon:$("admStudentLinkIcon").value.trim()||"⭐",
    p_display_order:Number($("admStudentLinkOrder").value||100),
    p_active:$("admStudentLinkActive").value==="true"
  });
  adminMsg("Student-specific link saved.");
  adminClearStudentPersonalLinkForm();
  await adminLoadStudentPersonalLinksAdmin();
}
async function adminDeleteStudentPersonalLink(id){
  if(!confirm("Delete this student-specific link?"))return;
  await adminRpc("admin_delete_student_personal_link",{p_token:adminState.token,p_student_resource_link_id:id});
  adminMsg("Student-specific link deleted.");
  await adminLoadStudentPersonalLinksAdmin();
}
