// 1d,3d,1w,2w,1m,2m,3m,6m,1y,indef
export const DURATIONS = [1,3,7,14,30,60,90,180,365,-1];
export const SANCTION_INFO = [
    {name:"Chat Ban",value:null,g:1,dur:[1,4,9,9]},
    {name:"Expression Ban",value:null,g:1,dur:[1,4,9,9]},
    {name:"Name Reset",value:null,g:1,dur:null},
    {name:"Room Create Ban",value:null,g:2,dur:[null,2,9,9]},
    {name:"Multiplayer Ban",value:null,g:3,dur:[null,null,9,9]},
    {name:"Deletion Review",value:null,g:3,dur:null},
    {name:"Blacklist",value:null,g:4,dur:[null,null,null,9]},
    {name:"Suspend",value:"Priv Group",g:4,dur:[null,null,null,9],pr:[(1<<29)|(1<<31)]},
    {name:"Simul Room Limit",value:"Max Simul Rooms",g:0,dur:[null,null,null,null,9]},
    {name:"Board Size Limit",value:"Max Board Size",g:0,dur:[null,null,null,null,9]},
    {name:"UGC Watch",value:null,g:1,p:[64|128],dur:[6,7,8,9]},
    {name:"UGC Ban",value:null,g:2,p:[64|128,1],dur:[null,5,7,9]}
];
