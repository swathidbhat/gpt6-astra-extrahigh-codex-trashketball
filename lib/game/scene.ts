import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Basket, Obstacle } from './physics';
export type Room = { root: THREE.Group; bin: THREE.Group; obstacles: Obstacle[]; animate?: (time: number) => void };
const mat = (color: THREE.ColorRepresentation, roughness = .7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geometry, material); o.position.set(x,y,z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
export function box(parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x=0,y=0,z=0, radius=0) {
  return mesh(parent, radius ? new RoundedBoxGeometry(w,h,d,2,radius) : new THREE.BoxGeometry(w,h,d), material,x,y,z);
}
export function cylinder(parent: THREE.Object3D, rt: number, rb: number, h: number, material: THREE.Material, x=0,y=0,z=0, segments=32) {return mesh(parent,new THREE.CylinderGeometry(rt,rb,h,segments),material,x,y,z);}
function lineBetween(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const center = a.clone().add(b).multiplyScalar(.5); const m=cylinder(parent,radius,radius,a.distanceTo(b),material,center.x,center.y,center.z,6);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;
}
function grain(color: string, kind:'carpet'|'wood'|'fabric'='carpet') {
  const c=document.createElement('canvas'); c.width=c.height=256; const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,256,256);
  let seed=913; const random=()=> {seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<20000;i++){ctx.fillStyle=random()>.5?'rgba(255,255,255,.055)':'rgba(0,0,0,.065)';const x=random()*256,y=random()*256;ctx.fillRect(x,y,kind==='wood'?random()*45+5:1,kind==='fabric'?2:1);}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='carpet'?12:4,kind==='carpet'?12:4);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function textPlane(parent:THREE.Object3D,text:string,w:number,h:number,x:number,y:number,z:number,fg='#d9e5c7',bg='#12392f',size=46,font='monospace') {
  const c=document.createElement('canvas');c.width=1024;c.height=Math.max(128,Math.round(1024*h/w));const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${size}px ${font}`;text.split('\n').forEach((line,i,a)=>ctx.fillText(line,512,c.height/2+(i-(a.length-1)/2)*size*1.45));const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return mesh(parent,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}),x,y,z);
}
export function makePaper() {
  const geometry=new THREE.IcosahedronGeometry(.105,2);const p=geometry.attributes.position; const colors=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=1+.095*Math.sin(x*213+y*187+z*113)+.048*Math.cos(x*309-y*113);p.setXYZ(i,x*n,y*n,z*n);const light=.84+.13*Math.sin(x*340+z*270)**2;colors.push(light,light*.994,light*.96);}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();const paper=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xfffcf0,vertexColors:true,roughness:1,flatShading:true}));paper.castShadow=true;return paper;
}
export function makeBin(root: THREE.Object3D, data:Basket, beach=false) {
  const g=new THREE.Group();g.position.set(data.x,0,data.z);root.add(g);
  const metal=mat(beach?'#b9915e':'#65746c',beach?.43:.42,beach?.55:.65);
  const dark=mat(beach?'#352d24':'#15241e');
  cylinder(g,data.bottomRadius,data.bottomRadius,.045,dark,0,.03,0);
  const rim=mesh(g,new THREE.TorusGeometry(data.radius,data.rim,10,64),metal,0,data.height,0);rim.rotation.x=Math.PI/2;
  const base=mesh(g,new THREE.TorusGeometry(data.bottomRadius,.018,8,64),metal,0,.05,0);base.rotation.x=Math.PI/2;
  if(beach){
    const shell=mesh(g,new THREE.CylinderGeometry(data.radius-.012,data.bottomRadius,data.height-.035,64,1,true),new THREE.MeshStandardMaterial({color:'#b38b58',roughness:.8,side:THREE.DoubleSide}),0,data.height/2,0);
    for(let j=1;j<22;j++){const y=j*data.height/22,r=data.bottomRadius+(data.radius-data.bottomRadius)*y/data.height;const t=mesh(g,new THREE.TorusGeometry(r,.011,5,64),mat(j%2?'#b38e60':'#c6a478'),0,y,0);t.rotation.x=Math.PI/2;}
    for(let i=0;i<52;i++){const a=i/52*Math.PI*2;lineBetween(g,new THREE.Vector3(Math.cos(a)*data.bottomRadius,.04,Math.sin(a)*data.bottomRadius),new THREE.Vector3(Math.cos(a)*data.radius,data.height-.015,Math.sin(a)*data.radius),.009,metal);}
    shell.castShadow=true;
  }else{
    const wall=mesh(g,new THREE.CylinderGeometry(data.radius,data.bottomRadius,data.height-.06,48,1,true),new THREE.MeshStandardMaterial({color:'#2d4135',transparent:true,opacity:.23,side:THREE.DoubleSide,depthWrite:false}),0,data.height/2,0);wall.castShadow=false;
    const points:THREE.Vector3[]=[];
    for(let i=0;i<40;i++){const start=i/40*Math.PI*2;for(const direction of[-1,1])for(let j=0;j<14;j++){const t=j/14,u=(j+1)/14;const a=start+t*.7*direction,b=start+u*.7*direction;const r=data.bottomRadius+(data.radius-data.bottomRadius)*t,s=data.bottomRadius+(data.radius-data.bottomRadius)*u;points.push(new THREE.Vector3(Math.cos(a)*r,.05+t*(data.height-.05),Math.sin(a)*r),new THREE.Vector3(Math.cos(b)*s,.05+u*(data.height-.05),Math.sin(b)*s));}}
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#9ba596',transparent:true,opacity:.68})));
  }
  const target=mesh(g,new THREE.RingGeometry(data.radius+.17,data.radius+.185,80),new THREE.MeshBasicMaterial({color:beach?'#e8d9a7':'#ccde92',transparent:true,opacity:.36,side:THREE.DoubleSide}),0,.012,0);target.rotation.x=-Math.PI/2;target.castShadow=false;
  return g;
}
export function officeScene(scene:THREE.Scene,bin:Basket):Room {
  scene.background=new THREE.Color('#c4cbbc');scene.fog=new THREE.Fog('#91a394',15,32);
  const root=new THREE.Group();scene.add(root);const obstacles:Obstacle[]=[];
  const carpet=mat('#c0d0aa');carpet.map=grain('#2f5845');const cream=mat('#d0d4c2');const wall=mat('#c2cabc');const green=mat('#426954');const dark=mat('#132d25');const chrome=mat('#94a097',.33,.72);
  box(root,16,.12,22,carpet,0,-.07,-1);
  box(root,16,4.3,.2,wall,0,2.15,-9);
  box(root,.2,4.3,22,wall,-8,2.15,-1);box(root,.2,4.3,22,wall,8,2.15,-1);
  box(root,16,1.15,.04,green,0,.575,-8.86);
  box(root,.04,1.15,22,green,-7.86,.575,-1);box(root,.04,1.15,22,green,7.86,.575,-1);
  box(root,16,.055,.07,chrome,0,1.17,-8.82);
  box(root,16,.12,22,cream,0,4.35,-1).castShadow=false;
  for(let x=-8;x<=8;x+=1.5)box(root,.018,.025,22,mat('#899989'),x,4.277,-1);
  for(let z=-10;z<10;z+=1.5)box(root,16,.025,.018,mat('#899989'),0,4.277,z);
  const lampMaterial=new THREE.MeshStandardMaterial({color:'#f1f5db',emissive:'#e7f3d3',emissiveIntensity:2.1});
  for(const x of[-5,0,5])for(const z of[-6,-1,4]){box(root,1.05,.035,2.6,mat('#526756'),x,4.23,z);const lamp=box(root,.94,.04,2.47,lampMaterial,x,4.205,z);lamp.castShadow=false;}
  scene.add(new THREE.HemisphereLight('#e6f1d5','#274934',2.0));
  const light=new THREE.DirectionalLight('#f5f5d9',2.6);light.position.set(-3,8,3);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-10;light.shadow.camera.right=10;light.shadow.camera.top=10;light.shadow.camera.bottom=-10;light.shadow.normalBias=.035;light.shadow.bias=-.0003;light.shadow.radius=3;scene.add(light);
  const fill=new THREE.PointLight('#cadfc3',38,17,2);fill.position.set(3,3.8,-5);scene.add(fill);
  // The long, windowless office and its symmetrical retro workstations.
  const monitor=(desk:THREE.Group,x:number,z:number)=>{
    box(desk,.64,.09,.45,green,x,.845,z,.025);box(desk,.13,.17,.16,chrome,x,.96,z);
    box(desk,.83,.6,.55,mat('#8aa69c'),x,1.27,z-.1,.045);
    box(desk,.76,.54,.025,mat('#a6b5a2'),x,1.27,z+.185,.015);
    box(desk,.62,.39,.025,dark,x,1.29,z+.205,.03);
    textPlane(desk,'04  12  06  19  07\n21  09  33  08  14\n09  27  11  05  22\n16  03  18  42  01',.565,.345,x,1.29,z+.22,'#9ddbbb','#082921',63);
    box(desk,.65,.045,.25,mat('#b9c3ac'),x,.82,z+.52,.015);
    for(let row=0;row<4;row++)for(let col=0;col<11;col++)box(desk,.038,.008,.034,mat('#879c87'),x-.26+col*.05,.849,z+.43+row*.047);
  };
  function desk(x:number,z:number,rotation=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;root.add(g);box(g,2.8,.085,1.25,cream,0,.77,0,.035);box(g,.55,.62,.95,green,1,.36,0,.018);for(const y of[.25,.45,.65]){box(g,.5,.012,.012,dark,1,y,.48);box(g,.18,.03,.018,chrome,1,y+.05,.491);}for(const a of[-1.23,1.23])for(const b of[-.48,.48])box(g,.045,.7,.045,chrome,a,.35,b);monitor(g,-.2,-.2);box(g,.48,.009,.33,mat('#e9e5cd'),-.94,.82,.26);textPlane(g,'MDR',.25,.1,1.02,.64,.49,'#d5ddc8','#426954',120);cylinder(g,.075,.063,.17,mat('#cdd4bc'),.67,.9,.26);cylinder(g,.058,.058,.006,dark,.67,.989,.26);
    obstacles.push({min:{x:x-1.4,y:.7,z:z-.63},max:{x:x+1.4,y:.82,z:z+.63}});
    const chair=new THREE.Group();chair.position.set(x,0,z+1.08);chair.rotation.y=rotation-.2;root.add(chair);box(chair,.66,.12,.61,dark,0,.49,0,.075);box(chair,.65,.57,.13,dark,0,.85,.27,.075);cylinder(chair,.05,.05,.4,chrome,0,.24,0);for(let i=0;i<5;i++){const a=i/5*Math.PI*2;lineBetween(chair,new THREE.Vector3(0,.12,0),new THREE.Vector3(Math.cos(a)*.37,.08,Math.sin(a)*.37),.025,chrome);const wheel=cylinder(chair,.055,.055,.045,dark,Math.cos(a)*.37,.065,Math.sin(a)*.37,10);wheel.rotation.z=Math.PI/2;}}
  desk(-3.5,-2.4);desk(3.75,-2.65);desk(-3.5,-6);desk(3.75,-6);
  // Teal dividers, quiet corridors, and the institutional wall signage.
  for(const x of[-3.5,3.75]){box(root,2.85,.52,.06,green,x,1.07,-3.04);box(root,2.85,.025,.08,chrome,x,1.34,-3.04);}
  box(root,2.6,3.2,.11,mat('#dbe0d1'),0,1.6,-8.82);box(root,1.43,2.65,.13,mat('#6b8471'),.05,1.325,-8.72);box(root,.02,2.65,.02,chrome,.05,1.325,-8.63);box(root,.5,.018,.025,chrome,.04,1.2,-8.6);
  textPlane(root,'LUMON',1.35,.38,.02,3.46,-8.69,'#315e4d','#c2cabc',133,'Georgia');textPlane(root,'MACRODATA REFINEMENT',1.6,.18,.02,2.93,-8.64,'#274c3b','#dbe0d1',60);
  const clock=cylinder(root,.28,.28,.055,mat('#284c3a'),5.77,2.9,-8.7);clock.rotation.x=Math.PI/2;const face=mesh(root,new THREE.CircleGeometry(.248,48),mat('#e1e2ca'),5.77,2.9,-8.665);box(root,.012,.15,.007,dark,5.77,2.965,-8.655);box(root,.16,.015,.008,dark,5.7,2.9,-8.651);face.castShadow=false;
  for(const x of[-6.6,6.7]){box(root,.85,1.45,.61,green,x,.725,-7.75);for(let i=0;i<4;i++){box(root,.78,.012,.013,dark,x,.22+i*.34,-7.433);box(root,.22,.035,.045,chrome,x,.37+i*.34,-7.41);}}
  // A sliver of the player's desk anchors the first-person perspective.
  box(root,2.7,.09,1.25,cream,-1.4,.73,6.08,.035);box(root,.55,.02,.38,mat('#d6d9c2'),-1.1,.79,5.7);
  const basket=makeBin(root,bin);return {root,bin:basket,obstacles};
}
export function disposeScene(scene:THREE.Scene) {const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)for(const material of Array.isArray(m.material)?m.material:[m.material]){materials.add(material);for(const v of Object.values(material))if(v instanceof THREE.Texture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());scene.clear();}

export function beachScene(scene:THREE.Scene,bin:Basket):Room {
  scene.background=new THREE.Color('#b6d9e3');scene.fog=new THREE.Fog('#c3dfe0',60,170);
  const root=new THREE.Group();scene.add(root);const obstacles:Obstacle[]=[];
  const stone=mat('#ded5bf',.62),plaster=mat('#e8dcc5'),oak=mat('#806349',.6),bronze=mat('#4f493d',.37,.65);
  stone.map=grain('#ded7c5','fabric');stone.map.repeat.set(10,10);
  const floor=box(root,16,.16,22,stone,0,-.10,-1);
  floor.receiveShadow=true;
  const seam=mat('#b8b09e');for(let x=-8;x<=8;x+=2)box(root,.012,.002,22,seam,x,-.012,-1);for(let z=-10;z<=10;z+=2)box(root,16,.002,.012,seam,0,-.011,z);
  box(root,.24,7.3,22,plaster,-8,3.65,-1);box(root,.24,7.3,22,plaster,8,3.65,-1);
  box(root,16,.15,22,plaster,0,7.3,-1);
  for(let x=-7.6;x<8;x+=1.9)box(root,.15,.25,22,oak,x,7.12,-1);
  // A full-height wall of glass frames the terrace, sand, sea, and distant horizon.
  box(root,16,.22,.24,bronze,0,6.8,-9.1);box(root,16,.11,.16,bronze,0,.055,-9.1);
  for(const x of[-8,-5.35,-2.67,0,2.67,5.35,8])box(root,.075,6.8,.12,bronze,x,3.4,-9.1);
  box(root,16,.055,.10,bronze,0,4.65,-9.1);
  const glass=new THREE.MeshPhysicalMaterial({color:'#d2edf0',metalness:0,roughness:.08,transparent:true,opacity:.075,side:THREE.DoubleSide,depthWrite:false});
  for(const x of[-6.67,-4.01,-1.33,1.33,4.01,6.67]){const pane=box(root,2.58,6.68,.012,glass,x,3.4,-9.12);pane.castShadow=false;}
  // Tall folded linen drapes make the scale of the architecture legible.
  const linen=mat('#ede6d3',1);for(const side of[-1,1])for(let i=0;i<9;i++){const curtain=box(root,.15,6.65,.21,linen,side*(7.25+i*.06),3.35,-8.84+Math.sin(i*1.8)*.10,.055);curtain.castShadow=true;}
  const skyGeometry=new THREE.SphereGeometry(140,32,16);
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#79b8d6')},bottom:{value:new THREE.Color('#f4e7ce')}},vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p; uniform vec3 top;uniform vec3 bottom;void main(){float h=clamp(normalize(p).y*2.8,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.7)),1.);}'});
  const sky=mesh(root,skyGeometry,skyMaterial,0,0,-15);sky.castShadow=sky.receiveShadow=false;
  const sun=mesh(root,new THREE.SphereGeometry(3.1,24,16),new THREE.MeshBasicMaterial({color:'#fff3c9'}),-45,25,-110);sun.castShadow=false;
  const deckmat=mat('#c3ad8d');deckmat.map=grain('#c3ad8d','wood');box(root,22,.14,6,deckmat,0,-.13,-12);
  for(let x=-11;x<11;x+=.32)box(root,.012,.005,6,mat('#9f8c71'),x,-.055,-12);
  box(root,110,.2,27,mat('#e9d4ad'),0,-.37,-28);
  const waterMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 p;uniform float time;void main(){float wave=sin(p.x*.8+p.y*.75+time*.6)*sin(p.y*2.3-time*.5);float fine=sin(p.y*8.+p.x*.28-time*1.4);float glint=pow(max(0.,wave*fine),10.);float depth=clamp((-p.y+30.)/110.,0.,1.);vec3 col=mix(vec3(.27,.72,.69),vec3(.15,.43,.54),depth);col+=vec3(.42,.42,.32)*glint;col+=.024*sin(p.y*1.3+time);gl_FragColor=vec4(col,1.);}`});
  const ocean=mesh(root,new THREE.PlaneGeometry(270,200,1,1),waterMaterial,0,-.40,-132);ocean.rotation.x=-Math.PI/2;ocean.castShadow=ocean.receiveShadow=false;
  const foam=new THREE.MeshBasicMaterial({color:'#fff7df',transparent:true,opacity:.53});
  const waves:THREE.Mesh[]=[];for(let j=0;j<6;j++){const wave=mesh(root,new THREE.PlaneGeometry(110,.12+j*.03),foam,0,-.39,-34-j*1.25);wave.rotation.x=-Math.PI/2;wave.castShadow=false;waves.push(wave);}
  scene.add(new THREE.HemisphereLight('#e5f2f8','#aa8e69',2.4));const sunlight=new THREE.DirectionalLight('#fff0c6',4.5);sunlight.position.set(-8,12,-13);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);Object.assign(sunlight.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:.5,far:50});sunlight.shadow.bias=-.00025;sunlight.shadow.normalBias=.025;sunlight.shadow.radius=3;scene.add(sunlight);
  const fill=new THREE.DirectionalLight('#f0e4d1',.65);fill.position.set(3,5,6);scene.add(fill);
  const fabric=mat('#e4dbc8',.96);fabric.map=grain('#e8e0d0','fabric');fabric.map.repeat.set(3,3);
  const cushion=mat('#f3ebdc',.98);cushion.map=fabric.map;const walnut=mat('#5a4030');
  function sofa(x:number,z:number,angle:number,ochre=false){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;root.add(g);const upholstery=ochre?mat('#b79c72',.9):fabric;const pillows=ochre?mat('#c5ad87',.98):cushion;
    box(g,3.35,.36,1.1,upholstery,0,.34,0,.16);box(g,3.28,.63,.34,upholstery,0,.81,-.48,.15);
    for(let i=0;i<3;i++){const sx=(i-1)*1.02;box(g,.99,.21,.88,pillows,sx,.6,.03,.10);const back=box(g,.99,.49,.23,pillows,sx,.91,-.30,.105);back.rotation.x=-.10;}
    for(const a of[-1,1]){box(g,.33,.51,1.27,upholstery,a*1.64,.60,0,.15);for(const b of[-.4,.4])cylinder(g,.042,.035,.2,walnut,a*1.4,.12,b);}
    const throwPillow=box(g,.52,.52,.20,mat(ochre?'#e8deca':'#b3a184'),-1.08,.93,-.06,.095);throwPillow.rotation.z=.18;throwPillow.rotation.x=-.1;const pillow2=box(g,.45,.45,.22,mat('#eee8d9'),1.08,.90,-.06,.09);pillow2.rotation.z=-.18;
    const dimensions=angle===0?{w:3.7,d:1.3}:{w:1.3,d:3.7};obstacles.push({min:{x:x-dimensions.w/2,y:.16,z:z-dimensions.d/2},max:{x:x+dimensions.w/2,y:1.12,z:z+dimensions.d/2}});
  }
  // Two sculptural sofas face a low stone table, leaving the tossing lane clear.
  sofa(-4.15,-4.2,0);sofa(4.5,-2.9,-Math.PI/2,true);
  const rug=mat('#c8bda5');rug.map=grain('#d5c8ae','fabric');const rugmesh=box(root,4.6,.018,4.7,rug,-4,.016,-2.6,.12);rugmesh.receiveShadow=true;
  const coffee=new THREE.Group();coffee.position.set(-3.8,0,-1.9);root.add(coffee);const marble=mat('#d5cbb8',.35);cylinder(coffee,.76,.79,.13,marble,0,.45,0,64);cylinder(coffee,.37,.44,.36,marble,0,.21,0,48);cylinder(coffee,.49,.50,.10,walnut,1,.35,-.5,48);cylinder(coffee,.15,.22,.30,walnut,1,.16,-.5);
  obstacles.push({min:{x:-4.6,y:.04,z:-2.7},max:{x:-3,y:.53,z:-1.1}});
  box(coffee,.42,.06,.30,mat('#a5865f'),-.16,.55,.05,.01);box(coffee,.36,.035,.27,mat('#f0e4c7'),-.12,.596,.03,.005);
  cylinder(coffee,.09,.10,.19,mat('#6e7867'),.35,.62,-.12);cylinder(coffee,.072,.07,.015,mat('#393d30'),.35,.72,-.12);
  const sideTable=new THREE.Group();sideTable.position.set(-6.65,0,-4.0);root.add(sideTable);cylinder(sideTable,.44,.44,.06,oak,0,.69,0);cylinder(sideTable,.19,.28,.66,oak,0,.34,0);cylinder(sideTable,.12,.15,.3,mat('#dbceb5'),0,.87,0);
  function plant(x:number,z:number,size=1){const plant=new THREE.Group();plant.position.set(x,0,z);plant.scale.setScalar(size);root.add(plant);cylinder(plant,.31,.24,.61,mat('#c9b99b'),0,.31,0,48);cylinder(plant,.28,.28,.015,mat('#4a4231'),0,.62,0);const trunk=mat('#7e7352');cylinder(plant,.032,.07,2.0,trunk,0,1.55,0,10);const leaf=mat('#537450',.86);leaf.side=THREE.DoubleSide;
    for(let i=0;i<12;i++){const a=i*2.4;const y=1.2+i*.12;const out=.55+(i%3)*.10;lineBetween(plant,new THREE.Vector3(0,y,0),new THREE.Vector3(Math.sin(a)*out,y+.28,Math.cos(a)*out),.012,trunk);const l=mesh(plant,new THREE.SphereGeometry(1,12,8),leaf,Math.sin(a)*out,y+.3,Math.cos(a)*out);l.scale.set(.22,.39,.045);l.rotation.set(.4,a,.4*Math.sin(a));}
  }
  plant(6.75,-7.5,1.2);plant(-6.85,-7.8,.95);
  // A restrained gallery wall, sculptural pendants, and a terrace chaise.
  const artwork=new THREE.Group();artwork.position.set(-7.85,3,-3.1);artwork.rotation.y=Math.PI/2;root.add(artwork);box(artwork,2.3,2.8,.06,oak);box(artwork,2.15,2.65,.07,mat('#e3d9c6'),0,0,.045);const artshape=mesh(artwork,new THREE.CircleGeometry(.7,64),mat('#9a7757'),.23,.24,.09);artshape.scale.y=1.2;const shape2=mesh(artwork,new THREE.CircleGeometry(.5,64),mat('#3d5143'),-.39,-.57,.1);shape2.scale.y=.65;
  for(let i=0;i<3;i++){const x=-4.1+i*.6,y=4.1+i*.37,z=-2.8-i*.42;cylinder(root,.009,.009,7.1-y,bronze,x,(7.1+y)/2,z,8);const pendant=mesh(root,new THREE.SphereGeometry(.44,24,16,0,Math.PI*2,0,Math.PI/2),mat('#a8906c'),x,y,z);pendant.scale.y=.68;const glow=mesh(root,new THREE.CircleGeometry(.37,40),new THREE.MeshBasicMaterial({color:'#fff0c3'}),x,y-.012,z);glow.rotation.x=-Math.PI/2;glow.castShadow=false;}
  for(const x of[-5.5,5.5]){const chaise=new THREE.Group();chaise.position.set(x,0,-11.7);chaise.rotation.y=x<0?.15:-.15;root.add(chaise);box(chaise,.83,.10,2.1,oak,0,.3,0,.025);box(chaise,.78,.12,1.9,cushion,0,.41,.03,.05);const back=box(chaise,.78,.1,.65,cushion,0,.61,-.72,.04);back.rotation.x=-.5;for(const a of[-.3,.3])for(const b of[-.75,.75])box(chaise,.05,.3,.05,oak,a,.15,b);}
  const basket=makeBin(root,bin,true);
  return {root,bin:basket,obstacles,animate:(time:number)=>{waterMaterial.uniforms.time.value=time;for(let i=0;i<waves.length;i++)waves[i].position.z=-34-i*1.25+Math.sin(time*.35+i)*.6;}};
}
