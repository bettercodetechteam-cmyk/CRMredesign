import "./server/env-setup.ts";
import { formatFirebasePrivateKey } from "./server/firebasePrivateKey.ts";
import admin from "firebase-admin";
import { writeFileSync } from "fs";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
if (projectId !== "syllabus-tracker-6d5ff") {
  writeFileSync("tmp-plan-shape.txt", "wrong project " + projectId);
  process.exit(1);
}
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formatFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}
const db = admin.firestore();
const out = { students: [], syllabi: [], versions: [], faculty: [], plans: [] };

const students = await db.collection("students").get();
students.docs.forEach((doc) => {
  const d = doc.data();
  out.students.push({
    id: doc.id,
    name: `${d.firstName || ""} ${d.lastName || ""}`.trim(),
    course: d.course || "",
    centreId: d.centreId || "",
    email: d.email || "",
  });
});

const syllabi = await db.collection("syllabi").get();
for (const doc of syllabi.docs) {
  const d = doc.data();
  out.syllabi.push({
    id: doc.id,
    courseName: d.courseName || "",
    status: d.status || "",
    currentVersion: d.currentVersion ?? null,
    centreId: d.centreId || "",
  });
}

const versions = await db.collection("syllabusVersions").get();
versions.docs.forEach((doc) => {
  const d = doc.data();
  const modules = Array.isArray(d.modules) ? d.modules : [];
  out.versions.push({
    id: doc.id,
    syllabusId: d.syllabusId || "",
    version: d.version ?? null,
    status: d.status || "",
    courseName: d.courseName || "",
    moduleCount: modules.length,
    topicCount: modules.reduce((n, m) => n + (Array.isArray(m.topics) ? m.topics.length : 0), 0),
    topics: modules.flatMap((m) =>
      (m.topics || []).map((t) => ({ moduleId: m.id, topicId: t.id, title: t.title, moduleTitle: m.title }))
    ),
  });
});

const users = await db.collection("users").get();
users.docs.forEach((doc) => {
  const d = doc.data();
  if (d.role === "faculty") {
    out.faculty.push({
      uid: doc.id,
      name: `${d.firstName || ""} ${d.lastName || ""}`.trim(),
      email: d.email || "",
      approved: d.approved === true,
      centreId: d.centreId || "",
    });
  }
});

const plans = await db.collection("batchPlans").get();
plans.docs.forEach((doc) => {
  const d = doc.data();
  out.plans.push({ id: doc.id, courseName: d.courseName, facultyUid: d.facultyUid, startDate: d.startDate, target: d.targetCompletionDate });
});

writeFileSync("tmp-plan-shape.txt", JSON.stringify(out, null, 2));
process.exit(0);
