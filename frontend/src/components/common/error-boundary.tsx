import { Component, ErrorInfo, ReactNode } from "react";
import { Button, Card, Container, Text, Title } from "@mantine/core";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught rendering error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Container
          size="sm"
          className="min-h-screen flex items-center justify-center p-6"
        >
          <Card
            shadow="md"
            padding="lg"
            radius="md"
            withBorder
            className="text-center w-full max-w-md bg-white"
          >
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-full">
                <AlertTriangle size={36} />
              </div>
            </div>
            <Title order={2} className="text-xl font-bold mb-2 text-gray-900">
              Something went wrong
            </Title>
            <Text color="dimmed" size="sm" className="mb-6">
              {this.state.error?.message ||
                "An unexpected rendering error occurred."}
            </Text>
            <Button
              onClick={this.handleReset}
              color="orange"
              fullWidth
              leftSection={<RefreshCw size={16} />}
            >
              Return to Home
            </Button>
          </Card>
        </Container>
      );
    }

    return this.props.children;
  }
}
