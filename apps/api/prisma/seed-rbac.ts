import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { name: 'company.create', description: 'Create a company' },
  { name: 'company.update', description: 'Update a company' },
  { name: 'company.delete', description: 'Delete a company (ADMIN only)' },
  { name: 'application.create', description: 'Create a job application' },
  { name: 'application.update', description: 'Update a job application' },
  { name: 'application.delete', description: 'Delete a job application' },
  { name: 'attachment.upload', description: 'Upload an attachment' },
  { name: 'attachment.delete', description: 'Delete an attachment' },
  { name: 'dashboard.read', description: 'Read dashboard metrics' },
  { name: 'audit.read', description: 'Read audit logs (ADMIN only)' },
  { name: 'auth.manage', description: 'Manage authentication (ADMIN only)' },
];

const ADMIN_PERMISSIONS = PERMISSIONS.map((p) => p.name);
const USER_PERMISSIONS = [
  'company.create',
  'company.update',
  'application.create',
  'application.update',
  'application.delete',
  'attachment.upload',
  'attachment.delete',
  'dashboard.read',
];

async function main() {
  console.log('🌱 Seeding RBAC roles and permissions...');

  // Upsert permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: perm,
    });
  }
  console.log(`✅ ${PERMISSIONS.length} permissions seeded`);

  // Upsert roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: { description: 'Full access administrator' },
    create: { name: 'ADMIN', description: 'Full access administrator' },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: { description: 'Standard authenticated user' },
    create: { name: 'USER', description: 'Standard authenticated user' },
  });

  console.log('✅ Roles ADMIN and USER seeded');

  // Assign permissions to ADMIN
  for (const permName of ADMIN_PERMISSIONS) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { name: permName } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }
  console.log(`✅ ADMIN assigned ${ADMIN_PERMISSIONS.length} permissions`);

  // Assign permissions to USER
  for (const permName of USER_PERMISSIONS) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { name: permName } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: userRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: userRole.id, permissionId: permission.id },
    });
  }
  console.log(`✅ USER assigned ${USER_PERMISSIONS.length} permissions`);

  console.log('🎉 RBAC seed completed successfully');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
