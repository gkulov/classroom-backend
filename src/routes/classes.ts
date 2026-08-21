import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { classes, subjects, user } from "../db/schema/index.js";

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, teacherId, subjectId, capacity, description, status, bannerUrl, bannerCldPubId } = req.body;

    const [createdClass] = await db
      .insert(classes)
      .values({ ...req.body, inviteCode: Math.random().toString(36).substring(2, 9), schedules: []})
      .returning({ id: classes.id });

    if (!createdClass) throw Error;

    res.status(201).json({ data: createdClass });
  } catch (error) {
    console.error("POST /classes error:", error);
    res.status(500).json({ error: "Failed to create class" });
  }
})


// Get all subjects with optional search, filtering and pagination
router.get("/", async (req, res) => {
  try {
    const { search, teacher, subject, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100); // Max 100 records per page

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    // If search query exists, filter by class name OR class code
    if (search) {
      filterConditions.push(
        or(
          ilike(classes.name, `%${search}%`),
          ilike(classes.inviteCode, `%${search}%`),
        )
      );
    }

    // If subject filter exists, match department name
    if (subject) {
      const subjectPattern = `%${String(subject).replace(/[%_]/g, '\\$&')}%`;
      filterConditions.push(ilike(subjects.name, subjectPattern));

    }


    // If teacher filter exists, match department name
    if (teacher) {
      const teacherPattern = `%${String(teacher).replace(/[%_]/g, '\\$&')}%`;
      filterConditions.push(ilike(user.name, teacherPattern));

    }



    // Combine all filter using AND if any exists
    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const classesList = await db
      .select({
        ...getTableColumns(classes),
        subject: { ...getTableColumns(subjects) },
        teacher: { ...getTableColumns(user) }
      })
      .from(classes)
      .leftJoin(subjects, eq(classes.subjectId, subjects.id))
      .leftJoin(user, eq(classes.teacherId, user.id))
      .where(whereClause)
      .orderBy(desc(classes.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: classesList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      }
    })

  } catch (e) {
    console.error(`GET /classes/::id/users error: ${e}`);
    res.status(500).json({ error: 'Failed to fetch class users' });
  }
})




export default router;
