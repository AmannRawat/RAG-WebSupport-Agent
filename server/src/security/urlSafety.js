import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export async function validatePublicHttpUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed.");
  }

  if (
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid website destination.");
  }

  const hostname = url.hostname.toLowerCase();

  // Reject localhost names explicitly.
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Local network destinations are not allowed.");
  }

  let addresses;

  if (ipaddr.isValid(hostname)) {
    addresses = [{ address: ipaddr.process(hostname).toString() }];
  } else {
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new Error("Website hostname could not be resolved.");
    }
  }

  if (addresses.length === 0) {
    throw new Error("Website hostname has no valid IP addresses.");
  }

  for (const { address } of addresses) {
    const parsedAddress = ipaddr.process(address);

    if (parsedAddress.range() !== "unicast") {
      throw new Error(
        "The website resolves to a non-public IP address."
      );
    }
  }

  return url;
}