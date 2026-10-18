import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildLegacyGraph} from '../legacy-model.js';
const bytes=await readFile(new URL('../legacy-data.json',import.meta.url));
const data=JSON.parse(bytes);
test('the previously approved public story remains byte-for-byte unchanged',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'900f4c719c70876cc5ee6009e26fd18c7b208828f15a7eaedb2b3bfcce693087');
 assert.equal(data.records.length,21);assert.equal(data.relationships.length,11);assert.equal(data.chapters.length,7);
 assert.equal(data.relationships.filter(edge=>edge.type==='thematic_connection').length,8);
 assert.equal(data.relationships.filter(edge=>edge.type.startsWith('documented_')).length,3);
});
test('all curated sources and relationship endpoints remain traceable without fabricated edges',()=>{
 const graph=buildLegacyGraph(data),ids=new Set(data.records.map(record=>record.id));
 assert.equal(graph.nodes.length,29);assert.equal(new Set(graph.nodes.map(node=>node.id)).size,29);
 assert.equal(graph.edges.filter(edge=>edge.relationship).length,11);
 for(const record of data.records){assert.ok(record.sources.length);assert.ok(record.epistemic_status);assert.ok(record.date_label);}
 for(const edge of data.relationships){assert.ok(ids.has(edge.from)&&ids.has(edge.to));assert.equal(edge.causal_claim,false);assert.ok(edge.sources.length);}
});
