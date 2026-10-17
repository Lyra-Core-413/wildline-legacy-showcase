// Pure presentation model. No API clients, private sources, storage or inference.
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sourceLink(value){
 try {const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.username&&!u.password&&!u.search?u.href:null;}catch{return null;}
}
export function searchLegacy(query,dataset){
 const q=query.trim().toLowerCase();if(!q)return [];
 return dataset.records.filter(r=>[r.title,r.summary,r.epistemic_status,r.capability_status,...r.sources.map(s=>s.title)].join(' ').toLowerCase().includes(q)).slice(0,12);
}
export function storyStep(dataset,id,direction){
 const index=Math.max(0,dataset.journey.indexOf(id));
 return dataset.journey[Math.max(0,Math.min(dataset.journey.length-1,index+Math.sign(direction)))];
}
export function buildLegacyGraph(dataset){
 const groups=Object.fromEntries(dataset.chapters.map(c=>[c.id,c]));
 const nodes=[{id:'core',name:'Living Legacy',desc:'A curated journey through documented choices and becoming.',core:true,group:'all',x:0,y:0,z:0,r:48,color:'#9cbbff'}],edges=[];
 dataset.chapters.forEach((chapter,i)=>{
  const angle=-Math.PI/2+i*Math.PI*2/dataset.chapters.length;
  const hub={id:'chapter:'+chapter.id,name:chapter.name,hub:true,group:chapter.id,x:Math.cos(angle)*260,y:Math.sin(angle)*220,z:Math.sin(angle*2)*55,r:22,color:chapter.color};
  nodes.push(hub);edges.push({id:'layout:core:'+chapter.id,a:'core',b:hub.id,kind:'structural',label:'Chapter navigation'});
  dataset.records.filter(r=>r.chapter===chapter.id).forEach((record,j)=>{
   const a=angle+(j-1)*.26,radius=335+(j%2)*44;
   nodes.push({id:record.id,name:record.title,desc:record.summary,record,group:chapter.id,x:Math.cos(a)*radius,y:Math.sin(a)*radius*.76,z:Math.sin(a*2+j)*83,r:6.5,color:chapter.color});
   edges.push({id:'layout:'+record.id,a:hub.id,b:record.id,kind:'structural',label:'Chapter navigation'});
  });
 });
 dataset.relationships.forEach(r=>edges.push({id:r.id,a:r.from,b:r.to,label:r.label,kind:r.type==='thematic_connection'?'proposed':'recorded',relationship:r}));
 return {nodes,edges,groups};
}
