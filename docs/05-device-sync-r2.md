# 5. Device sync with Cloudflare R2 and Sync Engine

Files sync between devices through **Sync Engine** (free, MIT licence) with its **S3** module, against a **Cloudflare R2** bucket. One bucket holds all vaults, each under its own key prefix. The **Encryption** module encrypts content (and, as observed, object names) before upload.

## 5.1 Bucket and scoped token

1. Cloudflare dashboard → **R2** → create a bucket, e.g. `obsidian-vaults`. Or from a terminal:
   ```
   npx wrangler r2 bucket create obsidian-vaults
   ```
2. R2 → **Manage API tokens** → create an API token:
   - Permission: **Object Read & Write**.
   - Scope: **only** the `obsidian-vaults` bucket.
3. Write down the **Access Key ID**, the **Secret Access Key** (shown once) and the S3 endpoint:
   ```
   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   ```
4. Optional check with the AWS CLI that the token works for this bucket and is refused for others:
   ```
   export AWS_ACCESS_KEY_ID=<ACCESS_KEY_ID> AWS_SECRET_ACCESS_KEY=<SECRET>
   aws s3 ls s3://obsidian-vaults --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --region auto
   aws s3 ls s3://<some-other-bucket> --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --region auto   # should fail
   ```

## 5.2 Sync Engine on the desktop

Per vault:

1. *Settings → Community plugins* → install and enable **Sync Engine**.
2. Sync Engine → **Module management** → install the **S3** module and the **Encryption** module.
3. Backend **S3**:

   | Setting | Value |
   |---|---|
   | Endpoint | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
   | Region | `auto` |
   | Access key ID / secret | from 5.1 (stored in Obsidian's keychain) |
   | Bucket | `obsidian-vaults` |
   | URL style | path-style |
   | Prefix | one per vault, e.g. `work/` and `personal/` |

4. **Encryption:** on, with a passphrase (see 5.3).
5. **Conflict strategy:** *keep both*. ("Smart merge" also exists; *keep both* keeps both versions of a conflicting file, at the cost of an occasional duplicate to merge by hand. How the copy is named depends on Sync Engine.)
6. **Triggers:** on change (save), on focus, on startup, and every 5 minutes.
7. Run the first sync, review what it proposes, confirm. In the bucket you should then see objects under the prefix; with encryption on, their names are not readable.

Setting names above follow the Sync Engine version used when this was written; they may differ in yours.

## 5.3 Encryption advice

- Use a **long passphrase** (for example 5 or more random words). Anyone with the bucket contents and the passphrase can read your notes.
- **Decide before adding the second device.** Changing the passphrase later means re-encrypting and re-uploading the whole vault, and entering the new one on every device.
- Keep the passphrase in a password manager. It is stored in Obsidian's keychain, which is per vault and per device, so you type it once per vault on each device.

## 5.4 Phone (Android)

Per vault:

1. In Obsidian on the phone, create an **empty vault with exactly the same name** as on the desktop (Task Calendar Sync relies on the name, doc 04).
2. Install and enable **Sync Engine**, install its **S3** and **Encryption** modules, and enter the same settings as on the desktop: same endpoint, bucket, prefix, keys, passphrase, conflict strategy and triggers.
3. Sync. The first sync downloads the vault.
4. Install the other plugins on the phone too (they are not synced, see below): **Full Calendar Remastered** (log in to Google once), and **Task Calendar Sync** by copying its folder (doc 04). Leave `pull` and `createEvents` off on the phone.
5. Enable the `wide-boards` CSS snippet if you copied the `.obsidian` files.

## 5.5 Gotchas

- **The keychain is per vault and per device.** Obsidian's secret storage (`app.secretStorage`) holds the R2 secret, the encryption passphrase and Full Calendar's Google login. A new vault or a new device needs its own entries (or a deliberate copy).
- **`.obsidian` is not synced by default.** Plugins, plugin settings, CSS snippets and `types.json` must be set up on each device. This also keeps per-device `data.json` files (e.g. the one-writer settings) apart. You can add a sync rule for parts of `.obsidian` if your Sync Engine version supports it; then make sure Task Calendar Sync's `data.json` is **not** shared.
- **Sync Engine modules are registered in IndexedDB, not in files.** Copying the plugin folder to a new device is not enough; install the modules through *Module management* on each device.
- **Android only syncs while Obsidian is open.** There is no background sync on the phone. Open Obsidian, wait for the sync to finish, then edit.
- **Custom plugins are not in the store.** Install Task Calendar Sync by copying its folder (adb or a file manager).

## 5.6 What "in sync" means in practice

| Change made on | Reaches the other devices |
|---|---|
| Desktop, note | Uploaded on save; the phone downloads it the next time Obsidian on the phone is opened or focused (or at the 5-minute timer while open). |
| Phone, note | Uploaded while Obsidian is open on the phone; the desktop gets it on focus or within 5 minutes. |
| Phone, a linked date | Sent to Google directly by Task Calendar Sync on the phone (if Full Calendar is logged in there), and the note syncs via R2. |
| Any calendar client, a linked date | Google immediately; the note only after the desktop (with `pull` on) has polled (up to `pollMinutes`) and Sync Engine has carried the note to the other devices. |

If the same note is changed on two devices before either has synced, *keep both* leaves two versions for you to merge by hand.
