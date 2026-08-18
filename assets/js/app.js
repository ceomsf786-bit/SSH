setTimeout(fillAdminGrades,500);


setInterval(async()=>{
  try{
    if(!state.student || state.selectedSubject) return;
    const box=$("studentMessageText");
    if(box && document.activeElement===box && box.value.trim()) return;
    await loadStudentPersonalLinks(null);
    await loadStudentMessages();
    renderSubjects();
  }catch(e){}
}, 45000);

init();
