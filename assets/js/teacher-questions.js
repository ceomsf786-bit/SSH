/* QUESTIONS */
async function adminLoadQuestions(){
  if(!requireAdmin())return; if(!adminState.quizzes.length)await adminLoadQuizzes();
  const quizId=$("admQuestionQuiz").value; if(!quizId){$("adminQuestionsTable").innerHTML=`<div class="loader">No quiz selected.</div>`;return}
  const d=await adminRpc("admin_list_questions",{p_token:adminState.token,p_quiz_id:quizId});
  adminState.questions=d||[];
  adminRenderQuestionsTable();
}
function adminRenderQuestionsTable(){
  const search=($("admQuestionSearch")?.value||"").toLowerCase().trim();
  const rows=(adminState.questions||[]).filter(q=>!search || [q.question_no,q.question_type,q.term,q.topic,q.unit,q.question,q.marks,q.active].join(" ").toLowerCase().includes(search));
  $("adminQuestionsTable").innerHTML=`<table class="admin-table"><thead><tr><th>No</th><th>Type</th><th>Term</th><th>Topic</th><th>Unit</th><th>Question</th><th>Marks</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map(q=>`<tr><td>${q.question_no}</td><td>${escapeHtml(q.question_type)}</td><td>${escapeHtml(q.term||"")}</td><td>${escapeHtml(q.topic||"")}</td><td>${escapeHtml(q.unit||"")}</td><td>${escapeHtml(shortText(q.question,90))}</td><td>${q.marks}</td><td>${q.active}</td><td><button class="small-btn" onclick="adminEditQuestion('${q.id}')">Edit</button><button class="small-btn danger" onclick="adminDeleteQuestion('${q.id}')">Delete</button></td></tr>`).join("")}</tbody></table>`;
}
function adminEditQuestion(id){const q=adminState.questions.find(x=>String(x.id)===String(id)); if(!q)return; $("admQuestionId").value=q.id; $("admQuestionQuiz").value=q.quiz_id; $("admQuestionNo").value=q.question_no; $("admQuestionTerm").value=q.term||""; $("admQuestionTopic").value=q.topic||""; $("admQuestionUnit").value=q.unit||""; $("admQuestionType").value=q.question_type; $("admQuestionText").value=q.question; $("admQuestionImage").value=q.image_url||""; $("admQuestionOptions").value=q.options?JSON.stringify(q.options,null,2):""; $("admQuestionCorrect").value=JSON.stringify(q.correct_answer,null,2); $("admQuestionMarks").value=q.marks; $("admQuestionAccepted").value=JSON.stringify(q.accepted_answers||[],null,2); $("admQuestionExplanation").value=q.explanation||""; $("admQuestionActive").value=String(q.active)}
function adminClearQuestionForm(){$("admQuestionId").value="";$("admQuestionNo").value="1";$("admQuestionType").value="mcq";$("admQuestionText").value="";$("admQuestionTerm").value="";$("admQuestionTopic").value="";$("admQuestionUnit").value="";$("admQuestionImage").value="";$("admQuestionOptions").value='[{"value":"A","label":"Answer 1"},{"value":"B","label":"Answer 2"},{"value":"C","label":"Answer 3"},{"value":"D","label":"Answer 4"},{"value":"E","label":"Answer 5"}]';$("admQuestionCorrect").value='"A"';$("admQuestionMarks").value="1";$("admQuestionAccepted").value="[]";$("admQuestionExplanation").value="";$("admQuestionActive").value="true"}
async function adminSaveQuestion(){
  if(!requireAdmin())return;
  let options=null,correct=null,accepted=[];
  try{options=safeJson($("admQuestionOptions").value,null);correct=safeJson($("admQuestionCorrect").value,null);accepted=safeJson($("admQuestionAccepted").value,[])}catch(e){adminMsg("Invalid JSON.",true);return}
  await adminRpc("admin_upsert_question",{p_token:adminState.token,p_question_id:$("admQuestionId").value||null,p_quiz_id:$("admQuestionQuiz").value,p_question_no:Number($("admQuestionNo").value),p_question_type:$("admQuestionType").value,p_question:$("admQuestionText").value.trim(),p_term:$("admQuestionTerm").value.trim()||null,p_topic:$("admQuestionTopic").value.trim()||null,p_unit:$("admQuestionUnit").value.trim()||null,p_image_url:$("admQuestionImage").value.trim()||null,p_options:options,p_correct_answer:correct,p_marks:Number($("admQuestionMarks").value||1),p_accepted_answers:accepted,p_explanation:$("admQuestionExplanation").value.trim()||null,p_active:$("admQuestionActive").value==="true"});
  adminMsg("Question saved."); await adminLoadQuestions();
}
async function adminDeleteQuestion(id){if(!confirm("Delete question?"))return;await adminRpc("admin_delete_question",{p_token:adminState.token,p_question_id:id});adminMsg("Question deleted.");await adminLoadQuestions()}



async function adminUploadQuestionImageFromQuestionTab(){
  if(!requireAdmin())return;
  const file=$("admQuestionImageFile")?.files[0];
  if(!file){adminMsg("Choose an image file first.",true);return}
  if(file.size>2*1024*1024){adminMsg("Image must be under 2MB.",true);return}
  const quizId=$("admQuestionQuiz")?.value || "unassigned";
  const label=($("admQuestionImageLabel")?.value.trim()||"question-image").replace(/[^a-zA-Z0-9._-]/g,"_");
  const name=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=`questions/${quizId}/${Date.now()}-${label}-${name}`;
  const {error}=await sb.storage.from("quiz-images").upload(path,file,{cacheControl:"3600",upsert:true});
  if(error){adminMsg(error.message,true);return}
  const {data}=sb.storage.from("quiz-images").getPublicUrl(path);
  $("admQuestionImage").value=data.publicUrl;
  adminMsg("Image uploaded. Click Save question to attach it.");
}
