import {createScene} from './scene.js';
import {Rotation} from './motion.js';
import {buildLegacyGraph,searchLegacy,escapeHtml as esc,storyStep,sourceLink} from './legacy-model.js';
import {launchChatGPT,VOICE_INSTRUCTION} from './legacy-launcher.js';
const $=id=>document.getElementById(id);
const STORAGE_KEY='wildline-legacy-v1-view';
let dataset;
try{
 const response=await fetch(new URL('./legacy-data.json',import.meta.url),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('Curated dataset unavailable');
 dataset=await response.json();
 if(dataset.schema_version!==1||!Array.isArray(dataset.records)||!dataset.records.length)throw Error('Invalid curated dataset');
}catch{
 $('reviewBadge').textContent='CURATED DATA UNAVAILABLE';
 const message=document.createElement('div');message.className='error-state glass';message.setAttribute('role','alert');
 message.textContent='The reviewed story is unavailable. No private source or demonstration data has been substituted.';
 document.body.append(message);throw Error('Legacy review dataset unavailable');
}
const graph=buildLegacyGraph(dataset),{nodes,edges,groups}=graph,byId=new Map(nodes.map(n=>[n.id,n])),core=byId.get('core');
const recordById=new Map(dataset.records.map(r=>[r.id,r]));
const approved=dataset.review_status==='approved';
$('reviewBadge').textContent=approved?'CURATED SHOWCASE · APPROVED CONTENT':'PRIVATE REVIEW · NOT CLEARED FOR PUBLICATION';
$('datasetVersion').textContent='Story v'+dataset.version+' · '+dataset.records.length+' selected records';
document.body.dataset.sourceMode=approved?'curated-approved':'curated-private-review';
document.body.dataset.recordCount=dataset.records.length;document.body.dataset.relationshipCount=dataset.relationships.length;
let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{}
const preference=matchMedia('(prefers-reduced-motion: reduce)');
const state=Object.assign(new Rotation({paused:saved.paused===true,reducedMotion:preference.matches}),{
 selected:'core',filter:'all',path:[],labels:false,zoom:1,hover:null,reducedMotion:preference.matches,busy:false,
 leftCollapsed:false,rightCollapsed:false
});
let seed=91731,scene,following=false;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({selected:state.selected,paused:state.paused}));}catch{}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function modal(id){if(!$(id).open)$(id).showModal();}
function panels(){
 $('navigationPanel').hidden=state.leftCollapsed;$('detailsPanel').hidden=state.rightCollapsed;
 for(const [id,collapsed,label] of [['toggleLeft',state.leftCollapsed,'chapters'],['toggleRight',state.rightCollapsed,'story panel']]){
  $(id).setAttribute('aria-expanded',String(!collapsed));$(id).setAttribute('aria-label',(collapsed?'Open ':'Close ')+label);
 }
}
function neighbors(id){return edges.filter(e=>e.relationship&&(e.a===id||e.b===id)).map(edge=>({edge,node:byId.get(edge.a===id?edge.b:edge.a)}));}
function emphasis(n){
 if(state.path.length)return state.path.includes(n.id)?1:n.core?.7:.2;
 if(state.filter!=='all'&&n.group!==state.filter&&!n.core)return .12;
 if(state.selected==='core'||byId.get(state.selected)?.hub)return 1;
 return n.id===state.selected||n.core||neighbors(state.selected).some(o=>o.node.id===n.id)?1:n.hub?.65:.3;
}
function nav(){
 $('chapterNav').innerHTML='<button class="nav-button '+(state.filter==='all'?'active':'')+'" data-chapter="all" aria-pressed="'+(state.filter==='all')+'">The whole journey <span class="count">'+dataset.records.length+'</span></button>'+
 dataset.chapters.map(c=>'<button class="nav-button '+(state.filter===c.id?'active':'')+'" data-chapter="'+esc(c.id)+'" aria-pressed="'+(state.filter===c.id)+'"><span class="dot" style="--dot:'+esc(c.color)+'"></span><span class="label">'+esc(c.name)+'</span><span class="count">'+dataset.records.filter(r=>r.chapter===c.id).length+'</span></button>').join('');
 $('chapterNav').querySelectorAll('button').forEach(button=>button.onclick=()=>{
  state.filter=button.dataset.chapter;clearFootsteps();selectNode(state.filter==='all'?'core':'chapter:'+state.filter,{open:false});
  $('lensLabel').textContent=state.filter==='all'?'All chapters':groups[state.filter].name;nav();
 });
}
function storyPosition(){
 const index=Math.max(0,dataset.journey.indexOf(state.selected));
 $('timeRange').value=index;$('timeRange').setAttribute('aria-valuetext',(index+1)+' of '+dataset.journey.length+' · '+recordById.get(dataset.journey[index]).title+' · curated reading order');
 $('timeLabel').textContent=recordById.get(dataset.journey[index]).title;
 $('previousStep').disabled=index===0;$('nextStep').disabled=index===dataset.journey.length-1;
 if(following){$('traceText').textContent='Follow the Footsteps · '+(index+1)+' / '+dataset.journey.length+' · curated reading order, not a causal claim';}
}
function renderInspector(){
 const n=byId.get(state.selected)||core;
 if(!n.record){
  const chapter=groups[n.group];
  $('inspectorBody').innerHTML='<div class="section-label">'+(chapter?'CHAPTER':'LIVING LEGACY · EXPERIMENTAL')+'</div><h1 class="story-title">'+esc(chapter?.name||'The footsteps between moments')+'</h1><p class="story-text">'+esc(chapter?.subtitle||'Project Wildline explores everyday continuity: recovering context, understanding decisions and managing responsibilities. Living Legacy presents one selected chapter of that work, with sources and uncertainty in view. Imagine what your own Nexus could become.')+'</p><p class="story-note">What happened → What was understood → What was challenged → What changed → What followed → Why it mattered.</p><p class="microcopy">'+(approved?'Curated showcase content approved.':'Selected paraphrases for founder review. No candidate is cleared for public use yet.')+' This view is separate from personal Nexus.</p><button id="inspectorStart" class="primary-button">Follow the Footsteps</button>';
  $('inspectorStart').onclick=startFootsteps;return;
 }
 const r=n.record;
 $('inspectorBody').innerHTML='<div class="section-label">'+esc(groups[r.chapter].name)+'</div><h1 class="story-title">'+esc(r.title)+'</h1><div class="story-meta"><span>'+esc(r.capability_status.toUpperCase())+'</span><span>'+esc(r.epistemic_status)+'</span></div><p class="story-text">'+esc(r.summary)+'</p><p class="microcopy">'+esc(r.date_label)+(r.documented_date?' · '+esc(r.documented_date):' · Exact historical date not established')+'</p><button id="inspectSource" class="secondary-button">Inspect source and evidence</button><div class="section-label" style="margin-top:22px">RELATIONSHIPS · DIRECTION PRESERVED</div><div class="connections">'+neighbors(r.id).map(({edge,node})=>'<button data-node="'+esc(node.id)+'">'+(edge.a===r.id?'→ ':'← ')+esc(node.name)+'<small>'+esc(edge.label)+' · '+(edge.relationship.type==='thematic_connection'?'editorial reading connection':'documented reference')+'</small></button><button class="relation-detail" data-relation="'+esc(edge.id)+'"><small>Inspect this relationship</small></button>').join('')+'</div>';
 $('inspectSource').onclick=()=>showSources(r);
 $('inspectorBody').querySelectorAll('[data-node]').forEach(b=>b.onclick=()=>selectNode(b.dataset.node));
 $('inspectorBody').querySelectorAll('[data-relation]').forEach(b=>b.onclick=()=>showRelationship(b.dataset.relation));
}
function sourceList(sources){return '<ul class="source-list">'+sources.map(s=>{
 const href=sourceLink(s.url);return '<li>'+(href?'<a class="source-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a>':esc(s.title)+'<small class="microcopy"> · Private provenance retained only in the local review manifest; original text is excluded.</small>')+'</li>';
}).join('')+'</ul>';}
function showSources(record){
 $('sourceTitle').textContent=record.title;
 $('sourceContent').innerHTML='<p class="pill">'+(approved?'CURATED PARAPHRASE':'PARAPHRASE · PRIVATE REVIEW')+'</p><p class="source-summary">'+esc(record.summary)+'</p><div class="story-meta"><span>'+esc(record.epistemic_status)+'</span><span>'+esc(record.capability_status)+'</span></div><p>'+esc(record.date_label)+(record.documented_date?' · '+esc(record.documented_date):' · Exact historical date not established')+'</p>'+sourceList(record.sources)+'<p class="dialog-note">This panel shows the selected sanitized summary and its evidence references. It does not retrieve original Core records or Bee conversations. Source claims keep their stated limits; future vision is not an implemented capability.</p>';
 modal('sourceDialog');
}
function showRelationship(id){
 const r=dataset.relationships.find(r=>r.id===id);
 $('sourceTitle').textContent=r.label;
 $('sourceContent').innerHTML='<p>'+esc(recordById.get(r.from).title)+' → '+esc(recordById.get(r.to).title)+'</p><p>'+esc(r.description)+'</p><p class="story-note">'+(r.type==='thematic_connection'?'Editorial reading connection. This is not a documented historical or causal relationship.':'Documented reference. Direction is preserved; a reference does not establish causality.')+'</p>'+sourceList(r.sources);
 modal('sourceDialog');
}
function selectNode(id,{open=true,keepPath=false}={}){
 if(!byId.has(id))return;if(!keepPath)clearFootsteps();
 const selected=byId.get(id);
 if(selected.record&&state.filter!=='all'&&state.filter!==selected.group){state.filter=selected.group;$('lensLabel').textContent=groups[state.filter].name;nav();}
 state.selected=id;renderInspector();storyPosition();if(open){state.rightCollapsed=false;}
 panels();scene?.focus(byId.get(id));persist();
}
function clearFootsteps(){following=false;state.path=[];$('traceBanner').hidden=true;}
function startFootsteps(){
 state.filter='all';following=true;state.path=[...dataset.journey];$('lensLabel').textContent='Follow the Footsteps';$('traceBanner').hidden=false;
 selectNode(dataset.journey[0],{keepPath:true});nav();
}
$('toggleLeft').onclick=()=>{state.leftCollapsed=!state.leftCollapsed;panels();};
$('toggleRight').onclick=()=>{state.rightCollapsed=!state.rightCollapsed;panels();};
$('visibleNodes').textContent=dataset.records.length;$('visibleLinks').textContent=dataset.relationships.length;
$('timeRange').max=dataset.journey.length-1;
$('timeRange').oninput=event=>selectNode(dataset.journey[Number(event.target.value)],{keepPath:following});
$('previousStep').onclick=()=>selectNode(storyStep(dataset,state.selected,-1),{keepPath:following});
$('nextStep').onclick=()=>selectNode(storyStep(dataset,state.selected,1),{keepPath:following});
$('footstepsButton').onclick=startFootsteps;$('clearTrace').onclick=clearFootsteps;
$('showIndex').onclick=()=>{
 $('indexContent').innerHTML=dataset.records.map(r=>'<button data-node="'+esc(r.id)+'">'+esc(r.title)+'<small>'+esc(groups[r.chapter].name)+' · '+esc(r.capability_status)+'</small></button>').join('');
 $('indexContent').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('indexDialog').close();selectNode(b.dataset.node);});modal('indexDialog');
};
$('searchInput').oninput=event=>{
 const q=event.target.value;$('searchResults').hidden=!q.trim();const results=searchLegacy(q,dataset);
 $('searchResults').innerHTML=results.length?results.map(r=>'<button data-node="'+esc(r.id)+'"><span>'+esc(r.title)+'<small>'+esc(groups[r.chapter].name)+' · '+esc(r.epistemic_status)+'</small></span></button>').join(''):'<p class="empty">No matching curated record.</p>';
 $('searchResults').querySelectorAll('button').forEach(b=>b.onclick=()=>{selectNode(b.dataset.node);$('searchResults').hidden=true;$('searchInput').value='';});
};
$('searchInput').onkeydown=e=>{if(e.key==='Escape')$('searchResults').hidden=true;if(e.key==='Enter')$('searchResults').querySelector('button')?.click();};
$('lyraButton').onclick=()=>{persist();launchChatGPT(window.open.bind(window));$('voiceInstruction').textContent=VOICE_INSTRUCTION;modal('voiceDialog');};
for(const name of ['source','index','voice','help'])$(name+'Close').onclick=()=>$(name+'Dialog').close();
$('helpButton').onclick=()=>modal('helpDialog');
$('resetCamera').onclick=()=>{state.filter='all';clearFootsteps();selectNode('core',{open:false});scene.reset();$('lensLabel').textContent='All chapters';nav();};
$('zoomIn').onclick=()=>scene.zoomBy(1.15);$('zoomOut').onclick=()=>scene.zoomBy(1/1.15);
function updateMotion(){$('motionButton').textContent=state.paused?'▷':'Ⅱ';$('motionButton').setAttribute('aria-label',state.paused?'Resume rotation':'Pause rotation');persist();}
$('motionButton').onclick=()=>{state.paused=!state.paused;updateMotion();};
$('labelsButton').onclick=()=>{state.labels=!state.labels;$('labelsButton').setAttribute('aria-pressed',String(state.labels));};
$('fullscreenButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}};
document.addEventListener('keydown',event=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]'))return;
 if(event.key==='/'){event.preventDefault();$('searchInput').focus();}
 if(event.code==='Space'){event.preventDefault();$('motionButton').click();}
 if(event.key.toLowerCase()==='r')$('resetCamera').click();
 if(event.key==='Escape'){state.leftCollapsed=state.rightCollapsed=true;panels();clearFootsteps();$('searchResults').hidden=true;}
});
preference.addEventListener('change',e=>{state.reducedMotion=e.matches;if(e.matches)state.paused=true;updateMotion();});
scene=createScene({$,esc,state,nodes,edges,byId,core,rand,activeNode:n=>Boolean(n),activeEdge:()=>true,emphasis,selectNode,currentDate:()=>null,onZoom:value=>$('zoomLabel').textContent=Math.round(value*100)+'%',recordLabel:' curated records',tooltipLabel:n=>n.record?'Curated source paraphrase':n.hub?'Story chapter':'Interface centre · no private Core connection',coreCaption:'L E G A C Y'});
nav();renderInspector();panels();storyPosition();updateMotion();
