import assert from 'node:assert/strict';
import {initPet} from '../static/js/pet.js';
// Small event/clock harness: tests real controller handlers, without real-time waits.
let now=100000, seq=0;
const tasks=new Map();
globalThis.setTimeout=(fn,ms)=>{const id=++seq;tasks.set(id,{fn,at:now+ms});return id;};
globalThis.clearTimeout=id=>tasks.delete(id);
globalThis.requestAnimationFrame=fn=>setTimeout(fn,16);
globalThis.cancelAnimationFrame=clearTimeout;
Date.now=()=>now;
function tick(ms){const end=now+ms;for(;;){const next=[...tasks].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;tasks.delete(next[0]);next[1].fn();}now=end;}
class Element {
  constructor(dataset={}) {this.dataset=dataset;this.events=new Map();this.isConnected=true;this.hidden=false;this.offsetWidth=104;this.offsetHeight=76;this.properties={};this.style={setProperty:(k,v)=>this.properties[k]=v,removeProperty:k=>delete this.properties[k]};this.classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>this.classes.add(x)),remove:(...xs)=>xs.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};}
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);}
  removeEventListener(type,fn){this.events.get(type)?.delete(fn);}
  fire(type,event={}){for(const fn of [...this.events.get(type)||[]])fn({pointerType:'mouse',button:0,preventDefault(){},...event});}
  getBoundingClientRect(){return {left:parseFloat(this.properties['--pet-x'])||12,top:parseFloat(this.properties['--pet-y'])||12,width:this.offsetWidth,height:this.offsetHeight};}
  contains(el){return el===this || this.children?.includes(el);}
  closest(){return this.dataset.petProject?this:null;}
  matches(selector){return selector==='a, button' && this.dataset.petContext!=='architecture';}
  setPointerCapture(){} hasPointerCapture(){return false;} releasePointerCapture(){}
}
function setup({reduced=false,mobile=false,storage={}}={}) {
  tasks.clear();now+=100000;
  const pet=new Element(),nudge=new Element(),hide=new Element(),speech=new Element();speech.textContent='';pet.children=[nudge,hide,speech];
  pet.querySelector=s=>({'.pet-nudge':nudge,'.pet-hide':hide,'.pet-speech':speech})[s];
  const project=new Element({petContext:'project',petId:'example-project',petProject:JSON.stringify({hover:'babu called this small.'})});
  const github=new Element({petContext:'github'}),linkedin=new Element({petContext:'linkedin'});
  const projects=new Element({petSection:'projects'}),detail=new Element({petSection:'detail'}),footer=new Element({petSection:'footer'});
  const doc=new Element(),win=new Element(),motion=new Element(),pointer=new Element();
  motion.matches=reduced;pointer.matches=!mobile;doc.hidden=false;win.innerWidth=1000;win.innerHeight=800;win.scrollY=0;
  const messages={projects:['projects entry'],project_linger:['generic project'],github:['evidence.'],linkedin:['professional internet'],pet_click:['bhai.','what.'],detail:['actually reading'],projects_dwell:['taking your time.'],footer:['you made it.'],repeated:['still deciding?'],project_deep:['actually reading'],github_deep:['planning an audit?'],architecture:['the diagram'],leave:['fair enough.']};
  doc.querySelector=s=>s==='.pet'?pet:{textContent:JSON.stringify(messages)};
  doc.querySelectorAll=s=>s==='[data-pet-section]'?[projects,detail,footer]:[project,github,linkedin];
  const observers=[];
  Object.assign(globalThis,{document:doc,window:win,matchMedia:q=>q.includes('reduced')?motion:pointer,sessionStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v},IntersectionObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}});
  const api=initPet();
  const enter=(target,active=true)=>observers[0].fn([{target,isIntersecting:active,intersectionRatio:active?.6:0}]);
  const activity=()=>doc.fire('pointerdown');
  const cleanup=()=>api.cleanupPet();
  return {...api,pet,nudge,hide,speech,project,github,linkedin,projects,detail,footer,doc,win,motion,pointer,enter,activity,storage,cleanup};
}
let h=setup();
assert.equal(h.pet.hidden,false);
h.enter(h.projects);assert.equal(h.pet.hidden,false);
h.activity();assert.equal(h.pet.hidden,false);assert.equal(h.state.expression,'excited');
h.enter(h.projects,false);h.enter(h.projects);assert.equal(h.state.appearanceCount,1);h.cleanup();

