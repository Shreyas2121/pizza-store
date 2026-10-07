import axios from "axios";
import { useParams } from "react-router";
import { Alert, Badge, Button, Card, Loader, Stack, Text, Title } from "@mantine/core";
import { formatStoreHours } from "@/shared/lib";
import { useStoreBySlug } from "../api/store.queries";
import { useStoreStore } from "../model/store.store";
import { isStoreOpen } from "../model/store-hours";

export default function StoreDetailsPage() {
  const { slug = "" } = useParams();
  const query = useStoreBySlug(slug);
  const openPincodeModal = useStoreStore((state) => state.openPincodeModal);
  if (query.isLoading) return <div className="mx-auto max-w-3xl p-6"><Loader aria-label="Loading store" /></div>;
  if (query.isError || !query.data) {
    const missing = axios.isAxiosError(query.error) && query.error.response?.status === 404;
    return <div className="mx-auto max-w-3xl p-6"><Alert color="red" title={missing ? "Store not found" : "Store details unavailable"}>{missing ? "This store link could not be found." : "Please try again."}{!missing && <Button variant="subtle" onClick={() => query.refetch()}>Retry</Button>}</Alert></div>;
  }
  const store = query.data;
  return <div className="mx-auto max-w-3xl px-4 py-10"><Card withBorder radius="lg" p="xl"><Stack>
    <Text size="sm" c="dimmed">Our stores</Text><Title order={1}>{store.name}</Title>
    <Badge color={!store.isActive ? "gray" : isStoreOpen(store.opensAt, store.closesAt) ? "green" : "orange"}>{!store.isActive ? "Unavailable" : isStoreOpen(store.opensAt, store.closesAt) ? "Open now" : "Closed now"}</Badge>
    <Text>{store.address}</Text><Text>{store.city}, {store.state} · {store.pincode}</Text>
    <Text>Hours: {formatStoreHours(store.opensAt, store.closesAt)} (India time)</Text>
    <Text>Phone: {store.phone}</Text>{store.email && <Text>Email: {store.email}</Text>}
    {store.isActive ? <><Text size="sm" c="dimmed">Enter your delivery pincode to find the store serving your address.</Text><Button onClick={openPincodeModal}>Check delivery availability</Button></> : <Alert color="gray">This store is currently unavailable for orders.</Alert>}
  </Stack></Card></div>;
}
