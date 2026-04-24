import { prisma } from "./src/config/db.js";
import { hashPassword } from "./src/utils/hash.js";

async function main() {
  console.log("🚀 Starting Master Data Seed (Full 6-Month Timeline)...");

  // 0. CLEAR EXISTING DATA
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
  } catch (err) {
    console.log("⚠️ Cleanup warning:", err.message);
  }

  const password = await hashPassword("password123");
  const collegeName = "Indian Institute of Placement & Excellence (IIPE)";

  // 1. Placement Officer
  const po = await prisma.user.upsert({
    where: { email: "po@iipe.edu.in" },
    update: { collegeName },
    create: {
      email: "po@iipe.edu.in",
      password,
      role: "PLACEMENT",
      fullName: "Dr. Rajesh K. Varma",
      name: "Rajesh",
      collegeName,
    }
  });

  // 2. Companies
  const companies = [
    { name: "TATA Consultancy Services (TCS)", website: "tcs.com", industry: "IT Services", ctc: "12 LPA", minCgpa: 7.5, minReadiness: 65.0, tier: "Service" },
    { name: "Infosys Limited", website: "infosys.com", industry: "IT Consulting", ctc: "10 LPA", minCgpa: 7.0, minReadiness: 60.0, tier: "Service" },
    { name: "Reliance Industries", website: "ril.com", industry: "Conglomerate", ctc: "18 LPA", minCgpa: 8.0, minReadiness: 75.0, tier: "Premium" },
    { name: "Wipro Technologies", website: "wipro.com", industry: "IT Services", ctc: "9.5 LPA", minCgpa: 7.0, minReadiness: 60.0, tier: "Service" },
    { name: "Zomato", website: "zomato.com", industry: "Product / FoodTech", ctc: "24 LPA", minCgpa: 8.5, minReadiness: 80.0, tier: "Product" },
    { name: "Google India", website: "google.com", industry: "Product", ctc: "32 LPA", minCgpa: 8.5, minReadiness: 85.0, tier: "Product" },
    { name: "Microsoft", website: "microsoft.com", industry: "Product", ctc: "28 LPA", minCgpa: 8.0, minReadiness: 80.0, tier: "Product" }
  ];

  const companyMap = {};
  for (const c of companies) {
    const created = await prisma.company.create({ data: c });
    companyMap[c.name] = created.id;
  }

  // 3. Recruiters
  const recruiters = [
    { email: "recruiter@tcs.com", fullName: "N. Chandrasekaran", companyId: companyMap["TATA Consultancy Services (TCS)"] },
    { email: "hr@infosys.com", fullName: "Salil Parekh", companyId: companyMap["Infosys Limited"] },
    { email: "talent@zomato.com", fullName: "Deepinder Goyal", companyId: companyMap["Zomato"] }
  ];

  for (const r of recruiters) {
    await prisma.user.create({
      data: {
        email: r.email,
        password,
        role: "COMPANY",
        fullName: r.fullName,
        name: r.fullName.split(".")[0].split(" ")[0],
        companyId: r.companyId
      }
    });
  }

  // 4. Students
  const branches = ["CSE-A", "CSE-B", "ECE", "ISE"];
  const studentNames = [
    "Rahul Deshmukh", "Priya Iyer", "Ananya Singh", "Arjun Reddy", 
    "Siddharth Rao", "Ishani Gupta", "Vikram Malhotra", "Meera Nair", 
    "Karthik Swamy", "Sneha Kulkarni", "Aditya Chatterjee", "Zoya Khan",
    "Rohan Gupta", "Tanya Sen", "Varun Mehta", "Deepak Kumar", 
    "Sushmita Roy", "Abhishek Jain", "Pooja Hegde", "Manoj Tiwari",
    "Kiran Rao", "Nidhi Agarwal", "Sandeep Varma", "Kavya Madhavan"
  ];

  const students = [];
  for (let i = 0; i < studentNames.length; i++) {
    const name = studentNames[i];
    const email = `${name.toLowerCase().replace(" ", ".")}@gmail.com`;
    const usn = `1RV21${branches[i % 4].slice(0, 3).replace("-","")}${String(100 + i).padStart(3, "0")}`;

    const user = await prisma.user.create({
      data: {
        email,
        password,
        role: "STUDENT",
        fullName: name,
        name: name.split(" ")[0],
        usn,
        collegeName
      }
    });

    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        id: usn,
        branch: branches[i % 4],
        cgpa: parseFloat((7.0 + Math.random() * 2.5).toFixed(2)),
        readinessScore: 0, 
        placementStatus: i < 6 ? "PLACED" : "UNPLACED",
        aptitudeScore: 0,
        coreScore: 0,
        softSkillsScore: 0
      }
    });
    students.push(user);
  }

  // 5. Historical Assessment Attempts (6 Months)
  console.log("📊 Seeding 6 months of assessment trends...");
  const assessmentTypes = ["APTITUDE", "CORE", "SOFT_SKILLS"];
  const now = new Date();
  
  for (const type of assessmentTypes) {
    const assessment = await prisma.assessment.create({
      data: {
        title: `${type} Mastery Test`,
        type: type,
        subject: type === "CORE" ? "Computer Science" : "General",
        scheduledAt: now,
        duration: 60,
        createdById: po.id
      }
    });

    for (const student of students) {
      let finalScore = 0;
      for (let m = 0; m < 6; m++) {
        const attemptDate = new Date(now);
        attemptDate.setMonth(now.getMonth() - (5 - m));
        const score = Math.min(100, 45 + (m * 7) + (Math.random() * 15));
        
        await prisma.assessmentAttempt.create({
          data: {
            userId: student.id,
            assessmentId: assessment.id,
            score: score,
            correctCount: Math.floor(score/2),
            totalCount: 50,
            timeTaken: 1800,
            createdAt: attemptDate,
            answers: { mock: true }
          }
        });
        finalScore = score;
      }
      
      const updateData = {};
      if (type === "APTITUDE") updateData.aptitudeScore = finalScore;
      if (type === "CORE") updateData.coreScore = finalScore;
      if (type === "SOFT_SKILLS") updateData.softSkillsScore = finalScore;
      
      await prisma.studentProfile.update({
        where: { userId: student.id },
        data: updateData
      });
    }
  }

  // Update final readiness
  for (const student of students) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: student.id } });
    const readiness = (profile.aptitudeScore + profile.coreScore + profile.softSkillsScore) / 3;
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { readinessScore: Math.round(readiness) }
    });
  }

  // 6. Recruitment History (6 Months)
  console.log("🏢 Seeding 6 months of recruitment history...");
  const driveNames = [
    { title: "TCS Ninja 2025", company: "TATA Consultancy Services (TCS)", month: 5 },
    { title: "Infosys Certification", company: "Infosys Limited", month: 4 },
    { title: "Zomato Ninja", company: "Zomato", month: 3 },
    { title: "Reliance JIO", company: "Reliance Industries", month: 2 },
    { title: "Microsoft Intern", company: "Microsoft", month: 1 },
    { title: "Google STEP", company: "Google India", month: 0 }
  ];

  for (const d of driveNames) {
    const driveDate = new Date(now);
    driveDate.setMonth(now.getMonth() - d.month);
    
    await prisma.placementDrive.create({
      data: {
        title: d.title,
        role: "Software Engineer",
        salary: "15 LPA",
        status: d.month === 0 ? "ACTIVE" : "COMPLETED",
        companyId: companyMap[d.company],
        createdAt: driveDate,
        date: driveDate,
        students: {
          connect: students.filter((_, idx) => (idx + d.month) % 4 === 0).map(s => ({ id: s.id }))
        }
      }
    });
  }

  console.log("\n✨ Master Data Seeding Complete!");
  console.log("   Timeline: 6 Months");
  console.log("   Drives: 6");
  console.log("   Student Attempts: 18 per student");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
