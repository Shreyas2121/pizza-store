import { Button, Container, Text, Title } from "@mantine/core";
import { Compass, Home } from "lucide-react";
import { Link } from "react-router";

export const NotFound = () => {
  return (
    <Container className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="p-4 bg-brand-soft text-brand rounded-full mb-4 animate-bounce">
        <Compass size={48} />
      </div>
      <Title className="text-4xl font-display text-ink mb-2">
        404 - Page Not Found
      </Title>
      <Text c="dimmed" className="max-w-md mb-6">
        Oops! The page you are looking for doesn't exist or has been moved.
      </Text>
      <Link to="/">
        <Button color="brand" leftSection={<Home size={18} />}>
          Back to Home
        </Button>
      </Link>
    </Container>
  );
};

export default NotFound;
