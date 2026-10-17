export function visibleAt(record, stage=3, date=null, includeHistorical=false) {
  if((record.stage??0)>stage)return false;
  if(!date)return true;
  if(!Number.isFinite(Date.parse(date)))return false;
  if(record.valid_at && Date.parse(record.valid_at)>Date.parse(date))return false;
  if(!includeHistorical && record.invalid_at && Date.parse(record.invalid_at)<=Date.parse(date))return false;
  return true;
}
export function tracePath(from,to,edges,stage=3,date=null) {
  const queue=[[from]],seen=new Set([from]);
  while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;
    for(const e of edges){if(!['explicit','recorded'].includes(e.kind)||!visibleAt(e,stage,date))continue;
      const next=e.a===last?e.b:e.b===last?e.a:null;
      if(next&&!seen.has(next)){seen.add(next);queue.push([...path,next]);}
    }
  }return [];
}
export function searchNodes(query,nodes,edges) {
  const q=query.trim().toLowerCase();if(!q)return [];
  const related=new Set(edges.filter(e=>(e.label||'').toLowerCase().includes(q)).flatMap(e=>[e.a,e.b]));
  return nodes.filter(n=>!n.minor&&(n.name.toLowerCase().includes(q)||((n.desc||'')+' '+(n.search_text||'')+' '+n.id).toLowerCase().includes(q)||related.has(n.id))).sort((a,b)=>Number(b.name.toLowerCase().includes(q))-Number(a.name.toLowerCase().includes(q))).slice(0,10);
}

export function provenanceLabel(node,knownSources=new Set()){
 if(node.core||node.hub||node.minor)return 'Interface structure';
 if(node.core_record&&node.source_ids?.some(id=>knownSources.has(id)))return `Core record · r${node.core_record.revision} · ${node.core_record.epistemic_status}`;
 return node.source_ids?.some(id=>knownSources.has(id))?'Fictional episode':'Source unavailable';
}
