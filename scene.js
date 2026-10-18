import {layoutReadingRoom} from './reading-layout.js';
// Adapted directly from the approved Galaxy prototype's spatial scene.
// Canvas projects 3D world coordinates, depth-sorts stars and curves their links.
export function createScene(context){
 const {$,esc,state,nodes,edges,byId,core,rand,activeNode,activeEdge,emphasis,selectNode,currentDate,onZoom,recordLabel=' demo records',tooltipLabel=n=>n.core_record?'Core record':'fictional record',coreCaption='C O R E'}=context;
const canvas=$('graphCanvas'),ctx=canvas.getContext('2d');
let gw=800,gh=700,dpr=1,hitNodes=[],drag=null,motionTime=0,lastFrame=0;
let frameLayout=null,visualPoints=null,transitionFrom=null,transitionStarted=0;
let cameraFocus={x:0,y:0,z:0},targetFocus={x:0,y:0,z:0},targetZoom=1;
const skyDust=Array.from({length:410},()=>{const a=rand()*Math.PI*2,r=140+rand()*340;return{x:Math.cos(a)*r,y:Math.sin(a)*r*.67,z:(rand()-.5)*270,r:.35+rand()*.85,phase:rand()*6.28,color:rand()>.7?'#b399f5':'#79aadb'};});
function rgba(hex,a){const h=hex.replace('#','');return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;}
function resizeGraph(){const rect=$('graphWorld').getBoundingClientRect();gw=Math.max(2,rect.width);gh=Math.max(2,rect.height);dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(gw*dpr);canvas.height=Math.round(gh*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
function projection(p){
 if(p.id&&frameLayout?.points.has(p.id))return frameLayout.points.get(p.id);
 const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
 const px=p.x-cameraFocus.x,py=p.y-cameraFocus.y,pz=p.z-cameraFocus.z;
 let x=px*cy-pz*sy,z=px*sy+pz*cy,y=py*cp-z*sp;z=py*sp+z*cp;
 const base=Math.min(gw/850,Math.max(115,gh-205)/660);
 const scale=base*state.zoom*940/Math.max(250,940+z);
 if(frameLayout?.context){const c=frameLayout.points.get(core.id);return{x:c.x+x*scale*.34,y:c.y+y*scale*.34,z,scale:scale*.34};}
 return{x:gw*.5+x*scale,y:gh*.49+y*scale,z,scale};
}
function glow(x,y,r,color,strength=.35){if(r<=0)return;const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,rgba(color,strength));grad.addColorStop(.22,rgba(color,strength*.52));grad.addColorStop(.6,rgba(color,strength*.1));grad.addColorStop(1,rgba(color,0));ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function traceCurve(a,b,k=.13){const dx=b.x-a.x,dy=b.y-a.y;return{x:(a.x+b.x)/2-dy*k,y:(a.y+b.y)/2+dx*k};}
function curvePoint(a,c,b,t){const q=1-t;return{x:q*q*a.x+2*q*t*c.x+t*t*b.x,y:q*q*a.y+2*q*t*c.y+t*t*b.y};}
function drawOrbits(){const time=motionTime*.000024;for(let ring=0;ring<3;ring++){ctx.beginPath();const tilt=(ring-1)*.36;for(let i=0;i<=110;i++){const a=i/110*Math.PI*2+time*(ring%2?1:-1),r=95+ring*14;const raw={x:Math.cos(a)*r,y:Math.sin(a)*r*.40,z:Math.sin(a)*r*.72};const p=projection({x:raw.x*Math.cos(tilt)-raw.y*Math.sin(tilt),y:raw.x*Math.sin(tilt)+raw.y*Math.cos(tilt),z:raw.z});if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.strokeStyle=rgba(ring===1?'#bf96fa':'#83b9ff',ring===1?.24:.36);ctx.lineWidth=ring===1?.7:1;ctx.stroke();}
 // Distant orbital dust is decoration, not a fabricated relationship.
 for(const star of skyDust){const p=projection(star);const a=(.15+.3*(.5+.5*Math.sin(star.phase+motionTime*.0007)))*(state.path.length?.5:1);ctx.fillStyle=rgba(star.color,a);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.28,star.r*p.scale),0,Math.PI*2);ctx.fill();}}
function drawConnection(e,points){const na=byId.get(e.a),nb=byId.get(e.b);if(!na||!nb||!activeNode(na)||!activeNode(nb)||!activeEdge(e))return;const a=points.get(e.a),b=points.get(e.b);const selectedEdge=e.a===state.selected||e.b===state.selected;let onPath=false;for(let i=1;i<state.path.length;i++){if((state.path[i-1]===e.a&&state.path[i]===e.b)||(state.path[i-1]===e.b&&state.path[i]===e.a)){onPath=true;break;}}
 let alpha=(e.kind==='structural'?(na.core?.34:.21):.4)*Math.min(emphasis(na),emphasis(nb));if(selectedEdge&&state.selected!=='core')alpha=Math.max(alpha,.5);if(state.path.length)alpha=onPath?.96:.04;
 const historic=Boolean(e.invalid_at&&e.invalid_at<=currentDate());if(historic)alpha*=.38;
 const color=onPath?'#d8c3ff':e.kind==='inferred'?'#c99eee':historic?'#9cabc8':e.kind==='proposed'?'#e9c087':nb.color;
 ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=onPath?1.6:na.core?1.2:e.kind==='structural'?.6:.85;
 if(e.kind==='structural')ctx.setLineDash([3,8]);if(e.kind==='inferred')ctx.setLineDash([4,5]);if(e.kind==='proposed')ctx.setLineDash([2,7]);if(historic)ctx.setLineDash([1,5]);
 const curve=traceCurve(a,b,na.core?.17:e.kind==='structural'?.055:.16);
 if(onPath){ctx.shadowColor=color;ctx.shadowBlur=12;}
 ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(curve.x,curve.y,b.x,b.y);ctx.stroke();ctx.restore();
 if(onPath){let t=(motionTime*.00013+edges.indexOf(e)*.17)%1;if(state.paused)t=.53;const p=curvePoint(a,curve,b,t);glow(p.x,p.y,10,color,.5);ctx.fillStyle='#f2eaff';ctx.beginPath();ctx.arc(p.x,p.y,1.8,0,Math.PI*2);ctx.fill();}
}
function writeLabel(text,x,y,font,color,align='center'){ctx.font=font;if(align==='center'){const w=ctx.measureText(text).width;x=Math.max(w/2+8,Math.min(gw-w/2-8,x));}ctx.textAlign=align;ctx.textBaseline='middle';ctx.shadowColor='#020715';ctx.shadowBlur=6;ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.shadowBlur=0;}
function drawNode(n,p){const compact=Boolean(frameLayout?.context&&!n.core&&n.group!==frameLayout.focusGroup);const selected=n.id===state.selected,hover=n.id===state.hover;const alpha=emphasis(n);ctx.save();ctx.globalAlpha=alpha;let r=n.r*p.scale;if(n.core)r=Math.max(compact?13:29,r);else if(n.hub)r=Math.max(compact?5:13,r);else r=Math.max(compact?.7:n.minor?1.2:2.8,r);
 if(n.core||n.hub){
  glow(p.x,p.y,r*(n.core?2.3:2.4),n.color,n.core?.46:.31);
  const sphere=ctx.createRadialGradient(p.x-r*.3,p.y-r*.35,r*.03,p.x,p.y,r);sphere.addColorStop(0,rgba(n.color,n.core?.39:.63));sphere.addColorStop(.24,rgba(n.color,.19));sphere.addColorStop(.67,'rgba(8,16,40,.94)');sphere.addColorStop(1,rgba(n.color,.36));ctx.fillStyle=sphere;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=rgba(n.color,.86);ctx.lineWidth=n.core?1.1:.9;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();
  for(let j=0;j<2;j++){ctx.strokeStyle=rgba(n.color,.22+j*.10);ctx.lineWidth=.6;ctx.beginPath();ctx.ellipse(p.x,p.y,r*(1.12+j*.1),r*(.27+j*.09),-.48+j*.9,0,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.arc(p.x,p.y,r+4,-2.4,-.45);ctx.strokeStyle=rgba('#eef0ff',.57);ctx.lineWidth=.8;ctx.stroke();
  if(n.core){
   writeLabel('LYRA',p.x,p.y-(compact?2:5),`${Math.max(compact?8:15,r*.32)}px Georgia,serif`,'#e6edff');
   if(!compact){drawCore(p,r);writeLabel(coreCaption,p.x,p.y+15,`${Math.max(8,r*.14)}px "Segoe UI",Arial`,'#a6bfdc');}
  }else if(!compact){
   writeLabel(n.name.toUpperCase(),p.x,p.y+r+17,`500 ${Math.max(10,Math.min(13,p.scale*12))}px "Segoe UI",Arial`,rgba(n.color,.98));
   const num=nodes.filter(v=>v.group===n.group&&!v.hub&&activeNode(v)).length;
   writeLabel(num+recordLabel,p.x,p.y+r+32,'9px "Segoe UI",Arial','#92a8c8');
  }
 }else{
  glow(p.x,p.y,r*(selected||hover?6:4.2),n.color,selected?.58:hover?.5:.36);
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);const grad=ctx.createRadialGradient(p.x-r*.2,p.y-r*.3,0,p.x,p.y,r);grad.addColorStop(0,selected||hover?'#fff7ff':n.color);grad.addColorStop(.6,rgba(n.color,.86));grad.addColorStop(1,rgba(n.color,.35));ctx.fillStyle=grad;ctx.fill();
  ctx.strokeStyle=rgba('#e7efff',n.minor?.32:.68);ctx.lineWidth=.6;ctx.stroke();
  if(selected||hover||state.path.includes(n.id)){ctx.strokeStyle=rgba(n.color,.75);ctx.lineWidth=.75;ctx.beginPath();ctx.arc(p.x,p.y,r+5,0,Math.PI*2);ctx.stroke();}
  if(!compact&&(selected||hover||state.labels&&!n.minor||state.path.includes(n.id))){const text=n.name,fs=selected?11:10;ctx.font=`${selected?'500 ':''}${fs}px "Segoe UI",Arial`;const tw=ctx.measureText(text).width;const tx=Math.max(tw/2+7,Math.min(gw-tw/2-7,p.x));const ty=Math.max(65,Math.min(gh-110,p.y-r-15));ctx.fillStyle='rgba(4,10,27,.82)';ctx.beginPath();ctx.roundRect(tx-tw/2-7,ty-11,tw+14,22,6);ctx.fill();writeLabel(text,tx,ty,`${selected?'500 ':''}${fs}px "Segoe UI",Arial`,selected?'#edf2ff':'#b9cce5');}
 }
 ctx.restore();hitNodes.push({n,p,r});
}
function paintScene(){
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,gw,gh);hitNodes=[];if(gw<5||gh<5)return;
 frameLayout=layoutReadingRoom(nodes,{width:gw,height:gh,time:motionTime,yaw:state.yaw,pitch:state.pitch,zoom:state.zoom,selected:state.selected});
 if(transitionFrom&&!state.reducedMotion&&!state.paused){
  const t=Math.min(1,Math.max(0,(performance.now()-transitionStarted)/700)),ease=t*t*(3-2*t);
  frameLayout.points=new Map([...frameLayout.points].map(([id,to])=>{const from=transitionFrom.get(id)||to;return[id,Object.fromEntries(['x','y','z','scale'].map(key=>[key,from[key]+(to[key]-from[key])*ease]))];}));
  if(t===1)transitionFrom=null;
 }else transitionFrom=null;
 visualPoints=frameLayout.points;
 const c=projection(core);glow(c.x,c.y,Math.min(gw,gh)*.39,'#6478d3',.11);drawOrbits();
 const points=new Map(nodes.map(n=>[n.id,projection(n)]));for(const e of edges)drawConnection(e,points);
 const sorted=nodes.filter(activeNode).sort((a,b)=>points.get(b.id).z-points.get(a.id).z);for(const n of sorted)drawNode(n,points.get(n.id));
 canvas.dataset.visibleEntities=String(sorted.length);canvas.dataset.focusGroup=frameLayout.focusGroup||'all';canvas.dataset.coreX=c.x.toFixed(2);canvas.dataset.coreY=c.y.toFixed(2);
}

function drawCore(p,r){
 const clock=motionTime*.00016,activity=state.busy?1.5:state.selected!=='core'?1.12:1;
 const breath=state.reducedMotion?1:1+.035*Math.sin(motionTime*.0012);
 glow(p.x,p.y,r*2.5*breath,'#729afa',.12*activity);
 ctx.save();ctx.translate(p.x,p.y);
 for(let j=0;j<4;j++){
   ctx.save();ctx.rotate(clock*(j%2?-.37:.5)+j*.72);
   ctx.strokeStyle=rgba(j%2?'#bd9bfa':'#8cd9ff',.29+(j===0?.15:0));ctx.lineWidth=.65;
   ctx.beginPath();ctx.ellipse(0,0,r*(1.18+j*.13),r*(.38+j*.06),0,.2,5.75);ctx.stroke();
   const a=clock*(j+1)+j;const x=Math.cos(a)*r*(1.18+j*.13),y=Math.sin(a)*r*(.38+j*.06);
   glow(x,y,4.5,j%2?'#ba94ff':'#9bdbff',.7);ctx.restore();
 }
 for(let j=0;j<48;j++){
   const a=j/48*Math.PI*2-clock*.3,long=j%4===0;
   ctx.strokeStyle=rgba('#a6ccff',long?.48:.2);ctx.lineWidth=.55;
   ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.89,Math.sin(a)*r*.89);ctx.lineTo(Math.cos(a)*r*(long?.98:.94),Math.sin(a)*r*(long?.98:.94));ctx.stroke();
 }
 ctx.restore();
}
function animate(now){
 const delta=Math.min(.05,Math.max(0,(now-(lastFrame||now))/1000));lastFrame=now;
 if(!document.hidden){
   state.step(delta);
   if(!state.paused&&!state.reducedMotion)motionTime+=delta*1000;
   const ease=state.reducedMotion?1:1-Math.exp(-5*delta);
   for(const key of ['x','y','z'])cameraFocus[key]+=(targetFocus[key]-cameraFocus[key])*ease;
   state.zoom+=(targetZoom-state.zoom)*ease;
   paintScene();
   canvas.dataset.yaw=state.yaw.toFixed(6);canvas.dataset.pitch=state.pitch.toFixed(6);
   canvas.dataset.angularVelocity=state.velocity.toFixed(6);
   canvas.dataset.dragging=String(state.dragging);
 }
 requestAnimationFrame(animate);
}
function hitTest(x,y){let best=null,bestScore=Infinity;for(const o of hitNodes){if(emphasis(o.n)<.2)continue;const dist=Math.hypot(x-o.p.x,y-o.p.y),threshold=o.n.hub||o.n.core?o.r+7:Math.max(8,o.r+5);if(dist<=threshold){const score=dist/threshold;if(score<bestScore){best=o;bestScore=score;}}}return best;}
function pointerPosition(event){const rect=canvas.getBoundingClientRect();return{x:event.clientX-rect.x,y:event.clientY-rect.y};}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||!e.isPrimary)return;
 const p=pointerPosition(e);canvas.focus({preventScroll:true});
 transitionFrom=null;drag={id:e.pointerId,startX:p.x,startY:p.y,moved:false};
 targetFocus={...cameraFocus};state.begin(p.x,p.y,e.timeStamp);canvas.setPointerCapture(e.pointerId);$('graphTooltip').hidden=true;
});
canvas.addEventListener('pointermove',e=>{
 const p=pointerPosition(e);
 if(drag&&drag.id===e.pointerId){if(Math.hypot(p.x-drag.startX,p.y-drag.startY)>4)drag.moved=true;state.move(p.x,p.y,e.timeStamp);return;}
 const hit=hitTest(p.x,p.y);state.hover=hit?hit.n.id:null;canvas.style.cursor=hit?'pointer':'grab';
 if(hit){$('graphTooltip').innerHTML=esc(hit.n.name)+'<small>Select to inspect · '+tooltipLabel(hit.n)+'</small>';$('graphTooltip').hidden=false;$('graphTooltip').style.left=Math.min(Math.max(8,p.x+14),Math.max(8,gw-230))+'px';$('graphTooltip').style.top=Math.min(p.y+16,gh-64)+'px';}else $('graphTooltip').hidden=true;
});
canvas.addEventListener('pointerup',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 const moved=drag.moved;drag=null;state.end(e.timeStamp);
 if(!moved){const p=pointerPosition(e),hit=hitTest(p.x,p.y);if(hit)selectNode(hit.n.id);}
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointercancel',()=>{drag=null;state.cancel();});
canvas.addEventListener('lostpointercapture',()=>{if(drag){drag=null;state.cancel();}});
canvas.addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
 state.velocity=0;state.pitchVelocity=0;
 if(e.key==='ArrowLeft')state.yaw-=.08;if(e.key==='ArrowRight')state.yaw+=.08;
 if(e.key==='ArrowUp')state.pitch=Math.max(-1.15,state.pitch-.06);
 if(e.key==='ArrowDown')state.pitch=Math.min(1.15,state.pitch+.06);
});
canvas.addEventListener('pointerleave',()=>{state.hover=null;$('graphTooltip').hidden=true;});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-e.deltaY*.001));},{passive:false});
new ResizeObserver(resizeGraph).observe($('graphWorld'));
window.addEventListener('resize',resizeGraph);


 function focus(n){transitionFrom=visualPoints?new Map(visualPoints):null;transitionStarted=performance.now();targetFocus={x:0,y:0,z:0};targetZoom=1;onZoom(targetZoom);}
 function reset(){transitionFrom=visualPoints?new Map(visualPoints):null;transitionStarted=performance.now();targetFocus={x:0,y:0,z:0};targetZoom=1;onZoom(1);}
 function zoomBy(factor){targetZoom=Math.min(2.4,Math.max(.5,targetZoom*factor));onZoom(targetZoom);}
 resizeGraph();requestAnimationFrame(animate);
 return{focus,reset,zoomBy,resize:resizeGraph};
}
