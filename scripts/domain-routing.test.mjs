#!/usr/bin/env node
/**
 * Domain routing unit checks (no Azure Host-header dependency).
 */
import assert from "node:assert/strict";
import {
  getRequestHost,
  shouldApplyCommercialDomainRouting,
  resolveWwwRedirectTarget,
  resolveAppHostRedirectTarget,
  isWwwHost,
} from "../src/lib/domains/routing.ts";
import { isAppHost, isMarketingHost, COMMERCIAL_DOMAIN, COMMERCIAL_WWW, APP_SUBDOMAIN } from "../src/lib/domains.ts";

function mockRequest({ host, testHost, pathname = "/" } = {}) {
  const headerMap = new Map();
  if (host) headerMap.set("host", host);
  if (testHost) headerMap.set("x-gcc-test-host", testHost);
  return {
    headers: {
      get(name) {
        return headerMap.get(String(name).toLowerCase()) ?? null;
      },
    },
    nextUrl: {
      pathname,
      search: "",
      searchParams: new URLSearchParams(),
      clone() {
        return { pathname, search: "", searchParams: new URLSearchParams() };
      },
    },
  };
}

const azureHost = "azapprngzn.nicecoast-be020962.eastus.azurecontainerapps.io";

assert.equal(isMarketingHost(COMMERCIAL_DOMAIN), true);
assert.equal(isAppHost(APP_SUBDOMAIN), true);
assert.equal(isWwwHost(COMMERCIAL_WWW), true);
assert.equal(shouldApplyCommercialDomainRouting(COMMERCIAL_DOMAIN), true);
assert.equal(shouldApplyCommercialDomainRouting(APP_SUBDOMAIN), true);
assert.equal(shouldApplyCommercialDomainRouting(azureHost), false);

assert.equal(
  getRequestHost(mockRequest({ host: azureHost, testHost: APP_SUBDOMAIN })),
  APP_SUBDOMAIN
);
assert.equal(
  getRequestHost(mockRequest({ host: azureHost, testHost: COMMERCIAL_WWW })),
  COMMERCIAL_WWW
);

const wwwTarget = resolveWwwRedirectTarget(
  mockRequest({ host: azureHost, testHost: COMMERCIAL_WWW })
);
assert.ok(wwwTarget && wwwTarget.includes(COMMERCIAL_DOMAIN), "www should redirect to marketing apex");

const appTarget = resolveAppHostRedirectTarget(
  mockRequest({ host: azureHost, testHost: APP_SUBDOMAIN }),
  false
);
assert.equal(appTarget, "/login");

console.log("PASS: domain routing unit checks");
console.log("HOST_HEADER_ROUTING_LOGIC=PASS");
console.log("HOST_HEADER_ROUTING_AZURE_FQDN=DEFERRED_UNTIL_CUSTOM_DOMAIN_BINDING");
