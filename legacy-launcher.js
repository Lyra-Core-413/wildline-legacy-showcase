export const VOICE_INSTRUCTION='Select Voice in ChatGPT to begin talking.';
export function launchChatGPT(open){
 // No node titles, source text, conversation ID or authorization are transmitted.
 const popup=open('https://chatgpt.com/','_blank','popup,width=480,height=720,noopener,noreferrer');
 return {opened:Boolean(popup),instruction:VOICE_INSTRUCTION};
}
