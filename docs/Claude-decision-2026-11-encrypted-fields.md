# Decision: encrypted field values (2026-11-21)

Status: built for plug-in settings (beta row 4). Owner: Claude. Threat addressed: a credential a person types into the app (a webhook address, an API token) sitting readable in the store, in an export or in a log.

## What was decided

1. **One cipher, one place.** `IFieldEncryptor` in `Adventures.Security` (`Encryption/`). AES-256-GCM, a fresh random 96-bit nonce per value, a 128-bit tag. Nothing else in the app encrypts fields.
2. **Keys live outside the store.** Host secrets `Encryption__CurrentKeyId` and `Encryption__Keys__<id>` (configuration `Encryption:CurrentKeyId`, `Encryption:Keys:<id>`). A key is text of at least 32 characters (32 random bytes as base64 is what `docs/Claude-secret.ps1 gen` makes); it is run through HKDF-SHA256 to the 32-byte AES key. This is an explicit key ring, not the ASP.NET Data Protection ring, so rotation is a visible, testable act.
3. **Stored form** `enc1:{keyId}:{base64(nonce || ciphertext || tag)}`. The marker says it is ours, the key id says which key made it.
4. **Context is authenticated.** The associated data is `plugin-setting:{pluginKey}:{settingName}`, so a value copied to another setting or plug-in does not decrypt. Tenant isolation is the tenant-scoped repository (each tenant has its own graph); the tenant is not part of the context yet (the plug-in seam does not know the tenant; add it if a store-level copy between tenants becomes a realistic threat).
5. **No key, no secret.** With no key configured the app starts, and saving a secret is refused with a message naming the missing setting. Plain text is never stored as a fallback. A bad key (too short, current id missing) fails at start-up.
6. **A value that cannot be read is "not set".** Wrong key, lost key, tampered value, text that was never encrypted by us: the server reads it as empty and the screen shows "Not set". The value is never echoed or logged. If a key is lost, secrets must be typed again.
7. **Write-only on the wire.** `GET api/plugins/{key}/settings` returns secrets as empty plus `secretsSet` (names that have a value). `PUT` with an empty secret keeps the stored value; removing one is explicit (`clear: ["Name"]`, the Clear button). Plug-in server code reads the decrypted value through `IPluginSettings.GetAsync`; only the admin read is masked (`GetForDisplayAsync`).
8. **Rotation.** Add the new key, set `CurrentKeyId` to it, keep the old key listed: old values still read, new saves use the new key, `NeedsReEncryption` tells which values are on an old key. Re-saving a secret moves it. Remove an old key only after every secret was re-saved.
9. **Scope today.** Plug-in settings only. Widget placement settings refuse the Secret kind (`PluginSettings.CheckValue` throws) until they get the same path. Entities fields and the Anthropic key stay as they are (host secrets).

## Production key (human step)

Set in the SmarterASP site panel for the api site (never through chat): `Encryption__CurrentKeyId` = `k1`, `Encryption__Keys__k1` = 32 random bytes as base64. Until then a Secret setting cannot be saved on production (clear message), and nothing breaks. Local development uses `Encryption:Keys:dev1` in the shared user-secrets (generated with `Claude-secret.ps1 gen`) and `Encryption:CurrentKeyId`=`dev1` beside it (both in user-secrets, never in a committed file: a fresh clone or CI has no key and simply runs with encryption not configured). A local run on the live store (`https-live`) encrypts with the dev key, which production cannot read: do not save real secrets from that profile.

## Not done

Encrypting other entity fields, a re-encryption sweep tool, tenant in the context, widget secrets, key rotation drill on production.
