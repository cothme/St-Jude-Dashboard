import { PrismaClient, Role } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

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

  await prisma.user.upsert({
    where: { email: "admin@stjude.local" },
    update: { role: Role.SUPER_ADMIN },
    create: {
      id: randomUUID(),
      name: "Maria Santos",
      email: "admin@stjude.local",
      emailVerified: true,
      role: Role.SUPER_ADMIN,
    },
  });

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
