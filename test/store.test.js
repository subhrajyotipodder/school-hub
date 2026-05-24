const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../lib/store");

function withStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "school-hub-"));
  return new Store(path.join(directory, "db.json"));
}

test("starts with seeded dashboard totals", () => {
  const store = withStore();
  const dashboard = store.getDashboard();

  assert.equal(dashboard.studentCount, 3);
  assert.equal(dashboard.teacherCount, 2);
  assert.equal(dashboard.outstandingFees, 28000);
});

test("creates students and updates dashboard counts", () => {
  const store = withStore();

  store.create("students", {
    name: "Diya Kapoor",
    admissionNo: "BFA-1004",
    className: "Grade 6 - A",
    status: "Active"
  });

  assert.equal(store.list("students").length, 4);
  assert.equal(store.getDashboard().studentCount, 4);
});

test("normalizes fee status when payment changes", () => {
  const store = withStore();
  const fee = store.create("fees", {
    student: "Diya Kapoor",
    invoice: "INV-1004",
    amount: 12000,
    paid: 6000,
    dueDate: "2026-06-01"
  });

  assert.equal(fee.status, "Partial");
  const paidFee = store.update("fees", fee.id, { paid: 12000 });
  assert.equal(paidFee.status, "Paid");
});

test("rejects missing required record data", () => {
  const store = withStore();

  assert.throws(() => store.create("students", { name: "Unnamed admission" }), /Required fields/);
});
