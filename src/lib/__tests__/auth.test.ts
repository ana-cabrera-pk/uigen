// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const { createSession, getSession, deleteSession, verifySession } =
  await import("@/lib/auth");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("sets an httpOnly cookie with a JWT token", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, token, options] = mockCookieStore.set.mock.calls[0];

    expect(name).toBe("auth-token");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT format
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("sets expiration to 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const { expires } = mockCookieStore.set.mock.calls[0][2];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs);
  });

  test("sets secure flag based on NODE_ENV", async () => {
    const origEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = "production";
    await createSession("user-1", "test@example.com");
    expect(mockCookieStore.set.mock.calls[0][2].secure).toBe(true);

    process.env.NODE_ENV = "development";
    await createSession("user-1", "test@example.com");
    expect(mockCookieStore.set.mock.calls[1][2].secure).toBe(false);

    process.env.NODE_ENV = origEnv;
  });
});

describe("getSession", () => {
  test("returns null when no cookie exists", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    await createSession("user-1", "test@example.com");
    const token = mockCookieStore.set.mock.calls[0][1];

    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).toMatchObject({
      userId: "user-1",
      email: "test@example.com",
    });
  });

  test("returns null for an invalid token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "invalid.jwt.token" });

    const session = await getSession();
    expect(session).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth cookie", async () => {
    await deleteSession();

    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  test("returns null when no cookie in request", async () => {
    const request = new NextRequest("http://localhost:3000/", {
      headers: new Headers(),
    });

    const session = await verifySession(request);
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token in request", async () => {
    await createSession("user-2", "user2@example.com");
    const token = mockCookieStore.set.mock.calls[0][1];

    const request = new NextRequest("http://localhost:3000/", {
      headers: new Headers({ Cookie: `auth-token=${token}` }),
    });

    const session = await verifySession(request);
    expect(session).toMatchObject({
      userId: "user-2",
      email: "user2@example.com",
    });
  });

  test("returns null for an invalid token in request", async () => {
    const request = new NextRequest("http://localhost:3000/", {
      headers: new Headers({ Cookie: "auth-token=bad-token" }),
    });

    const session = await verifySession(request);
    expect(session).toBeNull();
  });
});