h=setup();h.project.fire('pointerenter');tick(200);
assert.equal(h.state.linger.stage,'glance');assert.equal(h.speech.textContent,'');assert.equal(h.pet.hidden,false);
tick(700);assert.equal(h.state.expression,'focused');assert.equal(h.state.linger.stage,'interest');assert.equal(h.speech.textContent,'');
tick(1300);assert.equal(h.state.linger.stage,'linger');assert.equal(h.speech.textContent,'babu called this small.','Meaningful comments appear without an extra speech delay');
assert.equal(h.state.expression,'focused');tick(4300);assert.equal(h.state.linger.stage,'deep');assert.equal(h.state.expression,'suspicious');
assert.equal(h.state.messageCount,2,'Deep reaction can speak immediately after the linger comment');
h.project.fire('pointerleave');assert.equal(h.state.expression,'idle');assert.equal(h.state.linger,null);tick(200);assert.equal(h.speech.textContent,'');h.cleanup();
console.log('Glance, interest, linger, deep inspection, reaction-before-text and relaxation passed.');

for(const leaveAt of [200,1000,2250]) {
 h=setup();h.project.fire('pointerenter');tick(leaveAt);h.project.fire('pointerleave');tick(8000);
 assert.equal(h.state.messageCount,leaveAt>=1000?1:0,'Leaving cancels only comments that have not already appeared');assert.equal(h.state.linger,null);h.cleanup();
}
h=setup();h.project.fire('pointerenter');tick(1000);h.github.fire('pointerenter');tick(1000);
assert.equal(h.speech.textContent,'evidence.','Switching targets replaces stale speech with the new context');
h.github.fire('pointerleave');tick(200);h.linkedin.fire('pointerenter');tick(2440);assert.equal(h.state.context,'linkedin');assert.equal(h.speech.textContent,'','Dialogue cooldown never blocks the visual reaction');h.cleanup();
h=setup();h.project.fire('pointerenter');tick(900);h.project.isConnected=false;tick(6000);assert.equal(h.state.meaningfulCount,0);h.cleanup();
console.log('Early leave, pending-message cancellation, target switching and detached nodes passed.');

h=setup();
for(let i=0;i<3;i++){h.project.fire('pointerenter');tick(2450);if(i<2){h.project.fire('pointerleave');tick(31000);h.activity();tick(4000);}}
assert.equal(h.state.expression,'suspicious');assert.equal(h.speech.textContent,'still deciding?');assert.ok(h.state.repeatedSeen.has('example-project'));h.cleanup();
h=setup({storage:{'portfolio-pet-v2':JSON.stringify({meaningfulCount:1})}});h.github.fire('pointerenter');tick(2450);assert.equal(h.speech.textContent,'evidence.','Meaningful hovers receive contextual comments');tick(4290);assert.equal(h.speech.textContent,'planning an audit?');h.cleanup();
console.log('Meaningful repetition, session deduplication and rare deep comments passed.');

h=setup();h.project.fire('pointerenter');tick(900);h.pet.fire('pointerenter');
h.nudge.fire('click');assert.equal(h.state.expression,'surprised');assert.ok(h.pet.classes.has('pet--jump-normal'));
tick(400);assert.ok(h.pet.classes.has('pet--jump-normal'),'Entrance cannot override a click');
h.nudge.fire('click');assert.ok(h.pet.classes.has('pet--jump-small'));
h.nudge.fire('click');assert.equal(h.state.expression,'suspicious');
h.nudge.fire('click');assert.equal(h.state.expression,'annoyed');tick(240);assert.equal(h.speech.textContent,'bhai.');
h.nudge.fire('click');const clicks=h.state.clicks;for(let i=0;i<10;i++)h.nudge.fire('click');assert.equal(h.state.clicks,clicks+10,'Repeated taps keep escalating the physical reaction');
h.github.fire('pointerenter');tick(1000);assert.equal(h.state.expression,'annoyed','Interest cannot override a direct reaction');
h.github.fire('pointerleave');tick(38000);assert.equal(h.state.expression,'sleeping');tick(6000);h.doc.fire('pointermove',{clientX:50,clientY:50});tick(16);assert.equal(h.state.sleeping,false);assert.ok(h.pet.classes.has('pet--jump-small'));
h.pet.fire('pointerleave');tick(6000);assert.equal(h.pet.hidden,false);h.cleanup();
console.log('Click escalation, jump isolation, priority, click rest, sleep and wake passed.');

