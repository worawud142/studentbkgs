import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
function createSupabaseJwks() {
  if (!ENV.supabaseUrl) return null;

  try {
    return createRemoteJWKSet(
      new URL(`${ENV.supabaseUrl.replace(/\/+$/, "")}/auth/v1/keys`)
    );
  } catch (error) {
    console.error("[Supabase] Invalid SUPABASE_URL for JWKS:", error);
    return null;
  }
}

function createSupabaseAuthClient() {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) return null;

  try {
    return createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error("[Supabase] Failed to initialize auth client:", error);
    return null;
  }
}

const SUPABASE_JWKS = createSupabaseJwks();
const SUPABASE_AUTH_CLIENT = createSupabaseAuthClient();

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    if (ENV.oAuthServerUrl) {
      console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    } else if (ENV.isProduction) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }

  private decodeState(state: string): string {
    const redirectUri = atob(state);
    return redirectUri;
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  private getBearerToken(req: Request): string | null {
    const authorization = req.headers.authorization;
    if (typeof authorization !== "string") return null;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
  }

  private getSupabaseDisplayName(
    payload: Record<string, unknown>,
    fallbackEmail: string | null
  ): string {
    const userMetadata = payload.user_metadata;
    const candidates = [
      (typeof payload.name === "string" && payload.name) || null,
      (typeof payload.full_name === "string" && payload.full_name) || null,
      userMetadata &&
      typeof userMetadata === "object" &&
      typeof (userMetadata as Record<string, unknown>).full_name === "string"
        ? ((userMetadata as Record<string, unknown>).full_name as string)
        : null,
      userMetadata &&
      typeof userMetadata === "object" &&
      typeof (userMetadata as Record<string, unknown>).name === "string"
        ? ((userMetadata as Record<string, unknown>).name as string)
        : null,
      userMetadata &&
      typeof userMetadata === "object" &&
      typeof (userMetadata as Record<string, unknown>).username === "string"
        ? ((userMetadata as Record<string, unknown>).username as string)
        : null,
      fallbackEmail,
    ];
    return candidates.find(isNonEmptyString) ?? "Supabase User";
  }

  async authenticateSupabaseRequest(token: string): Promise<User | null> {
    if (!ENV.supabaseUrl) {
      return null;
    }

    try {
      const { data, error } = SUPABASE_AUTH_CLIENT
        ? await SUPABASE_AUTH_CLIENT.auth.getUser(token)
        : {
            data: null,
            error: new Error("Supabase auth client not configured"),
          };

      if (error || !data?.user) {
        return null;
      }

      const userRecord = data.user;
      const email = userRecord.email ?? null;
      const openId = userRecord.id || email;
      if (!openId) {
        return null;
      }

      const displayName =
        userRecord.user_metadata && typeof userRecord.user_metadata === "object"
          ? this.getSupabaseDisplayName(
              userRecord.user_metadata as Record<string, unknown>,
              email
            )
          : email || "Supabase User";
      const signedInAt = new Date();

      let user = email ? await db.getUserByEmail(email) : null;
      if (!user) {
        user = await db.getUserByOpenId(openId);
      }

      if (!user) {
        await db.upsertUser({
          openId,
          name: displayName,
          email,
          loginMethod: "supabase",
          lastSignedIn: signedInAt,
        });
        user =
          (email ? await db.getUserByEmail(email) : null) ??
          (await db.getUserByOpenId(openId));
      } else {
        await db.upsertUser({
          openId: user.openId,
          name: displayName || user.name || null,
          email: email ?? user.email ?? null,
          loginMethod: "supabase",
          role: user.role,
          lastSignedIn: signedInAt,
        });
        user =
          (email ? await db.getUserByEmail(email) : null) ??
          (await db.getUserByOpenId(user.openId));
      }

      return user ?? null;
    } catch (error) {
      console.warn("[Auth] Supabase token verification failed", String(error));
      return null;
    }
  }

  async loginSupabaseWithUsername(
    username: string,
    password: string
  ): Promise<{ session: unknown; user: User | null } | null> {
    if (!SUPABASE_AUTH_CLIENT) {
      return null;
    }

    const { email } = await db.resolveLoginUser(username);
    if (!email) {
      return null;
    }

    const { data, error } = await SUPABASE_AUTH_CLIENT.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.session) {
      return null;
    }

    const user = await this.authenticateSupabaseRequest(
      data.session.access_token
    );
    return { session: data.session, user };
  }

  async loginSupabaseWithEmail(
    email: string,
    password: string
  ): Promise<{ session: unknown; user: User | null } | null> {
    if (!SUPABASE_AUTH_CLIENT) {
      return null;
    }

    const { data, error } = await SUPABASE_AUTH_CLIENT.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.session) {
      return null;
    }

    const user = await this.authenticateSupabaseRequest(
      data.session.access_token
    );
    return { session: data.session, user };
  }

  async createSupabaseAuthUser(
    username: string,
    password: string,
    displayName: string
  ): Promise<{ email: string; id: string | null }> {
    if (!SUPABASE_AUTH_CLIENT) {
      throw new Error("Supabase Auth is not configured");
    }

    const email = `${username.trim().toLowerCase()}@school.local`;
    const { data, error } = await SUPABASE_AUTH_CLIENT.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
          username,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return { email, id: data.user?.id ?? null };
  }

  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      if (!ENV.isProduction && cookieValue.startsWith("dev-")) {
        return {
          openId: cookieValue,
          appId: ENV.appId,
          name: cookieValue === "dev-admin" ? "Demo Admin" : "Demo Teacher",
        };
      }

      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId: isNonEmptyString(appId) ? appId : ENV.appId,
        name,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  async authenticateRequest(req: Request): Promise<User> {
    // Regular authentication flow
    const devSessionHeader = req.headers["x-dev-session"];
    if (
      !ENV.isProduction &&
      typeof devSessionHeader === "string" &&
      devSessionHeader.startsWith("dev-")
    ) {
      const signedInAt = new Date();
      const isAdmin = devSessionHeader === "dev-admin";
      const isReviewer = devSessionHeader === "dev-reviewer";
      const devUser: User = {
        id: isAdmin ? 2 : isReviewer ? 3 : 1,
        openId: devSessionHeader,
        name: isAdmin
          ? "Demo Admin"
          : isReviewer
            ? "Demo Reviewer"
            : "Demo Teacher",
        email: isAdmin
          ? "admin@demo.local"
          : isReviewer
            ? "reviewer@demo.local"
            : "teacher@demo.local",
        loginMethod: "dev",
        role: isAdmin ? "admin" : isReviewer ? "reviewer" : "teacher",
        createdAt: signedInAt,
        updatedAt: signedInAt,
        lastSignedIn: signedInAt,
      };
      return devUser;
    }

    const bearerToken = this.getBearerToken(req);
    if (bearerToken) {
      const user = await this.authenticateSupabaseRequest(bearerToken);
      if (user) {
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });
        return user;
      }

      const bearerSession = await this.verifySession(bearerToken);
      if (bearerSession) {
        const bearerUser = await db.getUserByOpenId(bearerSession.openId);
        if (bearerUser) {
          await db.upsertUser({
            openId: bearerUser.openId,
            lastSignedIn: new Date(),
          });
          return bearerUser;
        }
      }
    }

    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    if (!user && sessionUserId.startsWith("dev-") && !ENV.isProduction) {
      const isAdmin = sessionUserId === "dev-admin";
      const isReviewer = sessionUserId === "dev-reviewer";
      return {
        id: isAdmin ? 2 : isReviewer ? 3 : 1,
        openId: sessionUserId,
        name:
          session.name ||
          (isAdmin
            ? "Demo Admin"
            : isReviewer
              ? "Demo Reviewer"
              : "Demo Teacher"),
        email: isAdmin
          ? "admin@demo.local"
          : isReviewer
            ? "reviewer@demo.local"
            : "teacher@demo.local",
        loginMethod: "dev",
        role: isAdmin ? "admin" : isReviewer ? "reviewer" : "teacher",
        createdAt: signedInAt,
        updatedAt: signedInAt,
        lastSignedIn: signedInAt,
      };
    }

    // If user not in DB, sync from OAuth server automatically
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
