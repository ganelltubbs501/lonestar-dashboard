console.log(">>> RUNNING prisma/seed.ts <<<");

import bcrypt from "bcryptjs";
import {
  PrismaClient,
  Role,
  WorkItemType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim() || "you@gmail.com";

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const staffEmails =
    allowed.length > 0
      ? allowed.filter((e) => e !== adminEmail)
      : [];

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const staffPassword = process.env.SEED_STAFF_PASSWORD;

  if (!adminPassword || !staffPassword) {
    console.error(`
╔════════════════════════════════════════════════════════════════════════╗
║              MISSING REQUIRED SEED ENVIRONMENT VARIABLES               ║
╚════════════════════════════════════════════════════════════════════════╝

Please set the following environment variables before running seed:

  SEED_ADMIN_PASSWORD   - Password for admin user (min 8 characters)
  SEED_STAFF_PASSWORD   - Password for staff users (min 8 characters)

Example:
  SEED_ADMIN_PASSWORD="YourSecureAdminPass123" SEED_STAFF_PASSWORD="YourSecureStaffPass123" npx prisma db seed

This ensures no default passwords are used in any environment.
`);
    process.exit(1);
  }

  if (adminPassword.length < 8 || staffPassword.length < 8) {
    console.error("Error: Seed passwords must be at least 8 characters long.");
    process.exit(1);
  }

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const staffHash = await bcrypt.hash(staffPassword, 10);

  // Clear demo users if they exist (ops.com) — must delete dependents first
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@ops.com" } },
    select: { id: true },
  });

  const demoUserIds = demoUsers.map((u) => u.id);

  if (demoUserIds.length) {
    await prisma.$transaction([
      prisma.comment.deleteMany({ where: { userId: { in: demoUserIds } } }),
      prisma.auditLog.deleteMany({ where: { userId: { in: demoUserIds } } }),
      prisma.subtask.deleteMany({ where: { assigneeUserId: { in: demoUserIds } } }),
      prisma.workItem.deleteMany({ where: { requesterId: { in: demoUserIds } } }),
      prisma.workItem.updateMany({
        where: { ownerId: { in: demoUserIds } },
        data: { ownerId: null },
      }),
      prisma.user.deleteMany({ where: { id: { in: demoUserIds } } }),
    ]);
  }

  // Create/Upsert Admin
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.ADMIN, passwordHash: adminHash },
    create: { email: adminEmail, name: "Admin", role: Role.ADMIN, passwordHash: adminHash },
  });

  // Create/Upsert Staff
  for (const email of staffEmails) {
    await prisma.user.upsert({
      where: { email },
      update: { role: Role.STAFF, passwordHash: staffHash },
      create: { email, name: email.split("@")[0], role: Role.STAFF, passwordHash: staffHash },
    });
  }

  console.log("Seeded users:", [adminEmail, ...staffEmails]);

  // ----- SEED TRIGGER TEMPLATES -----
  const templates = [
    {
      name: "Book Campaign Default",
      workItemType: WorkItemType.BOOK_CAMPAIGN,
      description: "Standard book campaign workflow",
      dueDaysOffset: 30,
      subtasks: [
        { title: "Receive book materials from author/publisher" },
        { title: "Create campaign folder in Drive" },
        { title: "Design social graphics (carousel + stories)" },
        { title: "Write social copy" },
        { title: "Schedule posts" },
        { title: "Send folder to reviewers" },
        { title: "Follow up on reviews" },
        { title: "Campaign wrap-up and metrics" },
      ],
    },
    {
      name: "Social Asset Request Default",
      workItemType: WorkItemType.SOCIAL_ASSET_REQUEST,
      description: "Request for social media graphics",
      dueDaysOffset: 7,
      subtasks: [
        { title: "Gather brand assets and copy" },
        { title: "Design graphics" },
        { title: "Get approval" },
        { title: "Deliver final files" },
      ],
    },
    {
      name: "Sponsored Editorial Review Default",
      workItemType: WorkItemType.SPONSORED_EDITORIAL_REVIEW,
      description: "Process a paid editorial review",
      dueDaysOffset: 30,
      subtasks: [
        { title: "Log book receipt" },
        { title: "Assign to reviewer" },
        { title: "Review completed" },
        { title: "Edit and format review" },
        { title: "Publish review" },
        { title: "Notify author/publisher" },
      ],
    },
    {
      name: "TX Book Preview Lead Default",
      workItemType: WorkItemType.TX_BOOK_PREVIEW_LEAD,
      description: "Texas Book Preview lead processing",
      dueDaysOffset: 14,
      subtasks: [
        { title: "Verify contact info" },
        { title: "Send preview PDF" },
        { title: "Add to newsletter" },
        { title: "Follow up" },
      ],
    },
    {
      name: "Website Event Default",
      workItemType: WorkItemType.WEBSITE_EVENT,
      description: "Add event to website calendar",
      dueDaysOffset: 3,
      subtasks: [
        { title: "Verify event details" },
        { title: "Create event post" },
        { title: "Add to calendar" },
        { title: "Promote on social" },
      ],
    },
    {
      name: "Access Request Default",
      workItemType: WorkItemType.ACCESS_REQUEST,
      description: "System access or login request",
      dueDaysOffset: 2,
      subtasks: [
        { title: "Verify requester identity" },
        { title: "Create/update account" },
        { title: "Send credentials" },
        { title: "Confirm access" },
      ],
    },
    {
      name: "General / Magazine Item Default",
      workItemType: WorkItemType.GENERAL,
      description: "General task or magazine content item",
      dueDaysOffset: 7,
      subtasks: [
        { title: "Confirm section placement" },
        { title: "Collect content / assets from contributor" },
        { title: "Edit and format" },
        { title: "Proof and QC" },
        { title: "Add to magazine layout" },
        { title: "Final sign-off" },
      ],
    },
  ];

  for (const tpl of templates) {
    await prisma.triggerTemplate.upsert({
      where: { id: tpl.workItemType + "_default" },
      update: {
        name: tpl.name,
        description: tpl.description,
        subtasks: tpl.subtasks,
        dueDaysOffset: tpl.dueDaysOffset,
        isActive: true,
      },
      create: {
        id: tpl.workItemType + "_default",
        name: tpl.name,
        workItemType: tpl.workItemType,
        description: tpl.description,
        subtasks: tpl.subtasks,
        dueDaysOffset: tpl.dueDaysOffset,
        isActive: true,
      },
    });
  }

  console.log("Seeded trigger templates");

  // ----- CLEAN UP DEMO / SEED DATA -----
  // If DEMO_MODE=true, wipe any previously seeded fake work items
  const demoMode = process.env.DEMO_MODE === "true" || process.env.SEED_DEMO === "true";
  if (demoMode) {
    console.log("Demo mode: clearing all work items…");
    await prisma.comment.deleteMany({});
    await prisma.subtask.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.qCCheck.deleteMany({});
    await prisma.workItem.deleteMany({});
    console.log("Work items cleared.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
