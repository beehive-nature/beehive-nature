import test from 'node:test';
import assert from 'node:assert/strict';
import { treeSpace, projectTree } from '../../surfaces/tree-of-life.mjs';
test('four grandparent limbs occupy distinct 3D positions; rotation preserves identity', () => {
  const view={nodes:[{id:'root',gen:0,pos:.5},...Array.from({length:4},(_,i)=>({id:'g'+i,gen:2,pos:(i+.5)/4}))]};
  const points=treeSpace(view);
  assert.equal(new Set(points.slice(1).map(p=>p.limb)).size,4);
  assert.ok(new Set(points.slice(1).map(p=>p.z)).size>1);
  for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*2])for(const pitch of [-.9,0,.9])for(const zoom of [.5,1,2.5]){
    for(const p of points){const q=projectTree(p,{yaw,pitch,zoom},390,500);assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y)&&q.scale>0);}
  }
  assert.notEqual(projectTree(points[1],{yaw:0,pitch:0,zoom:1},600,600).x,projectTree(points[1],{yaw:1,pitch:0,zoom:1},600,600).x);
  assert.deepEqual(points.map(p=>p.id),view.nodes.map(p=>p.id));
});
