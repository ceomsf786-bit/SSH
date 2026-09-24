const SUPABASE_URL = "https://gbezoogwevzctjxemuif.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XVPEm3NnzSKOxn0OM3Iv5w_iNc0_Ihu";
const CONFIG_NEEDED = SUPABASE_URL.includes("PASTE_") || SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");
const sb = CONFIG_NEEDED ? null : supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
window.sb = sb;

const state = { grade:null, student:null, learnerCode:null, subjects:[], selectedSubject:null, quizzes:[], resourceLinks:[], resourceTerm:"", personalLinks:[], messages:[], progress:[], subjectScoreSummary:[], revisionControls:[], practiceWork:[], selectedQuiz:null, questions:[], answers:{}, qIndex:0, leaderboardScope:"grade", quizStartedAt:null, quizDeadlineAt:null, quizTimerInterval:null, timerExpired:false, quizSubmitting:false, reviewFilter:"all", quizFilters:{term:"",topic:"",unit:""}, previewMode:false };
const $ = (id) => document.getElementById(id);

const demo = {
  students:{4:["Demo Grade 4 Learner"],5:["Demo Grade 5 Learner"],6:["Demo Grade 6 Learner","Demo Multi Grade Learner"],7:["Demo Grade 7 Learner"],8:["Demo Grade 8 Learner"],9:["Demo Grade 9 Learner"],10:["Demo Grade 10 Learner"],11:["Demo Grade 11 Learner"]},
  subjects:[{id:"eng",name:"English",icon:"📘"},{id:"math",name:"Math",icon:"➗"},{id:"afr",name:"Afrikaans",icon:"📗"},{id:"ns",name:"Natural Science",icon:"🔬"},{id:"geo",name:"Geography",icon:"🌍"},{id:"his",name:"History",icon:"🏺"},{id:"lo",name:"Life Orientation",icon:"💚"}],
  quizzes:[{id:"fractions",title:"Fractions Quick Challenge",description:"MCQ and missing word practice",time_limit_minutes:15,question_total:4,term:"Term 1",topic:"Fractions",unit:"Unit 1"},{id:"matchterms",title:"Math Match the Term",description:"Match terms to meanings",time_limit_minutes:10,question_total:2,term:"Term 1",topic:"Vocabulary",unit:"Unit 2"}],
  questions:[{question_id:"q1",question_no:1,question_type:"mcq",question:"What is ½ of 24?",image_url:"",options:[{value:"A",label:"10"},{value:"B",label:"12"},{value:"C",label:"14"},{value:"D",label:"18"},{value:"E",label:"20"}],marks:1},{question_id:"q2",question_no:2,question_type:"true_false",question:"True or False: 9 × 6 = 54",image_url:"",options:null,marks:1},{question_id:"q3",question_no:3,question_type:"missing_word",question:"Complete: The top number in a fraction is called the _______.",image_url:"",options:null,marks:1},{question_id:"q4",question_no:4,question_type:"match",question:"Match each fraction word to its meaning.",image_url:"",options:{left:["Numerator","Denominator"],right:["Bottom number","Top number"]},marks:2}],
  leaderboard:[{rank_no:1,full_name:"Ayesha Khan",avatar_url:"",average_percentage:91,quizzes_completed:8},{rank_no:2,full_name:"Yusuf Adams",avatar_url:"",average_percentage:86,quizzes_completed:7},{rank_no:3,full_name:"Zainab Jacobs",avatar_url:"",average_percentage:82,quizzes_completed:9},{rank_no:4,full_name:"Imraan Daniels",avatar_url:"",average_percentage:78,quizzes_completed:5}],
  resourceLinks:[{id:"demo-link-1",title:"Extra practice",url:"https://www.khanacademy.org",description:"Open extra lesson practice",icon:"🌐"},{id:"demo-link-2",title:"Worksheet folder",url:"https://www.google.com",description:"Open worksheet resources",icon:"📄"}],
  progress:[{quiz_id:"fractions",subject_id:"math",subject_name:"Math",quiz_title:"Fractions Quick Challenge",attempts:2,best_percentage:85,last_percentage:80,last_submitted_at:new Date(Date.now()-4*24*60*60*1000).toISOString(),next_review_at:new Date(Date.now()-24*60*60*1000).toISOString(),review_status:"review_due"},{quiz_id:"matchterms",subject_id:"math",subject_name:"Math",quiz_title:"Math Match the Term",attempts:1,best_percentage:70,last_percentage:70,last_submitted_at:new Date().toISOString(),next_review_at:new Date(Date.now()+24*60*60*1000).toISOString(),review_status:"review_later"}]
};

function setStatus(msg){$("connectionStatus").textContent=msg}
function escapeHtml(str){return String(str??"").replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]))}
function escapeJs(str){return String(str??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
function safeExternalUrl(value){
  const raw=String(value??"").trim();
  if(!raw)return "";
  try{
    const u=new URL(raw);
    return (u.protocol==="http:" || u.protocol==="https:") ? u.href : "";
  }catch(e){return ""}
}

const PRACTICE_LINK_LABEL_PREFIX="[[SNT_LINK_LABEL:";
const PRACTICE_LINK_LABEL_REGEX=/^\[\[SNT_LINK_LABEL:([^\]\r\n]{1,60})\]\]\s*/i;

function cleanPracticeLinkLabel(value){
  return String(value??"")
    .replace(/[\[\]\r\n]/g," ")
    .replace(/\s+/g," ")
    .trim()
    .slice(0,60);
}

function parsePracticeWorkText(value){
  const raw=String(value??"");
  const match=raw.match(PRACTICE_LINK_LABEL_REGEX);
  return {
    text:raw.replace(PRACTICE_LINK_LABEL_REGEX,"").trim(),
    linkLabel:match?cleanPracticeLinkLabel(match[1]):""
  };
}

function buildPracticeWorkStoredText(text,linkLabel,practiceUrl){
  const cleanText=String(text??"").trim();
  const cleanLabel=cleanPracticeLinkLabel(linkLabel);
  if(practiceUrl && cleanLabel){
    return `${PRACTICE_LINK_LABEL_PREFIX}${cleanLabel}]]\n${cleanText}`.trim();
  }
  return cleanText||null;
}
function gradeLabel(){return state.grade?`Grade ${state.grade}`:"No grade"}

function cleanQuizCode(v){return String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6)}
function quizName(q){return (q && (q.display_label || q.title)) ? (q.display_label || q.title) : "Quiz"}

async function openQuizDashboard(){
  if(!state.student){alert("Login first.");return}
  await loadSubjects();
  await loadLeaderboard();
}
