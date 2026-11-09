import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminServices } from "@/lib/firebase-admin";
import { deletePrivateFiles } from "@/lib/supabase-storage";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const { auth, db } = adminServices();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return { response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  const caller = await auth.verifyIdToken(token);
  const role = (await db.collection("users").doc(caller.uid).get()).data()?.role;
  if (role !== "admin") return { response: NextResponse.json({ error: "Administrators only." }, { status: 403 }) };
  return { auth, db, caller };
}

async function deleteDocuments(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  const unique = [...new Map(docs.map((item) => [item.ref.path, item])).values()];
  for (let index = 0; index < unique.length; index += 400) {
    const batch = unique[index].ref.firestore.batch();
    for (const item of unique.slice(index, index + 400)) batch.delete(item.ref);
    await batch.commit();
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdmin(request);
    if ("response" in access) return access.response;
    const { auth, db } = access;
    const users: Awaited<ReturnType<typeof auth.listUsers>>["users"] = [];
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      users.push(...page.users);
      pageToken = page.pageToken;
    } while (pageToken);

    const profiles = new Map<string, FirebaseFirestore.DocumentData>();
    for (let index = 0; index < users.length; index += 300) {
      const group = users.slice(index, index + 300);
      const snapshots = await db.getAll(...group.map((user) => db.collection("users").doc(user.uid)));
      snapshots.forEach((snapshot) => { if (snapshot.exists) profiles.set(snapshot.id, snapshot.data() ?? {}); });
    }

    const accounts = users.map((user) => ({
      uid: user.uid,
      email: user.email ?? "",
      name: user.displayName || String(profiles.get(user.uid)?.fullName ?? ""),
      role: String(profiles.get(user.uid)?.role ?? "unlinked"),
      createdAt: user.metadata.creationTime ?? "",
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[admin-accounts] list failed", error);
    return NextResponse.json({ error: "Could not load account records." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireAdmin(request);
    if ("response" in access) return access.response;
    const { auth, db, caller } = access;
    const body = await request.json().catch(() => null) as { uid?: string } | null;
    const uid = String(body?.uid ?? "");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
      return NextResponse.json({ error: "Choose a valid account." }, { status: 400 });
    }
    if (uid === caller.uid) return NextResponse.json({ error: "You cannot delete the account you are using." }, { status: 400 });

    const profileRef = db.collection("users").doc(uid);
    const [profileSnap, authUser] = await Promise.all([
      profileRef.get(),
      auth.getUser(uid).catch(() => null),
    ]);
    if (!profileSnap.exists && !authUser) return NextResponse.json({ error: "That account no longer exists." }, { status: 404 });
    if (profileSnap.data()?.role === "admin") {
      return NextResponse.json({ error: "Administrator accounts cannot be deleted from this screen." }, { status: 403 });
    }

    const [consumerJobSnap, workerJobSnap, workerSnap, credentialByUid, offerSnap, inquiryAsConsumer, inquiryAsWorker, conversationSnap, proRequestSnap, topupSnap, ledgerSnap, reviewAsConsumer] = await Promise.all([
      db.collection("jobs").where("consumerId", "==", uid).get(),
      db.collection("jobs").where("workerUid", "==", uid).get(),
      db.collection("workers").where("uid", "==", uid).get(),
      db.collection("workerCredentials").where("uid", "==", uid).get(),
      db.collection("offers").where("workerUid", "==", uid).get(),
      db.collection("inquiries").where("consumerId", "==", uid).get(),
      db.collection("inquiries").where("workerUid", "==", uid).get(),
      db.collection("conversations").where("participants", "array-contains", uid).get(),
      db.collection("proPaymentRequests").where("workerUid", "==", uid).get(),
      db.collection("topupRequests").where("workerUid", "==", uid).get(),
      db.collection("ledger").where("workerUid", "==", uid).get(),
      db.collection("reviews").where("consumerId", "==", uid).get(),
    ]);
    const jobsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const item of [...consumerJobSnap.docs, ...workerJobSnap.docs]) jobsById.set(item.id, item);
    const jobs = [...jobsById.values()];
    const unresolved = jobs.filter((item) => {
      const data = item.data();
      return ["requested", "accepted", "quoted", "in_progress", "disputed"].includes(String(data.status))
        || (data.status === "completed" && data.paymentProofPath && !data.paymentApprovedAt);
    });
    if (unresolved.length) {
      return NextResponse.json({ error: `Resolve or cancel the ${unresolved.length} active job${unresolved.length === 1 ? "" : "s"} before deleting this account.` }, { status: 409 });
    }

    const workerIds = workerSnap.docs.map((item) => item.id);
    const workerReviews = (await Promise.all(workerIds.map((workerId) => db.collection("reviews").where("workerId", "==", workerId).get()))).flatMap((snapshot) => snapshot.docs);
    const reviewsToDelete = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const item of [...reviewAsConsumer.docs, ...workerReviews]) reviewsToDelete.set(item.id, item);

    const jobProofPrefixes: string[] = [];
    for (const job of jobs) {
      const data = job.data();
      const scrub: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = { conversationId: FieldValue.delete() };
      if (data.consumerId === uid) {
        scrub.consumerId = `removed_${uid}`;
        scrub.consumerName = "Former member";
        scrub.consumerPhone = FieldValue.delete();
        scrub.consumerPhotoUrl = FieldValue.delete();
        scrub.reviewEmailOptIn = false;
        scrub.photoPath = FieldValue.delete();
        scrub.photoUrl = FieldValue.delete();
        scrub.paymentProofPath = FieldValue.delete();
        scrub.paymentReference = FieldValue.delete();
        scrub.paymentSubmittedAt = FieldValue.delete();
        jobProofPrefixes.push(`job-payment-proofs/${job.id}/${uid}`);
      }
      if (data.workerUid === uid) {
        scrub.workerUid = `removed_${uid}`;
        scrub.workerId = FieldValue.delete();
        scrub.workerName = "Former member";
        scrub.workerPhone = FieldValue.delete();
        scrub.workerPhotoUrl = FieldValue.delete();
      }
      await job.ref.update(scrub);
    }

    const allWorkerCredentialDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    credentialByUid.docs.forEach((item) => allWorkerCredentialDocs.set(item.id, item));
    const credentialByWorker = await Promise.all(workerIds.map((workerId) => db.collection("workerCredentials").doc(workerId).get()));
    credentialByWorker.forEach((item) => { if (item.exists) allWorkerCredentialDocs.set(item.id, item as FirebaseFirestore.QueryDocumentSnapshot); });

    const disputeConsumer = await db.collection("disputes").where("consumerId", "==", uid).get();
    const disputeWorker = await db.collection("disputes").where("workerUid", "==", uid).get();
    const disputeDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    [...disputeConsumer.docs, ...disputeWorker.docs].forEach((item) => disputeDocs.set(item.id, item));

    await Promise.all([
      deleteDocuments(offerSnap.docs),
      deleteDocuments([...inquiryAsConsumer.docs, ...inquiryAsWorker.docs]),
      deleteDocuments([...topupSnap.docs, ...ledgerSnap.docs, ...reviewsToDelete.values(), ...disputeDocs.values(), ...allWorkerCredentialDocs.values()]),
      deleteDocuments([...proRequestSnap.docs]),
      ...conversationSnap.docs.map((item) => db.recursiveDelete(item.ref)),
      ...workerSnap.docs.map((item) => db.recursiveDelete(item.ref)),
    ]);
    if (proRequestSnap.docs.length === 0) await db.collection("proPaymentRequests").doc(uid).delete().catch(() => undefined);

    // Keep the other party's completed-job history while removing the deleted
    // member's name, contact details, photos, and message threads.
    const affectedWorkers = new Set(reviewAsConsumer.docs.map((item) => String(item.data().workerId ?? "")).filter((id) => id && !workerIds.includes(id)));
    await Promise.all([...affectedWorkers].map(async (workerId) => {
      const workerRef = db.collection("workers").doc(workerId);
      const remaining = await db.collection("reviews").where("workerId", "==", workerId).get();
      const count = remaining.size;
      const rating = count ? remaining.docs.reduce((total, item) => total + Number(item.data().rating ?? 0), 0) / count : 0;
      await workerRef.update({ rating: Math.round(rating * 100) / 100, reviewCount: count }).catch(() => undefined);
    }));

    const storagePrefixes = [
      `profile-photos/${uid}`,
      `credentials/${uid}`,
      `pro-payment-receipts/${uid}`,
      `worker-portfolio/${uid}`,
      `job-requests/${uid}`,
      `topup-receipts/${uid}`,
      ...jobProofPrefixes,
    ];
    const uniqueStoragePrefixes = [...new Set(storagePrefixes)];
    let filesNotRemoved = false;
    try { await deletePrivateFiles(uniqueStoragePrefixes); }
    catch (error) { filesNotRemoved = true; console.error("[admin-accounts] private file cleanup failed", error); }

    await profileRef.delete().catch(() => undefined);
    if (authUser) await auth.deleteUser(uid);
    return NextResponse.json({ ok: true, storageCleanupIncomplete: filesNotRemoved });
  } catch (error) {
    console.error("[admin-accounts] deletion failed", error);
    return NextResponse.json({ error: "Could not delete this account. Refresh the account list and try again." }, { status: 500 });
  }
}
