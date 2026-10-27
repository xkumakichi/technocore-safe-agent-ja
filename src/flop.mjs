// FLOP-facing evidence checks. No signing, payment, faucet or remote code loading.
import { createHash } from "node:crypto";
import {
  base58Decode, publicKeyFromDid, verifyRoomMessageFromDid,
} from "./technocore.mjs";

export const FLOP_UPSTREAM = Object.freeze({
  tclk: "fb910d354b34892f9bad236ca51f390be50a6d4b",
  technocore: "cd1ce1c55a9956f3cb14ec42c1dd9707981926f9",
  checkedAt: "2026-10-27",
});
const HEX32 = /^0x[0-9a-f]{64}$/;
const ROOM = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const NONCE = /^(?:0|[1-9][0-9]{0,18})$/;
const SIGNATURE = /^[A-Za-z0-9_-]{85}[AQgw]$/;
const MAX_EXPORT_BYTES = 16 * 1024 * 1024;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Same sorted, compact JSON convention used by TCLK. This is not an XAIP profile.
export function canonicalJson(value, depth = 0) {
  if (depth > 20) throw new Error("JSON nesting exceeds the review limit.");
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v, depth + 1)).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((k) =>
      `${JSON.stringify(k)}:${canonicalJson(value[k], depth + 1)}`).join(",")}}`;
  }
  throw new Error("Unsupported JSON value.");
}

function fields(value, expected, label) {
  if (!value || Array.isArray(value) || typeof value !== "object" ||
      Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) {
    throw new Error(`Unexpected ${label} fields.`);
  }
}

export function flopAccountFromDid(did) {
  publicKeyFromDid(did);
  return `0x${base58Decode(did.slice("did:key:z".length)).subarray(2).toString("hex")}`;
}

export function validateLockTerms(terms) {
  fields(terms, ["contract", "lock", "statement", "amount", "asset", "payer", "payee",
    "claimByMs", "refundAfterMs"], "FLOP LockTerms");
  if (!HEX32.test(terms.contract) || !HEX32.test(terms.statement) ||
      terms.lock !== "hash" || terms.asset !== "FLOP") {
    throw new Error("Expected native FLOP hash-lock terms.");
  }
  if (typeof terms.amount !== "string" || !/^[1-9][0-9]{0,38}$/.test(terms.amount) ||
      BigInt(terms.amount) >= 2n ** 128n) throw new Error("Amount must be positive u128 base units.");
  flopAccountFromDid(terms.payer);
  flopAccountFromDid(terms.payee);
  if (terms.payer === terms.payee) throw new Error("FLOP payer and payee must differ.");
  if (!Number.isSafeInteger(terms.claimByMs) || terms.claimByMs <= 0 ||
      !Number.isSafeInteger(terms.refundAfterMs) || terms.refundAfterMs <= terms.claimByMs) {
    throw new Error("Invalid FLOP deadlines.");
  }
}

export function validateTrust(trust) {
  fields(trust, ["network", "rpcUrl", "expectedGenesisHash", "blockTimeMs", "refundMarginBlocks"], "trust configuration");
  if (!["devnet", "testnet", "mainnet"].includes(trust.network) ||
      !HEX32.test(trust.expectedGenesisHash)) throw new Error("A separately trusted network and genesis pin are required.");
  const url = new URL(trust.rpcUrl);
  if (url.protocol !== "wss:" || url.username || url.password || url.hash || url.search) {
    throw new Error("RPC must be a reviewed wss URL without credentials, query or fragment.");
  }
  for (const value of [trust.blockTimeMs, trust.refundMarginBlocks]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 0xffffffff) {
      throw new Error("Invalid FLOP timing profile.");
    }
  }
}

export function inspectFlopRequest(request) {
  fields(request, ["reference", "expectedTerms", "trust"], "lock review request");
  validateLockTerms(request.expectedTerms);
  validateTrust(request.trust);
  const { reference, expectedTerms, trust } = request;
  if (typeof reference !== "string" || reference.length > 3500 ||
      !/^flop1\.[A-Za-z0-9_-]+$/.test(reference)) throw new Error("Malformed flop1 reference.");
  const bytes = Buffer.from(reference.slice(6), "base64url");
  const ref = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  fields(ref, ["v", "network", "genesis", "escrow", "anchor", "blockTimeMs", "refundMarginBlocks", "terms"], "flop1 reference");
  validateLockTerms(ref.terms);
  if (ref.v !== 1 || !HEX32.test(ref.genesis) || !HEX32.test(ref.escrow) ||
      !HEX32.test(ref.anchor) || `flop1.${Buffer.from(canonicalJson(ref)).toString("base64url")}` !== reference) {
    throw new Error("Reference is not canonical FlopRail v1.");
  }
  if (ref.escrow === `0x${"0".repeat(64)}`) throw new Error("Pending reference has no finalized escrow id.");
  if (ref.network !== trust.network || ref.genesis !== trust.expectedGenesisHash ||
      ref.blockTimeMs !== trust.blockTimeMs || ref.refundMarginBlocks !== trust.refundMarginBlocks ||
      canonicalJson(ref.terms) !== canonicalJson(expectedTerms)) {
    throw new Error("Reference disagrees with independently supplied terms or trust pins.");
  }
  const { escrow: _escrow, ...bindingFields } = ref;
  const witness = sha256(canonicalJson({ domain: "tclk/flop-htlc/1", ...bindingFields }));
  return {
    profile: "flop-agent-evidence/1", mode: "offline-reference-review",
    referenceSha256: sha256(reference), upstream: FLOP_UPSTREAM,
    network: ref.network, genesis: ref.genesis, escrow: ref.escrow,
    payerAccountId32: flopAccountFromDid(expectedTerms.payer),
    payeeAccountId32: flopAccountFromDid(expectedTerms.payee),
    expectedPolicy: { combinator: "And", clauses: [
      { Hash: expectedTerms.statement }, { Hash: `0x${sha256(Buffer.from(witness, "hex"))}` },
    ] },
    checks: { referenceMatchesExpectedTerms: true, referenceMatchesTrustPins: true,
      chainLockVerified: false, workDeliveryVerified: false },
    limitations: ["An internally consistent reference does not prove an escrow exists.",
      "Network labels do not establish that testnet or mainnet has launched.",
      "Chain timestamps and block deadlines are different clocks."],
  };
}

// Retain exact integer nonce bytes. On runtimes without JSON source context,
// unsafe numbers fail instead of silently rounding a signed 19-digit nonce.
export function parseExportJson(line) {
  return JSON.parse(line, (key, value, context) => {
    if (key === "nonce" && typeof value === "number") {
      if (context?.source && NONCE.test(context.source)) return context.source;
      if (Number.isSafeInteger(value) && value >= 0) return String(value);
      throw new Error("Unsafe numeric nonce; obtain an export with decimal-text nonces.");
    }
    return value;
  });
}

export function auditExport(room, jsonl) {
  if (!ROOM.test(room) || typeof jsonl !== "string" || Buffer.byteLength(jsonl) > MAX_EXPORT_BYTES) {
    throw new Error("Invalid room or export larger than 16 MiB.");
  }
  let lastSeq = -1;
  const lastNonce = new Map();
  const rows = [];
  const messages = [];
  let hasGaps = false;
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    if (rows.length >= 50_000 || Buffer.byteLength(line) > 65_536) throw new Error("Export row limit exceeded.");
    const row = parseExportJson(line);
    if (!row || !Number.isSafeInteger(row.seq) || row.seq < 0 || row.seq <= lastSeq ||
        typeof row.ts !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(row.ts) ||
        !Number.isFinite(Date.parse(row.ts)) || typeof row.text !== "string" ||
        typeof row.from !== "string") throw new Error("Malformed or out-of-order export record.");
    if (lastSeq >= 0 && row.seq !== lastSeq + 1) hasGaps = true;
    lastSeq = row.seq;
    const signed = row.sig !== undefined && row.sig !== null;
    let signatureValid = false;
    let nonceIncreasing = null;
    if (signed) {
      try {
        if (!NONCE.test(row.nonce) || !SIGNATURE.test(row.sig)) throw new Error("Non-canonical signature fields.");
        signatureValid = verifyRoomMessageFromDid(row.from, room, row.nonce, row.text, row.sig);
        if (signatureValid) {
          const previous = lastNonce.get(row.from);
          nonceIncreasing = previous === undefined || BigInt(row.nonce) > previous;
          lastNonce.set(row.from, BigInt(row.nonce));
        }
      } catch { signatureValid = false; }
    }
    // Report indexes and hashes, never re-emit room instructions or reveal secrets.
    rows.push({ seq: row.seq, signed, signatureValid, nonceIncreasing,
      textSha256: sha256(row.text), tclk: row.text.startsWith("tclk1 ") });
    messages.push(row);
  }
  const invalidSigned = rows.filter((r) => r.signed && (!r.signatureValid || r.nonceIncreasing === false)).length;
  return {
    report: { profile: "flop-agent-evidence/1", mode: "offline-technocore-export", room,
      sourceSha256: sha256(jsonl), records: rows.length,
      verifiedSignatures: rows.filter((r) => r.signatureValid).length,
      unsignedRecords: rows.filter((r) => !r.signed).length, invalidSignedRecords: invalidSigned,
      hasSequenceGaps: hasGaps, ok: invalidSigned === 0, rows,
      checks: { serverInclusionAttested: false, completeHistoryProven: false,
        protocolStateVerified: false, chainLockVerified: false, workDeliveryVerified: false } },
    // Private in-process handoff to the official parser. CLI prints report only.
    normalizedJsonl: messages.map((m) => JSON.stringify(m)).join("\n"),
  };
}

async function officialTclk() {
  try { return await import("@flop-labs/tclk"); }
  catch { throw new Error("Official @flop-labs/tclk is not available. See docs/FLOP_DESIGN.md; no code is downloaded automatically."); }
}

export async function auditTclk(offersJsonl, dealJsonl, contract, toolkit) {
  if (!HEX32.test(contract)) throw new Error("Invalid TCLK contract id.");
  const room = `mb-p-tclk-${contract.slice(2, 18)}`;
  const board = auditExport("tclk-offers", offersJsonl);
  const deal = auditExport(room, dealJsonl);
  if (!board.report.ok || !deal.report.ok) throw new Error("Export contains an invalid signature or nonce replay.");
  const core = toolkit ?? await officialTclk();
  const handshake = core.findContractHandshake(core.parseTranscriptExport("tclk-offers", board.normalizedJsonl), contract);
  if (!handshake) throw new Error("No authenticated TCLK offer/accept pair.");
  const folded = core.foldTranscript([handshake.offer, handshake.accept,
    ...core.parseTranscriptExport(room, deal.normalizedJsonl)]);
  if (!folded.state || folded.steps.some((step) => !step.ok)) throw new Error("Official TCLK transcript validation failed.");
  return { profile: "flop-agent-evidence/1", mode: "official-tclk-fold", contract,
    sourceHashes: [board.report.sourceSha256, deal.report.sourceSha256],
    status: folded.state.status, terms: core.lockTerms(folded.state),
    checks: { protocolStateVerified: true, venueMetadataTrusted: true,
      chainLockVerified: false, workDeliveryVerified: false },
    note: "A claimed/refunded transcript status is a signed statement, not a chain observation." };
}

export async function verifyFlopLock(request, connector) {
  // Capture before awaiting; a caller cannot change terms or endpoint in flight.
  const captured = JSON.parse(canonicalJson(request));
  const report = inspectFlopRequest(captured);
  let connect = connector;
  if (!connect) {
    try { ({ connectFlopRail: connect } = await import("@flop-labs/tclk-flop")); }
    catch { throw new Error("Official @flop-labs/tclk-flop is not available. Offline inspection remains usable; see docs/FLOP_DESIGN.md."); }
  }
  // No signer, private key, funding, lock, claim, refund or retry path.
  const connection = await connect({ ...captured.trust });
  try {
    if (await connection.rail.verifyLock(captured.expectedTerms, captured.reference) !== true) {
      throw new Error("Official FlopRail did not verify an open, timely lock matching the agreed terms.");
    }
    return { ...report, mode: "official-floprail-read-only",
      checkedAt: new Date().toISOString(), trustModel: "configured-RPC, not a consensus light client",
      checks: { ...report.checks, chainLockVerified: true, workDeliveryVerified: false } };
  } finally { await connection.disconnect(); }
}
