import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";
import { BookingDetail } from "~/components/BookingDetail";

export const useBlId = routeLoader$(({ params }) => {
  return Number(params.id) || 0;
});

export default component$(() => {
  const id = useBlId().value;
  return <BookingDetail module="bl" id={id} />;
});

export const head: DocumentHead = {
  title: "提单详情 - 订舱管理系统",
};
