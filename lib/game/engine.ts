import * as THREE from 'three';
import { registerGameTools } from './webmcp';
import { advance, trajectory, launch, STEP, OFFICE_BIN, BEACH_BIN, ORIGIN, type BallState, type Basket } from './physics';
import { officeScene, beachScene, makePaper, disposeScene, type Room } from './scene';
export type GameSnapshot = { level: number; score: number; shots: number; baskets: number; streak: number; power: number; angle: number; ready: boolean; result: string; phase: 'playing' | 'level-complete' | 'complete'; distance: number };
type LiveBall = { mesh: THREE.Mesh; body: BallState; resultAt: number | null };
export class TrashketballEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(57,1,.05,180);
  private room!: Room;
  private basket: Basket = OFFICE_BIN;
  private held!: THREE.Mesh;
  private dots: THREE.Mesh[] = [];
  private marker!: THREE.Mesh;
  private ball: LiveBall | null = null;
  private papers: THREE.Mesh[] = [];
  private raf = 0;
  private lastTime = 0;
  private accumulator = 0;
  private time = 0;
  private paused = false;
  private muted = true;
  private audio: AudioContext | null = null;
  private yaw = .03;
  private pointerDown = false;
  private resizeObserver: ResizeObserver;
  private cleanups: (()=>void)[] = [];
  private feedbackUntil = 0;
  private celebration = 0;
  private pendingShot: {resolve:(state:GameSnapshot)=>void;reject:(error:Error)=>void}|null=null;
  private endless = false;
  private state: GameSnapshot = { level:1,score:0,shots:0,baskets:0,streak:0,power:69,angle:42,ready:true,result:'',phase:'playing',distance:7.4 };
  constructor(private host:HTMLDivElement,private onChange:(s:GameSnapshot)=>void) {
    this.renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.host.appendChild(this.renderer.domElement);
    this.camera.position.set(0,1.95,6.5);this.camera.lookAt(0,1.0,-2.3);
    this.buildRoom();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
    const listen=(target:EventTarget,name:string,fn:EventListener,opts?:AddEventListenerOptions)=>{target.addEventListener(name,fn,opts);this.cleanups.push(()=>target.removeEventListener(name,fn,opts));};
    listen(host,'pointermove',((event:PointerEvent)=>{if(event.pointerType==='touch'&&!this.pointerDown)return;this.aimPointer(event);}) as EventListener);
    listen(host,'pointerdown',((event:PointerEvent)=>{if(event.button!==0||this.paused)return;this.pointerDown=true;host.focus({preventScroll:true});host.setPointerCapture(event.pointerId);if(event.pointerType==='touch')this.aimPointer(event);}) as EventListener);
    listen(host,'pointerup',((event:PointerEvent)=>{if(!this.pointerDown)return;this.pointerDown=false;if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);this.shoot();}) as EventListener);
    listen(host,'pointercancel',(()=>{this.pointerDown=false;}) as EventListener);
    listen(host,'wheel',((event:WheelEvent)=>{event.preventDefault();this.setPower(this.state.power-Math.sign(event.deltaY)*2);}) as EventListener,{passive:false});
    listen(window,'keydown',((event:KeyboardEvent)=>{
      if((event.target as HTMLElement).closest('button,a,input,[role="slider"],[role="dialog"]'))return;
      const k=event.key;
      if([' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_'].includes(k))event.preventDefault();
      if(this.paused||this.state.phase!=='playing')return;
      if(k===' '&&!event.repeat)this.shoot();
      else if(k==='ArrowLeft')this.setAim(this.yaw-.008,this.state.angle);
      else if(k==='ArrowRight')this.setAim(this.yaw+.008,this.state.angle);
      else if(k==='ArrowUp')this.setAim(this.yaw,this.state.angle+.5);
      else if(k==='ArrowDown')this.setAim(this.yaw,this.state.angle-.5);
      else if(k==='+'||k==='=')this.setPower(this.state.power+1);
      else if(k==='-'||k==='_')this.setPower(this.state.power-1);
    }) as EventListener);
    listen(document,'visibilitychange',(()=>{this.lastTime=0;this.accumulator=0;}) as EventListener);
    listen(this.renderer.domElement,'webglcontextlost',((e:Event)=>{e.preventDefault();this.paused=true;this.state.result='Graphics paused. Refresh to resume.';this.emit();}) as EventListener);
    this.cleanups.push(registerGameTools(this));
    this.emit();this.raf=requestAnimationFrame(this.frame);
  }
  private emit(){this.onChange({...this.state});}
  private buildRoom(){
    this.ball=null;this.papers=[];this.dots=[];disposeScene(this.scene);
    this.basket=this.state.level===1?OFFICE_BIN:BEACH_BIN;
    this.room=this.state.level===1?officeScene(this.scene,this.basket):beachScene(this.scene,this.basket);
    this.held=makePaper();this.held.position.set(ORIGIN.x,ORIGIN.y,ORIGIN.z);this.held.scale.setScalar(1.22);this.scene.add(this.held);
    const dotGeo=new THREE.SphereGeometry(.021,8,6);const dotMat=new THREE.MeshBasicMaterial({color:'#e3edc3',transparent:true,opacity:.83,depthTest:true});
    for(let i=0;i<100;i++){const dot=new THREE.Mesh(dotGeo,dotMat);this.scene.add(dot);this.dots.push(dot);}
    this.marker=new THREE.Mesh(new THREE.RingGeometry(.10,.123,40),new THREE.MeshBasicMaterial({color:'#ddebaf',transparent:true,opacity:.7,side:THREE.DoubleSide}));this.marker.rotation.x=-Math.PI/2;this.scene.add(this.marker);
    this.state.distance=Math.hypot(this.basket.x-ORIGIN.x,this.basket.z-ORIGIN.z);this.updateTrajectory();
  }
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.fov=w/h<.85?68:57;this.camera.updateProjectionMatrix();}
  private aimPointer(event:PointerEvent){
    if(this.paused||!this.state.ready||this.state.phase!=='playing')return;
    const bounds=this.host.getBoundingClientRect();const x=(event.clientX-bounds.left)/bounds.width,y=(event.clientY-bounds.top)/bounds.height;
    this.setAim((x-.5)*.9,42+(.5-y)*30);
  }
  setAim(yaw:number,elevation:number){if(this.paused||!this.state.ready)return;this.yaw=Math.max(-.62,Math.min(.62,yaw));this.state.angle=Math.max(28,Math.min(68,elevation));this.updateTrajectory();this.emit();}
  setPower(power:number){if(!Number.isFinite(power)||this.paused||!this.state.ready)return;this.state.power=Math.max(20,Math.min(100,power));this.updateTrajectory();this.emit();}
  private updateTrajectory(){
    if(!this.held)return;const prediction=trajectory(this.state.power,this.yaw,this.state.angle,this.basket,this.room.obstacles);
    for(let i=0;i<this.dots.length;i++){const p=prediction.points[i];this.dots[i].visible=!!p&&this.state.ready&&this.state.phase==='playing';if(p){this.dots[i].position.set(p.x,p.y,p.z);this.dots[i].scale.setScalar(.8+i*.009);}}
    (this.dots[0].material as THREE.MeshBasicMaterial).opacity=.83;
    (this.dots[0].material as THREE.MeshBasicMaterial).color.set(prediction.makes?'#e8f0a9':'#e8eddf');
    const end=prediction.points.at(-1);if(end)this.marker.position.set(end.x,prediction.makes?this.basket.height+.01:.018,end.z);
    this.marker.visible=this.state.ready&&this.state.phase==='playing';
  }
  shoot(){
    if(!this.state.ready||this.paused||this.state.phase!=='playing')return false;
    this.state.ready=false;this.state.shots++;this.state.result='';this.held.visible=false;
    const paper=makePaper();paper.position.copy(this.held.position);paper.rotation.set(.4,.8,.2);this.scene.add(paper);
    this.ball={mesh:paper,body:launch(this.state.power,this.yaw,this.state.angle),resultAt:null};this.accumulator=0;
    (this.dots[0].material as THREE.MeshBasicMaterial).opacity=.22;this.marker.visible=false;this.tone('throw');this.emit();return true;
  }
  canShoot(){return this.state.ready&&!this.paused&&this.state.phase==='playing';}
  shootAndWait():Promise<GameSnapshot>{
    if(!this.canShoot())return Promise.reject(new Error('A shot is not available right now.'));
    return new Promise((resolve,reject)=>{this.pendingShot={resolve,reject};this.shoot();});
  }
  private finishShot(){
    if(!this.ball)return;
    if(!this.ball.body.scored){this.state.streak=0;this.state.result=this.ball.body.bounces?'A little off. Try again.':'Next one’s yours.';this.feedbackUntil=this.time+1.5;}
    this.papers.push(this.ball.mesh);if(this.papers.length>16){const old=this.papers.shift()!;this.scene.remove(old);old.geometry.dispose();(old.material as THREE.Material).dispose();}
    this.ball=null;this.state.ready=true;this.held.visible=true;
    if(this.state.level===1&&this.state.score>=100){this.state.phase='level-complete';this.state.ready=false;this.held.visible=false;}
    else if(this.state.level===2&&this.state.score>=200&&!this.endless){this.state.phase='complete';this.state.ready=false;this.held.visible=false;}
    this.updateTrajectory();this.emit();
    this.pendingShot?.resolve({...this.state});this.pendingShot=null;
  }
  private frame=(now:number)=>{
    this.raf=requestAnimationFrame(this.frame);
    if(document.hidden){this.lastTime=0;return;}
    const dt=this.lastTime?Math.min((now-this.lastTime)/1000,.06):0;this.lastTime=now;
    if(!this.paused){
      this.time+=dt;this.room.animate?.(this.time);
      if(this.state.ready){this.held.rotation.y=this.time*.22;this.held.rotation.z=Math.sin(this.time*.7)*.08;this.held.position.y=ORIGIN.y+Math.sin(this.time*1.5)*.012;}
      if(this.ball){
        this.accumulator+=dt;let count=0;
        while(this.accumulator>=STEP&&this.ball&&count++<20){const event=advance(this.ball.body,this.basket,this.room.obstacles);this.accumulator-=STEP;
          if(event==='score'){this.state.score+=10;this.state.baskets++;this.state.streak++;this.state.result=this.state.streak>=3?'On a roll. +10':'Beautiful work. +10';this.feedbackUntil=this.time+2;this.celebration=1;this.ball.resultAt=this.ball.body.age;this.tone('score');this.emit();}
          else if(event==='rim')this.tone('rim');else if(event==='floor'&&this.ball.body.bounces<3)this.tone('floor');
        }
        if(this.ball){const b=this.ball; b.mesh.position.set(b.body.position.x,b.body.position.y,b.body.position.z);if(!b.body.settled){b.mesh.rotation.x+=dt*4;b.mesh.rotation.z+=dt*2;}
          if(b.body.settled||b.body.age>4.5||(b.resultAt!==null&&b.body.age-b.resultAt>.9))this.finishShot();}
      }
      if(this.celebration>0){this.celebration=Math.max(0,this.celebration-dt*1.8);this.room.bin.scale.set(1+Math.sin(this.celebration*Math.PI*3)*.025,1,1+Math.sin(this.celebration*Math.PI*3)*.025);}
      if(this.state.result&&this.time>this.feedbackUntil&&this.state.phase==='playing'){this.state.result='';this.emit();}
    }
    this.renderer.render(this.scene,this.camera);
  };
  setPaused(paused:boolean){this.paused=paused;this.accumulator=0;this.lastTime=0;}
  setMuted(muted:boolean){this.muted=muted;if(!muted){this.audio??=new AudioContext();void this.audio.resume();this.tone('rim');}}
  private tone(kind:'throw'|'score'|'rim'|'floor'){
    if(this.muted)return;
    try{this.audio??=new AudioContext();const ctx=this.audio;if(ctx.state==='suspended')void ctx.resume();const t=ctx.currentTime;const frequencies=kind==='score'?[523,659,784]:[kind==='rim'?390:kind==='throw'?180:100];
      frequencies.forEach((freq,i)=>{const o=ctx.createOscillator(),gain=ctx.createGain();o.type=kind==='score'?'sine':'triangle';o.frequency.setValueAtTime(freq,t+i*.095);if(kind==='throw')o.frequency.exponentialRampToValueAtTime(55,t+.13);gain.gain.setValueAtTime(0,t+i*.095);gain.gain.linearRampToValueAtTime(kind==='score'?.055:.025,t+i*.095+.01);gain.gain.exponentialRampToValueAtTime(.001,t+i*.095+.2);o.connect(gain);gain.connect(ctx.destination);o.start(t+i*.095);o.stop(t+i*.095+.23);});}catch{/* Sound is optional; gameplay does not depend on audio support. */}
  }
  nextLevel(){if(this.state.phase!=='level-complete')return;this.state.level=2;this.state.phase='playing';this.state.ready=true;this.state.result='Welcome to your out-of-office era.';this.feedbackUntil=this.time+3;this.state.power=79;this.state.angle=42;this.yaw=-.02;this.buildRoom();this.emit();}
  keepPlaying(){if(this.state.phase!=='complete')return;this.endless=true;this.state.phase='playing';this.state.ready=true;this.state.result='';this.held.visible=true;this.updateTrajectory();this.emit();}
  reset(){this.pendingShot?.reject(new Error('The game was restarted.'));this.pendingShot=null;this.endless=false;this.state={level:1,score:0,shots:0,baskets:0,streak:0,power:69,angle:42,ready:true,result:'',phase:'playing',distance:7.4};this.yaw=.03;this.accumulator=0;this.buildRoom();this.emit();}
  getState(){return {...this.state,yaw:this.yaw,bin:{...this.basket}};}
  dispose(){this.pendingShot?.reject(new Error('The game was closed.'));this.pendingShot=null;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();this.cleanups.forEach(fn=>fn());disposeScene(this.scene);this.renderer.dispose();this.renderer.domElement.remove();void this.audio?.close();}
}
