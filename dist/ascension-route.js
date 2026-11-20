// Coordenadas de la vía en unidades del lienzo del avatar, con y hacia abajo.
(()=>{
  const ROUTES={directa:'Directa',travesia:'Travesía'};
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

  function plan(points,route='directa'){
    const count=points>=100?6:points>=85?5:points>=60?4:points>=30?3:2;
    const traversing=route==='travesia';
    const rise=.067,start=[0,0],finish=[0,-count*rise];
    const rest=atRest(start),landing=atRest(finish);
    const startHands=[[.305,.60],[.70,.60]];
    const startFeet=[[.432,.887],rest.feet[1]];
    const steps=[];
    let from=start,hands=startHands,feet=startFeet;
    for(let i=0;i<count;i++){
      const side=i%2,foot=1-side;
      const wave=Math.sin((i+1)/count*Math.PI);
      const next=[wave*(traversing?.065:0),-rise*(i+1)];
      const nextHands=hands.slice(),nextFeet=feet.slice();
      nextHands[side]=place(next,side?.70:.305,.60);
      nextFeet[foot]=place(next,foot?.57:.43,.86);
      steps.push({from,next,hands,feet,nextHands,nextFeet,side,foot});
      from=next;hands=nextHands;feet=nextFeet;
    }
    const prep=290,beat=345,arrive=560,duration=prep+beat*count+arrive;
    const holds=[
      ...startHands.map(point=>({point,kind:'hand'})),
      {point:startFeet[0],kind:'foot'},
      ...steps.flatMap(step=>[{point:step.nextHands[step.side],kind:'hand'},{point:step.nextFeet[step.foot],kind:'foot'}])
    ];

    function sample(ms){
      const time=Math.max(0,Math.min(duration,ms));
      let center=start,grips=startHands,shoes=rest.feet,active=null,lean=0,turn=.48,cue='start',follow=.87,oldLedge=1,crouch=0,contact=0,transfer=0;
      if(time<prep){
        const u=smooth(time/prep);
        grips=rest.hands.map((p,i)=>above(p,startHands[i],u,.012));
        shoes=[above(rest.feet[0],startFeet[0],smooth(clamp((time/prep-.44)/.56)),.014),rest.feet[1]];
        active=startHands[0];
        turn=mix(.2,.48,u);
      }else if(time<prep+beat*count){
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
        const t=clamp((time-prep-beat*count)/arrive);
        center=[finish[0],finish[1]-.032*Math.sin(Math.PI*t)];
        shoes=feet.map((p,i)=>above(p,landing.feet[i],smooth(clamp((t-i*.18)/.55)),.025));
        grips=hands.map((p,i)=>blend(p,landing.hands[i],smooth(clamp((t-.42)/.58))));
        lean=.48*Math.sin(Math.PI*t);
        turn=mix(.48,.2,smooth(clamp((t-.52)/.48)));
        cue=t<.73?'ledge':'land';
        follow=mix(.87,1,smooth(t));
        oldLedge=1-smooth(clamp((t-.35)/.65));
      }
      return {center,active,cue,follow,oldLedge,contact,transfer,pose:{
        hands:grips.map(p=>about(p,center)),feet:shoes.map(p=>about(p,center)),turn,lean,crouch,mix:time<prep?smooth(time/prep):1
      }};
    }
    return {holds,steps,duration,start,finish,sample};
  }
  window.AscensionRoute={plan,routes:ROUTES};
})();
