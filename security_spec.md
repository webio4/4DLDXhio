# Security Specification & Test-Driven Development (TDD) for DriveX Firestore

This document defines the security boundaries, data invariants, and malicious test payloads ("Dirty Dozen") designed to test the defensive strength of the Firestore Security Rules.

## 1. Data Invariants

1. **Identity Alignment**: A user can only write, replace, or update a document in `/leaderboard/{userId}` if the `{userId}` matches their verified `request.auth.uid`. Non-authenticated users can read leaderboards but cannot submit entries.
2. **Immutability of Key Fields**: Once created, `/leaderboard/{userId}` documents cannot have their `userId` or `createdAt` fields changed during updates.
3. **Room Ownership & Permissions**:
   - A `/rooms/{roomCode}` document can only be created by an authenticated user whose `request.auth.uid` matches the `hostId` field inside the payload.
   - Only the host (`hostId === request.auth.uid`) can edit structure parameters of the map like `customHillHeight`, `customDuneScale`, `customRippleFreq`, `customFloorLevel`, `customObstacleDensity`, and `trackTheme`.
   - Non-hosts can only update the `playersActive` array to include/update their own active heartbeat, and cannot touch map settings or change the `hostId`.
   - The size of the `playersActive` array must be strictly bounded (e.g., maximum 10 components) to prevent "Denial of Wallet" size-bombing attacks.
4. **ID Hardening**: All document keys must conform to strict ID format (`isValidId` check of size <= 128 characters, matching '^[a-zA-Z0-9_\-]+$') to prevent resource poisoning.
5. **Verified Users**: All standard write operations must enforce that the user holds a verified email: `request.auth.token.email_verified == true`.

---

## 2. The "Dirty Dozen" Malicious Payloads (Attack Scenarios)

### Attack 1: Identity Spoofing on Leaderboard Creation
* **Description**: Attacker tries to submit a highscore entry under another user's ID.
* **Target**: `setDoc` on `/leaderboard/attacker_user_123` with payload `{"userId": "victim_user_456", "nickname": "Noob", "stars": 1}`.
* **Expected Result**: `PERMISSION_DENIED` since document ID doesn't match authenticated user.

### Attack 2: Score Padding as Unauthenticated User
* **Description**: Guest user attempts to post scores to the leaderboard.
* **Target**: `setDoc` on `/leaderboard/ghost_user` without any auth credentials.
* **Expected Result**: `PERMISSION_DENIED` since `request.auth` is null.

### Attack 3: Modifying Someone Else's Highscore
* **Description**: Attacker attempts to update the stars/rank of a victim.
* **Target**: `updateDoc` on `/leaderboard/victim_user` by `attacker_user` to change `stars` to `99999`.
* **Expected Result**: `PERMISSION_DENIED` due to identity mismatch.

### Attack 4: Star Value Poisoning with Malicious Payload Types
* **Description**: Attacker tries to corrupt the database sorting by uploading stars as strings or booleans instead of integers, or excessively large numbers.
* **Target**: `setDoc` on `/leaderboard/attacker_user` with `"stars": "9999999"` (string) or `"stars": true` (boolean).
* **Expected Result**: `PERMISSION_DENIED` due to static validator schema mismatch.

### Attack 5: Room Creation with Spoofed Host Identity
* **Description**: Attacker attempts to create a lobby Room where the host identifier in the document is a victim's ID.
* **Target**: `setDoc` on `/rooms/ROOM12` with payload having `hostId: "victim_id"` while authenticated as `attacker_id`.
* **Expected Result**: `PERMISSION_DENIED` as host ID must match the request's auth ID.

### Attack 6: Room Settings Tampering by Guest Player
* **Description**: A guest player in the room tries to alter map terrain or theme settings of a lobby.
* **Target**: `updateDoc` on `/rooms/ROOM12` by non-host `guest_id` attempting to change `customHillHeight` to `50.0`.
* **Expected Result**: `PERMISSION_DENIED` since non-host players are only allowed to update `playersActive`.

### Attack 7: Host Impersonation during Room Modification
* **Description**: Attacker attempts to hijack ownership of an existing room.
* **Target**: `updateDoc` on `/rooms/ROOM12` attempting to edit the `hostId` value to `attacker_id`.
* **Expected Result**: `PERMISSION_DENIED` as `hostId` is immutable/non-transferable.

### Attack 8: Bounded List Bombing (Denial of Wallet)
* **Description**: Attacker tries to crash client memory or bloat document size by submitting a room heartbeat state containing 5,000 player entries.
* **Target**: `updateDoc` on `/rooms/ROOM12` with a `playersActive` list containing 100 fake items.
* **Expected Result**: `PERMISSION_DENIED` since list size of `playersActive` must be strictly bounded (e.g. `<= 12` items).

### Attack 9: Immutability Tampering of Original User Highscores
* **Description**: Attacker tries to rewrite the `createdAt` value to cheat timestamp rankings or change the user identity after creation.
* **Target**: `updateDoc` on `/leaderboard/attacker_user` with a altered `createdAt` value.
* **Expected Result**: `PERMISSION_DENIED` because `createdAt` is immutable.

### Attack 10: Injecting Malicious Document ID Strings (Path Poisoning)
* **Description**: An attacker tries to write to a room with a 2MB binary string as the document ID path to crash index storage.
* **Target**: `setDoc` on `/rooms/VERY_LONG_MALFORMED_GIBBERISH_STRING_OVER_128_CHARS`
* **Expected Result**: `PERMISSION_DENIED` due to `isValidId` string constraints.

### Attack 11: Email Spoofing Bypass Attempt
* **Description**: Attacker logs in with an unverified email address and tries to write to the leaderboards.
* **Target**: `setDoc` on `/leaderboard/unverified_user` with auth token having `email_verified: false`.
* **Expected Result**: `PERMISSION_DENIED` since `email_verified == true` is required.

### Attack 12: Blanket Reading Room Document Contents (Query Scraping)
* **Description**: Attempting to grab list results of room details without restricting where checks or matching user bounds.
* **Target**: `list` query on `/rooms` without proper filter limits or authentication.
* **Expected Result**: `PERMISSION_DENIED`.

---

## 3. Test Runner Definition (`firestore.rules.test.ts`)

This represents the unit test layout executed inside the emulator:

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

describe('DriveX Firestore Rules Tests', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'gen-lang-client-0571752419',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('Blocks Attack 1: Spoofed Leaderboard User ID', async () => {
    const context = testEnv.authenticatedContext('attacker_user', { email_verified: true });
    const db = context.firestore();
    const docRef = db.collection('leaderboard').doc('victim_user');
    await assertFails(docRef.set({
      userId: 'victim_user',
      nickname: 'V',
      avatar: '😊',
      stars: 10,
      diamonds: 2,
      outfit: 'racer',
      createdAt: Date.now()
    }));
  });

  it('Blocks Attack 4: Highschool value poisoning with boolean', async () => {
    const context = testEnv.authenticatedContext('attacker_user', { email_verified: true });
    const db = context.firestore();
    const docRef = db.collection('leaderboard').doc('attacker_user');
    await assertFails(docRef.set({
      userId: 'attacker_user',
      nickname: 'A',
      avatar: '😊',
      stars: true, // Poison value
      diamonds: 2,
      outfit: 'racer',
      createdAt: Date.now()
    }));
  });
});
```
