import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

function createRequest(protocol: "http" | "https") {
  return {
    protocol,
    headers: {},
  } as Parameters<typeof getSessionCookieOptions>[0];
}

describe("getSessionCookieOptions", () => {
  it("uses lax cookies on insecure local requests", () => {
    const options = getSessionCookieOptions(createRequest("http"));

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      secure: false,
      sameSite: "lax",
    });
  });

  it("uses cross-site compatible cookies on secure requests", () => {
    const options = getSessionCookieOptions(createRequest("https"));

    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      secure: true,
      sameSite: "none",
    });
  });
});
