import type {SVGProps} from "react";

export type IconName="crane"|"grid"|"wrench"|"calendar"|"clock"|"chart"|"user"|"shield"|"search"|"arrow"|"check"|"layers";
const paths:Record<IconName,React.ReactNode>={
 crane:<><path d="M4 21h6M7 21V3l13 4H7M7 11h13V7M17 11v5M15 16h4l-2 3zM3 11h4"/></>,
 grid:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
 wrench:<path d="m14 6 4 4 3-3a6 6 0 0 1-8 8l-6 6a2.8 2.8 0 0 1-4-4l6-6a6 6 0 0 1 8-8z"/>,
 calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 chart:<><path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5"/></>,
 user:<><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
 shield:<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/></>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
 check:<path d="m5 12 4 4L19 6"/>,
 layers:<><path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
};
export function Icon({name,...props}:{name:IconName}&SVGProps<SVGSVGElement>){
 return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
