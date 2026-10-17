// Radians and seconds throughout. Exact exponential integration makes inertia
// independent of display refresh rate; pointer samples use milliseconds.
export const AMBIENT_SPEED = 2 * Math.PI / 150;
const LIMIT = 1.2, DAMPING = 2.2, SENSITIVITY_X = .006, SENSITIVITY_Y = .005;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export class Rotation {
  constructor({paused=false, reducedMotion=false}={}) {
    this.paused = paused || reducedMotion;
    this.yaw=0; this.pitch=-.06; this.direction=1;
    this.velocity=this.paused?0:AMBIENT_SPEED; this.pitchVelocity=0;
    this.dragging=false; this.samples=[];
  }
  begin(x,y,t) {
    this.dragging=true; this.velocity=0; this.pitchVelocity=0;
    this.samples=[{x,y,t}];
  }
  move(x,y,t) {
    if(!this.dragging)return;
    const last=this.samples.at(-1), dx=x-last.x, dy=y-last.y;
    this.yaw+=dx*SENSITIVITY_X;
    this.pitch=clamp(this.pitch+dy*SENSITIVITY_Y,-1.15,1.15);
    if(Math.abs(dx)>.1)this.direction=Math.sign(dx);
    this.samples.push({x,y,t});
    while(this.samples.length>2 && t-this.samples[0].t>90)this.samples.shift();
  }
  end(t) {
    if(!this.dragging)return;
    this.dragging=false;
    const first=this.samples[0], last=this.samples.at(-1);
    const elapsed=(last.t-first.t)/1000;
    if(t-last.t<90 && elapsed>.001) {
      this.velocity=clamp((last.x-first.x)*SENSITIVITY_X/elapsed,-LIMIT,LIMIT);
      this.pitchVelocity=clamp((last.y-first.y)*SENSITIVITY_Y/elapsed,-LIMIT,LIMIT);
    } else {this.velocity=0;this.pitchVelocity=0;}
    this.samples=[];
  }
  cancel() {this.dragging=false;this.velocity=0;this.pitchVelocity=0;this.samples=[];}
  step(dt) {
    if(this.dragging||!Number.isFinite(dt)||dt<=0)return;
    const target=this.paused?0:this.direction*AMBIENT_SPEED;
    const decay=Math.exp(-DAMPING*dt), integral=(1-decay)/DAMPING;
    this.yaw+=target*dt+(this.velocity-target)*integral;
    this.pitch=clamp(this.pitch+this.pitchVelocity*integral,-1.15,1.15);
    this.velocity=target+(this.velocity-target)*decay;
    this.pitchVelocity*=decay;
    if(Math.abs(this.pitch)>=1.15)this.pitchVelocity=0;
    if(this.paused&&Math.abs(this.velocity)<1e-5)this.velocity=0;
    if(Math.abs(this.pitchVelocity)<1e-5)this.pitchVelocity=0;
  }
}
