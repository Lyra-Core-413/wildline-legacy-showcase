import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildLegacyGraph} from '../legacy-model.js';

const dataset=JSON.parse(await readFile(new URL('../legacy-data.json',import.meta.url),'utf8'));
const {nodes}=buildLegacyGraph(dataset);
const module=await import('../reading-layout.js').catch(()=>({}));
const layout=module.layoutReadingRoom;

// These checks catch dropped source IDs, mutation, clipped hit targets, a planar
// orbit, or focus navigation that loses the surrounding source context.
test('the Reading Room exposes a pure layout function',()=>{
  assert.equal(typeof layout,'function','layoutReadingRoom is not implemented');
});

if(typeof layout==='function'){
  const snapshot=JSON.stringify(nodes);
  function bounded(result,width,height){
    assert.equal(result.points.size,29);
    assert.deepEqual([...result.points.keys()].sort(),nodes.map(n=>n.id).sort());
    for(const node of nodes){
      const point=result.points.get(node.id);
      assert.ok(Object.values(point).every(Number.isFinite),node.id+' must project to finite coordinates');
      const radius=Math.max(node.core?29:node.hub?13:2.8,node.r*point.scale);
      assert.ok(point.scale>0,node.id+' needs a positive visible scale');
      assert.ok(point.x>=radius+8&&point.x<=width-radius-8,node.id+' must fit horizontally');
      assert.ok(point.y>=80+radius+8&&point.y<=height-150-radius-8,node.id+' must clear the title and controls');
    }
  }

  test('overview preserves every source node without changing source coordinates',()=>{
    const result=layout(nodes);
    bounded(result,1280,800);
    assert.equal(result.context,false);
    assert.equal(result.focusGroup,null);
    assert.equal(JSON.stringify(nodes),snapshot);
    assert.equal(new Set(nodes.map(n=>n.id)).size,29);
  });

  test('orbit motion has independent depth and pauses deterministically at the supplied clock',()=>{
    const first=layout(nodes,{time:0});
    const later=layout(nodes,{time:12000});
    const repeat=layout(nodes,{time:12000});
    assert.deepEqual(later,repeat);
    const hubs=nodes.filter(n=>n.hub);
    assert.ok(hubs.filter(n=>Math.abs(first.points.get(n.id).z-later.points.get(n.id).z)>1).length>=5);
    assert.ok(hubs.filter(n=>Math.hypot(first.points.get(n.id).x-later.points.get(n.id).x,first.points.get(n.id).y-later.points.get(n.id).y)>1).length>=5);
    assert.ok(new Set(hubs.map(n=>Math.round(first.points.get(n.id).z))).size>=5);
    assert.deepEqual(first.points.get('core'),later.points.get('core'));
  });

  test('dragging either axis changes the real orbit projection',()=>{
    const start=layout(nodes);
    for(const options of [{yaw:.6},{pitch:.6}]){
      const moved=layout(nodes,options);
      assert.ok(nodes.filter(n=>n.hub).some(n=>Math.hypot(start.points.get(n.id).x-moved.points.get(n.id).x,start.points.get(n.id).y-moved.points.get(n.id).y)>8));
    }
  });

  test('chapter focus retains a miniature Lyra universe and expands its source records',()=>{
    const chapter=nodes.find(n=>n.hub),record=nodes.find(n=>n.record&&n.group===chapter.group);
    const result=layout(nodes,{selected:chapter.id});
    bounded(result,1280,800);
    assert.equal(result.context,true);
    assert.equal(result.focusGroup,chapter.group);
    assert.ok(result.points.get('core').x<1280*.32);
    assert.ok(result.points.get(chapter.id).x>1280*.5);
    assert.ok(result.points.get(record.id).scale>result.points.get('core').scale);
    for(const hub of nodes.filter(n=>n.hub&&n.group!==chapter.group))assert.ok(result.points.get(hub.id).x<1280*.45);
    assert.deepEqual(layout(nodes,{selected:record.id}),result,'source inspection must not move its chapter when selecting a member');
  });

  test('the default zoom keeps the entire graph inside glyph-safe bounds across narrow and wide views',()=>{
    for(const [width,height] of [[320,850],[390,700],[1280,850],[1920,1080]]){
      for(const selected of ['core',...nodes.filter(n=>n.hub).map(n=>n.id)]){
        for(const time of [0,13000,61000]){
          bounded(layout(nodes,{width,height,time,yaw:1.3,pitch:-.6,zoom:1,selected}),width,height);
        }
      }
    }
  });

  test('zoom controls expand and contract actual geometry in desktop and phone overview and chapter views',()=>{
    const chapter=nodes.find(node=>node.hub);
    for(const [width,height] of [[1280,850],[390,700]]){
      for(const selected of ['core',chapter.id]){
        const normal=layout(nodes,{width,height,selected,zoom:1});
        for(const zoom of [1.5,.5]){
          const changed=layout(nodes,{width,height,selected,zoom});
          const target=nodes.find(node=>selected==='core'?node.hub:node.record&&node.group===chapter.group);
          const before=normal.points.get(target.id),after=changed.points.get(target.id);
          assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>2,
            width+'px '+selected+' zoom '+zoom+' must move real node coordinates');
          assert.ok(Math.abs(after.scale/before.scale-zoom)<1e-9,
            width+'px '+selected+' zoom '+zoom+' must scale actual rendered nodes');
          assert.equal(changed.points.size,29,'zoom must not remove offscreen source nodes');
          if(zoom<1)bounded(changed,width,height);
        }
      }
    }
  });

  test('nested records stay nearer their chapter than unrelated chapters in overview',()=>{
    const result=layout(nodes,{width:1920,height:1080});
    for(const chapter of nodes.filter(n=>n.hub)){
      const hub=result.points.get(chapter.id);
      for(const record of nodes.filter(n=>n.record&&n.group===chapter.group)){
        const point=result.points.get(record.id);
        assert.ok(Math.hypot(point.x-hub.x,point.y-hub.y)<160,'record must remain in the chapter orbit');
      }
    }
  });

  test('unknown selection safely keeps the overview and empty graphs remain empty',()=>{
    assert.deepEqual(layout(nodes,{selected:'not-a-source'}),layout(nodes));
    assert.deepEqual(layout([]),{points:new Map(),context:false,focusGroup:null});
  });
}
