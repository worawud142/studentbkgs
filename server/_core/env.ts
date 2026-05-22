export const ENV = {
  appId: process.env.VITE_APP_ID ?? (process.env.NODE_ENV === "production" ? "" : "studentbkgs-local-dev"),
  cookieSecret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "studentbkgs-local-dev-secret"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  dbSchema: process.env.DB_SCHEMA ?? "studentbkgs",
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
