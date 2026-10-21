import type { NextConfig } from "next";
const config: NextConfig = {
 poweredByHeader: false,
 outputFileTracingIncludes:{"/api/documents/**":["./assets/fonts/**"],"/api/requisition-plans/**":["./assets/fonts/**"],"/requisitions":["./assets/fonts/**"],"/cases/**":["./assets/fonts/**"]},
 async headers() {
  return [{source:"/:path*",headers:[
   {key:"X-Content-Type-Options",value:"nosniff"},
   {key:"X-Frame-Options",value:"DENY"},
   {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
   {key:"Permissions-Policy",value:"camera=(self), microphone=(), geolocation=()"},
   {key:"Cache-Control",value:"private, no-store"}
  ]}];
 }
};
export default config;
