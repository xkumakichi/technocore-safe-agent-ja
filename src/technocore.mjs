import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as ed25519Sign,
  verify as ed25519Verify,
} from "node:crypto";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const ED25519_MULTICODEC = Buffer.from([0xed, 0x01]);
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/u;

export const DEFAULT_ORIGIN = "https://technocore.chat";
export const MAX_MESSAGE_CHARS = 4096;

export function sweepText(value, limit = MAX_MESSAGE_CHARS) {
  const cleaned = [...String(value)]
    .map((char) => (INVISIBLE.test(char) ? " " : char))
    .join("")
    .trim();

  if (!cleaned) {
    throw new Error("Technocoreの正規化後に表示可能な文字が残りません。幅ゼロ文字や改行だけは投稿できません。");
  }
  if (cleaned.length > limit) {
    throw new Error(`Technocoreの上限${limit}文字を超えています（正規化後${cleaned.length}文字）。`);
  }
  return cleaned;
}

export function base58Encode(bytes) {
  const input = Buffer.from(bytes);
  let zeroes = 0;
  while (zeroes < input.length && input[zeroes] === 0) zeroes += 1;

  let number = BigInt(`0x${input.toString("hex") || "0"}`);
  let encoded = "";
  while (number > 0n) {
    const remainder = Number(number % 58n);
    number /= 58n;
    encoded = B58[remainder] + encoded;
  }
  return "1".repeat(zeroes) + encoded;
}

export function base58Decode(value) {
  if (typeof value !== "string" || !value) throw new Error("空のbase58btc文字列は扱えません。");
  let number = 0n;
  for (const char of value) {
    const digit = B58.indexOf(char);
    if (digit < 0) throw new Error(`base58btcに使えない文字です: ${JSON.stringify(char)}`);
    number = number * 58n + BigInt(digit);
  }
  let hex = number.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const body = number === 0n ? Buffer.alloc(0) : Buffer.from(hex, "hex");
  const leadingZeroes = value.match(/^1*/)[0].length;
  return Buffer.concat([Buffer.alloc(leadingZeroes), body]);
}

function publicKeyRaw(publicKey) {
  const der = Buffer.from(publicKey.export({ type: "spki", format: "der" }));
  if (
    der.length !== ED25519_SPKI_PREFIX.length + 32 ||
    !der.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    throw new Error("Ed25519公開鍵を期待した形式で取り出せませんでした。");
  }
  return der.subarray(ED25519_SPKI_PREFIX.length);
}

export function didFromPublicKey(publicKey) {
  const multibase = `z${base58Encode(Buffer.concat([ED25519_MULTICODEC, publicKeyRaw(publicKey)]))}`;
  if (!/^z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/.test(multibase)) {
    throw new Error("生成したDIDがTechnocoreのEd25519 did:key形式と一致しません。");
  }
  return `did:key:${multibase}`;
}

export function publicKeySpkiHex(publicKey) {
  return Buffer.from(publicKey.export({ type: "spki", format: "der" })).toString("hex");
}

export function publicKeyFromDid(did) {
  if (typeof did !== "string" || !/^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/.test(did)) {
    throw new Error("Technocoreが受理するEd25519 did:keyではありません。");
  }
  const decoded = base58Decode(did.slice("did:key:z".length));
  if (decoded.length !== 34 || !decoded.subarray(0, 2).equals(ED25519_MULTICODEC)) {
    throw new Error("DIDのmulticodecがEd25519公開鍵ではありません。");
  }
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, decoded.subarray(2)]),
    format: "der",
    type: "spki",
  });
}

export function generateEncryptedIdentity(passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 16) {
    throw new Error("パスフレーズは16文字以上にしてください。");
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const encryptedPem = privateKey.export({
    type: "pkcs8",
    format: "pem",
    cipher: "aes-256-cbc",
    passphrase,
  });
  return {
    encryptedPem: String(encryptedPem),
    did: didFromPublicKey(publicKey),
  };
}

export function loadEncryptedIdentity(encryptedPem, passphrase) {
  let privateKey;
  try {
    privateKey = createPrivateKey({
      key: encryptedPem,
      format: "pem",
      type: "pkcs8",
      passphrase,
    });
  } catch {
    throw new Error("秘密鍵を開けませんでした。パスフレーズまたはidentity.pemを確認してください。");
  }
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey, did: didFromPublicKey(publicKey) };
}

export function makeNonce(now = Date.now()) {
  const nonce = String(now);
  if (!/^[0-9]{1,19}$/.test(nonce)) {
    throw new Error("nonceは1〜19桁のASCII数字である必要があります。");
  }
  return nonce;
}

export function signRoomMessage(privateKey, room, nonce, text) {
  if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(room)) {
    throw new Error("ルーム名は小文字英数字で始まる48文字以内（英数字、_、-）にしてください。");
  }
  if (!/^[0-9]{1,19}$/.test(String(nonce))) {
    throw new Error("nonceは1〜19桁のASCII数字である必要があります。");
  }
  const cleaned = sweepText(text);
  const canonical = `${room}|${nonce}|${cleaned}`;
  const signature = ed25519Sign(null, Buffer.from(canonical, "utf8"), privateKey).toString("base64url");
  if (!/^[A-Za-z0-9_-]{86}$/.test(signature)) {
    throw new Error("署名がTechnocoreのbase64url形式と一致しません。");
  }
  return { text: cleaned, canonical, signature };
}

export function verifyRoomMessage(publicKey, room, nonce, text, signature) {
  const cleaned = sweepText(text);
  const canonical = `${room}|${nonce}|${cleaned}`;
  return ed25519Verify(null, Buffer.from(canonical, "utf8"), publicKey, Buffer.from(signature, "base64url"));
}

export function verifyRoomMessageFromDid(did, room, nonce, text, signature) {
  return verifyRoomMessage(publicKeyFromDid(did), room, nonce, text, signature);
}

export async function publishSignedMessage({
  origin = DEFAULT_ORIGIN,
  room,
  did,
  signature,
  nonce,
  text,
  fetchImpl = fetch,
}) {
  const endpoint = new URL(`/r/${encodeURIComponent(room)}?format=json`, origin);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "flop-technocore-safe-agent/0.1.0",
    },
    body: JSON.stringify({ did, sig: signature, nonce, text }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`TechnocoreがHTTP ${response.status}を返しました: ${body.slice(0, 1000)}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Technocoreの成功応答をJSONとして確認できませんでした。再投稿せず、ルームを読んで確認してください。");
  }
}
