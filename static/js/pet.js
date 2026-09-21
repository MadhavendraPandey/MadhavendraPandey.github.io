// Event-driven cameos. No network requests or continuously running animation loop.
export function initPet() {
  const pet = document.querySelector('.pet');
  const nudge = pet?.querySelector('.pet-nudge');
  const dismiss = pet?.querySelector('.pet-hide');
  const speech = pet?.querySelector('.pet-speech');
  let dialogue = {};
  try { dialogue = JSON.parse(document.querySelector('#pet-dialogue')?.textContent || '{}'); } catch { /* Optional content. */ }
  if (!pet || !nudge || !dismiss || pet.dataset.initialized) return;
  pet.dataset.initialized = 'true';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const read = key => { try { return JSON.parse(sessionStorage.getItem(key)) || {}; } catch { return {}; } };
  const write = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Optional session memory. */ } };
  const saved = read('portfolio-pet-v2');
  const storedPosition = read('portfolio-pet-position');
  const state = {
    visible: false, expression: 'idle', sleeping: false, sleepAt: 0,
    context: null, lookTarget: null, linger: null, directHover: false, focused: false,
    lastActivity: Date.now(), lastVisual: 0, lastJump: 0, clickBlockedUntil: 0,
    lastDialogue: Number(saved.lastDialogue) || 0, lastMessageAt: 0, lastLeaveComment: Number(saved.lastLeaveComment) || 0,
    messageCount: Number(saved.messageCount) || 0, meaningfulCount: Number(saved.meaningfulCount) || 0,
    usedMessages: new Set(Array.isArray(saved.usedMessages) ? saved.usedMessages : []),
    interestMemory: saved.interestMemory || {}, repeatedSeen: new Set(saved.repeatedSeen || []),
    deepCount: 0, longLeaves: 0, hoverEpoch: 0, messageOwner: null, nearCount: 0, wasNear: false,
    lastAppearance: 0, priority: 0, priorityUntil: 0, hasActivity: false,
    appearanceCount: Number(saved.appearanceCount) || 0, dismissedCount: Number(saved.dismissedCount) || 0,
    muted: saved.muted === true, projectsSeen: saved.projectsSeen === true,
    position: Number.isFinite(storedPosition.x) && Number.isFinite(storedPosition.y) ? storedPosition : {x:0,y:1},
    drag: null, suppressClick: false, clicks: 0, clickAt: 0,
    lastScrollY: window.scrollY, lastScrollTime: Date.now(), fastAt: 0,
    frame: 0, hiddenAt: 0, destroyed: false, timers: new Map(), sections: new Map()
  };
  const removers = [];
  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  const clear = name => { clearTimeout(state.timers.get(name)); state.timers.delete(name); };
  const later = (name, delay, fn) => {
    clear(name);
    state.timers.set(name, setTimeout(() => { state.timers.delete(name); if (!state.destroyed) fn(); }, delay));
  };
  const save = () => write('portfolio-pet-v2', {
    projectsSeen: state.projectsSeen, appearanceCount: state.appearanceCount,
    dismissedCount: state.dismissedCount, muted: state.muted,
    lastDialogue: state.lastDialogue, lastLeaveComment: state.lastLeaveComment,
    messageCount: state.messageCount, meaningfulCount: state.meaningfulCount,
    usedMessages: [...state.usedMessages], interestMemory: state.interestMemory, repeatedSeen: [...state.repeatedSeen]
  });
  const clamp = (value, low, high) => Math.max(low, Math.min(Math.max(low, high), value));
  function place() {
    if (!state.visible) return;
    const width = pet.offsetWidth, height = pet.offsetHeight;
    const x = 12 + clamp(state.position.x,0,1) * Math.max(0,window.innerWidth-width-24);
    const y = 12 + clamp(state.position.y,0,1) * Math.max(0,window.innerHeight-height-24);
    pet.style.setProperty('--pet-x', `${x}px`);
    pet.style.setProperty('--pet-y', `${y}px`);
    if(speech) {
      speech.style.left = `${clamp(x,12,window.innerWidth-speech.offsetWidth-12)}px`;
      speech.style.top = `${clamp(y > speech.offsetHeight+24 ? y-speech.offsetHeight-8 : y+height+8,12,window.innerHeight-speech.offsetHeight-12)}px`;
    }
    pet.style.setProperty('--exit-x', x < window.innerWidth/2 ? '-18px' : '18px');
  }
  function move(x,y) {
    state.position = {x:clamp((x-12)/Math.max(1,window.innerWidth-pet.offsetWidth-24),0,1), y:clamp((y-12)/Math.max(1,window.innerHeight-pet.offsetHeight-24),0,1)};
    place();
    write('portfolio-pet-position',state.position);
  }
  function resetPetLook() {
    pet.style.removeProperty('--eye-x'); pet.style.removeProperty('--eye-y');
    pet.style.removeProperty('--pet-lean');
    pet.classList.remove('pet--near');
  }
  function setPetExpression(expression) { state.expression=expression; pet.dataset.state=expression; }
  function canReact(level=2, priority=70, direct=false) {
    if (state.destroyed || state.muted || document.hidden || state.drag) return false;
    if (state.priorityUntil > Date.now() && priority < state.priority) return false;
    if (state.linger && level > 1 && priority < 75) return false;
    if (level > 1 && !direct && Date.now()-state.lastVisual < 2500) return false;
    if (!state.visible && !direct && Date.now()-state.lastAppearance < 10000) return false;
    return true;
  }
  function jumpPet(type='small', direct=false) {
    if (motion.matches || !state.visible || state.sleeping || (!direct && Date.now()-state.lastJump<4000)) return;
    state.lastJump=Date.now();
    pet.classList.remove('pet--jump-small','pet--jump-normal','pet--jump-double');
    // One layout read restarts a discrete animation, never a frame loop.
    void nudge.offsetWidth;
    pet.classList.add(`pet--jump-${type}`);
    later('jump',type==='double'?850:540,()=>pet.classList.remove('pet--jump-small','pet--jump-normal','pet--jump-double'));
  }
  // Physical poses come first; comments are gated by meaningful interaction.
  const gestures = {
    identity: {expression:'pleased', action:'proud'},
    work: {expression:'curious', action:'inspect'},
    project: {expression:'curious', action:'inspect'},
    projects: {expression:'excited', action:'inspect'},
    github: {expression:'focused', action:'nod'},
    linkedin: {expression:'amused', action:'greet'},
    contact: {expression:'curious', action:'greet'},
    email: {expression:'focused', action:'attend'},
    architecture: {expression:'suspicious', action:'ponder'},
    detail: {expression:'curious', action:'read'},
    about: {expression:'curious', action:'read'},
    tech: {expression:'focused', action:'inspect'},
    footer: {expression:'impressed', action:'greet'},
    repeated: {expression:'suspicious', action:'double-take'}
  };
  function hideMessage() {
    clear('comment'); clear('message');
    state.messageOwner=null;
    pet.classList.remove('is-speaking');
    later('message-clear',180,()=>{ if(speech) speech.textContent=''; });
  }
  function queueComment(category, {element=null, valid=()=>true, priority=75, expression='focused', custom=null, onShown=null}={}) {
    clear('comment');
    if(!speech) return;
    const show=()=>{
      if(!valid() || !state.visible || !canReact(1,priority,true)) return;
      let project={};
      try { project=JSON.parse(element?.closest('[data-pet-project]')?.dataset.petProject || '{}'); } catch { /* Optional YAML metadata. */ }
      const override=custom || (category==='project_linger' ? element?.dataset.petMessage || project.hover : category.endsWith('_deep') ? element?.dataset.petRoast : null);
      const lines=override?[override]:dialogue[category] || [];
      const line=lines.find(value=>typeof value==='string' && value && !state.usedMessages.has(value)) || lines.find(value=>typeof value==='string' && value);
      if(!line) return;
      clear('message-clear'); clear('reaction');
      setPetExpression(expression); state.priority=priority; state.priorityUntil=Date.now()+2000;
      speech.textContent=line; state.messageOwner=element; pet.classList.add('is-speaking'); place();
      state.usedMessages.add(line); state.lastDialogue=Date.now(); state.lastMessageAt=Date.now(); state.messageCount++;
      onShown?.(); save();
      later('message',2000,()=>{ hideMessage(); relaxHover(); });
      scheduleHide();
    };
    show();
  }
  function blink() {
    clear('blink');
    if(!state.visible || state.sleeping || motion.matches || document.hidden || state.muted) return;
    later('blink',3000+Math.random()*5000,()=>{
      if(!['surprised','excited','annoyed','suspicious'].includes(state.expression)) {
        const close=()=>{ pet.classList.add('is-blinking'); later('blink-open',120,()=>pet.classList.remove('is-blinking')); };
        close(); if(Math.random()<.12) later('double-blink',320,close);
      }
      blink();
    });
  }
  function interestKey(element,context) {
    return element.dataset.petId || element.getAttribute?.('href') || element.id || `${context}:${(element.textContent||'').trim().slice(0,100)}`;
  }
  function recordInterest(element,context) {
    const key=interestKey(element,context), count=(state.interestMemory[key]||0)+1;
    state.interestMemory[key]=count; state.meaningfulCount++; save(); return {key,count};
  }
  function relaxHover() {
    if(state.priorityUntil>Date.now() && state.priority>75) return;
    state.priority=0; state.priorityUntil=0; pet.dataset.action='none';
    if(!state.sleeping) setPetExpression(state.linger ? state.linger.stage==='glance'?'curious':'focused' : 'idle');
    if(state.linger) lookAtElement(state.linger.element);
  }
  const directlyEngaged = () => state.drag || state.directHover || state.focused;
  function scheduleHide() {
    clear('hide');
    // The companion stays available throughout the page. It only leaves when
    // the visitor explicitly dismisses it or the document is torn down.
  }
  function showPet({expression='curious',jump='small'}={}) {
    if (state.muted || document.hidden || state.destroyed) return false;
    clear('leave'); clear('hide'); pet.classList.remove('pet--leaving');
    if (!state.visible) {
      state.visible=true; pet.hidden=false; state.appearanceCount++; state.lastAppearance=Date.now(); save();
      pet.classList.add('pet--visible','pet--entering'); place();
      blink();
      later('entrance',380,()=>{ pet.classList.remove('pet--entering'); if(jump) jumpPet(jump); });
    }
    state.sleeping=false; pet.classList.add('is-awake'); setPetExpression(expression); scheduleHide();
    return true;
  }
  function cancelLingerReaction(allowLeave=false) {
    const previous=state.linger;
    for(const name of ['interest','linger','deep','comment']) clear(name);
    if(state.messageOwner===previous?.element) hideMessage();
    state.hoverEpoch++; state.linger=null; state.lookTarget=null; resetPetLook();
    if(previous && state.priority<=80) { clear('reaction'); state.priorityUntil=0; relaxHover(); }
    if(allowLeave && previous?.meaningful && state.visible) {
      const epoch=state.hoverEpoch; state.longLeaves++;
      if(state.longLeaves%4===0 && Date.now()-state.lastLeaveComment>=60000) {
        queueComment('leave',{priority:50,expression:'idle',valid:()=>state.hoverEpoch===epoch && !state.linger,
          onShown:()=>{state.lastLeaveComment=Date.now();}});
      }
    }
    scheduleHide();
  }
  function hidePet(force=false) {
    if (!state.visible || (!force && directlyEngaged())) return;
    cancelLingerReaction(); hideMessage();
    for (const name of ['hide','entrance','jump','reaction','blink','blink-open','double-blink']) clear(name);
    state.context=null; state.priority=0; state.priorityUntil=0; setPetExpression('idle'); pet.dataset.action='none'; resetPetLook();
    pet.classList.remove('pet--entering','pet--jump-small','pet--jump-normal','pet--jump-double','pet--fast-scroll');
    pet.classList.remove('is-blinking');
    pet.classList.add('pet--leaving');
    const finish=()=>{ state.visible=false; pet.hidden=true; pet.classList.remove('pet--visible','pet--leaving'); };
    if (motion.matches || document.hidden) finish(); else later('leave',240,finish);
  }
  function lookAt(x,y) {
    if (!state.visible || state.sleeping || motion.matches || !pointer.matches || document.hidden) return;
    const box=nudge.getBoundingClientRect(), dx=x-box.left-box.width/2, dy=y-box.top-box.height/2;
    const distance=Math.max(55,Math.hypot(dx,dy)), extent=state.expression==='drowsy'?2:7;
    pet.style.setProperty('--pet-lean',`${dx/distance * (['focused','suspicious'].includes(state.expression)?3.5:1.7)}deg`);
    pet.style.setProperty('--eye-x',`${dx/distance*extent}px`); pet.style.setProperty('--eye-y',`${dy/distance*extent}px`);
  }
  function lookAtElement(element) {
    if (!element?.isConnected) return;
    const box=element.getBoundingClientRect(); lookAt(box.left+box.width/2,box.top+box.height/2);
  }
  function reactToContext(context, {priority=70,element=null,valid=null,jump=null,expression=null,action=null,direct=false,stage=false}={}) {
    if (valid && !valid() || !canReact(stage?1:2,priority,direct)) return false;
    const gesture=gestures[context] || {expression:'curious',action:'inspect'};
    expression=expression || gesture.expression;
    pet.dataset.action=action || gesture.action;
    if(priority>75) hideMessage();
    const wasVisible=state.visible;
    showPet({expression,jump});
    const duration=expression==='surprised'?500:1800;
    state.context=context; state.priority=priority; state.priorityUntil=Date.now()+duration; state.lastVisual=Date.now();
    if(wasVisible) {
      clear('entrance'); pet.classList.remove('pet--entering');
      if(jump) jumpPet(jump,direct);
    }
    if(element) lookAtElement(element);
    later('reaction',duration,()=>{ relaxHover(); pet.classList.remove('pet--fast-scroll'); });
    return true;
  }
  function startLingerReaction(element,context) {
    if(state.linger?.element===element) return;
    const handoff=Date.now()-state.lastMessageAt<2600;
    cancelLingerReaction();
    const hover={element,context,stage:'glance',meaningful:false};
    state.linger=hover; state.lookTarget=element;
    const valid=()=>!document.hidden && element.isConnected && state.linger===hover;
    lookAtElement(element);
    if(state.visible && canReact(1,50,true)) { setPetExpression('curious'); pet.dataset.action='none'; }
    later('interest',900,()=>{
      if(!valid()) return;
      hover.stage='interest';
      reactToContext(context,{priority:50,element,valid,expression:'focused',action:'none',stage:true});
    });
    later('linger',handoff?120:1000,()=>{
      if(!valid()) return;
      hover.stage='linger'; hover.meaningful=true;
      const {key,count}=recordInterest(element,context);
      const repeated=count>=3;
      if(!reactToContext(repeated?'repeated':context,{priority:75,element,valid,expression:repeated?'suspicious':'focused',action:repeated?'double-take':'none',stage:true})) return;
      const repeatEligible=repeated && !state.repeatedSeen.has(key);
      const lingerCategory=repeatEligible && dialogue[`${context}_repeated`]?`${context}_repeated`:repeatEligible?'repeated':context==='project'?'project_linger':context;
      queueComment(lingerCategory,
        {element,valid,priority:75,expression:repeated?'suspicious':'focused',onShown:()=>{if(repeatEligible) state.repeatedSeen.add(key);}});
    });
    if(['project','architecture','github','linkedin'].includes(context)) later('deep',6500,()=>{
      if(!valid()) return;
      hover.stage='deep'; state.deepCount++;
      if(!reactToContext(context,{priority:80,element,valid,expression:'suspicious',action:'ponder',stage:true})) return;
      if(state.deepCount%4===1) queueComment(`${context}_deep`,{element,valid,priority:80,expression:'suspicious'});
    });
  }
  function enterSleep() {
    state.sleeping=true; state.sleepAt=Date.now(); state.priority=0; state.priorityUntil=0;
    hideMessage(); for(const name of ['blink','blink-open','double-blink']) clear(name); pet.classList.remove('is-blinking');
    clear('reaction'); pet.dataset.action='none'; resetPetLook(); setPetExpression('sleeping');
  }
  function wakePet() {
    if(!state.sleeping) return;
    const meaningful=Date.now()-state.sleepAt>=5000;
    state.sleeping=false; setPetExpression('idle'); blink();
    if(meaningful) reactToContext('return',{priority:60,jump:'small',expression:'surprised'});
  }
  function armIdle() {
    later('drowsy',30000,()=>{ if(state.visible && !state.sleeping) { setPetExpression('drowsy'); resetPetLook(); } });
    later('sleep',38000,enterSleep);
  }
  function updateDwell() {
    clear('dwell');
    if(document.hidden || state.muted || !state.hasActivity) return;
    const now=Date.now(); let pending=false;
    for(const [element,section] of state.sections) {
      if(!section.active || section.done) continue;
      section.elapsed+=Math.max(0,Math.min(now,state.lastActivity+8000)-section.since); section.since=now;
      if(section.elapsed>=20000) {
        section.done=true;
        reactToContext(section.context,{element,valid:()=>section.active && !document.hidden && Date.now()-state.lastActivity<8000,jump:null});
      } else if(now-state.lastActivity<8000) pending=true;
    }
    if(pending) later('dwell',1000,updateDwell);
  }
  function markUserActivity() {
    if(document.hidden || state.muted || state.destroyed) return;
    const now=Date.now();
    if(state.hasActivity && now-state.lastActivity<250) return;
    if(!state.hasActivity) {
      for(const section of state.sections.values()) section.since=now;
    }
    updateDwell(); state.lastActivity=now; state.hasActivity=true;
    wakePet(); if(state.expression==='drowsy') setPetExpression('idle'); armIdle();
    for(const [element,section] of state.sections) {
      if(section.active && section.context==='projects' && !state.projectsSeen) discoverProjects(element);
    }
    updateDwell();
  }
  function discoverProjects(element) {
    if(!state.hasActivity || state.projectsSeen) return;
    if(reactToContext('projects',{element,jump:'normal'})) { state.projectsSeen=true; save(); }
  }
  function handleFastScroll() {
    const now=Date.now(), y=window.scrollY, dt=now-state.lastScrollTime, dy=y-state.lastScrollY;
    state.lastScrollTime=now; state.lastScrollY=y;
    if(dt>0 && dt<350 && Math.abs(dy)>45 && Math.abs(dy)/dt>1.25 && now-state.fastAt>3500) {
      if(state.visible && reactToContext('fast-scroll',{priority:40,jump:null,expression:'surprised'})) {
        state.fastAt=now; hideMessage(); pet.classList.add('pet--fast-scroll');
      }
    }
  }
  function handlePetClick() {
    if(state.suppressClick) { state.suppressClick=false; return; }
    markUserActivity(); cancelLingerReaction();
    state.clicks=Date.now()-state.clickAt<5000?state.clicks+1:1; state.clickAt=Date.now();
    const expression=state.clicks>=4?'annoyed':state.clicks===3?'suspicious':'surprised';
    const jump=state.clicks===1?'normal':state.clicks===2?'small':'double';
    pet.dataset.action='none'; void pet.offsetWidth;
    reactToContext('pet-click',{priority:100,direct:true,jump,expression,action:state.clicks>=2?'shake':'none'});
    resetPetLook();
    if(state.clicks===4) queueComment('pet_click',{priority:100,expression:'annoyed',valid:()=>state.context==='pet-click'});
  }
  function registerPetContextElements() {
    document.querySelectorAll('[data-pet-context], a[href*="github.com"], a[href*="linkedin.com"], a[href^="mailto:"], button').forEach(element=>{
      if(pet.contains(element)) return;
      const context=element.dataset.petContext || (element.href?.includes('github.com')?'github':element.href?.includes('linkedin.com')?'linkedin':element.href?.startsWith('mailto:')?'email':'button');
      on(element,'pointerenter',event=>{ if(pointer.matches && event.pointerType!=='touch') startLingerReaction(element,context); });
      on(element,'pointerleave',()=>{ if(state.linger?.element===element) cancelLingerReaction(true); });
      on(element,'focus',()=>startLingerReaction(element,context));
      on(element,'blur',()=>{ if(state.linger?.element===element) cancelLingerReaction(); });
      on(element,'click',()=>{
        if(!element.matches('a, button')) return;
        cancelLingerReaction(); markUserActivity(); recordInterest(element,context);
        reactToContext(context,{priority:90,element,direct:true,jump:context==='project'?'small':null,expression:context==='project'?'surprised':context==='github'?'impressed':'curious'});
      });
    });
  }
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries) {
      const section=state.sections.get(entry.target);
      const active=entry.isIntersecting && entry.intersectionRatio>=0.45;
      if(section.active===active) continue;
      section.active=active; section.since=Date.now(); section.elapsed=0;
      if(!active) continue;
      if(section.context==='projects') discoverProjects(entry.target);
      else if(section.context==='footer' && state.hasActivity && !section.entered) {
        section.entered=reactToContext('footer',{element:entry.target,jump:null});
      }
    }
    updateDwell();
  },{threshold:[0,0.45,0.6]});
  function registerGlobalPetEvents() {
    on(document,'pointermove',event=>{
      markUserActivity();
      if(!state.visible || state.sleeping || state.drag || !pointer.matches || motion.matches || event.pointerType==='touch' || state.frame || document.hidden) return;
      state.frame=requestAnimationFrame(()=>{
        state.frame=0;
        if(!state.visible || document.hidden) return;
        if(state.lookTarget) lookAtElement(state.lookTarget); else lookAt(event.clientX,event.clientY);
        const box=nudge.getBoundingClientRect(), distance=Math.hypot(event.clientX-box.left-box.width/2,event.clientY-box.top-box.height/2);
        const near=distance<80;
        if(near && !state.wasNear) state.nearCount++; state.wasNear=near;
        pet.classList.toggle('pet--near',near);
        if(near) pet.style.setProperty('--pet-lean',`${event.clientX<box.left+box.width/2?3:-3}deg`);
        if(distance<28 && canReact(2,60)) reactToContext('near',{priority:60,expression:state.nearCount>=3?'suspicious':'surprised',action:'none'});
      });
    },{passive:true});
    for(const type of ['pointerdown','keydown','touchstart']) on(document,type,markUserActivity,{passive:true});
    on(document,'scroll',()=>{ handleFastScroll(); markUserActivity(); },{passive:true});
    on(window,'resize',()=>{ cancelLingerReaction(); place(); });
    on(document,'visibilitychange',()=>{
      pet.classList.toggle('is-paused',document.hidden);
      cancelLingerReaction(); hideMessage(); pet.classList.remove('is-blinking');
      for(const name of [...state.timers.keys()]) clear(name);
      cancelAnimationFrame(state.frame); state.frame=0;
      pet.classList.remove('pet--entering','pet--jump-small','pet--jump-normal','pet--jump-double','pet--fast-scroll');
      pet.dataset.action='none'; state.priority=0; state.priorityUntil=0;
      for(const section of state.sections.values()) section.since=Date.now();
      if(document.hidden) { state.hiddenAt=Date.now(); if(pet.classList.contains('pet--leaving')) hidePet(true); }
      else {
        if(state.hiddenAt && Date.now()-state.hiddenAt>=38000) { state.sleeping=true; state.sleepAt=state.hiddenAt; }
        state.lastActivity=0; markUserActivity(); scheduleHide(); blink();
      }
    });
    const preferences=()=>{ resetPetLook(); cancelAnimationFrame(state.frame); state.frame=0; if(!pointer.matches) cancelLingerReaction(); pet.classList.remove('is-blinking'); for(const name of ['blink','blink-open','double-blink']) clear(name); blink(); };
    on(motion,'change',preferences); on(pointer,'change',preferences);
    on(window,'pagehide',cleanupPet);
  }
  function cleanupPet() {
    if(state.destroyed) return;
    hidePet(true); state.destroyed=true;
    for(const name of [...state.timers.keys()]) clear(name);
    cancelAnimationFrame(state.frame); observer.disconnect(); removers.forEach(remove=>remove());
    pet.hidden=true; state.visible=false; delete pet.dataset.initialized;
    // A restored back-forward cache page needs fresh listeners.
    window.addEventListener('pageshow',event=>{ if(event.persisted) initPet(); },{once:true});
  }
  pet.hidden=true; nudge.disabled=false; dismiss.hidden=false;
  if(state.muted) return {state,cleanupPet};
  registerPetContextElements(); registerGlobalPetEvents();
  document.querySelectorAll('[data-pet-section]').forEach(element=>{
    state.sections.set(element,{context:element.dataset.petSection,active:false,elapsed:0,since:Date.now(),done:false,entered:false}); observer.observe(element);
  });
  on(pet,'pointerenter',event=>{ if(event.pointerType!=='touch') {state.directHover=true; clear('hide');} });
  on(pet,'pointerleave',()=>{state.directHover=false; scheduleHide();});
  on(pet,'focusin',()=>{
    state.focused=nudge.matches(':focus-visible') || dismiss.matches(':focus-visible');
    if(state.focused) clear('hide');
  });
  on(pet,'focusout',event=>{ if(!pet.contains(event.relatedTarget)) {state.focused=false; scheduleHide();} });
  on(pet,'keydown',event=>{ if(event.key==='Escape') hidePet(true); });
  on(nudge,'click',handlePetClick);
  on(dismiss,'click',()=>{ state.muted=true; state.dismissedCount++; save(); hidePet(true); for(const name of [...state.timers.keys()]) if(name!=='leave') clear(name); });
  on(nudge,'pointerdown',event=>{
    if(event.button!==0 || state.drag) return;
    state.suppressClick=false; const box=pet.getBoundingClientRect();
    state.drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:box.left,top:box.top,moved:false};
    nudge.setPointerCapture(event.pointerId); clear('hide');
  });
  on(nudge,'pointermove',event=>{
    const drag=state.drag; if(!drag || drag.id!==event.pointerId) return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.hypot(dx,dy)>5) drag.moved=true;
    if(drag.moved) { pet.classList.add('is-dragging'); move(drag.left+dx,drag.top+dy); }
  });
  const endDrag=event=>{
    if(state.drag?.id!==event.pointerId) return;
    state.suppressClick=state.drag.moved; state.drag=null; pet.classList.remove('is-dragging');
    if(nudge.hasPointerCapture(event.pointerId)) nudge.releasePointerCapture(event.pointerId);
    scheduleHide();
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture']) on(nudge,type,endDrag);
  on(nudge,'keydown',event=>{
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    state.suppressClick=false; if(!direction) return;
    event.preventDefault(); const box=pet.getBoundingClientRect(),step=event.shiftKey?5:20;
    move(box.left+direction[0]*step,box.top+direction[1]*step);
  });
  // The companion is part of the page from the first frame; interactions can
  // still change its expression, position, and sleep state later.
  showPet({expression:'idle',jump:null});
  clear('hide');
  armIdle();
  return {state,cleanupPet};
}
if(typeof document!=='undefined') initPet();

