import test from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "./server";

test("health and auth flow", async () => {
  const app = await buildServer();
  try {
    const live = await app.inject({ method: "GET", url: "/health/live" });
    assert.equal(live.statusCode, 200);

    const email = `test_${Date.now()}@example.com`;
    const signup = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        email,
        password: "testpassword123",
        firstName: "Test",
        birthYear: 1997,
      },
    });
    assert.equal(signup.statusCode, 201);

    const body = signup.json() as { token?: string };
    assert.ok(body.token);

    const me = await app.inject({
      method: "GET",
      url: "/me",
      headers: {
        authorization: `Bearer ${body.token}`,
      },
    });
    assert.equal(me.statusCode, 200);
  } finally {
    await app.close();
  }
});
