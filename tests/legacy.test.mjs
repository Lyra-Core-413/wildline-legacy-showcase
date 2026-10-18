import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLegacyGraph,searchLegacy,escapeHtml,storyStep,sourceLink} from '../legacy-model.js';
import {launchChatGPT,VOICE_INSTRUCTION} from '../legacy-launcher.js';
const dataset={chapters:[{id:'growth',name:'Growth',color:'#79d7fa'}],records:[{id:'before',chapter:'growth',title:'Earlier reading',summary:'A documented interpretation.',sources:[{title:'Evidence'}]},{id:'after',chapter:'growth',title:'A correction',summary:'Uncertainty remains.',sources:[]}],relationships:[{id:'corrects',from:'after',to:'before',type:'documented_correction',label:'Corrects',description:'Recorded correction',causal_claim:false}],journey:['before','after']};
test('presentation membership is separate from factual record and link counts',()=>{
 const g=buildLegacyGraph(dataset);assert.equal(g.nodes.filter(n=>n.record).length,2);
 assert.equal(g.edges.filter(e=>e.relationship).length,1);
 const edge=g.edges.find(e=>e.relationship);assert.equal(edge.a,'after');assert.equal(edge.b,'before');
 assert.equal(edge.kind,'recorded');assert.equal(g.edges.filter(e=>e.kind==='structural').length,3);
});
test('search uses only supplied curated summaries and source titles',()=>{
 assert.deepEqual(searchLegacy('uncertainty',dataset).map(n=>n.id),['after']);
 assert.deepEqual(searchLegacy('evidence',dataset).map(n=>n.id),['before']);
 assert.deepEqual(searchLegacy('private data absent',dataset),[]);
});
test('story order is bounded navigation and does not invent chronological dates',()=>{
 assert.equal(storyStep(dataset,'before',-1),'before');assert.equal(storyStep(dataset,'after',1),'after');
 assert.equal(storyStep(dataset,'before',1),'after');
 assert.ok(buildLegacyGraph(dataset).nodes.filter(n=>n.record).every(n=>!n.valid_at));
});
test('untrusted text is escaped and private or active source URLs are rejected',()=>{
 assert.equal(escapeHtml('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
 for(const url of ['javascript:alert(1)','http://127.0.0.1:5187/api/graph','https://evil.invalid','https://github.com@evil.invalid','https://github.com/x?secret=x'])assert.equal(sourceLink(url),null);
 assert.equal(sourceLink('https://github.com/Lyra-Core-413/wildline-continuity-reader/blob/main/README.md'),'https://github.com/Lyra-Core-413/wildline-continuity-reader/blob/main/README.md');
});
test('launcher opens only public ChatGPT and never transmits selected map state',()=>{
 const calls=[];const open=(...args)=>{calls.push(args);return null;};
 const result=launchChatGPT(open);assert.equal(result.instruction,VOICE_INSTRUCTION);
 assert.equal(VOICE_INSTRUCTION,'Select Voice in ChatGPT to begin talking.');
 assert.equal(calls.length,1);assert.equal(calls[0][0],'https://chatgpt.com/');
 assert.ok(calls[0][2].includes('noopener'));assert.ok(calls[0][2].includes('noreferrer'));
 assert.equal(result.opened,false);
});
test('public GitHub evidence anchors retain their exact source link',()=>{
 const url='https://github.com/example/project/blob/main/README.md#L10';assert.equal(sourceLink(url),url);
});
