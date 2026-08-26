import { createPublicKey, sign as ed25519Sign, verify as ed25519Verify } from "node:crypto";
import { createHash } from "node:crypto";
import {
  publicKeyFromDid,
  publicKeySpkiHex,
  verifyRoomMessageFromDid,
} from "./technocore.mjs";

export const XAIP_FORMAT_VERSION = "1";
export const XAIP_TOOL_NAME = "technocore.say_signed";

export function canonicalize(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JCSでは有限でない数値を扱えません。");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value !== "object") throw new Error(`JCSで扱えない型です: ${typeof value}`);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

export function xaipHash(value) {
  const preimage =
    value === undefined || value === null
      ? ""
      : typeof value === "string"
        ? value
        : canonicalize(value);
  return createHash("sha256").update(preimage, "utf8").digest("hex");
}

export function xaipReceiptPayload(receipt) {
  const signed = {
    agentDid: receipt.agentDid,
    callerDid: receipt.callerDid ?? "",
    failureType: receipt.failureType ?? "",
    latencyMs: receipt.latencyMs,
    resultHash: receipt.resultHash ?? "",
    success: receipt.success,
    taskHash: receipt.taskHash,
    timestamp: receipt.timestamp,
    toolName: receipt.toolName,
  };
  if (receipt.formatVersion !== undefined) signed.formatVersion = receipt.formatVersion;
  return canonicalize(signed);
}

function postedOutput(technocoreReceipt) {
  return {
    room: technocoreReceipt.room,
    posted: {
      from: technocoreReceipt.did,
      nonce: Number(technocoreReceipt.nonce),
      seq: technocoreReceipt.sequence,
      text: technocoreReceipt.text,
      ts: technocoreReceipt.serverTimestamp,
    },
  };
}

export function createTechnocoreXaipArtifact({
  privateKey,
  publicKey,
  technocoreReceipt,
  latencyMs,
}) {
  if (!Number.isInteger(latencyMs) || latencyMs < 0) {
    throw new Error("XAIP receiptには実測した0以上の整数latencyMsが必要です。");
  }
  if (!technocoreReceipt.signature) {
    throw new Error("Technocore署名のない受領記録からXAIP証跡は作成しません。");
  }

  const input = {
    nonce: String(technocoreReceipt.nonce),
    room: technocoreReceipt.room,
    text: technocoreReceipt.text,
  };
  const output = postedOutput(technocoreReceipt);
  const base = {
    formatVersion: XAIP_FORMAT_VERSION,
    agentDid: technocoreReceipt.did,
    callerDid: technocoreReceipt.did,
    toolName: XAIP_TOOL_NAME,
    taskHash: xaipHash(input),
    resultHash: xaipHash(output),
    success: true,
    latencyMs,
    failureType: "",
    timestamp: technocoreReceipt.receivedAt,
  };
  const signature = ed25519Sign(
    null,
    Buffer.from(xaipReceiptPayload(base), "utf8"),
    privateKey,
  ).toString("hex");

  return {
    schema: "xaip-technocore-evidence/0.1",
    receipt: {
      ...base,
      signature,
      toolMetadata: {
        xaip: {
          class: "mutation",
          verifiabilityHint: "attestable",
        },
      },
    },
    publicKey: publicKeySpkiHex(publicKey),
    evidence: {
      input,
      output,
      technocoreSignature: technocoreReceipt.signature,
    },
    sources: {
      xaipReceiptProfile:
        "https://github.com/xkumakichi/xaip-protocol/blob/main/docs/emit-from-anything.md",
      technocoreSigning:
        "https://github.com/flop-labs/technocore-chat/blob/main/src/didkey.py",
    },
  };
}

export function verifyTechnocoreXaipArtifact(artifact) {
  const { receipt, evidence, publicKey } = artifact ?? {};
  if (!receipt || !evidence || typeof publicKey !== "string") {
    throw new Error("XAIP-Technocore証跡の必須フィールドがありません。");
  }
  if (receipt.formatVersion !== XAIP_FORMAT_VERSION || receipt.toolName !== XAIP_TOOL_NAME) {
    throw new Error("対応していないXAIP receipt形式です。");
  }
  if (receipt.agentDid !== receipt.callerDid) {
    throw new Error("この非委任フローではcallerDidとagentDidが一致する必要があります。");
  }

  const embeddedKey = publicKeyFromDid(receipt.agentDid);
  if (publicKeySpkiHex(embeddedKey) !== publicKey.toLowerCase()) {
    throw new Error("XAIP publicKeyがagentDidに埋め込まれた公開鍵と一致しません。");
  }
  const suppliedKey = createPublicKey({
    key: Buffer.from(publicKey, "hex"),
    format: "der",
    type: "spki",
  });
  const receiptOk = ed25519Verify(
    null,
    Buffer.from(xaipReceiptPayload(receipt), "utf8"),
    suppliedKey,
    Buffer.from(receipt.signature, "hex"),
  );
  if (!receiptOk) throw new Error("XAIP receipt署名を検証できません。");
  if (receipt.taskHash !== xaipHash(evidence.input)) {
    throw new Error("taskHashが公開入力のJCS/SHA-256と一致しません。");
  }
  if (receipt.resultHash !== xaipHash(evidence.output)) {
    throw new Error("resultHashが公開出力のJCS/SHA-256と一致しません。");
  }
  if (
    evidence.input.room !== evidence.output.room ||
    receipt.agentDid !== evidence.output.posted.from ||
    String(evidence.output.posted.nonce) !== String(evidence.input.nonce) ||
    evidence.output.posted.text !== evidence.input.text
  ) {
    throw new Error("Technocore入力とサーバー受理記録が一致しません。");
  }
  if (
    !verifyRoomMessageFromDid(
      receipt.agentDid,
      evidence.input.room,
      evidence.input.nonce,
      evidence.input.text,
      evidence.technocoreSignature,
    )
  ) {
    throw new Error("元のTechnocore署名をDIDの公開鍵で検証できません。");
  }
  return true;
}
