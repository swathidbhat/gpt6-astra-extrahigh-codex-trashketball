import type { TrashketballEngine } from './engine';
type Tool = { name:string; description:string; inputSchema:object; annotations:{readOnlyHint:boolean}; execute:(input:unknown)=>unknown };
type ModelContext = {registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>};
export function registerGameTools(engine:TrashketballEngine) {
  const context=(document as Document & {modelContext?:ModelContext}).modelContext;
  if(!context?.registerTool)return ()=>{};
  const lifecycle=new AbortController();
  const register=(tool:Tool)=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Browsers without the proposal still support the full game. */}};
  register({name:'get_trashketball_state',description:'Read the current level, score, bin position, throw settings, and whether another shot is ready.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>engine.getState()});
  register({name:'configure_paper_throw',description:'Set aim and power and update the visible trajectory without throwing. Yaw is radians from straight ahead, elevation is degrees, power is a percentage.',inputSchema:{type:'object',properties:{power:{type:'number',minimum:20,maximum:100},yaw:{type:'number',minimum:-.62,maximum:.62},elevation:{type:'number',minimum:28,maximum:68}},required:['power','yaw','elevation'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input)=>{
    const v=input as {power:number;yaw:number;elevation:number};
    if(!v||!Number.isFinite(v.power)||v.power<20||v.power>100||!Number.isFinite(v.yaw)||Math.abs(v.yaw)>.62||!Number.isFinite(v.elevation)||v.elevation<28||v.elevation>68)throw new Error('Provide valid power (20–100), yaw (−0.62–0.62), and elevation (28–68).');
    if(!engine.canShoot())throw new Error('Close help and wait until the current throw is complete.');
    engine.setPower(v.power);engine.setAim(v.yaw,v.elevation);return engine.getState();
  }});
  register({name:'throw_paper',description:'Throw the paper ball using the current visible aim and power. Resolves after the shot lands and returns its resulting score.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>engine.shootAndWait()});
  return ()=>lifecycle.abort();
}
