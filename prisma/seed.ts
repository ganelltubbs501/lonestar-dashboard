console.log(">>> RUNNING prisma/seed.ts <<<");

import bcrypt from "bcryptjs";
import {
  PrismaClient,
  Role,
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
  DeliverableType,
} from "@prisma/client";

const prisma = new PrismaClient();

// Helper to get a random date in the future or past
function randomDate(daysFromNow: number, variance: number = 5): Date {
  const days = daysFromNow + Math.floor(Math.random() * variance * 2) - variance;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// Helper to pick random item from array
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim() || "you@gmail.com";

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const staffEmails =
    allowed.length > 0
      ? allowed.filter((e) => e !== adminEmail)
      : ["person2@gmail.com", "person3@gmail.com", "person4@gmail.com", "person5@gmail.com", "person6@gmail.com", "person7@gmail.com"];

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

const demoUserIds = demoUsers.map(u => u.id);

if (demoUserIds.length) {
  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { userId: { in: demoUserIds } } }),
    prisma.auditLog.deleteMany({ where: { userId: { in: demoUserIds } } }),
    prisma.subtask.deleteMany({ where: { assigneeId: { in: demoUserIds } } }),

    // WorkItem relations: requesterId is NOT nullable, so delete those items
    prisma.workItem.deleteMany({ where: { requesterId: { in: demoUserIds } } }),

    // If ownerId exists and is nullable, you can either delete or null them out:
    prisma.workItem.updateMany({
      where: { ownerId: { in: demoUserIds } },
      data: { ownerId: null },
    }),

    prisma.user.deleteMany({ where: { id: { in: demoUserIds } } }),
  ]);
}


  // Create/Upsert Admin
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: Role.ADMIN,
      passwordHash: adminHash,
    },
    create: {
      email: adminEmail,
      name: "Admin",
      role: Role.ADMIN,
      passwordHash: adminHash,
    },
  });

  // Create/Upsert Staff
  const staffUsers: { id: string; email: string; name: string | null }[] = [];
  for (const email of staffEmails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: Role.STAFF,
        passwordHash: staffHash,
      },
      create: {
        email,
        name: email.split("@")[0],
        role: Role.STAFF,
        passwordHash: staffHash,
      },
    });
    staffUsers.push(user);
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
  ];

  for (const tpl of templates) {
    await prisma.triggerTemplate.upsert({
      where: {
        id: tpl.workItemType + "_default", // Use a predictable ID
      },
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

  // ----- SEED WORK ITEMS (25 items) -----
  const allUsers = [admin, ...staffUsers];

  const workItemsData = [
    // BOOK_CAMPAIGN items (5)
    {
      type: WorkItemType.BOOK_CAMPAIGN,
      title: "Spring Release: The Hidden Garden",
      description: "Full marketing campaign for Sarah Mitchell's new novel. Launch date April 15th.",
      status: WorkItemStatus.IN_PROGRESS,
      priority: WorkItemPriority.HIGH,
      dueAt: randomDate(20),
      deliverableType: DeliverableType.CAMPAIGN,
      subtasks: ["Create campaign folder", "Design social graphics", "Write social copy", "Schedule posts", "Send to reviewers"],
    },
    {
      type: WorkItemType.BOOK_CAMPAIGN,
      title: "Summer Reading: Beach Reads Collection",
      description: "Bundle campaign featuring 5 summer-themed titles.",
      status: WorkItemStatus.READY,
      priority: WorkItemPriority.MEDIUM,
      dueAt: randomDate(45),
      deliverableType: DeliverableType.CAMPAIGN,
      subtasks: ["Compile book list", "Create bundle graphics", "Partner outreach", "Social campaign"],
    },
    {
      type: WorkItemType.BOOK_CAMPAIGN,
      title: "Mystery Month: Detective Series Promo",
      description: "Monthly mystery genre spotlight campaign.",
      status: WorkItemStatus.BACKLOG,
      priority: WorkItemPriority.LOW,
      dueAt: randomDate(60),
      deliverableType: DeliverableType.CAMPAIGN,
      subtasks: ["Select featured titles", "Author interviews", "Create graphics", "Newsletter feature"],
    },
    {
      type: WorkItemType.BOOK_CAMPAIGN,
      title: "Award Winner: National Book Prize Campaign",
      description: "Urgent campaign for newly announced award winner.",
      status: WorkItemStatus.IN_PROGRESS,
      priority: WorkItemPriority.URGENT,
      dueAt: randomDate(5),
      deliverableType: DeliverableType.CAMPAIGN,
      subtasks: ["Update all materials with award badge", "Press release", "Social announcement", "Retailer notification"],
    },
    {
      type: WorkItemType.BOOK_CAMPAIGN,
      title: "Holiday Gift Guide Campaign",
      description: "End of year gift guide featuring curated book selections.",
      status: WorkItemStatus.DONE,
      priority: WorkItemPriority.HIGH,
      dueAt: randomDate(-30),
      deliverableType: DeliverableType.CAMPAIGN,
      subtasks: ["Curate gift categories", "Create guide layout", "Influencer partnerships", "Paid promotion"],
    },

    // SOCIAL_ASSET_REQUEST items (4)
    {
      type: WorkItemType.SOCIAL_ASSET_REQUEST,
      title: "Instagram Carousel: New Releases March",
      description: "10-slide carousel showcasing March new releases.",
      status: WorkItemStatus.IN_REVIEW,
      priority: WorkItemPriority.MEDIUM,
      dueAt: randomDate(3),
      subtasks: ["Gather cover images", "Design carousel", "Write captions", "Schedule post"],
    },
    {
      type: WorkItemType.SOCIAL_ASSET_REQUEST,
      title: "Author Quote Graphics",
      description: "Series of quote graphics for Texas author spotlight.",
      status: WorkItemStatus.READY,
      priority: WorkItemPriority.LOW,
      dueAt: randomDate(10),
      subtasks: ["Collect quotes", "Design templates", "Create 5 graphics"],
    },
    {
      type: WorkItemType.SOCIAL_ASSET_REQUEST,
      title: "Event Announcement: Book Festival",
      description: "Social graphics for upcoming book festival booth.",
      status: WorkItemStatus.BLOCKED,
      priority: WorkItemPriority.HIGH,
      dueAt: randomDate(7),
      blockedReason: "Waiting for final booth number from event organizers",
      subtasks: ["Get event details", "Design announcement", "Create story templates"],
    },
    {
      type: WorkItemType.SOCIAL_ASSET_REQUEST,
      title: "TikTok Video Templates",
      description: "Branded templates for book review TikToks.",
      status: WorkItemStatus.DONE,
      priority: WorkItemPriority.MEDIUM,
      dueAt: randomDate(-15),
      subtasks: ["Research trends", "Create templates", "Test with sample content"],
    },

    // SPONSORED_EDITORIAL_REVIEW items (4)
    {
      type: WorkItemType.SPONSORED_EDITORIAL_REVIEW,
      title: "SER: The Last Lighthouse by James Cooper",
      description: "Sponsored review for literary fiction title. Book received 2/15.",
      status: WorkItemStatus.IN_PROGRESS,
      priority: WorkItemPriority.MEDIUM,
      dueAt: randomDate(25),
      deliverableType: DeliverableType.SER,
      needsProofing: true,
      subtasks: ["Assign reviewer", "Review in progress", "Edit review", "Author approval", "Publish"],
    },
    {
      type: WorkItemType.SPONSORED_EDITORIAL_REVIEW,
      title: "SER: Texas Wildflowers Photo Book",
      description: "Coffee table book review for regional publisher.",
      status: WorkItemStatus.NEEDS_QA,
      priority: WorkItemPriority.HIGH,
      dueAt: randomDate(10),
      deliverableType: DeliverableType.SER,
      needsProofing: true,
      subtasks: ["Review complete", "Edit review", "QA check", "Publish"],
    },
    {
      type: WorkItemType.SPONSORED_EDITORIAL_REVIEW,
      title: "SER: Cooking with Grandma",
      description: "Family cookbook sponsored review.",
      status: WorkItemStatus.READY,
      priority: WorkItemPriority.LOW,
      dueAt: randomDate(35),
      deliverableType: DeliverableType.SER,
      subtasks: ["Receive book", "Assign reviewer", "Review", "Edit", "Publish"],
    },
    {
      type: WorkItemType.SPONSORED_EDITORIAL_REVIEW,
      title: "SER: Startup Stories",
      description: "Business book review - author requested expedited timeline.",
      status: WorkItemStatus.IN_PROGRESS,
      priority: WorkItemPriority.URGENT,
      dueAt: randomDate(5),
      deliverableType: DeliverableType.SER,
      needsProofing: true,
      subtasks: ["Rush review assignment", "Express editing", "Publish ASAP"],
    },

    // TX_BOOK_PREVIEW_LEAD items (4)
    {
      type: WorkItemType.TX_BOOK_PREVIEW_LEAD,
      title: "TBP Lead: Maria Santos - Historical Fiction",
      description: "Author interested in Texas Book Preview feature for upcoming release.",
      status: WorkItemStatus.READY,
      priority: WorkItemPriority.MEDIUM,
      dueAt: randomDate(7),
      deliverableType: DeliverableType.TBP,
      subtasks: ["Verify contact", "Send info packet", "Follow up call", "Confirm participation"],
    },
    {
      type: WorkItemType.TX_BOOK_PREVIEW_LEAD,
      title: "TBP Lead: Austin Press - Multiple Titles",
      description: "Publisher inquiry for featuring 3 titles in TBP.",
      status: WorkItemStatus.IN_PROGRESS,
      priority: WorkItemPriority.HIGH,
      dueAt: randomDate(14),
      deliverableType: DeliverableType.TBP,
      subtasks: ["Review submission", "Negotiate package", "Collect materials", "Schedule features"],
    },
    {
      type: WorkItemType.TX_BOOK_PREVIEW_LEAD,
      title: "TBP Lead: John Williams - Self-Published",
      description: "Self-published author from Houston interested in TBP.",
      status: WorkItemStatus.BLOCKED,
      priority: WorkItemPriority.LOW,
      dueAt: randomDate(21),
      deliverableType: DeliverableType.TBP,
      blockedReason: "Waiting for author to send updated manuscript",
      subtasks: ["Initial contact made", "Awaiting materials", "Review and respond"],
    },
    {
      type: WorkItemType.TX_BOOK_PREVIEW_LEAD,
      title: "TBP Lead: GHL Import - New Contact",
      description: "Auto-created from Go High Level webhook.",
      status: WorkItemStatus.BACKLOG,
      priority: WorkItemPriority.LOW,
      dueAt: randomDate(30),
      deliverableType: DeliverableType.TBP,
      tags: ["GHL", "Auto-Created"],
      subtasks: ["Verify contact", "Send preview PDF", "Add to newsletter", "Follow up"],
    },

    // WEBSITE_EVENT items (4)
    {
      type: WorkItemType.WEBSITE_EVENT,
      title: "Event: Author Signing at BookPeople",
      description: "Add signing event to website calendar.",
      status: WorkItemStatus.DONE,
      priority: WorkItemPriority.MEDIUM,
      dueAt: randomDate(-5),
      deliverableType: DeliverableType.EVENTS,
      subtasks: ["Get event details", "Create listing", "Publish", "Social promotion"],
    },
    {
      type: WorkItemType.WEBSITE_EVENT,
      title: "Event: Virtual Book Club Meeting",
      description: "Monthly virtual book club - April session.",
      status: WorkItemStatus.READY,
      priority: WorkItemPriority.LOW,
      dueAt: randomDate(12),
      deliverableType: DeliverableType.EVENTS,
      subtasks: ["Confirm book selection", "Create Zoom link", "Post event", "Send reminders"],
    },
    {
      type: WorkItemType.WEBSITE_EVENT,
      title: "Event: Texas Book Festival Panel",
      description: "Add festival panel information.",
      status: WorkItemStatus.IN_PROGRESS,
      priority: WorkItemPriority.HIGH,
      dueAt: randomDate(8),
      deliverableType: DeliverableType.EVENTS,
      subtasks: ["Get panel details", "Confirm speakers", "Create event page", "Coordinate with festival"],
    },
    {
      type: WorkItemType.WEBSITE_EVENT,
      title: "Event: Weekend Author Workshop",
      description: "Writing workshop event submission.",
      status: WorkItemStatus.IN_REVIEW,
      priority: WorkItemPriority.MEDIUM,
      dueAt: randomDate(5),
      deliverableType: DeliverableType.EVENTS,
      subtasks: ["Review submission", "Edit details", "Publish event"],
    },

    // ACCESS_REQUEST items (2)
    {
      type: WorkItemType.ACCESS_REQUEST,
      title: "Access: New Marketing Intern",
      description: "Set up system access for summer intern starting next week.",
      status: WorkItemStatus.READY,
      priority: WorkItemPriority.MEDIUM,
      dueAt: randomDate(4),
      subtasks: ["Create account", "Set permissions", "Send welcome email", "Schedule training"],
    },
    {
      type: WorkItemType.ACCESS_REQUEST,
      title: "Access: Password Reset - Jane Editor",
      description: "Staff member locked out of account.",
      status: WorkItemStatus.DONE,
      priority: WorkItemPriority.URGENT,
      dueAt: randomDate(-1),
      subtasks: ["Verify identity", "Reset password", "Confirm access"],
    },

    // GENERAL items (2)
    {
      type: WorkItemType.GENERAL,
      title: "Q2 Marketing Report",
      description: "Compile quarterly marketing metrics and analysis.",
      status: WorkItemStatus.IN_PROGRESS,
      priority: WorkItemPriority.MEDIUM,
      dueAt: randomDate(15),
      subtasks: ["Gather metrics", "Create charts", "Write analysis", "Review with team"],
    },
    {
      type: WorkItemType.GENERAL,
      title: "Website Maintenance Window",
      description: "Scheduled downtime for website updates.",
      status: WorkItemStatus.BACKLOG,
      priority: WorkItemPriority.LOW,
      dueAt: randomDate(30),
      subtasks: ["Plan update scope", "Notify users", "Execute updates", "Verify functionality"],
    },
  ];

  // Check if demo mode - clear existing work items to start fresh
  const demoMode = process.env.DEMO_MODE === "true" || process.env.SEED_DEMO === "true";
  if (demoMode) {
    console.log("Demo mode: Clearing existing work items...");
    await prisma.comment.deleteMany({});
    await prisma.subtask.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.qCCheck.deleteMany({});
    await prisma.workItem.deleteMany({});
  }

  // Create work items
  for (const itemData of workItemsData) {
    const requester = pick(allUsers);
    const owner = Math.random() > 0.2 ? pick(allUsers) : null; // 80% have owner

    const workItem = await prisma.workItem.create({
      data: {
        type: itemData.type,
        title: itemData.title,
        description: itemData.description,
        status: itemData.status,
        priority: itemData.priority,
        dueAt: itemData.dueAt,
        blockedReason: itemData.blockedReason || null,
        tags: itemData.tags || [],
        deliverableType: itemData.deliverableType || null,
        needsProofing: itemData.needsProofing || false,
        requesterId: requester.id,
        ownerId: owner?.id || null,
      },
    });

    // Create subtasks
    if (itemData.subtasks) {
      await prisma.subtask.createMany({
        data: itemData.subtasks.map((title, index) => ({
          workItemId: workItem.id,
          title,
          order: index,
          completedAt: itemData.status === WorkItemStatus.DONE
            ? new Date()
            : Math.random() > 0.7 ? new Date() : null, // 30% random completion
        })),
      });
    }

    // Add a sample comment for some items
    if (Math.random() > 0.5) {
      await prisma.comment.create({
        data: {
          workItemId: workItem.id,
          userId: pick(allUsers).id,
          body: pick([
            "Making good progress on this.",
            "Waiting for client response.",
            "Updated the status - ready for review.",
            "Added to this week's sprint.",
            "Need clarification on requirements.",
          ]),
        },
      });
    }
  }

  console.log(`Seeded ${workItemsData.length} work items with subtasks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
