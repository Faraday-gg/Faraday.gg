// Coordenadas de la vía en unidades del lienzo del avatar, con y hacia abajo.
(()=>{
  const ROUTES={directa:'Directa',travesia:'Travesía'};
  const SUMMIT=7000,MOUNTAIN_HEIGHT=4.2,WALL_TURN=2.74;
  const elevation=meters=>-meters/SUMMIT*MOUNTAIN_HEIGHT;
  const mix=(a,b,t)=>a+(b-a)*t;
  const blend=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
  const smooth=t=>t*t*(3-2*t);
  const clamp=t=>Math.max(0,Math.min(1,t));
  const above=(a,b,t,height)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)-Math.sin(t*Math.PI)*height];
  const place=(p,x,y)=>[p[0]+x,p[1]+y];
  const about=(p,origin)=>[p[0]-origin[0],p[1]-origin[1]];
  const atRest=center=>({
    hands:[place(center,.36,.735),place(center,.64,.735)],
    feet:[place(center,.45,.94),place(center,.55,.94)]
  });

  function plan(points,route='directa',drift=0){
    const count=points>=100?6:points>=85?5:points>=60?4:points>=30?3:2;
    const traversing=route==='travesia';
    const start=[0,0],finish=[drift,elevation(points*10)];
    const rest=atRest(start),landing=atRest(finish);
    const startHands=[[.31,.558],[.69,.62]];
    const startFeet=[[.41,.872],rest.feet[1]];
    const steps=[];
    let from=start,hands=startHands,feet=startFeet;
    for(let i=0;i<count;i++){
      const side=i%2,foot=1-side;
      const fraction=(i+1)/count,wave=Math.sin(fraction*Math.PI);
      const next=i+1===count?finish:[drift*fraction+wave*(traversing?.105:0),finish[1]*fraction];
      const nextHands=hands.slice(),nextFeet=feet.slice();
      nextHands[side]=place(next,side?.69:.31,.57);
      nextFeet[foot]=place(next,foot?.57:.43,.86);
      steps.push({from,next,hands,feet,nextHands,nextFeet,side,foot});
      from=next;hands=nextHands;feet=nextFeet;
    }
    const [prep,beat,arrive]=[[245,455,390],[220,310,365],[190,240,330],[170,195,305],[145,165,280]][count-2];
    const ascent=beat*count,duration=prep+ascent+arrive;
    const ready={hands:startHands,feet:startFeet,turn:WALL_TURN,lean:-.24,crouch:.32,mix:1};
    const holds=[
      ...startHands.map(point=>({point,kind:'hand'})),
      {point:startFeet[0],kind:'foot'},
      ...steps.flatMap(step=>[{point:step.nextHands[step.side],kind:'hand'},{point:step.nextFeet[step.foot],kind:'foot'}])
    ];

    function sample(ms){
      const time=Math.max(0,Math.min(duration,ms));
      let center=start,grips=startHands,shoes=startFeet,active=null,lean=0,poseMix=1,cue='start',crouch=0,contact=0,transfer=0;
      if(time<prep){
        const brace=1-smooth(time/prep);
        lean=ready.lean*brace;
        crouch=ready.crouch*brace;
        active=steps[0].nextHands[0];
      }else if(time<prep+ascent){
        const stepNumber=Math.floor((time-prep)/beat);
        const step=steps[stepNumber],t=(time-prep-beat*stepNumber)/beat;
        const reach=smooth(clamp(t/.30));
        const stepUp=smooth(clamp((t-.30)/.29));
        const push=smooth(clamp((t-.58)/.42));
        grips=step.hands.slice();shoes=step.feet.slice();
        grips[step.side]=above(step.hands[step.side],step.nextHands[step.side],reach,.035);
        shoes[step.foot]=above(step.feet[step.foot],step.nextFeet[step.foot],stepUp,.03);
        center=blend(step.from,step.next,push);
        lean=Math.sin(t*Math.PI)*(step.side?1:-1)*.52;
        crouch=Math.sin(t*Math.PI)*.45;
        active=step.nextHands[step.side];
        transfer=stepNumber+1;
        cue=t<.3?'reach':'grip-'+stepNumber;
        if(t>=.30)contact=1-clamp((t-.30)/.35);
      }else{
        const t=clamp((time-prep-ascent)/arrive);
        center=[finish[0],finish[1]-Math.min(.032,-finish[1]*.24)*Math.sin(Math.PI*t)];
        shoes=feet.map((p,i)=>above(p,landing.feet[i],smooth(clamp((t-i*.18)/.55)),.025));
        grips=hands.map((p,i)=>blend(p,landing.hands[i],smooth(clamp((t-.42)/.58))));
        lean=.48*Math.sin(Math.PI*t);
        poseMix=1-smooth(clamp((t-.75)/.25));
        cue=t<.73?'ledge':'land';
      }
      return {center,active,cue,contact,transfer,travel:smooth(clamp((time-prep)/ascent)),pose:{
        hands:grips.map(p=>about(p,center)),feet:shoes.map(p=>about(p,center)),turn:WALL_TURN,lean,crouch,mix:poseMix
      }};
    }
    return {holds,steps,duration,beat,ready,start,finish,sample};
  }
  window.AscensionRoute={plan,elevation,maxHeight:SUMMIT,routes:ROUTES};
})();
