import { prisma } from "./src/config/db.js";

async function verify() {
  const users = await prisma.user.count();
  const students = await prisma.user.count({ where: { role: "STUDENT" } });
  const companies = await prisma.company.count();
  const drives = await prisma.placementDrive.count();
  const attempts = await prisma.assessmentAttempt.count();
  const interviews = await prisma.mockInterview.count();

  console.log("\n📊 DATABASE SUMMARY FOR SHOWCASE:");
  console.log("--------------------------------");
  console.log(`👥 Total Users: ${users}`);
  console.log(`🎓 Total Students: ${students}`);
  console.log(`🏢 Total Companies: ${companies}`);
  console.log(`🚗 Placement Drives: ${drives}`);
  console.log(`📈 History Points (Graph Data): ${attempts}`);
  console.log(`🤖 AI Interviews (Ready to View): ${interviews}`);
  
  console.log("\n📋 Sample Credentials:");
  console.log("- PO: po@iipe.edu.in / password123");
  console.log("- Top Student: rahul.sharma@example.com / password123");
  console.log("- TCS HR: hr@tcs.com / password123");
}

verify().finally(() => prisma.$disconnect());
