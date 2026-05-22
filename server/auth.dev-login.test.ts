import { describe, expect, it } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createDevContext(): {
  ctx: TrpcContext;
  cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>;
} {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "http",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, cookies };
}

describe("auth.devLogin", () => {
  it("sets a local session cookie for development logins", async () => {
    const { ctx, cookies } = createDevContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.devLogin({ preset: "teacher" });

    expect(result).toEqual({ success: true, preset: "teacher" });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(COOKIE_NAME);
    expect(cookies[0]?.value).toEqual(expect.any(String));
    expect(cookies[0]?.options).toMatchObject({
      httpOnly: true,
      path: "/",
      secure: false,
      sameSite: "lax",
      maxAge: expect.any(Number),
    });
  });
});