h=setup();h.project.fire('pointerenter');tick(900);h.project.fire('pointerleave');h.pet.fire('pointerenter');tick(3000);
h.win.scrollY=100;h.doc.fire('scroll');tick(50);h.win.scrollY=350;h.doc.fire('scroll');
assert.ok(h.pet.classes.has('pet--fast-scroll'));assert.equal(h.speech.textContent,'');const fast=h.state.fastAt;tick(50);h.win.scrollY=600;h.doc.fire('scroll');assert.equal(h.state.fastAt,fast);tick(500);assert.notEqual(h.state.expression,'surprised','Surprise is short');
h.github.fire('pointerenter');tick(1000);h.doc.hidden=true;h.doc.fire('visibilitychange');tick(60000);assert.equal(tasks.size,0);assert.equal(h.state.linger,null);h.doc.hidden=false;h.doc.fire('visibilitychange');assert.equal(h.speech.textContent,'evidence.');h.cleanup();
console.log('Silent fast scroll, short surprise, hidden-tab cleanup and return passed.');

h=setup();h.enter(h.detail);tick(25000);h.activity();assert.equal(h.pet.hidden,false);tick(21000);assert.equal(h.pet.hidden,false);
for(let i=0;i<13;i++){h.activity();tick(1000);}assert.equal(h.state.context,'detail');h.cleanup();
h=setup();h.enter(h.detail);h.activity();tick(5000);h.enter(h.detail,false);for(let i=0;i<25;i++){h.activity();tick(1000);}assert.equal(h.pet.hidden,false);h.cleanup();

const memory={};h=setup({reduced:true,storage:memory});h.project.fire('pointerenter');tick(2440);assert.equal(h.speech.textContent,'babu called this small.');assert.ok(![...h.pet.classes].some(x=>x.startsWith('pet--jump')));assert.equal(h.pet.properties['--eye-x'],undefined);assert.equal(h.state.timers.has('blink'),false);
h.nudge.fire('pointerdown',{pointerId:1,clientX:30,clientY:700});h.nudge.fire('pointermove',{pointerId:1,clientX:2000,clientY:-500});h.nudge.fire('pointerup',{pointerId:1});h.nudge.fire('click');assert.equal(h.state.clicks,0);assert.deepEqual(h.state.position,{x:1,y:0});
h.win.innerWidth=390;h.win.fire('resize');assert.equal(h.pet.properties['--pet-x'],'274px');h.cleanup();
h=setup({storage:memory});assert.deepEqual(h.state.position,{x:1,y:0});assert.ok(h.state.usedMessages.has('babu called this small.'));h.cleanup();
h=setup({mobile:true});h.project.fire('pointerenter',{pointerType:'touch'});tick(3000);assert.equal(h.pet.hidden,false);let blocked=false;h.project.fire('click',{preventDefault(){blocked=true;}});assert.equal(blocked,false);assert.equal(h.pet.hidden,false);h.hide.fire('click');tick(600);assert.equal(h.pet.hidden,true);h.project.fire('click');assert.equal(h.pet.hidden,true);h.cleanup();assert.equal(tasks.size,0);
console.log('Active dwell, reduced-motion comments, drag bounds, saved memory, mobile and cleanup passed.');

for(const [mobile,limit] of [[false,6],[true,3]]) {
 h=setup({mobile,storage:{'portfolio-pet-v2':JSON.stringify({messageCount:limit})}});
 h.project.fire('focus');tick(2440);assert.equal(h.pet.hidden,false);assert.equal(h.speech.textContent,'babu called this small.');h.cleanup();
}
console.log('Desktop/mobile dialogue caps and keyboard hover equivalent passed.');
