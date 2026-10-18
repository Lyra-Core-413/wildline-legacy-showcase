// Pure presentation geometry. Source records, chronology and relationship
// endpoints are never changed by the orbit or the contextual chapter view.
const TAU=Math.PI*2;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;

function identityPhase(id){
  let hash=2166136261;
  for(const character of String(id))hash=Math.imul(hash^character.charCodeAt(0),16777619)>>>0;
  return hash/4294967296*TAU;
}

function rotate(point,yaw,pitch,roll=0){
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
  const x=point.x*cy-point.z*sy,z=point.x*sy+point.z*cy;
  const y=point.y*cp-z*sp,depth=point.y*sp+z*cp;
  return {x:x*cr-y*sr,y:x*sr+y*cr,z:depth};
}

function orbitalPoint(angle,radius,index){
  // Each chapter has its own orbital plane instead of sharing a flat ring.
  return rotate({x:Math.cos(angle)*radius,y:Math.sin(angle)*radius*.79,z:0},
    -.43+(index%3)*.42,.40+(index%4)*.13,(index%3-1)*.38);
}

function minimumRadius(node){return node.core?29:node.hub?13:2.8;}

function projectGroup(entries,{cx,cy,halfWidth,halfHeight,maxScale,zoom,yaw,pitch,width,height,depthOffset=0}){
  const projected=entries.map(({node,position})=>{
    const point=rotate(position,yaw,pitch);
    const perspective=900/Math.max(450,900+point.z);
    return {node,x:point.x*perspective,y:point.y*perspective,z:point.z,perspective};
  });
  // Fit the resting view once. User zoom is applied afterward, so fitting must
  // not cancel the zoom control on viewports where the graph already fills it.
  let fit=maxScale;
  for(const point of projected){
    const margin=minimumRadius(point.node)+8;
    // Include both the sphere radius and the minimum hit-target radius when
    // fitting; this also keeps the same layout safe on a narrow phone screen.
    const nativeRadius=finite(point.node.r,6.5)*point.perspective;
    fit=Math.min(fit,
      Math.max(.01,halfWidth-margin)/(Math.abs(point.x)+nativeRadius||1),
      Math.max(.01,halfHeight-margin)/(Math.abs(point.y)+nativeRadius||1));
  }
  fit*=zoom;
  return new Map(projected.map(point=>{
    const scale=Math.max(.001,fit*point.perspective);
    const radius=Math.max(minimumRadius(point.node),finite(point.node.r,6.5)*scale);
    return [point.node.id,{
      // Enlarging the view may intentionally move nodes beyond the viewport,
      // as a normal camera zoom does. Every source node remains in the map.
      x:zoom>1?cx+point.x*fit:clamp(cx+point.x*fit,radius+8,width-radius-8),
      y:zoom>1?cy+point.y*fit:clamp(cy+point.y*fit,80+radius+8,height-150-radius-8),
      z:point.z+depthOffset,scale
    }];
  }));
}

export function layoutReadingRoom(nodes,{width=1280,height=800,time=0,yaw=0,pitch=0,zoom=1,selected='core'}={}){
  if(!nodes.length)return {points:new Map(),context:false,focusGroup:null};
  width=Math.max(180,finite(width,1280));height=Math.max(360,finite(height,800));
  time=finite(time,0);yaw=finite(yaw,0);pitch=finite(pitch,0);zoom=clamp(finite(zoom,1),.5,2.5);
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const chapters=nodes.filter(node=>node.hub).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const selectedNode=byId.get(selected);
  const focusGroup=selectedNode&&!selectedNode.core&&chapters.some(node=>node.group===selectedNode.group)?selectedNode.group:null;
  const context=focusGroup!==null;
  const hubPositions=new Map(chapters.map((node,index)=>{
    const angle=-Math.PI/2+index*TAU/Math.max(1,chapters.length)+time*(.000010+index*.0000013);
    return [node.group,orbitalPoint(angle,242+(index%3)*19,index)];
  }));
  const entries=nodes.map(node=>{
    if(node.core)return {node,position:{x:0,y:0,z:0}};
    const hub=hubPositions.get(node.group)||{x:0,y:0,z:0};
    if(node.hub)return {node,position:hub};
    const phase=identityPhase(node.id),angle=phase+time*(.000019+(phase/TAU)*.000009);
    const offset=rotate({x:Math.cos(angle)*(38+phase*2),y:Math.sin(angle)*40,z:Math.sin(angle*.93+phase)*18},phase*.2,.35,phase*.14);
    return {node,position:{x:hub.x+offset.x,y:hub.y+offset.y,z:hub.z+offset.z}};
  });
  const top=80,bottom=height-150,cy=(top+bottom)/2,halfHeight=(bottom-top)/2;
  const points=projectGroup(entries,{
    cx:width*(context?.22:.5),cy,
    halfWidth:context?width*.20-8:width*.5-8,
    halfHeight,maxScale:context?.36:1.20,zoom,yaw,pitch,width,height
  });
  if(context){
    const focused=nodes.filter(node=>!node.core&&node.group===focusGroup).map(node=>{
      if(node.hub)return {node,position:{x:0,y:0,z:0}};
      const phase=identityPhase(node.id),angle=phase+time*.000023;
      return {node,position:rotate({x:Math.cos(angle)*(110+phase*4),y:Math.sin(angle)*104,z:Math.sin(angle+phase)*42},.14,.35,.18)};
    });
    const expanded=projectGroup(focused,{
      cx:width*.65,cy,halfWidth:width*.21-8,halfHeight,
      maxScale:1.9,zoom,yaw,pitch,width,height,depthOffset:-320
    });
    for(const [id,point] of expanded)points.set(id,point);
  }
  return {points,context,focusGroup};
}
