# Van Life
## Firebase & Google Services Reference
*Configuration, Limits & Operational Guide*

---

## 1. Services Overview

This app uses three Google/Firebase services. All run on the free Spark plan.

| Service | What It Does | Console Location |
|---|---|---|
| Firebase Authentication | Google Sign-In, user identity & session management | Build → Authentication |
| Cloud Firestore | NoSQL database storing all project & user data | Build → Firestore Database |
| Firebase Hosting | Serves index.html and static assets | Not used — GitHub Pages instead |

> **Note:** GitHub Pages handles hosting — Firebase Hosting is NOT enabled on this project. No cost, no configuration needed there.

---

## 2. Firebase Authentication

### Finding Signed-In Users

Go to: **Firebase Console → Build → Authentication → Users tab**

Every Google account that has signed in appears here. Columns include:

- Identifier (email)
- Providers (Google)
- Created date
- Last signed in
- **User UID** — matches the document ID in your Firestore `users/{uid}` collection

> **Tip:** Cross-reference Auth UID with Firestore `users/{uid}` to check approval status and project membership.

### Settings to Know

| Setting | Value / Location |
|---|---|
| Sign-in provider | Google — enabled under Authentication → Sign-in method |
| Authorised domains | `sryanc1.github.io` — under Authentication → Settings → Authorised domains |
| User deletion | Manual — Auth → Users → select user → Delete. Does **not** auto-delete Firestore doc. |
| Session persistence | Browser default (IndexedDB) — users stay logged in across tabs/refreshes |

> ⚠️ **Warning:** If you delete a user from Auth, manually delete their `users/{uid}` document in Firestore too, otherwise orphan data accumulates.

### Free Tier Limits

- Monthly active users: **10,000** — more than enough for a personal project
- No charge for Google OAuth sign-ins
- Phone auth is NOT used — avoid enabling it (costs apply beyond 10/day on Spark)

---

## 3. Cloud Firestore

### Data Structure

Four top-level collections:

| Collection / Path | Contents |
|---|---|
| `users/{uid}` | `name`, `email`, `photoURL`, `status` (pending\|approved), `isAdmin`, `projects[]` |
| `projects/{projectId}` | `name`, `ownerId`, `members: {uid: 'owner'\|'editor'}`, `createdAt` |
| `builds/{projectId}/data/main` | `budget`, `categories[]` — the full van build data for one project |
| `invites/{token}` | `projectId`, `targetEmail`, `inviterName`, `createdAt`, `expiresAt`, `used`, `usedBy`, `usedAt` |

### Free Tier Limits (Spark Plan)

| Metric | Free Limit | Reality Check |
|---|---|---|
| Reads / day | 50,000 | `onSnapshot` counts as 1 read then streams |
| Writes / day | 20,000 | `scheduleWrite` debounces — safe for normal use |
| Deletes / day | 20,000 | Counted in write quota |
| Storage | 1 GiB | Text data only — very unlikely to hit this |
| Network egress | 10 GiB / month | Safe unless you store large images in Firestore (don't) |

---

## 4. Firestore Security Rules

Your rules enforce multi-tenant isolation. Key rules in effect:

- `users/{uid}` — only the owning user can read/write their own doc
- `projects/{projectId}` — only members listed in the `members` map can read
- `builds/{projectId}/data/main` — only project members can read/write
- `invites/{token}` — authenticated users can create; token owner validated server-side in `acceptInvite()`

> ⚠️ **Warning:** Periodically review your rules in Firestore → Rules. Firebase provides a **Rules Playground** to test scenarios without deploying.

- **Rules location:** Firebase Console → Build → Firestore Database → Rules tab
- **Test endpoint:** Firebase Console → Build → Firestore Database → Rules → Rules Playground

---

## 5. Quick Console Navigation

| Task | Console Path |
|---|---|
| See who has signed in | Build → Authentication → Users |
| Browse Firestore data | Build → Firestore Database → Data |
| Monitor usage / quota | Build → Firestore Database → Usage |
| Edit security rules | Build → Firestore Database → Rules |
| Check authorised domains | Build → Authentication → Settings → Authorised domains |
| Set billing alerts | Project Overview → ⚙ Settings → Usage and billing |
| Delete a user completely | Auth → Users (delete UID) **+** Firestore → `users/{uid}` (delete doc manually) |

---

## 6. Recommended Actions Before Going Public

Your app currently works for personal/invited use. Before sharing the link widely, work through this checklist.

### Security

- Review Firestore rules — ensure no collection is accidentally left open (`allow read, write: if true`)
- Verify the `invites/{token}` rule requires authentication — anonymous users should not be able to create invites
- Test the rules in the Rules Playground using a test UID that is **not** a project member — it should be denied
- Confirm your GitHub repository only exposes code, not secrets — API keys in `firebase.js` are public, but Firebase API keys are not secret by design; security comes from Firestore rules and Authentication

> ⚠️ **Note:** Firebase Web API keys in your source code are intentionally public — they identify the project, not grant admin access. Security is enforced by Firestore rules and Authentication, not by hiding the key.

### Invite Tokens

- Expired and used invite tokens accumulate in the `invites` collection forever — add a cleanup step or Cloud Function to delete tokens older than 7 days
- Consider adding a **Revoke invite** button to the manage project screen so owners can cancel a pending invite

### User Approval Flow

- The manual approval step (Admin panel) is a good gate, but ensure you check it regularly — users will be stuck on the pending screen until you approve them
- Consider adding an email notification to yourself when a new user registers (requires a Firebase Cloud Function or a simple webhook)

### Data Integrity

- If a project owner deletes their Google account without deleting the project first, the project becomes ownerless — consider adding an ownership transfer feature before going public
- The delete project function cascades member cleanup, but test it with a multi-member project before relying on it in production

### Usage Monitoring

- Set a budget alert in the Firebase console at **$1** — you are on the Spark (free) plan, but enabling billing alerts means you get an email before any accidental charge
- Bookmark Firestore → Usage tab and check it the first week after sharing — reads spike when new users load their projects for the first time
- If reads climb toward 30,000/day, investigate whether `onSnapshot` listeners are being left open when users switch projects (`stopListening()` should handle this)

### GitHub Pages

- Confirm your GitHub Pages source is set to the correct branch (usually `main` or `gh-pages`) under Repository → Settings → Pages
- There is no build step — any push to the source branch deploys immediately. Consider protecting the `main` branch with a simple review process if others will contribute
- GitHub Pages does not support server-side redirects — all routing is client-side via URL params, which is already how the invite system works

> ✅ **Priority:** At small scale (< 20 users, personal project), none of these are urgent. The most important ones are: test your Firestore rules, set a $1 billing alert, and handle expired invite cleanup.

---

## 7. GitHub Pages Configuration

| Setting | Value |
|---|---|
| Live URL | https://sryanc1.github.io/ |
| Must be in Auth authorised domains | Yes — `sryanc1.github.io` must be listed |
| Deploy trigger | Git push to source branch — no build step needed |
| HTTPS | Automatic — GitHub provides TLS, required for Google OAuth |

---

## 8. Who Is That User? — Quick Reference

Two-step process to identify and manage any user:

| Step | Where | What to Look For |
|---|---|---|
| 1 | Auth → Users | Email, sign-in date, UID. **Copy the UID.** |
| 2 | Firestore → `users/{uid}` | `status` (pending\|approved), `isAdmin` flag, `projects[]` array |

To change a user's status manually: open their Firestore doc and edit the `status` field from `pending` to `approved`, or toggle `isAdmin`.

---

*Van Life — Firebase Reference*
*sryanc1.github.io | Firebase Spark Plan | March 2026*