import { faker } from "@faker-js/faker";
import userService from "../features/users/user.service";

(async function seedAddress() {
  console.log(`Seeding Addresses...`);

  const users = await userService.getAllUsers();

  for (let i = 0; i < users.length; i++) {
    const userId = users[i].id;

    const existingAddress = await userService.addressExists(userId);

    if (existingAddress) {
      continue;
    }

    await userService.createUserAddress({
      userId,
      city: faker.location.city(),
      street: faker.location.streetAddress(),
      state: faker.location.state(),
      pincode: faker.location.zipCode(),
      phone: faker.phone.number(),
      type: "Home",
    });
  }

  console.log("Seeding completed!");
  process.exit(0);
})();
