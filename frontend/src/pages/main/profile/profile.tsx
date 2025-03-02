import { Loader, Card, Text, Title, Button, Avatar } from "@mantine/core";
import { useGetUser } from "../../../hooks/user";

const Profile = () => {
  const { data: user, isLoading } = useGetUser();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-pink-50 to-pink-100">
        <Loader size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-pink-50 to-pink-100">
        <Text size="xl" color="dimmed">
          No user data found.
        </Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-pink-100 p-6">
      <Card
        shadow="xl"
        radius="md"
        withBorder
        className="max-w-sm w-full bg-white px-6 py-8 relative"
      >
        {/* Avatar or user icon at the top */}
        <div className="flex items-center justify-center mb-4">
          <Avatar
            src={undefined} // if you have a user avatar URL, put it here
            alt="User Profile Picture"
            radius="xl"
            size="lg"
            className="shadow"
          />
        </div>

        {/* Title */}
        <Title order={2} className="mb-4 text-center">
          My Profile
        </Title>

        <div className="space-y-2 text-center">
          <Text>
            <span className="font-semibold">Name:</span> {user.fname}{" "}
            {user.lname}
          </Text>
          <Text>
            <span className="font-semibold">Email:</span> {user.email}
          </Text>

          <Text>
            <span className="font-semibold">Joined on:</span>{" "}
            {new Date(user.createdAt).toLocaleDateString()}
          </Text>
        </div>

        <Button
          className="mt-6"
          color="red"
          fullWidth
          radius="md"
          // onClick={() => {/* open a modal or navigate to edit profile */}}
        >
          Edit Profile
        </Button>
      </Card>
    </div>
  );
};

export default Profile;
