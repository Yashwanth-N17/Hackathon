import { prisma } from "../src/config/db.js";
import { hashPassword } from "../src/utils/hash.js";

async function main() {
  console.log("🚀 INITIALIZING MASTER SEED V2 (Branch-Aware & Dashboard-Rich)...");

  // 1. CLEAN DATABASE
  console.log("🧹 Clearing old data...");
  try {
    await prisma.interviewMessage.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.assessmentAttempt.deleteMany({});
    await prisma.mockInterview.deleteMany({});
    await prisma.inboundRequest.deleteMany({});
    await prisma.placementDrive.deleteMany({});
    await prisma.trainingTestResult.deleteMany({});
    await prisma.trainingModuleProgress.deleteMany({});
    await prisma.assessment.deleteMany({});
    await prisma.question.deleteMany({});
    await prisma.tag.deleteMany({});
    await prisma.studentProfile.deleteMany({});
    await prisma.user.deleteMany({ where: { role: { in: ["STUDENT", "COMPANY", "PLACEMENT", "FACULTY"] } } });
    await prisma.company.deleteMany({});
  } catch (err) { console.log("⚠️ Cleanup warning:", err.message); }

  const password = await hashPassword("password123");
  const collegeName = "IIPE - College of Engineering";

  // 2. STAKEHOLDERS
  const po = await prisma.user.create({
    data: { email: "po@iipe.edu.in", password, role: "PLACEMENT", fullName: "Dr. Rajesh K. Varma", collegeName }
  });

  const facultyCSE = await prisma.user.create({
    data: { email: "cse.faculty@iipe.edu.in", password, role: "FACULTY", fullName: "Prof. Amit Rao (CSE)", collegeName }
  });

  // 3. COMPANIES & LIVE JOBS
  const google = await prisma.company.create({ data: { name: "Google India", industry: "Product", website: "google.co.in", ctc: "45 LPA", tier: "Premium" } });
  const tcs = await prisma.company.create({ data: { name: "TCS", industry: "IT Services", website: "tcs.com", ctc: "12 LPA", tier: "Service" } });
  const bosch = await prisma.company.create({ data: { name: "Bosch", industry: "Hardware/Core", website: "bosch.in", ctc: "18 LPA", tier: "Premium" } });

  // Company HR Users
  await prisma.user.create({ data: { email: "hr@google.com", password, role: "COMPANY", fullName: "Google HR", companyId: google.id } });
  await prisma.user.create({ data: { email: "hr@bosch.com", password, role: "COMPANY", fullName: "Bosch HR", companyId: bosch.id } });

  // Default Assessment for history
  const defaultAssessment = await prisma.assessment.create({
    data: {
      title: "Quarterly Proficiency Exam",
      type: "APTITUDE",
      subject: "General Readiness",
      scheduledAt: new Date(),
      duration: 60,
      createdById: po.id
    }
  });

  // 4. BRANCH-BASED STUDENTS (15 Students with Real Names)
  const studentNames = {
    "Computer Science": ["Rahul Deshmukh", "Priya Sharma", "Amit Patel", "Sneha Kulkarni", "Arjun Reddy"],
    "Electronics": ["Karthik Swamy", "Ishani Gupta", "Vikram Singh", "Meera Nair", "Siddharth Rao"],
    "Mechanical": ["Sanjay Verma", "Ananya Iyer", "Rohan Mehta", "Kavita Joshi", "Deepak Pandey"]
  };

  const branches = [
    { name: "Computer Science", code: "CS", coreLabel: "Coding" },
    { name: "Electronics", code: "EC", coreLabel: "VLSI/Embedded" },
    { name: "Mechanical", code: "ME", coreLabel: "CAD/Thermal" }
  ];

  for (const branch of branches) {
    console.log(`🎓 Seeding ${branch.name} students with real names...`);
    const names = studentNames[branch.name];
    
    for (let i = 0; i < names.length; i++) {
      const fullName = names[i];
      const firstName = fullName.split(' ')[0];
      const lastName = fullName.split(' ')[1];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.com`;
      
      const user = await prisma.user.create({
        data: { 
          email, 
          password, 
          role: "STUDENT", 
          fullName, 
          name: firstName, 
          usn: `1II21${branch.code}0${String(i + 1).padStart(2, '0')}`, 
          department: branch.name, 
          collegeName 
        }
      });

      // Tailor skills based on branch
      const aptitude = 70 + Math.random() * 20;
      const core = 75 + Math.random() * 20;
      const soft = 80 + Math.random() * 10;

      await prisma.studentProfile.create({
        data: {
          userId: user.id,
          readinessScore: (aptitude + core + soft) / 3,
          cgpa: 7.5 + Math.random() * 2,
          branch: branch.name,
          aptitudeScore: aptitude,
          codingScore: branch.code === "CS" ? core : 40 + Math.random() * 20,
          coreScore: core,
          softSkillsScore: soft,
          placementStatus: i === 1 ? "PLACED" : "UNPLACED"
        }
      });

      // 6-Month Historical Graph Points (12 attempts)
      for (let j = 0; j < 12; j++) {
        await prisma.assessmentAttempt.create({
          data: {
            userId: user.id,
            assessmentId: defaultAssessment.id,
            score: 45 + (j * 4) + Math.random() * 5,
            correctCount: 10 + j,
            totalCount: 25,
            timeTaken: 1200,
            answers: {},
            createdAt: new Date(Date.now() - (12 - j) * 15 * 24 * 60 * 60 * 1000)
          }
        });
      }

      // Add a completed AI Interview for each
      await prisma.mockInterview.create({
        data: {
          title: `${branch.coreLabel} Mock Interview`,
          type: "AI",
          mode: branch.code === "CS" ? "TECHNICAL" : "TECHNICAL",
          status: "COMPLETED",
          studentId: user.id,
          overallScore: 82,
          feedback: `Great understanding of ${branch.coreLabel} fundamentals.`,
          analysis: { technical: 85, communication: 80, confidence: 90, problemSolving: 80 },
          messages: { create: [{ senderRole: "AI", senderName: "AI", text: `Describe your experience with ${branch.coreLabel}.` }] }
        }
      });
    }
  }

  // 5. PLACEMENT DRIVES (Connecting some students)
  const activeDrive = await prisma.placementDrive.create({
    data: {
      title: "Google SDE Hiring 2024",
      description: "Hiring for SDE-1 roles in Bangalore.",
      date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      location: "Main Auditorium",
      role: "SDE-1",
      salary: "45 LPA",
      companyId: google.id,
      status: "ACTIVE"
    }
  });

  console.log("✅ ULTIMATE SEED V2 COMPLETE!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
