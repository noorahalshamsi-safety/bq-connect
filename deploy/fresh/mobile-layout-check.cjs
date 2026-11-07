"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const sourceDir = path.join(
  root,
  "release-preparation/maintenance-cd5bd76/source/public",
);
const css = fs.readFileSync(path.join(__dirname, "mobile-layout.css"), "utf8");
const sourceCss = fs.readFileSync(path.join(sourceDir, "css/app.css"), "utf8");
const html = fs.readFileSync(path.join(sourceDir, "index.html"), "utf8");

// Confirm the baseline defects this additive stylesheet is intended to address.
assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
assert.doesNotMatch(html, /name="viewport"[^>]*viewport-fit\s*=\s*cover/i);
assert.match(sourceCss, /input,\s*select,\s*textarea\s*\{[^}]*font:\s*inherit/s);
assert.match(sourceCss, /#compose input:not\(\[type="file"\]\),\s*#compose textarea\s*\{[^}]*font-size:\s*0\.95rem/s);
assert.match(sourceCss, /dialog#compose\s*\{[^}]*height:\s*100vh;[^}]*max-height:\s*100vh/s);
assert.match(sourceCss, /\.story-view\s*\{\s*position:\s*fixed;\s*inset:\s*0/s);
assert.match(sourceCss, /\.story-bars\s*\{\s*position:\s*absolute;\s*top:\s*10px/s);

// Verify scoped repairs without hiding overflow or restricting accessibility zoom.
assert.match(css, /#gate input[\s\S]*?font-size:\s*16px/);
assert.match(css, /#forum input[\s\S]*?font-size:\s*16px/);
assert.match(css, /#compose input[\s\S]*?font-size:\s*16px/);
assert.match(css, /dialog#compose[\s\S]*?height:\s*100dvh/);
assert.match(css, /\.story-view[\s\S]*?height:\s*100dvh/);
assert.match(css, /\.story-bars[\s\S]*?env\(safe-area-inset-top\)/);
assert.match(css, /\.story-chat-panel[\s\S]*?100dvh/);
assert.match(css, /orientation:\s*landscape/);
assert.doesNotMatch(css, /overflow-x\s*:\s*hidden|user-scalable\s*=\s*no|maximum-scale\s*=/i);

console.log("Fresh mobile layout checks passed (source contracts + scoped CSS).");
