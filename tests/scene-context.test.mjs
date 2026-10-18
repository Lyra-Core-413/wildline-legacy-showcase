import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createScene} from '../scene.js';
import {buildLegacyGraph} from '../legacy-model.js';
import {Rotation} from '../motion.js';
const dataset=JSON.parse(await readFile(new URL('../legacy-data.json',import.meta.url)));

test('actual canvas renderer retains every node and the Lyra parent when a record is focused',()=>{
 const original={window:globalThis.window,document:globalThis.document,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame};
 let frame;
 const gradient={addColorStop(){}};
 const ctx=new Proxy({createRadialGradient:()=>gradient,measureText:text=>({width:text.length*6})},{get:(target,key)=>key in target?target[key]:()=>{}});
 const canvas={dataset:{},style:{},width:0,height:0,getContext:()=>ctx,addEventListener(){},getBoundingClientRect:()=>({x:0,y:0,width:1280,height:800})};
 const elements={graphCanvas:canvas,graphWorld:{getBoundingClientRect:()=>({width:1280,height:800})}};
 globalThis.window={devicePixelRatio:1,addEventListener(){}};
 globalThis.document={hidden:false};
 globalThis.ResizeObserver=class{observe(){}};
 globalThis.requestAnimationFrame=callback=>{frame=callback;return 1;};
 try{
  const graph=buildLegacyGraph(dataset),byId=new Map(graph.nodes.map(node=>[node.id,node]));
  const state=Object.assign(new Rotation({paused:true,reducedMotion:true}),{selected:'core',path:[],zoom:1,labels:false,hover:null,reducedMotion:true});
  const scene=createScene({$:id=>elements[id],esc:String,state,...graph,byId,core:byId.get('core'),rand:()=>.5,activeNode:()=>true,activeEdge:()=>true,emphasis:()=>1,selectNode(){},currentDate:()=>null,onZoom(){}});
  frame(0);
  assert.equal(canvas.dataset.visibleEntities,'29');assert.equal(canvas.dataset.focusGroup,'all');
  const overviewCore=Number(canvas.dataset.coreX);
  state.selected=dataset.records[0].id;scene.focus(byId.get(state.selected));frame(20);
  assert.equal(canvas.dataset.visibleEntities,'29');assert.equal(canvas.dataset.focusGroup,dataset.records[0].chapter);
  assert.ok(Number(canvas.dataset.coreX)<overviewCore);
  const retained=canvas.dataset.coreX;frame(1020);assert.equal(canvas.dataset.coreX,retained);
  state.selected='core';scene.reset();frame(1040);assert.equal(canvas.dataset.focusGroup,'all');
 }finally{for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
