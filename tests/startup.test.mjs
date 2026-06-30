import assert from "node:assert/strict";
import test from "node:test";
import { hasSamePublicSites, runAfterFirstPaint } from "../src/lib/startup.js";

test("runAfterFirstPaint uses requestIdleCallback when available", () => {
  let idleOptions = null;
  let called = false;
  const fakeWindow = {
    requestIdleCallback(callback, options) {
      idleOptions = options;
      callback();
      return 7;
    },
    setTimeout() {
      throw new Error("setTimeout should not be used when requestIdleCallback exists");
    },
  };

  const handle = runAfterFirstPaint(() => {
    called = true;
  }, fakeWindow);

  assert.equal(handle, 7);
  assert.equal(called, true);
  assert.deepEqual(idleOptions, { timeout: 1_500 });
});

test("runAfterFirstPaint falls back to setTimeout", () => {
  let delay = null;
  let called = false;
  const fakeWindow = {
    setTimeout(callback, timeout) {
      delay = timeout;
      callback();
      return 11;
    },
  };

  const handle = runAfterFirstPaint(() => {
    called = true;
  }, fakeWindow);

  assert.equal(handle, 11);
  assert.equal(called, true);
  assert.equal(delay, 120);
});

test("hasSamePublicSites detects equivalent public site payloads", () => {
  const sites = [
    {
      id: "gemini",
      name: "Gemini",
      url: "https://gemini.google.com",
      category: "AI",
      tags: ["AI", "Google"],
      icon: "AI",
      description: "Google AI assistant",
      aliases: ["bard"],
      createdAt: "2026-06-01T00:00:00Z",
    },
  ];

  assert.equal(hasSamePublicSites(sites, [{ ...sites[0], tags: [...sites[0].tags], aliases: [...sites[0].aliases] }]), true);
  assert.equal(hasSamePublicSites(sites, [{ ...sites[0], name: "Google Gemini" }]), false);
  assert.equal(hasSamePublicSites(sites, [{ ...sites[0], tags: ["Google", "AI"] }]), false);
  assert.equal(hasSamePublicSites(sites, []), false);
});
