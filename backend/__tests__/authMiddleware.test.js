import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import { verifyToken } from "../middleware/authMiddleware.js";

const previousSecret = process.env.JWT_SECRET;
afterEach(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

it("refuses authentication when no signing secret is configured", () => {
  delete process.env.JWT_SECRET;
  const res = response();
  const next = jest.fn();
  verifyToken({ headers: { authorization: "Bearer any-token" } }, res, next);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(next).not.toHaveBeenCalled();
});

it("accepts a token signed with the configured secret", () => {
  process.env.JWT_SECRET = "middleware-tests-only-signing-secret";
  const signed = jwt.sign({ role: "user", studentId: "S1" }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${signed}` } };
  const next = jest.fn();
  verifyToken(req, response(), next);
  expect(req.user).toMatchObject({ role: "user", studentId: "S1" });
  expect(next).toHaveBeenCalledTimes(1);
});
