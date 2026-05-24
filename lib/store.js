const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const COLLECTIONS = ["students", "teachers", "classes", "attendance", "fees", "exams"];

function seedData() {
  return {
    school: {
      name: "Bright Future Academy",
      academicYear: "2026-2027",
      term: "Term 1"
    },
    students: [
      { id: "stu-001", admissionNo: "BFA-1001", name: "Aarav Sharma", className: "Grade 8 - A", guardian: "Neha Sharma", phone: "9876543210", status: "Active" },
      { id: "stu-002", admissionNo: "BFA-1002", name: "Meera Iyer", className: "Grade 7 - B", guardian: "Ravi Iyer", phone: "9876543211", status: "Active" },
      { id: "stu-003", admissionNo: "BFA-1003", name: "Kabir Singh", className: "Grade 8 - A", guardian: "Pooja Singh", phone: "9876543212", status: "Active" }
    ],
    teachers: [
      { id: "tch-001", employeeNo: "T-014", name: "Anita Rao", subject: "Mathematics", phone: "9811000001", status: "Active" },
      { id: "tch-002", employeeNo: "T-021", name: "Vikram Das", subject: "Science", phone: "9811000002", status: "Active" }
    ],
    classes: [
      { id: "cls-001", name: "Grade 8 - A", teacher: "Anita Rao", room: "201", students: 2 },
      { id: "cls-002", name: "Grade 7 - B", teacher: "Vikram Das", room: "105", students: 1 }
    ],
    attendance: [
      { id: "att-001", student: "Aarav Sharma", className: "Grade 8 - A", date: "2026-05-22", status: "Present" },
      { id: "att-002", student: "Meera Iyer", className: "Grade 7 - B", date: "2026-05-22", status: "Absent" },
      { id: "att-003", student: "Kabir Singh", className: "Grade 8 - A", date: "2026-05-22", status: "Present" }
    ],
    fees: [
      { id: "fee-001", student: "Aarav Sharma", invoice: "INV-1001", amount: 18000, paid: 18000, dueDate: "2026-05-15", status: "Paid" },
      { id: "fee-002", student: "Meera Iyer", invoice: "INV-1002", amount: 18000, paid: 8000, dueDate: "2026-05-30", status: "Partial" },
      { id: "fee-003", student: "Kabir Singh", invoice: "INV-1003", amount: 18000, paid: 0, dueDate: "2026-05-30", status: "Pending" }
    ],
    exams: [
      { id: "exm-001", name: "Term 1 Mathematics", className: "Grade 8 - A", subject: "Mathematics", date: "2026-06-08", totalMarks: 100 },
      { id: "exm-002", name: "Term 1 Science", className: "Grade 7 - B", subject: "Science", date: "2026-06-10", totalMarks: 100 }
    ]
  };
}

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.ensureDatabase();
  }

  ensureDatabase() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.write(seedData());
    }
  }

  read() {
    return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
  }

  write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2) + "\n");
  }

  getBootstrap() {
    const data = this.read();
    return { ...data, dashboard: this.getDashboard(data) };
  }

  list(collection) {
    this.assertCollection(collection);
    return this.read()[collection];
  }

  create(collection, payload) {
    this.assertCollection(collection);
    this.validate(collection, payload);
    const data = this.read();
    const record = this.normalize(collection, {
      id: `${collection.slice(0, 3)}-${crypto.randomUUID().slice(0, 8)}`,
      ...payload
    });
    data[collection].unshift(record);
    this.write(data);
    return record;
  }

  update(collection, id, payload) {
    this.assertCollection(collection);
    const data = this.read();
    const position = data[collection].findIndex((entry) => entry.id === id);
    if (position === -1) return null;
    const record = this.normalize(collection, { ...data[collection][position], ...payload, id });
    this.validate(collection, record);
    data[collection][position] = record;
    this.write(data);
    return record;
  }

  remove(collection, id) {
    this.assertCollection(collection);
    const data = this.read();
    const position = data[collection].findIndex((entry) => entry.id === id);
    if (position === -1) return false;
    data[collection].splice(position, 1);
    this.write(data);
    return true;
  }

  getDashboard(input) {
    const data = input || this.read();
    const present = data.attendance.filter((item) => item.status === "Present").length;
    const totalAmount = data.fees.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalPaid = data.fees.reduce((sum, item) => sum + Number(item.paid || 0), 0);
    const upcomingExams = data.exams
      .filter((exam) => new Date(exam.date) >= new Date())
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      studentCount: data.students.length,
      teacherCount: data.teachers.length,
      classCount: data.classes.length,
      attendanceRate: data.attendance.length ? Math.round((present / data.attendance.length) * 100) : 0,
      outstandingFees: totalAmount - totalPaid,
      upcomingExams: upcomingExams.slice(0, 3)
    };
  }

  assertCollection(collection) {
    if (!COLLECTIONS.includes(collection)) {
      const error = new Error("Unknown resource.");
      error.status = 404;
      throw error;
    }
  }

  validate(collection, payload) {
    const required = {
      students: ["name", "admissionNo", "className"],
      teachers: ["name", "employeeNo", "subject"],
      classes: ["name", "teacher"],
      attendance: ["student", "className", "date", "status"],
      fees: ["student", "invoice", "amount", "dueDate"],
      exams: ["name", "className", "subject", "date"]
    };
    const missing = required[collection].filter((field) => payload[field] === undefined || payload[field] === "");
    if (missing.length) {
      const error = new Error(`Required fields: ${missing.join(", ")}.`);
      error.status = 400;
      throw error;
    }
  }

  normalize(collection, record) {
    if (collection === "fees") {
      record.amount = Number(record.amount);
      record.paid = Number(record.paid || 0);
      record.status = record.paid >= record.amount ? "Paid" : record.paid > 0 ? "Partial" : "Pending";
    }
    if (collection === "classes") record.students = Number(record.students || 0);
    if (collection === "exams") record.totalMarks = Number(record.totalMarks || 100);
    return record;
  }
}

module.exports = { Store, seedData, COLLECTIONS };
