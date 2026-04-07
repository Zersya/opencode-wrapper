import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 64

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set")
  }
  return Buffer.from(key, "hex")
}

function deriveKey(salt: Buffer, password: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha512")
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const salt = crypto.randomBytes(SALT_LENGTH)
  const derivedKey = deriveKey(salt, key)

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  const result = Buffer.concat([salt, iv, authTag, encrypted])
  return result.toString("hex")
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey()
  const buffer = Buffer.from(ciphertext, "hex")

  const salt = buffer.subarray(0, SALT_LENGTH)
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  )
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

  const derivedKey = deriveKey(salt, key)

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
  decipher.setAuthTag(authTag)

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
    return decrypted.toString("utf8")
  } catch (error) {
    throw new Error("Decryption failed - data may be corrupted or tampered with")
  }
}

export function encryptApiKey(key: string): string {
  if (!key || key.trim() === "") {
    return ""
  }
  return encrypt(key.trim())
}

export function decryptApiKey(encryptedKey: string | null): string {
  if (!encryptedKey || encryptedKey.trim() === "") {
    return ""
  }
  try {
    return decrypt(encryptedKey)
  } catch (error) {
    console.error("Failed to decrypt API key:", error)
    return ""
  }
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex")
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 8)
}
