import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env";
function key() { const raw=env.ENCRYPTION_KEY??""; if(!/^[0-9a-f]{64}$/i.test(raw)) throw new Error("Set ENCRYPTION_KEY to 64 hexadecimal characters before connecting LinkedIn."); return Buffer.from(raw,"hex"); }
export function sealSecret(value:string) { const iv=randomBytes(12); const cipher=createCipheriv("aes-256-gcm",key(),iv); const data=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]); return [iv.toString("hex"),cipher.getAuthTag().toString("hex"),data.toString("hex")].join("."); }
export function openSecret(value:string) { const [iv,tag,data]=value.split("."); const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"hex")); decipher.setAuthTag(Buffer.from(tag,"hex")); return Buffer.concat([decipher.update(Buffer.from(data,"hex")),decipher.final()]).toString("utf8"); }
