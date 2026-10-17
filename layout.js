// Preserve explicit panel choices except when entering a smaller layout.
export function panelPolicy(width,previousWidth,state){
 let {leftCollapsed,rightCollapsed}=state;
 if(width<620&&(previousWidth===null||previousWidth>=620)){leftCollapsed=true;rightCollapsed=true;}
 else if(width<900&&(previousWidth===null||previousWidth>=900)){leftCollapsed=true;}
 return{leftCollapsed,rightCollapsed};
}
