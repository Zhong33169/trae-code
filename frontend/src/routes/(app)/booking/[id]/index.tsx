import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";
import { BookingDetail } from "~/components/BookingDetail";

export const useBookingId = routeLoader$(({ params }) => {
  return Number(params.id) || 0;
});

export default component$(() => {
  const id = useBookingId().value;
  return <BookingDetail module="booking" id={id} />;
});

export const head: DocumentHead = {
  title: "订舱详情 - 订舱管理系统",
};
