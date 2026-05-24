const { Pool } = require("pg");
const crypto = require("node:crypto");

const COLLECTIONS = ["students", "teachers", "classes", "attendance", "fees", "exams"];

function seedData() {
  return {
    school: { name: "Bright Future Academy", academicYear: "2026-2027", term: "Term 1" },
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

class PgStore {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_NAME || "schooldb",
    });
    this._ready = this._init();
  }

  async _init() {
    const client = await this.pool.connect();
    try {
      // Create metadata table
      await client.query(`
        CREATE TABLE IF NOT EXISTS school_meta (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL
        )
      `);

      // Create a generic records table per collection
      for (const col of COLLECTIONS) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${col} (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL
          )
        `);
      }

      // Seed school meta
      const metaRes = await client.query(`SELECT key FROM school_meta WHERE key = 'school'`);
      if (metaRes.rowCount === 0) {
        const seed = seedData();
        await client.query(
          `INSERT INTO school_meta (key, value) VALUES ('school', $1)`,
          [JSON.stringify(seed.school)]
        );
        for (const col of COLLECTIONS) {
          for (const record of seed[col]) {
            await client.query(
              `INSERT INTO ${col} (id, data) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [record.id, JSON.stringify(record)]
            );
          }
        }
      }
    } finally {
      client.release();
    }
  }

  async ready() {
    return this._ready;
  }

  async getBootstrap() {
    await this._ready;
    const metaRes = await this.pool.query(`SELECT value FROM school_meta WHERE key = 'school'`);
    const school = metaRes.rows[0]?.value || {};
    const data = { school };
    for (const col of COLLECTIONS) {
      const res = await this.pool.query(`SELECT data FROM ${col} ORDER BY data->>'id'`);
      data[col] = res.rows.map(r => r.data);
    }
    return { ...data, dashboard: this.getDashboard(data) };
  }

  async list(collection) {
    this.assertCollection(collection);
    await this._ready;
    const res = await this.pool.query(`SELECT data FROM ${collection}`);
    return res.rows.map(r => r.data);
  }

  async create(collection, payload) {
    this.assertCollection(collection);
    this.validate(collection, payload);
    await this._ready;
    const record = this.normalize(collection, {
      id: `${collection.slice(0, 3)}-${crypto.randomUUID().slice(0, 8)}`,
      ...payload
    });
    await this.pool.query(
      `INSERT INTO ${collection} (id, data) VALUES ($1, $2)`,
      [record.id, JSON.stringify(record)]
    );
    return record;
  }

  async update(collection, id, payload) {
    this.assertCollection(collection);
    await this._ready;
    const existing = await this.pool.query(`SELECT data FROM ${collection} WHERE id = $1`, [id]);
    if (existing.rowCount === 0) return null;
    const record = this.normalize(collection, { ...existing.rows[0].data, ...payload, id });
    this.validate(collection, record);
    await this.pool.query(
      `UPDATE ${collection} SET data = $1 WHERE id = $2`,
      [JSON.stringify(record), id]
    );
    return record;
  }

  async remove(collection, id) {
    this.assertCollection(collection);
    await this._ready;
    const res = await this.pool.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
    return res.rowCount > 0;
  }

  getDashboard(data) {
    const present = (data.attendance || []).filter(i => i.status === "Present").length;
    const total = (data.attendance || []).length;
    const totalAmount = (data.fees || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalPaid = (data.fees || []).reduce((s, i) => s + Number(i.paid || 0), 0);
    const upcomingExams = (data.exams || [])
      .filter(e => new Date(e.date) >= new Date())
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      studentCount: (data.students || []).length,
      teacherCount: (data.teachers || []).length,
      classCount: (data.classes || []).length,
      attendanceRate: total ? Math.round((present / total) * 100) : 0,
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
    const missing = required[collection].filter(f => payload[f] === undefined || payload[f] === "");
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

  async close() {
    await this.pool.end();
  }
}

module.exports = { PgStore, seedData, COLLECTIONS };
