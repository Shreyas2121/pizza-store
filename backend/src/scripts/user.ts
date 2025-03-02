import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import userService from "../features/users/user.service";

(async function seedUsers() {
  const countArg = process.argv[2];
  const NUM_USERS = parseInt(countArg, 10) || 10;

  console.log(`Seeding ${NUM_USERS} fake users...`);

  for (let i = 0; i < NUM_USERS; i++) {
    const plainTextPassword = "1234";
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    await userService.createUser({
      email: faker.internet.email(),
      password: hashedPassword,
      fname: faker.person.firstName(),
      lname: faker.person.lastName(),
      role: "user",
    });
  }

  console.log("Seeding completed!");
  process.exit(0);
})();
