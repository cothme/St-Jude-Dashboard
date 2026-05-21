import { PrismaClient, Role } from "@prisma/client";
import { auth } from "../src/auth.js";

const prisma = new PrismaClient();

async function createDemoUser(name: string, email: string, role: Role, linkedEmployeeId?: number) {
  await prisma.user.deleteMany({ where: { email } });
  await auth.api.signUpEmail({
    body: {
      name,
      email,
      password: "Password123!",
    },
  });
  await prisma.user.update({
    where: { email },
    data: { role, linkedEmployeeId, emailVerified: true },
  });
}

async function main() {
  const doctor = await prisma.employee.upsert({
    where: { employeeCode: "SJ-001" },
    update: {},
    create: {
      employeeCode: "SJ-001",
      firstName: "Miguel",
      lastName: "Cruz",
      position: "Psychiatrist",
      department: "Clinical",
      email: "mcruz@stjude.local",
      phone: "0917 222 0101",
      hireDate: new Date("2022-01-10"),
      baseSalary: 68000,
      workDaysPerWeek: 5,
    },
  });

  await prisma.employee.upsert({
    where: { employeeCode: "SJ-002" },
    update: {},
    create: {
      employeeCode: "SJ-002",
      firstName: "Lena",
      lastName: "Dizon",
      position: "Nurse",
      department: "Custodial Care",
      email: "ldizon@stjude.local",
      phone: "0917 222 0102",
      hireDate: new Date("2021-09-18"),
      baseSalary: 34000,
      workDaysPerWeek: 6,
    },
  });

  const staff = await prisma.employee.upsert({
    where: { employeeCode: "SJ-003" },
    update: {},
    create: {
      employeeCode: "SJ-003",
      firstName: "Ana",
      lastName: "Reyes",
      position: "Care Staff",
      department: "Administration",
      email: "areyes@stjude.local",
      phone: "0917 222 0103",
      hireDate: new Date("2023-04-03"),
      baseSalary: 28000,
      workDaysPerWeek: 6,
    },
  });

  await createDemoUser("Maria Santos", "admin@stjude.local", Role.SUPER_ADMIN);
  await createDemoUser("Ana Reyes", "staff@stjude.local", Role.STAFF, staff.id);
  await createDemoUser("Dr. Miguel Cruz", "doctor@stjude.local", Role.DOCTOR, doctor.id);

  await prisma.patient.upsert({
    where: { id: 1 },
    update: {},
    create: {
      firstName: "Ramon",
      lastName: "Villanueva",
      dateOfBirth: new Date("1978-08-12"),
      sex: "MALE",
      civilStatus: "SINGLE",
      nationality: "Filipino",
      address: "Quezon City",
      contactNumber: "0918 100 8801",
      emergencyContactName: "Elena Villanueva",
      emergencyContactNumber: "0918 100 8802",
      attendingDoctorId: doctor.id,
      status: "STABLE",
      ward: "A-102",
      admissionDate: new Date("2025-12-04"),
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
